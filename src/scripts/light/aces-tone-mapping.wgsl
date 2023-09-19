// ACES tonemapper
fn ACES(x: vec3<f32>) -> vec3<f32> {
    const a: f32 = 2.51;
    const b: f32 =  .03;
    const c: f32 = 2.43;
    const d: f32 =  .59;
    const e: f32 =  .14;
    return (x * (a * x + b)) / (x * (c * x + d) + e);
}

// ACES fitted
// from https://github.com/TheRealMJP/BakingLab/blob/master/BakingLab/ACES.hlsl

const ACESInputMat = mat3x3f(
0.59719, 0.35458, 0.04823,
0.07600, 0.90834, 0.01566,
0.02840, 0.13383, 0.83777
);

// ODT_SAT => XYZ => D60_2_D65 => sRGB
const ACESOutputMat = mat3x3f(
1.60475, -0.53108, -0.07367,
-0.10208,  1.10813, -0.00605,
-0.00327, -0.07276,  1.07602
);

fn RRTAndODTFit(v: vec3<f32>) -> vec3<f32> {
    let a: vec3<f32> = v * (v + 0.0245786) - 0.000090537;
    let b: vec3<f32> = v * (0.983729 * v + 0.4329510) + 0.238081;
    return a / b;
}

fn ACESFitted(_color: vec3<f32>) -> vec3<f32> {
    var color: vec3<f32> = _color * ACESInputMat;

    // Apply RRT and ODT
    color = RRTAndODTFit(color);

    color = color * ACESOutputMat;

    // Clamp to [0, 1]
    color = clamp(color, vec3<f32>(0.0), vec3<f32>(1.0));

    return color;
}

//---------------------------------------------------------------------------------

fn linear_srgb(x: f32) -> f32 {
    return mix(1.055*pow(x, 1./2.4) - 0.055, 12.92*x, step(x,0.0031308));
}

fn linear_srgb_vec(x: vec3<f32>) ->  vec3<f32> {
    return mix(1.055*pow(x, vec3(1./2.4)) - 0.055, 12.92*x, step(x,vec3(0.0031308)));
}

fn srgb_linear(x: f32) -> f32 {
    return mix(pow((x + 0.055)/1.055,2.4), x / 12.92, step(x,0.04045));
}

fn srgb_linear_vec(x: vec3<f32>) -> vec3<f32> {
    return mix(pow((x + 0.055)/1.055,vec3(2.4)), x / 12.92, step(x,vec3(0.04045)));
}
/*
struct SD {
    d : f32,
    albedo: vec3<f32>,
    emissive: bool
};
*/

fn shade2(sh: vec3<f32>, dV: vec3<f32>, sd: SD, ch: i32) -> f32 {
    let dZ = vec3<f32>(0., 0., 1.) * CH_Basis;
    let W: f32 = max(0.0, dot(sh, dZ));
    var L: f32 = max(0.0, dot(sh, dV));

    let d: f32 = sd.d / pixel_radius;
    let w: f32 = fwidth(d);
    let b: f32 = clamp(d*0.5+0.5, 0.0, 1.0);

    let albedo: f32 = sd.albedo[ch];

    if (sd.emissive && (abs(d) <= 1.0)) {
        L = albedo;
    } else {
        L *= albedo;
    }
    return mix(L, W, b);
    //return W + L*(1.0 - b);
}

@group(0) @binding(0) var texture: texture_2d_array<f32>;
//@group(0) @binding(1) var texture_signed_distance: texture_2d<f32>;

struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) fragUV : vec2<f32>
};

@fragment
fn main(data: VertexOutput) -> @location(0) vec4<f32> {
    var iResolution: vec2<f32> = vec2<f32>(textureDimensions(texture, 0));

    //setup_mouse_pos();
    set_resolution(iResolution);

    var uv: vec2<f32> = data.fragUV * 2.0 - 1.0;
    uv *= vec2<f32>(iResolution.x/iResolution.y, 1.0);

    //let tuv: vec2<f32> = ((uv * vec2<f32>(iResolution.y/iResolution.x,1.0))*0.5 + 0.5);
    let shr: vec3<f32> = textureLoad(texture, vec2<i32>(data.fragUV*iResolution), 0, 0).xyz;
    let shg: vec3<f32> = textureLoad(texture, vec2<i32>(data.fragUV*iResolution), 1, 0).xyz;
    let shb: vec3<f32> = textureLoad(texture, vec2<i32>(data.fragUV*iResolution), 2, 0).xyz;

    //var dV: vec3<f32> = vec3<f32>(-normal_map(uv, pixel_radius), 1.) * CH_Basis;
    //dV = sh_irradiance_probe(dV);
    var dV: vec3<f32> = lambert(-normal_map(uv, pixel_radius)) * CH_Basis;

    let sd: SD = map(uv);
    //let sd = SD(2.5, vec3<f32>(0.), false);

    let col  = vec3<f32>(
        shade2(shr, dV, sd, 0),
        shade2(shg, dV, sd, 1),
        shade2(shb, dV, sd, 2));

    //let col  = vec3<f32>(shr.z, shg.z, shb.z)*CH_Basis.z;
    let fragColor = vec4(linear_srgb_vec(ACESFitted(max(col, vec3(0.0)))), 1.0);

    //let c = textureLoad(myTexture, vec2<i32>(data.fragUV*d), 0).rgb;
    //var fragColor = vec4<f32>(pow( clamp(c, vec3<f32>(0.), vec3<f32>(1.)), vec3<f32>(1. / 2.2)), 1.);
    //let fragColor = vec4<f32>(ACES(sd.albedo), 1.0);
    //fragColor = vec4<f32>(sd.d, -sd.d, sd.d, 1.0);
    //fragColor = vec4<f32>(shr.r, shr.r, shr.r, 1.0);
    return fragColor;
//    return textureLoad(texture_signed_distance, vec2<i32>(data.fragUV*iResolution), 0).rgba;
}
