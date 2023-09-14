@group(0) @binding(0) var myTexture: texture_2d<f32>;

struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) fragUV : vec2<f32>
};

@fragment
fn main(data: VertexOutput) -> @location(0) vec4<f32> {
    var d: vec2<f32> = vec2<f32>(textureDimensions(myTexture, 0));
    let c = textureLoad(myTexture, vec2<i32>(data.fragUV*d), 0).rgb;
    var fragColor = vec4<f32>(pow( clamp(c, vec3<f32>(0.), vec3<f32>(1.)), vec3<f32>(1. / 2.2)), 1.);
    return fragColor;
}
