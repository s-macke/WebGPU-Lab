struct StagingBuffer {
    iMouse: vec2f,
    wheel: f32,
    iFrame: f32
};

@group(0) @binding(0) var scene : texture_storage_2d_array<rgba8unorm, write>;
@group(0) @binding(1) var density : texture_2d<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    //let iResolution = vec2f(textureDimensions(scene));
    //resolution = iResolution.xy;
    let p = vec2i(global_id.xy);
    let d = textureLoad(density, p, 0)/256.0;
    var ch = vec3f(0., 0., 0.);
    var translucency = vec4f(0., 0., 0., 1.);

    //ch = vec3f(d.g*1., d.g*1., d.g*1.);
    //translucency = 1. - d.r*50. - d.g*10.;
    //translucency = 1. - d.g*40.;

    translucency.a = 1. - d.r*20.;
    translucency.r = 0.9;
    translucency.g = 0.0;
    translucency.b = 0.0;

    if (p.y > 508) && (p.x > 408) {
        ch = vec3f(0.6, 0.6, 1.);
    }
/*
    if (p.y < 10) {
        ch = vec3f(0.0, 0.3, 0.);
        translucency.a = 0.1;
    }
    if (p.y < 11) {
        translucency.a = 0.1;
    }
*/

    textureStore(scene, p, 0, vec4f(ch, 0.));  // emissive circular harmonics for rgb.
    textureStore(scene, p, 1, translucency);  // absorption and color of emitted light
}

