[[group(0), binding(0)]] var velocity_src: texture_2d<f32>;
[[group(0), binding(1)]] var div_dest: texture_storage_2d<r32float, write>;
[[group(0), binding(2)]] var flags: texture_2d<i32>;

[[stage(compute), workgroup_size(2, 2)]]
fn main([[builtin(global_invocation_id)]] global_id: vec3<u32>) {

    let pixel_coords = vec2<i32>(global_id.xy) + 1;
    let f = textureLoad(flags, pixel_coords, 0).r;
    //let h = -0.5/sqrt(512.*512.);
    //let h = -0.5/512.;
    let h = -0.5;

    // is not fluid?
    if  ((f&1) == 0) { return; }

    var r = textureLoad(velocity_src, pixel_coords + vec2<i32>( 1,  0), 0);
    var l = textureLoad(velocity_src, pixel_coords + vec2<i32>(-1,  0), 0);
    var t = textureLoad(velocity_src, pixel_coords + vec2<i32>( 0,  1), 0);
    var b = textureLoad(velocity_src, pixel_coords + vec2<i32>( 0, -1), 0);

    // is boundary
    if ((f & 0x1e) != 0) {
        let c = textureLoad(velocity_src, pixel_coords, 0);
        if ((f&0x2) != 0) { l = c; }
        if ((f&0x4) != 0) { r = c; }
        if ((f&0x8) != 0) { t = c; }
        if ((f&0x10) != 0) { b = c; }
    }

    textureStore(div_dest, pixel_coords, vec4<f32>(((r.x - l.x) + (t.y - b.y)) * h));
}