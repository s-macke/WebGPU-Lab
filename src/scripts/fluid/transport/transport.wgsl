@group(0) @binding(0) var t_old: texture_2d<f32>;
@group(0) @binding(1) var t_sampler: sampler;
@group(0) @binding(2) var newtexture: texture_storage_2d<rgba16float, write>;
@group(0) @binding(3) var velocity: texture_2d<f32>;
@group(0) @binding(4) var flags: texture_2d<i32>;

const dt: f32 = 1.;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let dims = vec2<f32>(textureDimensions(newtexture));
    let scale = 1. / dims;
    let pixel_coords = vec2<i32>(global_id.xy) + 1;

    let f = textureLoad(flags, pixel_coords, 0).r;

    // is not fluid?
    if ((f & 1) == 0) { return; }

    // get index in global work group i.e x,y position
    let v: vec2<f32> = textureLoad(velocity, pixel_coords, 0).xy;
    let pixel_coords2 = vec2<f32>(global_id.xy) + 1.5;

    var p = (pixel_coords2 - dt*v);
    p = min( max(p, vec2<f32>(0.5)), dims - vec2<f32>(0.5) );

    let c = vec4<f32>(textureSampleLevel(t_old, t_sampler, p*scale, 0.));

    textureStore(newtexture, pixel_coords, c);
    //textureStore(newtexture, pixel_coords, vec4<f32>(fbm(vec3<f32>(pixel_coords.x, pixel_coords.y, 0.)*0.01,5).x));
}