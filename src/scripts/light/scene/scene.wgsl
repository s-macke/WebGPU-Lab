#include "../common.wgsl"
#include "../distance.wgsl"

struct StagingBuffer {
    iMouse: vec2f,
    wheel: f32,
    iFrame: f32
};

@group(0) @binding(0) var scene : texture_storage_2d_array<rgba32float, write>;
@group(0) @binding(1) var<uniform> staging: StagingBuffer;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let iResolution = vec2f(textureDimensions(scene));
    set_resolution(iResolution.xy);
    let p = vec2i(global_id.xy);

    mouse_pos = ((staging.iMouse.xy / iResolution.xy)*2.0 - 1.0) * vec2f(iResolution.x/iResolution.y, 1.0);
    mouse_wheel = staging.wheel;

    let uv = pixel2uv(p);
    var sd: SD = map(uv);
    let n = normal_map(uv, pixel_radius);

    var chr = vec3f(0.);
    var chg = vec3f(0.);
    var chb = vec3f(0.);

    if (sd.emissive) {
        if (abs(sd.d) <= pixel_radius) {
            //let ref2 = sd.albedo * E;
            let light = light (n, pi) * CH_Basis;
            chr += light * sd.albedo.r;
            chg += light * sd.albedo.g;
            chb += light * sd.albedo.b;
        }
    }
    textureStore(scene, p, 0, vec4f(chr, 0.));
    textureStore(scene, p, 1, vec4f(chg, 0.));
    textureStore(scene, p, 2, vec4f(chb, 0.));
    textureStore(scene, p, 3, vec4f(n.xy, 0., 0.));
    if (sd.emissive) {
        sd.albedo = -sd.albedo;
    }
    textureStore(scene, p, 4, vec4f(sd.albedo.rgb, sd.d));
}
