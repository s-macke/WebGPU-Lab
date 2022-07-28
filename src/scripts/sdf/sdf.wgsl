// A signed distance function P(x,y), satisfied the condition
//
// |grad P| = 1
//
// or
//
// L = |grad P| - 1 = 0
//
// This code solves the so called level set method reinitialization
// equation
//
// dP/dt = - P0 * L
//
// with P0(x,y) containing the initial shapes.
// The solution converges and is in a steady state when L = 0.
//
// To stabilize the algorithm, you have to use high order discretization schemes
// such as WENO (https://en.wikipedia.org/wiki/WENO_methods) and
// upwind schemes (https://en.wikipedia.org/wiki/Upwind_scheme)

@group(0) @binding(0) var boundary_src: texture_2d<f32>;
@group(0) @binding(1) var sdf_src: texture_2d<f32>;
@group(0) @binding(2) var sdf_dest: texture_storage_2d<rg32float, write>;
@group(0) @binding(3) var render_output: texture_storage_2d<rgba32float, write>;

let timestep = 0.2;
/*
#define getSign(uv)  texture(iChannel1, uv).r
#define fetchDistance(x) texture(iChannel0, uv + step * x).r

// fifth order WENO discretization or ordinary first order discretization
//#define WENO
*/

fn fetchDistance(p: vec2<i32>) -> f32 {
    return textureLoad(sdf_src, p, 0).r;
}

fn getSign(p: vec2<i32>) -> f32 {
    var f = textureLoad(boundary_src, p, 0);
    if (f.r > 0.5) {
        return 1.;
    }
    return -1.;
}

fn upwind(grad_left: f32, grad_right: f32, sign0: f32) -> f32 {
    if ((grad_left * sign0 < -grad_right * sign0) && (grad_right*sign0 < 0.)) {
	    return grad_right;
    } else {
        if ((grad_left * sign0 > 0.) && (grad_right * sign0 > -grad_left * sign0)) {
            return grad_left;
        }
    }
    return 0.;
}


// calculates the gradient using the WENO scheme
fn weno_gradient (
    Psinnn: f32,
    Psinn: f32,
    Psin: f32,
    Psi: f32,
    Psip: f32,
    Psipp: f32,
    Psippp: f32,
    dx: f32, positive: bool) -> f32
{
    let e = 1.e-6;

    //float q1, q2, q3, q4, q5, is1, is2, is3, a1, a2, a3, w1, w2, w3;
    var q1: f32;
    var q2: f32;
    var q3: f32;
    var q4: f32;
    var q5: f32;

    if (positive) {
        q1 =  (Psippp - Psipp) / dx;
        q2 =  (Psipp - Psip) / dx;
        q3 =  (Psip - Psi) / dx;
        q4 =  (Psi - Psin) / dx;
        q5 =  (Psin - Psinn) / dx;
    } else {
        q1 =  (Psinn - Psinnn) / dx;
        q2 =  (Psin - Psinn) / dx;
        q3 =  (Psi - Psin) / dx;
        q4 =  (Psip - Psi) / dx;
        q5 =  (Psipp - Psip) / dx;
    }

    let is1 = 13. / 12. * ( q1 - 2. * q2 + q3 ) * ( q1 - 2. * q2 + q3 ) + 0.25 * ( q1 - 4. * q2 + 3. * q3 ) * ( q1 - 4. * q2 + 3. * q3 );
    let is2 = 13. / 12. * ( q2 - 2. * q3 + q4 ) * ( q2 - 2. * q3 + q4 ) + 0.25 * ( q2 - q4 ) * ( q2 - q4 );
    let is3 = 13. / 12. * ( q3 - 2. * q4 + q5 ) * ( q3 - 2. * q4 + q5 ) + 0.25 * ( 3. * q3 - 4. * q4 + q5 ) * ( 3. * q3 - 4. * q4 + q5 );
    let a1 = 0.1 / ((e + is1) * (e + is1));
    let a2 = 0.6 / ((e + is2) * (e + is2));
    let a3 = 0.3 / ((e + is3) * (e + is3));
    let w1 = a1 / (a1 + a2 + a3);
    let w2 = a2 / (a1 + a2 + a3);
    let w3 = a3 / (a1 + a2 + a3);
    return  w1 * (q1 / 3. - 7. * q2 / 6. + 11. * q3 / 6.) + w2 * (-q2 / 6. + 5.*q3 / 6. + q4 / 3. ) + w3*(q3 / 3. + 5. * q4 / 6. - q5 / 6.);
}



// calculates gradient of the distance map
fn gradient(uv: vec2<i32>, sign0: f32) -> vec2<f32> {
    let c   = fetchDistance(uv + vec2<i32>( 0,  0));
    let eee = fetchDistance(uv + vec2<i32>( 3,  0));
    let ee  = fetchDistance(uv + vec2<i32>( 2,  0));
    let e   = fetchDistance(uv + vec2<i32>( 1,  0));
    let w   = fetchDistance(uv + vec2<i32>(-1,  0));
    let ww  = fetchDistance(uv + vec2<i32>(-2,  0));
    let www = fetchDistance(uv + vec2<i32>(-3,  0));
    let nnn = fetchDistance(uv + vec2<i32>( 0,  3));
    let nn  = fetchDistance(uv + vec2<i32>( 0,  2));
    let n   = fetchDistance(uv + vec2<i32>( 0,  1));
    let s   = fetchDistance(uv + vec2<i32>( 0, -1));
    let ss  = fetchDistance(uv + vec2<i32>( 0, -2));
    let sss = fetchDistance(uv + vec2<i32>( 0, -3));

    // using cellwidth and cellheight = 1
//#ifdef WENO
    let gradxp = weno_gradient(www, ww, w, c, e, ee, eee, 1., true);
    let gradxm = weno_gradient(www, ww, w, c, e, ee, eee, 1., false);
    let gradyp = weno_gradient(nnn, nn, n, c, s, ss, sss, 1., true);
    let gradym = weno_gradient(nnn, nn, n, c, s, ss, sss, 1., false);
//else
/*
    float gradxp = (e-c);
    float gradxm = (c-w);
    float gradyp = (n-c);
    float gradym = (c-s);
    */
//endif

    // choose the right gradient to stabilize
    let grad = vec2<f32>(upwind(gradxm, gradxp, sign0),
                         upwind(gradym, gradyp, sign0));

    return grad;
}

/*
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord/iResolution.xy;

    float sign0 = getSign(uv);

    // reset signed distance function
    if (iFrame < 1) {
        fragColor = vec4(sign0);
        return;
    }

    float L = length(gradient(uv, sign0)) - 1.;

    // Two step Adams-Bashforth time integration
    // r contains old value and g the previous right hand side.
    float dPdt = -sign0*L;
    vec4 old_distance = texture(iChannel0, uv);
    float new_distance = old_distance.r + timestep * (3./2.*dPdt - 1./2.*old_distance.g);

    fragColor = vec4(new_distance, dPdt, 0., 0.);
}
*/

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let uv = vec2<i32>(global_id.xy);
    let sign0 = getSign(uv);
    let L = length(gradient(uv, sign0)) - 1.;

    // Two step Adams-Bashforth time integration
    // r contains old value and g the previous right hand side.
    let dPdt = - sign0 * L;
    let old_distance = textureLoad(sdf_src, uv, 0);
    let new_distance = old_distance.r + timestep * (3. / 2. * dPdt - 1. / 2. * old_distance.g);

    textureStore(sdf_dest, vec2<i32>(global_id.xy), vec4<f32>(new_distance, dPdt, 0., 0.));

    // render output
    var fragColor = vec4<f32>(0.);
    if (abs(new_distance) < 1.) {
        fragColor = vec4<f32>(1.);
    } else {
        if (new_distance < 0.0) {
            fragColor = vec4<f32>(min(-new_distance * 0.02, 1.), 0., 0. ,1.);
        } else {
            fragColor = vec4<f32>(0., 0., min(new_distance * 0.02, 1.), 1.);
        }
    }
    textureStore(render_output, vec2<i32>(global_id.xy), fragColor);

/*
    let pixel_coords = vec2<i32>(global_id.xy);
    var f = textureLoad(boundary_src, pixel_coords, 0);
    if (f.r > 0.5) { f = vec4<f32>(1.); } else { f = vec4<f32>(0.); }
    textureStore(sdf_dest, vec2<i32>(global_id.xy), f);
*/
}
