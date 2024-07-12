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
