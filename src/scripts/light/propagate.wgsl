struct StagingBuffer {
    iMouse: vec2<f32>,
    wheel: f32,
    iFrame: f32
};

@group(0) @binding(0) var img_inputR: texture_2d<f32>;
@group(0) @binding(1) var img_outputR: texture_storage_2d<rgba32float, write>;
@group(0) @binding(2) var img_inputG: texture_2d<f32>;
@group(0) @binding(3) var img_outputG: texture_storage_2d<rgba32float, write>;
@group(0) @binding(4) var img_inputB: texture_2d<f32>;
@group(0) @binding(5) var img_outputB: texture_storage_2d<rgba32float, write>;
@group(0) @binding(6) var<uniform> staging: StagingBuffer;

fn occluder(p: vec2<i32>, sd: ptr<function, SD>) -> vec3<f32> {
    let uv: vec2<f32> = pixel2uv(p);
    *sd = map(uv);
    let d: f32 = (*sd).d / pixel_radius;
    if (d > 1.0) {
        return vec3<f32>(0.0);
    }
    let n: vec2<f32> = normal_map(uv, pixel_radius);
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
fn propagate(p: vec2<i32>, n: vec2<f32>, sa: f32, sd: SD, colorChannel: i32, img_input: texture_2d<f32>) -> vec3<f32> {
    let R: vec2<i32> = vec2<i32>(resolution.xy);

    // check if neighbor is out of bounds. if so, return black
    if ((p.x < 0) || (p.y < 0) || (p.x >= R.x) || (p.y >= R.y)) {
        return vec3<f32>(0.0);
    }

    // check if neighbor is occluded. if so, return black
    if (sd.d < -pixel_radius) {
        return vec3<f32>(0.0);
    }

    // get occluder of neighbor
    var occ_sd: SD;
    var occ: vec3<f32> = occluder(p, &occ_sd);

    let F: vec3<f32> = textureLoad(img_input, p, 0).xyz; // incoming light from neighbor as circular harmonics
    let dV = vec3<f32>(n, 1.) * CH_Basis;

    // light hitting our interior cell wall
    let L: f32 = max(0.0, dot(F, dV * sa));

    // how much of their cell wall is occupied?
    let E: f32 = max(0.0, dot(occ, dV * sa));
    let O: f32 = min(E, 1.0); // do bounce

    // subtract occluder from light
    var outsh: vec3<f32> = dV * L * (1.0 - O);
    let dRV = vec3<f32>(-n, 1.) * CH_Basis;
    var ref2 = 0.0;

    if (sd.emissive) {
        if (abs(occ_sd.d) <= pixel_radius) {
            ref2 = sd.albedo[colorChannel] * E;
        }
    } else {
        ref2 = O * L * sd.albedo[colorChannel];
    }
    // add emission
    outsh += ref2 * dRV;
    return outsh;
}

fn solid_angle(a: vec2<f32>, b: vec2<f32>) -> f32 {
    return acos(dot(normalize(a), normalize(b)));
}

fn lpv_kernel(fragCoord: vec2<i32>, colorChannel: i32, img_input: texture_2d<f32>) -> vec3<f32> {
    let p: vec2<i32> = fragCoord;
    var sd: SD = map(pixel2uv(p));

    //#define PROPAGATE(OFS, N, SA)  propagate(channel, p + OFS, N, SA, sd, ch)
    let d: i32 = 1;
    let x: f32 = 2.0;
    let sa1: f32 = solid_angle(vec2<f32>(x,    -1.0), vec2<f32>(x, 1.0)); // ~53.13°, projecting to the right side of our pixel
    let sa2: f32 = solid_angle(vec2<f32>(x-1.0, 1.0), vec2<f32>(x, 1.0)); // ~18.43°, projecting to the top/bottom side of our pixel
    // note that sa2 = (90° - sa1) / 2
    let dn1: vec2<f32> = normalize(vec2<f32>(x - 0.5,  1.0)); // normal to the center of the top side of our pixel
    let dn0: vec2<f32> = normalize(vec2<f32>(x - 0.5, -1.0)); // normal to the center of the bottom side of our pixel

    let ch: vec3<f32> =
     propagate(p+vec2<i32>(-1, 0), vec2<f32>(1., 0.),  sa1, sd, colorChannel, img_input)
    +propagate(p+vec2<i32>(-1, 0), dn1,                sa2, sd, colorChannel, img_input)
    +propagate(p+vec2<i32>(-1, 0), dn0,                sa2, sd, colorChannel, img_input)

    +propagate(p+vec2<i32>( 1, 0), vec2<f32>(-1., 0.), sa1, sd, colorChannel, img_input)
    +propagate(p+vec2<i32>( 1, 0), -dn0,               sa2, sd, colorChannel, img_input)
    +propagate(p+vec2<i32>( 1, 0), -dn1,               sa2, sd, colorChannel, img_input)

    +propagate(p+vec2<i32>(0, -1), vec2<f32>(0., 1.),  sa1, sd, colorChannel, img_input)
    +propagate(p+vec2<i32>(0, -1), dn1.yx,             sa2, sd, colorChannel, img_input)
    +propagate(p+vec2<i32>(0, -1), dn0.yx,             sa2, sd, colorChannel, img_input)

    +propagate(p+vec2<i32>(0,  1), vec2<f32>(0., -1.), sa1, sd, colorChannel, img_input)
    +propagate(p+vec2<i32>(0,  1), -dn1.yx,            sa2, sd, colorChannel, img_input)
    +propagate(p+vec2<i32>(0,  1), -dn0.yx,            sa2, sd, colorChannel, img_input);

    return ch;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let iResolution: vec2<f32> = vec2<f32>(textureDimensions(img_inputR, 0));

    mouse_pos = ((staging.iMouse.xy / iResolution.xy)*2.0 - 1.0) * vec2(iResolution.x/iResolution.y, 1.0);
    mouse_wheel = staging.wheel;

    set_resolution(iResolution.xy);

    var ch: vec3<f32>;

    ch = lpv_kernel(vec2<i32>(global_id.xy), 0, img_inputR);
    textureStore(img_outputR, vec2<i32>(global_id.xy), vec4<f32>(ch, 0.));

    ch = lpv_kernel(vec2<i32>(global_id.xy), 1, img_inputG);
    textureStore(img_outputG, vec2<i32>(global_id.xy), vec4<f32>(ch, 0.));

    ch = lpv_kernel(vec2<i32>(global_id.xy), 2, img_inputB);
    textureStore(img_outputB, vec2<i32>(global_id.xy), vec4<f32>(ch, 0.));
}


