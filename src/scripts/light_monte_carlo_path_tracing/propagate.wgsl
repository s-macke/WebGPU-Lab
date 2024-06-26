struct StagingBuffer {
    iMouse: vec2f,
    wheel: f32,
    iFrame: f32
};

@group(0) @binding(0) var img_input : texture_2d_array<f32>;
@group(0) @binding(1) var img_output : texture_storage_2d_array<rgba32float, write>;
@group(0) @binding(2) var<uniform> staging: StagingBuffer;
@group(1) @binding(0) var scene : texture_2d_array<f32>;

const PI = 3.14159265359;

const SAMPLES = 2;
const MAXDEPTH = 700;

var<private> seed: u32 = 0u;
fn hash() {
    seed ^= 2747636419u;
    seed *= 2654435769u;
    seed ^= seed >> 16;
    seed *= 2654435769u;
    seed ^= seed >> 16;
    seed *= 2654435769u;
}
fn InitRandom(fragCoord: vec2f, iFrame: i32, iTime: f32) {
    //seed = uint(fragCoord.y*iResolution.x + fragCoord.x)+uint(iFrame)*uint(iResolution.x)*uint(iResolution.y);
    seed = u32(fragCoord.y*512 + fragCoord.x)+u32(iFrame)*u32(512)*u32(512);
}

fn rand() -> f32 {
    hash();
    return f32(seed)/4294967295.0;
    //return f32(seed>>1)/2147483647.0;
}

fn radiance(_p: vec2f) -> vec3<f32> {
   var p = _p;
   //var color = vec3f(0.);
   var acc = vec3f(0.);    // Cumulative radiance
   var att = vec3f(1.);    // Light attenuation
   let dims = vec2i(textureDimensions(scene));

   let phi = 2. * PI * rand();
   var d = vec2f(cos(phi), sin(phi));

   for(var i: i32 = 0; i<MAXDEPTH; i++) {
       let pi = vec2i(p);
       if ((pi.x < 0) || (pi.x > dims.x-1) || (pi.y < 0) || (pi.y >= dims.y-1)) {
           break;
       }
       let Em = textureLoad(scene, pi, 0, 0).rgb;
       acc += att * Em;
       let translucency = textureLoad(scene, pi, 1, 0).a;
       if (translucency < rand()) {
           if (rand() > 0.8) {
               break;
           }
           let phi = 2. * PI * rand();
           d = vec2f(cos(phi), sin(phi));
           att.r *= 1.0;
           att.g *= 0.;
           att.b *= 0.;

       }
       p = p + d;
   }
   return acc;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let previousColor = textureLoad(img_input, vec2i(global_id.xy), 0, 0).rgb;
    let p = vec2f(global_id.xy);

    InitRandom(p, i32(staging.iFrame), staging.iFrame*0.1);

    var color = vec3f(0.);
    for(var i: i32 = 0; i<SAMPLES; i++) {
        color = color + radiance(p);
    }
    color = mix(previousColor, color / f32(SAMPLES), 1. / (staging.iFrame + 1.));

    textureStore(img_output, vec2i(global_id.xy), 0, vec4<f32>(color, 1.0));
}


