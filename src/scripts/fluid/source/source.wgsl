struct StagingBuffer {
    iMouse: vec2f,
    wheel: f32,
    iFrame: f32
};

@group(0) @binding(0) var velocity_src: texture_2d<f32>;
@group(0) @binding(1) var velocity_dest: texture_storage_2d<rgba16float, write>;
@group(0) @binding(2) var density_src: texture_2d<f32>;
@group(0) @binding(3) var density_dest: texture_storage_2d<rgba16float, write>;
@group(0) @binding(4) var flags: texture_2d<i32>;
@group(0) @binding(5) var<uniform> staging: StagingBuffer;

var<private> mouse_pos = vec2<f32>(0.);
var<private> mouse_wheel: f32 = 0.;

fn sphere(p: vec2<f32>, r: f32) -> f32 {
    return length(p) - r;
}

@compute @workgroup_size(8, 8)
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

    //mouse_pos = ((staging.iMouse.xy / vec2<f32>(dims.xy))*2.0 - 1.0) * vec2f(1., 1.);
    mouse_pos = staging.iMouse.xy;
    mouse_wheel = staging.wheel;

    //let dist = sphere(vec2<f32>(pixel_coords) - mouse_pos, (-mouse_wheel*0.005+0.05));
    let dist = sphere(vec2<f32>(pixel_coords) - mouse_pos, -10.*mouse_wheel + 10.);
    if (dist < 0) {
        //v = vec4<f32>(0.0);
        v *= 0.5;
        d = vec4<f32>(1.0, 0., 0., 1.);
    }

/*
    if (((pixel_coords.x > 250)) && (pixel_coords.x < 260) && ((pixel_coords.y > 250)) && (pixel_coords.y < 260)) {
        v = vec4<f32>(0.0);
        d = vec4<f32>(1.0, 0., 0., 0.);
    }
*/
    textureStore(velocity_dest, pixel_coords, v);
    textureStore(density_dest, pixel_coords, d);
}