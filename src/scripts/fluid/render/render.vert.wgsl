struct VertexOutput {
  [[builtin(position)]] Position : vec4<f32>;
  [[location(0)]] fragUV : vec2<f32>;
};

[[stage(vertex)]]
fn main([[builtin(vertex_index)]] VertexIndex : u32) -> VertexOutput {
  var pos = array<vec2<f32>, 4>(
      vec2<f32>(-1., 1.),
      vec2<f32>(-1., -1.),
      vec2<f32>(1., 1.),
      vec2<f32>(1., -1.)
      );

  var output : VertexOutput;
  output.Position = vec4<f32>(pos[VertexIndex], 0.0, 1.0);
  output.fragUV = vec2<f32>(output.Position.x + 1., output.Position.y + 1.) * 0.5;
  return output;
}

