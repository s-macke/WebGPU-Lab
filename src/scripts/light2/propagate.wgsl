struct StagingBuffer {
    iMouse: vec2f,
    wheel: f32,
    iFrame: f32
};

@group(0) @binding(0) var img_input : texture_2d_array<f32>;
@group(0) @binding(1) var img_output : texture_storage_2d_array<rgba16float, write>;
@group(0) @binding(2) var<uniform> staging: StagingBuffer;
@group(1) @binding(0) var scene : texture_2d_array<f32>;

struct ColorCH {
    r: vec3f,
    g: vec3f,
    b: vec3f
};

// propagate light from neighbor to this pixel
// n: normal of neighbor to center
// sa: solid angle of neighbor
fn propagate(
    n: vec2f,
    sa: f32,
    F: ColorCH, // incoming light from neighbor
    Em: ColorCH, // emitted light from neighbor
    out: ptr<function, ColorCH>) {

    // circular harmonic factors of light from neighbor to center
    let dV = vec3f(n, 1.) * CH_Basis;

    // light hitting our interior cell wall
    let L = max(vec3f(0.0), vec3f(
        dot(F.r, dV),
        dot(F.g, dV),
        dot(F.b, dV)))*sa;

    // reflection
    //let dRV = vec3f(-n, 1.) * CH_Basis;

    let ch = ColorCH(dV * L.r, dV * L.g, dV * L.b);
    (*out).r += ch.r;
    (*out).g += ch.g;
    (*out).b += ch.b;
}

fn solid_angle(a: vec2f, b: vec2f) -> f32 {
    return acos(dot(normalize(a), normalize(b)));
}

fn retrieveConstants(pn: vec2i, F: ptr<function, ColorCH>,  E: ptr<function, ColorCH>) {
    *F = ColorCH(
        textureLoad(img_input, pn, 0, 0).xyz, // incoming red light from neighbor as circular harmonics
        textureLoad(img_input, pn, 1, 0).xyz, // incoming green light from neighbor as circular harmonics
        textureLoad(img_input, pn, 2, 0).xyz, // incoming blue light from neighbor as circular harmonics
    );
    /*
    *E = ColorCH(
        textureLoad(scene, pn, 0, 0).xyz, // emitted red light from neighbor as circular harmonics
        textureLoad(scene, pn, 1, 0).xyz, // emitted green light from neighbor as circular harmonics
        textureLoad(scene, pn, 2, 0).xyz, // emitted blue light from neighbor as circular harmonics
    );
    */
}

    // note that sa2 = (90° - sa1) / 2
    //const sa1: f32 = solid_angle(vec2f(1.5,      -0.5), vec2<f32>(1.5, 0.5)); // ~53.13°, projecting to the right side of our pixel
    //const sa2: f32 = solid_angle(vec2f(0.5, 0.5), vec2<f32>(1.5, 0.5)); // ~18.43°, projecting to the top/bottom side of our pixel
    //const dn1: vec2f = normalize(vec2f(2.,  1.0)); // normal to the center of the top side of our pixel

    // TODO: the comments are wrong
    const sa1= 0.6435011087932845; // ~53.13°, projecting to the right side of our pixel
    const sa2= 0.4636476090008066; // ~18.43°, projecting to the top/bottom side of our pixel
    const dn1 = vec2f(0.8944271909999159, 0.4472135954999579); // normal to the center of the top side of our pixel
    const dn0 = vec2f(0.8944271909999159, -0.4472135954999579); // normal to the center of the bottom side of our pixel

fn lpv_kernel(p: vec2i, out: ptr<function, ColorCH>) {
    let Em = textureLoad(scene, p, 0, 0).xyz; // emitted rgb light as circular harmonics
    let translucency = textureLoad(scene, p, 1, 0).w;

/*
    let d: i32 = 1;
    let x: f32 = 2.0;
    let sa1: f32 = solid_angle(vec2f(x,      -1.0), vec2<f32>(x, 1.0)); // ~53.13°, projecting to the right side of our pixel
    let sa2: f32 = solid_angle(vec2f(x - 1.0, 1.0), vec2<f32>(x, 1.0)); // ~18.43°, projecting to the top/bottom side of our pixel
    // note that sa2 = (90° - sa1) / 2
    let dn1: vec2f = normalize(vec2f(x - 0.5,  1.0)); // normal to the center of the top side of our pixel
    let dn0: vec2f = normalize(vec2f(x - 0.5, -1.0)); // normal to the center of the bottom side of our pixel
*/

/*
float sa1 = solid_angle(vec2(1.5, -0.5),vec2(1.5,0.5)); // ~53.13°, projecting to the right side of our pixel
    float sa2 = solid_angle(vec2(0.5,0.5),vec2(1.5,0.5)); // ~18.43°, projecting to the top/bottom side of our pixel
    vec2 dn1 = normalize(vec2(2., 1.0)); // normal to the center of the top side of our pixel
    vec2 dn0 = normalize(vec2(2., -1.0)); // normal to the center of the bottom side of our pixel
*/

    var pn : vec2i;
    var F : ColorCH;
    var E : ColorCH;

    pn = p + vec2i(-1, 0);
    retrieveConstants(pn, &F, &E);
    propagate(vec2f(1., 0.),  sa1, F, E, out);
    propagate(dn1,            sa2, F, E, out);
    propagate(dn0,            sa2, F, E, out);

    pn = p + vec2i(1, 0);
    retrieveConstants(pn, &F, &E);
    propagate(vec2f(-1., 0.), sa1, F, E, out);
    propagate(-dn0,           sa2, F, E, out);
    propagate(-dn1,           sa2, F, E, out);

    pn = p + vec2i(0, -1);
    retrieveConstants(pn, &F, &E);
    propagate(vec2f(0., 1.),  sa1, F, E, out);
    propagate(dn1.yx,         sa2, F, E, out);
    propagate(dn0.yx,         sa2, F, E, out);

    pn = p + vec2i(0, 1);
    retrieveConstants(pn, &F, &E);
    propagate(vec2f(0., -1.), sa1, F, E, out);
    propagate(-dn1.yx,        sa2, F, E, out);
    propagate(-dn0.yx,        sa2, F, E, out);

    (*out).r.z = (*out).r.z + Em.r;
    (*out).g.z = (*out).g.z + Em.g;
    (*out).b.z = (*out).b.z + Em.b;

    //var absorbed = ColorCH((*out).r * 1.-, (*out).g, (*out).b);
    let absorbedr = (*out).r.z * (1.-translucency);
    let absorbedg = (*out).g.z * (1.-translucency);
    let absorbedb = (*out).b.z * (1.-translucency);

    (*out).r.z = (*out).r.z * (translucency) + absorbedr*0.8;
    (*out).g.z = (*out).g.z * (translucency);
    (*out).b.z = (*out).b.z * (translucency);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    var outch : ColorCH;
    lpv_kernel(vec2i(global_id.xy), &outch);

    textureStore(img_output, vec2i(global_id.xy), 0, vec4f(outch.r, 0.));
    textureStore(img_output, vec2i(global_id.xy), 1, vec4f(outch.g, 0.));
    textureStore(img_output, vec2i(global_id.xy), 2, vec4f(outch.b, 0.));
}


