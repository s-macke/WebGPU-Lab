#include "common.wgsl"

// ACES tonemapper
fn ACES(x: vec3f) -> vec3f {
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

fn RRTAndODTFit(v: vec3f) -> vec3f {
    let a: vec3f = v * (v + 0.0245786) - 0.000090537;
    let b: vec3f = v * (0.983729 * v + 0.4329510) + 0.238081;
    return a / b;
}

fn ACESFitted(_color: vec3f) -> vec3f {
    var color: vec3f = _color * ACESInputMat;

    // Apply RRT and ODT
    color = RRTAndODTFit(color);

    color = color * ACESOutputMat;

    // Clamp to [0, 1]
    color = clamp(color, vec3f(0.0), vec3f(1.0));

    return color;
}
//---------------------------------------------------------------------------------


struct ColorCH {
    r: vec3f,
    g: vec3f,
    b: vec3f
};

//---------------------------------------------------------------------------------

fn linear_srgb(x: f32) -> f32 {
    return mix(1.055*pow(x, 1./2.4) - 0.055, 12.92*x, step(x,0.0031308));
}

fn linear_srgb_vec(x: vec3f) ->  vec3f {
    return mix(1.055*pow(x, vec3f(1./2.4)) - 0.055, 12.92*x, step(x,vec3f(0.0031308)));
}

fn srgb_linear(x: f32) -> f32 {
    return mix(pow((x + 0.055)/1.055,2.4), x / 12.92, step(x,0.04045));
}

fn srgb_linear_vec(x: vec3f) -> vec3f {
    return mix(pow((x + 0.055)/1.055,vec3f(2.4)), x / 12.92, step(x,vec3f(0.04045)));
}

@group(0) @binding(0) var texture: texture_2d_array<f32>;
@group(0) @binding(1) var scene: texture_2d_array<f32>;

struct VertexOutput {
  @builtin(position) Position : vec4f,
  @location(0) fragUV : vec2f
};

@fragment
fn main(data: VertexOutput) -> @location(0) vec4f {
    var iResolution = vec2f(textureDimensions(texture, 0));
    let p = vec2i(data.fragUV*iResolution);

    let ch = ColorCH(
        textureLoad(texture, p, 0, 0).xyz, // emitted red light as circular harmonics
        textureLoad(texture, p, 1, 0).xyz, // emitted green light as circular harmonics
        textureLoad(texture, p, 2, 0).xyz, // emitted blue light as circular harmonics
    );

    let col  = vec3<f32>(ch.r.z, ch.g.z, ch.b.z)*CH_Basis.z;
    let fragColor = vec4f(linear_srgb_vec(ACESFitted(max(col, vec3f(0.0)))), 1.0);

    //let c = textureLoad(myTexture, vec2<i32>(data.fragUV*d), 0).rgb;
    //var fragColor = vec4f(pow( clamp(c, vec3<f32>(0.), vec3<f32>(1.)), vec3<f32>(1. / 2.2)), 1.);
    //let fragColor = vec4f(ACES(sd.albedo), 1.0);
    return fragColor;
//    return textureLoad(texture_signed_distance, vec2<i32>(data.fragUV*iResolution), 0).rgba;
}
