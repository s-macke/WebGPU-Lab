@group(0) @binding(0) var pressuresrc: texture_2d<f32>;
@group(0) @binding(1) var pressuredest: texture_storage_2d<r32float, write>;
@group(0) @binding(2) var rhs: texture_2d<f32>;
@group(0) @binding(3) var scaleedges: texture_2d<f32>;
@group(0) @binding(4) var scalecenter: texture_2d<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let pixel_coords = vec2<i32>(global_id.xy) + 1;

    let se = textureLoad(scaleedges, pixel_coords, 0);
    let sc = textureLoad(scalecenter, pixel_coords, 0).r;

    let div = textureLoad(rhs, pixel_coords, 0).r;

    let c = textureLoad(pressuresrc, pixel_coords, 0).r;
    var l = textureLoad(pressuresrc, pixel_coords + vec2<i32>(-1,  0), 0).r;
    var r = textureLoad(pressuresrc, pixel_coords + vec2<i32>( 1,  0), 0).r;
    var t = textureLoad(pressuresrc, pixel_coords + vec2<i32>( 0,  1), 0).r;
    var b = textureLoad(pressuresrc, pixel_coords + vec2<i32>( 0, -1), 0).r;

    var dot = dot(vec4<f32>(l, r, t, b), se);

    var pressure: f32 = (dot + c*sc - div) * 0.25;
    //let pressure: f32 = (l+r+t+b - div) * 0.25;
    //let w = 1.7;
    //pressure = (1. - w) * c + w * pressure;

    textureStore(pressuredest, pixel_coords, vec4<f32>(pressure, 0., 0., 1.));
}

/*
6.451 TFlops
= 6.451 * 10^12
pro Frame bei 60FPS:
512*512*20*60*21
*/





