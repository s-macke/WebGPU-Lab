struct StagingBuffer {
    iMouse: vec2f,
    wheel: f32,
    iFrame: f32
};

@group(0) @binding(0) var img_input : texture_2d_array<f32>;
@group(0) @binding(1) var img_output : texture_storage_2d_array<rgba16float, write>;
@group(0) @binding(2) var<uniform> staging: StagingBuffer;
@group(1) @binding(0) var scene : texture_2d_array<f32>;

fn getMap(p: vec2i) -> SD {
    let data: vec4f = textureLoad(scene, p, 4, 0);
    if ((data.r < 0.) || (data.g < 0.) || (data.b < 0.)) {
        return SD(data.a, -data.rgb, true);
    } else {
        return SD(data.a, data.rgb, false);
    }
}

struct ColorCH {
    r: vec3f,
    g: vec3f,
    b: vec3f
};


// p: pixel of neighbor in screen space
// returns sd: signed distance to surface of the neighbor
// returns circular harmonics
fn occluder(pn: vec2i, occ_sd: SD, n: vec2f) -> vec3f {
    // no occluder if neighbor is too far away
    let d: f32 = occ_sd.d / pixel_radius;
    if (d > 1.0) {
        return vec3f(0.0);
    }

    // orthodox: solid angle goes from 100% to 50%, then drops
    // to 0% when the point is inside the surface
    //let opacity = step(0., d) * (d*0.5+0.5);

    // benevolent: no discontinuity, 50% visibility on the surface
    let opacity: f32 = max(0.0, (d*0.5+0.5));

    // smooth: no discontinuity, sine curve
    //let opacity = sin(max(-1.0,d)*pi*0.5)*0.5+0.5;

    // return direction and solid angle of returned light
    return light(-n, opacity * 2.0 * pi) * CH_Basis;
}

// propagate light from neighbor to this pixel
// p: pixel of neighbor in screen space
// n: normal of neighbor to center
// sa: solid angle of neighbor
// sd: signed distance
fn propagate(n: vec2f, sa: f32,
    sd: SD,
    occ: vec3f, // occluder circular harmonics of neighbor
    F: ColorCH, Em: ColorCH,
    out: ptr<function, ColorCH>) {

    let dV = vec3f(n, 1.) * CH_Basis;

    // light hitting our interior cell wall
    let L = max(vec3f(0.0), vec3f(dot(F.r, dV), dot(F.g, dV), dot(F.b, dV)))*sa;

    // how much of their cell wall is occupied?
    let E: f32 = max(0.0, dot(occ, dV * sa));
    let O: f32 = min(E, 1.0); // do bounce

    // subtract occluder from light
    let chr: vec3f = dV * (L.r * (1.0 - O));
    let chg: vec3f = dV * (L.g * (1.0 - O));
    let chb: vec3f = dV * (L.b * (1.0 - O));

    let dRV = vec3f(-n, 1.) * CH_Basis;

    var ref2 = vec3f(0.0);

    if (sd.emissive) {
    //    if (abs(occ_sd.d) <= pixel_radius) {
    //        ref2 = sd.albedo * E;
    //    }
    } else {
        ref2 = O * L * sd.albedo;
    }

    // add emission
    (*out).r += chr + ref2.r * dRV + (Em.r * dV)*E;
    (*out).g += chg + ref2.g * dRV + (Em.g * dV)*E;
    (*out).b += chb + ref2.b * dRV + (Em.b * dV)*E;
}

fn solid_angle(a: vec2f, b: vec2f) -> f32 {
    return acos(dot(normalize(a), normalize(b)));
}

fn retrieveConstants(pn: vec2i,
    sd: SD,
    F: ptr<function, ColorCH>,
    E: ptr<function, ColorCH>,
    occ: ptr<function, vec3f>
    ) -> bool {

    // check if neighbor is out of bounds. if so, return black
    let R = vec2i(resolution.xy);
    if ((pn.x < 0) || (pn.y < 0) || (pn.x >= R.x) || (pn.y >= R.y)) {
        return false;
    }

    // check if neighbor is occluded. if so, return black
    if (sd.d < -pixel_radius) {
        return false;
    }

    *F = ColorCH(
        textureLoad(img_input, pn, 0, 0).xyz, // incoming red light from neighbor as circular harmonics
        textureLoad(img_input, pn, 1, 0).xyz, // incoming green light from neighbor as circular harmonics
        textureLoad(img_input, pn, 2, 0).xyz, // incoming blue light from neighbor as circular harmonics
    );
    *E = ColorCH(
        textureLoad(scene, pn, 0, 0).xyz, // emitted red light from neighbor as circular harmonics
        textureLoad(scene, pn, 1, 0).xyz, // emitted green light from neighbor as circular harmonics
        textureLoad(scene, pn, 2, 0).xyz, // emitted blue light from neighbor as circular harmonics
    );

    // get occluder circular harmonics of neighbor
    let occ_sd = getMap(pn);
    let occ_n = textureLoad(scene, pn, 3, 0).xy; // normal of surface at neighbor
    *occ = occluder(pn, occ_sd, occ_n);
    return true;
}

fn lpv_kernel(fragCoord: vec2i,
    out: ptr<function, ColorCH>) {
    let p: vec2i = fragCoord;

    let d: i32 = 1;
    let x: f32 = 2.0;
    let sa1: f32 = solid_angle(vec2f(x,      -1.0), vec2<f32>(x, 1.0)); // ~53.13°, projecting to the right side of our pixel
    let sa2: f32 = solid_angle(vec2f(x - 1.0, 1.0), vec2<f32>(x, 1.0)); // ~18.43°, projecting to the top/bottom side of our pixel
    // note that sa2 = (90° - sa1) / 2
    let dn1: vec2f = normalize(vec2f(x - 0.5,  1.0)); // normal to the center of the top side of our pixel
    let dn0: vec2f = normalize(vec2f(x - 0.5, -1.0)); // normal to the center of the bottom side of our pixel

    let sd: SD = getMap(p);
    var pn : vec2i;
    var F : ColorCH;
    var E : ColorCH;
    var occ: vec3f;

    pn = p + vec2i(-1, 0);
    if (retrieveConstants(pn, sd, &F, &E, &occ)) {
        propagate(vec2f(1., 0.),  sa1, sd, occ, F, E, out);
        propagate(dn1,            sa2, sd, occ, F, E, out);
        propagate(dn0,            sa2, sd, occ, F, E, out);
    }

    pn = p + vec2i(1, 0);
    if (retrieveConstants(pn, sd, &F, &E, &occ)) {
        propagate(vec2f(-1., 0.), sa1, sd, occ, F, E, out);
        propagate(-dn0,           sa2, sd, occ, F, E, out);
        propagate(-dn1,           sa2, sd, occ, F, E, out);
    }

    pn = p + vec2i(0, -1);
    if (retrieveConstants(pn, sd, &F, &E, &occ)) {
        propagate(vec2f(0., 1.),  sa1, sd, occ, F, E, out);
        propagate(dn1.yx,         sa2, sd, occ, F, E, out);
        propagate(dn0.yx,         sa2, sd, occ, F, E, out);
    }

    pn = p + vec2i(0, 1);
    if (retrieveConstants(pn, sd, &F, &E, &occ)) {
        propagate(vec2f(0., -1.), sa1, sd, occ, F, E, out);
        propagate(-dn1.yx,        sa2, sd, occ, F, E, out);
        propagate(-dn0.yx,        sa2, sd, occ, F, E, out);
    }
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let iResolution: vec2f = vec2f(textureDimensions(img_input, 0));
    set_resolution(iResolution.xy);

    mouse_pos = ((staging.iMouse.xy / iResolution.xy)*2.0 - 1.0) * vec2f(iResolution.x/iResolution.y, 1.0);
    mouse_wheel = staging.wheel;

    var outch : ColorCH;
    lpv_kernel(vec2i(global_id.xy), &outch);
    /*
    if (global_id.y < 100) {
        chr.z *= 0.97; // absorption
        chg.z *= 0.97; // absorption
        chb.z *= 0.97; // absorption
    }*/

    textureStore(img_output, vec2i(global_id.xy), 0, vec4f(outch.r, 0.));
    textureStore(img_output, vec2i(global_id.xy), 1, vec4f(outch.g, 0.));
    textureStore(img_output, vec2i(global_id.xy), 2, vec4f(outch.b, 0.));
}


