struct StagingBuffer {
    iMouse: vec2f,
    wheel: f32,
    iFrame: f32
};


var<private> resolution: vec2<f32>;

fn pixel2uv(p: vec2<i32>) -> vec2<f32> {
    var uv: vec2<f32> = ((vec2<f32>(p) + 0.5) / resolution.xy)*2.0 - 1.0;
    uv.x *= resolution.x/resolution.y;
    return uv;
}


var<private> mouse_pos = vec2<f32>(0.);
var<private> mouse_wheel: f32 = 0.;

fn sphere(p: vec2<f32>, r: f32) -> f32 {
    return length(p) - r;
}

@group(0) @binding(0) var scene : texture_storage_2d_array<rgba8unorm, write>;
@group(0) @binding(1) var<uniform> staging: StagingBuffer;
@group(0) @binding(2) var sdf : texture_2d<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let iResolution = vec2f(textureDimensions(scene));
    resolution = iResolution.xy;
    let p = vec2i(global_id.xy);

    mouse_pos = ((staging.iMouse.xy / iResolution.xy)*2.0 - 1.0) * vec2f(iResolution.x/iResolution.y, 1.0);
    mouse_wheel = staging.wheel;

    let uv = pixel2uv(p);

    var ch = vec3f(0.);

    const pi: f32 = 3.14159265359;
    //const scale = 1./sqrt(2.0 * pi);
    const scale = 1.;

    let d = sphere(uv - mouse_pos, (-mouse_wheel*0.005+0.05));
    if (d < 0) {
        ch.r += 1.*scale;
        ch.g += 1.*scale;
        ch.b += 1.*scale;
    }
    var translucency = f32(1.0);

   let dT = textureLoad(sdf, p, 0).x/256.0;
    if (dT < -0.05) {
        translucency = 0.6;
    }

    if (d < -0.02) {
        translucency = 0.1;
    }

    textureStore(scene, p, 0, vec4f(ch, 0.));  // emissive circular harmonics for rgb.
    textureStore(scene, p, 1, vec4f(0.9, 0., 0., translucency));  // absorption
}
