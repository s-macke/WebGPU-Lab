
struct Ray {
    origin: vec3<f32>,
    direction: vec3<f32>
};

struct Material {
    typ : i32,
    color: vec3<f32>
};

struct Hit {
    t: f32,
    p: vec3<f32>,
    normal : vec3<f32>,
    m: Material
};

struct Camera {
    origin : vec3<f32>,
    lower_left_corner: vec3<f32>,
    horizontal : vec3<f32>,
    vertical : vec3<f32>,
    u : vec3<f32>,
    v : vec3<f32>,
    w : vec3<f32>,
    lens_radius: f32
}

struct Triangle {
    v0: vec3<f32>,
    edgeA: vec3<f32>,
    edgeB: vec3<f32>,
    n : vec3<f32>
};

