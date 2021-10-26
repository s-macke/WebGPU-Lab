[[group(0), binding(0)]] var img_output: texture_storage_2d<rgba32float, write>;

fn noise(p_par: vec3<f32>) -> f32 {
    var p = p_par;
    let ip: vec3<f32> = floor(p);
    p = p - ip;
    let s = vec3<f32>(7., 157., 113.);
    var h = vec4<f32>(0., s.yz, s.y + s.z)+dot(ip, s);
    p = p * p * (3. - p * 2.);
    h = mix(fract(sin(h)*43758.5), fract(sin(h+s.x)*43758.5), p.x);
    let h2 = mix(h.xz, h.yw, p.y);
    return mix(h2.x, h2.y, p.z);
}

fn fbm(p_par: vec3<f32>, octaveNum: i32) -> vec2<f32> {
    var p = p_par;
    var acc = vec2<f32>(0.);
    let freq = 1.0;
    var amp = 0.5;
    let shift = vec3<f32>(100.);
    for (var i = 0; i < octaveNum; i = i + 1) {
        acc = acc + vec2<f32>(noise(p), noise(p + vec3<f32>(0., 0., 10.))) * amp;
        p = p * 2.0 + shift;
        amp = amp * 0.5;
    }
    return acc;
}

fn vignette(color: vec3<f32>, q: vec2<f32>, v: f32) -> vec3<f32> {
    return color * mix(1., pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), v), 0.02);
}

[[stage(compute), workgroup_size(2, 2)]]
fn main([[builtin(global_invocation_id)]] global_id: vec3<u32>) {
    let pixel_coords = vec2<i32>(global_id.xy);
    textureStore(img_output, pixel_coords, vec4<f32>(fbm(vec3<f32>(f32(global_id.x), f32(global_id.y), 0.)*0.02,5).x));
}
