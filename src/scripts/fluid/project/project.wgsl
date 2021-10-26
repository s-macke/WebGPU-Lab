[[group(0), binding(0)]] var pressure_src: texture_2d<f32>;
[[group(0), binding(1)]] var velocity_src: texture_2d<f32>;
[[group(0), binding(2)]] var velocity_dest: texture_storage_2d<rgba16float, write>;
[[group(0), binding(3)]] var flags: texture_2d<i32>;

[[stage(compute), workgroup_size(2, 2)]]
fn main([[builtin(global_invocation_id)]] global_id: vec3<u32>) {
    let pixel_coords = vec2<i32>(global_id.xy) + 1;
    let f = textureLoad(flags, pixel_coords, 0).r;

    // is not fluid?
    if  ((f&1) == 0) { return; }

    var r = textureLoad(pressure_src, pixel_coords + vec2<i32>( 1,  0), 0).r;
    var l = textureLoad(pressure_src, pixel_coords + vec2<i32>(-1,  0), 0).r;
    var u = textureLoad(pressure_src, pixel_coords + vec2<i32>( 0,  1), 0).r;
    var d = textureLoad(pressure_src, pixel_coords + vec2<i32>( 0, -1), 0).r;

    // is boundary
    if ((f & 0x1e) != 0) {
        let c = textureLoad(pressure_src, pixel_coords, 0).r;
        if ((f&0x2) != 0) { l = c; }
        if ((f&0x4) != 0) { r = c; }
        if ((f&0x8) != 0) { u = c; }
        if ((f&0x10) != 0) { d = c; }
    }
    let grad = vec2<f32>(
        0.5 * (r - l),
        0.5 * (u - d));

    let v = textureLoad(velocity_src, pixel_coords, 0);

    textureStore(velocity_dest, pixel_coords, vec4<f32>(
        v.x + grad.x,
        v.y + grad.y,
         0., 1.));
}