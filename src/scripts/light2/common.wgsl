// --------------------------------------------------------------------------------------------
const pi: f32 = 3.14159265359;
const tau: f32 = 6.28318530718;
const unit_circle_area:f32 = 2.0 * pi;

// circular harmonics
// see also https://blackpawn.com/texts/ch/default.html
// and https://valdes.cc/articles/ch.html


// Basis functions used here for circular harmonics
//  1 / sqrt(pi)  of the basis function b1 = cos(phi) / sqrt(pi)
//  1 / sqrt(pi)  of the basis function b2 = sin(phi) / sqrt(pi)
//  1 / sqrt(2*pi) of the basis function b0 = for 1 / sqrt(2*pi)
const CH_Basis = sqrt(vec3(2., 2., 1.0) / unit_circle_area);

// returns the circular harmonics coefficients for a light
// ambient light sends light in all directions. No direction
fn ambient () -> vec3<f32> {
    return vec3(0, 0, 2.0 * pi);
}

// returns the circular harmonics coefficients for diffuse scattering wall
// n: normalized surface normal
fn lambert (n: vec2<f32>) -> vec3<f32> {
    return vec3(n * 0.5 * pi, 2.0);
}

// see https://www.jordanstevenstechart.com/lighting-models
// returns the circular harmonics coefficients for diffuse scattering wall
// n: normalized surface normal
fn half_lambert (n: vec2<f32>) -> vec3<f32> {
    return vec3(n * 0.5 * pi, pi);
}

// returns the circular harmonics coefficients for a light
// must be multiplied by CH_Basis
// n: normalized light direction
// sa: solid angle of the light
fn light (n: vec2<f32>, sa: f32) -> vec3<f32> {
    return vec3<f32>(n * 2.0 * sin(sa / 2.0), sa);
}

const SHSharpness = 1.0; // 2.0
fn sh_irradiance_probe(v: vec3<f32>) -> vec3<f32> {
    const sh_c0 = (2.0 - SHSharpness) * 1.0;
    const sh_c1 = SHSharpness * 2.0 / 3.0;
    return vec3<f32>(v.xy * sh_c1, v.z * sh_c0);
}

