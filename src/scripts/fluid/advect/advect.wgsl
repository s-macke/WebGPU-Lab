@group(0) @binding(0) var velocity_src: texture_2d<f32>;
@group(0) @binding(1) var velocity_sampler: sampler;
@group(0) @binding(2) var velocity_dest: texture_storage_2d<rgba16float, write>;
@group(0) @binding(3) var flags: texture_2d<i32>;

const dt: f32 = 1.;
//let dt: f32 = 1.;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let dims = vec2<f32>(textureDimensions(velocity_src));
    let scale = 1. / dims;

    let pixel_coords = vec2<i32>(global_id.xy) + 1;

    let f: i32 = textureLoad(flags, pixel_coords, 0).r;

    // is not fluid?
    if  ((f&1) == 0) { return; }

    // get index in global work group i.e x,y position
    let v: vec2<f32> = textureLoad(velocity_src, pixel_coords, 0).xy;

    let pixel_coords2 = vec2<f32>(global_id.xy) + 1.5;
    var p = (pixel_coords2 - dt*v);
    p = min( max(p, vec2<f32>(0.5)), dims - vec2<f32>(0.5) );

    let c = vec4<f32>(textureSampleLevel(velocity_src, velocity_sampler, p*scale, 0.));
    textureStore(velocity_dest, pixel_coords, c);
}