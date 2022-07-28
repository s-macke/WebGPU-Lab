@group(0) @binding(0) var velocity_src: texture_2d<f32>;
@group(0) @binding(1) var velocity_dest: texture_storage_2d<rgba16float, write>;
@group(0) @binding(2) var density_src: texture_2d<f32>;
@group(0) @binding(3) var density_dest: texture_storage_2d<rgba16float, write>;
@group(0) @binding(4) var flags: texture_2d<i32>;

@compute @workgroup_size(2, 2)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    var dims = vec2<i32>(textureDimensions(velocity_src));
    let pixel_coords = vec2<i32>(global_id.xy);

    var v = textureLoad(velocity_src, pixel_coords, 0);
    var d = textureLoad(density_src, pixel_coords, 0);

    if (((pixel_coords.x < 3)) || (pixel_coords.x > (dims.x - 2)) || ((pixel_coords.y < 2))  || (pixel_coords.y > (dims.y - 2))) {
        v = vec4<f32>(1., 0., 0., 0.);
    }

    if (pixel_coords.x < 2) {
        var dens = cos(f32(pixel_coords.y)*0.2);
        if (dens > 0.6) {
            d = vec4<f32>(1.);
        } else {
            d = vec4<f32>(0.);
        }
    }

    if (((pixel_coords.x > 250)) && (pixel_coords.x < 260) && ((pixel_coords.y > 250)) && (pixel_coords.y < 260)) {
        v = vec4<f32>(0.0);
    }

    textureStore(velocity_dest, pixel_coords, v);
    textureStore(density_dest, pixel_coords, d);
}