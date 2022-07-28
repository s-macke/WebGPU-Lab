@group(0) @binding(0) var pressuresrc: texture_2d<f32>;
@group(0) @binding(1) var pressuredest: texture_storage_2d<r32float, write>;
@group(0) @binding(2) var rhs: texture_2d<f32>;
@group(0) @binding(3) var flags: texture_2d<i32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let pixel_coords = vec2<i32>(global_id.xy) + 1;

    let f = textureLoad(flags, pixel_coords, 0).r;

    // is not fluid?
    if  ((f&1) == 0) { return; }

    let div = textureLoad(rhs, pixel_coords, 0).r;
    var l = textureLoad(pressuresrc, pixel_coords + vec2<i32>(-1,  0), 0).r;
    var r = textureLoad(pressuresrc, pixel_coords + vec2<i32>( 1,  0), 0).r;
    var t = textureLoad(pressuresrc, pixel_coords + vec2<i32>( 0,  1), 0).r;
    var b = textureLoad(pressuresrc, pixel_coords + vec2<i32>( 0, -1), 0).r;

    // is boundary
    if ((f & 0x1e) != 0) {
        let c = textureLoad(pressuresrc, pixel_coords, 0).r;
        if ((f &  0x2) != 0) { l = c; }
        if ((f &  0x4) != 0) { r = c; }
        if ((f &  0x8) != 0) { t = c; }
        if ((f & 0x10) != 0) { b = c; }
    }

    let pressure = (l + r + t + b - div) * 0.25;
    textureStore(pressuredest, pixel_coords, vec4<f32>(pressure, 0., 0., 1.));

}



