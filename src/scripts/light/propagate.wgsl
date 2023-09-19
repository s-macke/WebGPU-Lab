struct StagingBuffer {
    iMouse: vec2f,
    wheel: f32,
    iFrame: f32
};

@group(0) @binding(0) var img_input : texture_2d_array<f32>;
@group(0) @binding(1) var img_output : texture_storage_2d_array<rgba32float, write>;
@group(0) @binding(2) var<uniform> staging: StagingBuffer;

fn occluder(p: vec2i, sd: ptr<function, SD>) -> vec3f {
    let uv: vec2f = pixel2uv(p);
    *sd = map(uv);
    let d: f32 = (*sd).d / pixel_radius;
    if (d > 1.0) {
        return vec3f(0.0);
    }
    let n: vec2f = normal_map(uv, pixel_radius);
    // orthodox: solid angle goes from 100% to 50%, then drops
    // to 0% when the point is inside the surface
    //float opacity = step(0.0,d)*(d*0.5+0.5);
    // benevolent: no discontinuity, 50% visibility on the surface
    let opacity: f32 = max(0.0, (d*0.5+0.5));
    // smooth: no discontinuity, sine curve
    //let opacity: f32 = sin(max(-1.0,d)*pi*0.5)*0.5+0.5;
    return light(-n, opacity * 2.0 * pi) * CH_Basis;
}

// propagate light from neighbor to this pixel
// p: pixel of neighbor in screen space
// n: normal of neighbor
// sa: solid angle of neighbor
// sd: signed distance to neighbor
// colorChannel: which color channel to propagate
// img_input: input image
fn propagate(p: vec2i, n: vec2f, sa: f32, sd: SD,
    outchr: ptr<function, vec3f>,
    outchg: ptr<function, vec3f>,
    outchb: ptr<function, vec3f>) {

    let R = vec2i(resolution.xy);

    // check if neighbor is out of bounds. if so, return black
    if ((p.x < 0) || (p.y < 0) || (p.x >= R.x) || (p.y >= R.y)) {
        return;
    }

    // check if neighbor is occluded. if so, return black
    if (sd.d < -pixel_radius) {
        return;
    }

    // get occluder of neighbor
    var occ_sd: SD;
    var occ: vec3<f32> = occluder(p, &occ_sd);

    let Fr: vec3f = textureLoad(img_input, p, 0, 0).xyz; // incoming red light from neighbor as circular harmonics
    let Fg: vec3f = textureLoad(img_input, p, 1, 0).xyz; // incoming green light from neighbor as circular harmonics
    let Fb: vec3f = textureLoad(img_input, p, 2, 0).xyz; // incoming blue light from neighbor as circular harmonics

    let dV = vec3f(n, 1.) * CH_Basis;

    // light hitting our interior cell wall
    let L = max(vec3f(0.0), vec3f(
        dot(Fr, dV * sa),
        dot(Fg, dV * sa),
        dot(Fb, dV * sa)));

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
        if (abs(occ_sd.d) <= pixel_radius) {
            ref2 = sd.albedo * E;
        }
    } else {
        ref2 = O * L * sd.albedo;
    }
    // add emission
    *outchr += chr + ref2.r * dRV;
    *outchg += chg + ref2.g * dRV;
    *outchb += chb + ref2.b * dRV;
}

fn solid_angle(a: vec2f, b: vec2f) -> f32 {
    return acos(dot(normalize(a), normalize(b)));
}

fn lpv_kernel(fragCoord: vec2i,
    outchr: ptr<function, vec3f>,
    outchg: ptr<function, vec3f>,
    outchb: ptr<function, vec3f>) {

    let p: vec2i = fragCoord;
    var sd: SD = map(pixel2uv(p));

    //#define PROPAGATE(OFS, N, SA)  propagate(channel, p + OFS, N, SA, sd, ch)
    let d: i32 = 1;
    let x: f32 = 2.0;
    let sa1: f32 = solid_angle(vec2f(x,    -1.0), vec2<f32>(x, 1.0)); // ~53.13°, projecting to the right side of our pixel
    let sa2: f32 = solid_angle(vec2f(x-1.0, 1.0), vec2<f32>(x, 1.0)); // ~18.43°, projecting to the top/bottom side of our pixel
    // note that sa2 = (90° - sa1) / 2
    let dn1: vec2f = normalize(vec2f(x - 0.5,  1.0)); // normal to the center of the top side of our pixel
    let dn0: vec2f = normalize(vec2f(x - 0.5, -1.0)); // normal to the center of the bottom side of our pixel

    var chr: vec3f;
    var chg: vec3f;
    var chb: vec3f;
    propagate(p+vec2i(-1, 0), vec2f(1., 0.),  sa1, sd, &chr, &chg, &chb);
    propagate(p+vec2i(-1, 0), dn1,            sa2, sd, &chr, &chg, &chb);
    propagate(p+vec2i(-1, 0), dn0,            sa2, sd, &chr, &chg, &chb);

    propagate(p+vec2i( 1, 0), vec2f(-1., 0.), sa1, sd, &chr, &chg, &chb);
    propagate(p+vec2i( 1, 0), -dn0,           sa2, sd, &chr, &chg, &chb);
    propagate(p+vec2i( 1, 0), -dn1,           sa2, sd, &chr, &chg, &chb);

    propagate(p+vec2i(0, -1), vec2f(0., 1.),  sa1, sd, &chr, &chg, &chb);
    propagate(p+vec2i(0, -1), dn1.yx,         sa2, sd, &chr, &chg, &chb);
    propagate(p+vec2i(0, -1), dn0.yx,         sa2, sd, &chr, &chg, &chb);

    propagate(p+vec2i(0,  1), vec2f(0., -1.), sa1, sd, &chr, &chg, &chb);
    propagate(p+vec2i(0,  1), -dn1.yx,        sa2, sd, &chr, &chg, &chb);
    propagate(p+vec2i(0,  1), -dn0.yx,        sa2, sd, &chr, &chg, &chb);

    *outchr = chr;
    *outchg = chg;
    *outchb = chb;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let iResolution: vec2f = vec2f(textureDimensions(img_input, 0));

    mouse_pos = ((staging.iMouse.xy / iResolution.xy)*2.0 - 1.0) * vec2(iResolution.x/iResolution.y, 1.0);
    mouse_wheel = staging.wheel;

    set_resolution(iResolution.xy);

    var chr = vec3f(0.);
    var chg = vec3f(0.);
    var chb = vec3f(0.);

    lpv_kernel(vec2i(global_id.xy), &chr, &chg, &chb);
    textureStore(img_output, vec2i(global_id.xy), 0, vec4f(chr, 0.));
    textureStore(img_output, vec2i(global_id.xy), 1, vec4f(chg, 0.));
    textureStore(img_output, vec2i(global_id.xy), 2, vec4f(chb, 0.));
}


