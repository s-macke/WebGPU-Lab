// ACES tonemapper
fn ACES(x: vec3f) -> vec3f {
    let a = 2.51;
    let b =  .03;
    let c = 2.43;
    let d =  .59;
    let e =  .14;
    return (x * (a * x + b)) / (x * (c * x + d) + e);
}

@group(0) @binding(0) var myTexture: texture_2d<f32>;

struct VertexOutput {
  @builtin(position) Position : vec4f,
  @location(0) fragUV : vec2f
};

@fragment
fn main(data: VertexOutput) -> @location(0) vec4f {
    var d: vec2f = vec2f(textureDimensions(myTexture, 0));
    let c = textureLoad(myTexture, vec2i(data.fragUV*d), 0).rgb;
    var fragColor = vec4f(pow( clamp(c, vec3f(0.), vec3f(1.)), vec3f(1. / 2.2)), 1.);
    return fragColor;
}
