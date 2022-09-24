//@block
struct StagingBuffer {
    iMouse: vec2<f32>,
    iTime: f32
};

@group(0) @binding(0) var img_output: texture_storage_2d<rgba32float, write>;
@group(0) @binding(1) var<uniform> staging: StagingBuffer;

// Play with the two following values to change quality.
// You want as many samples as your GPU can bear. :)
const SAMPLES = 100;
const MAXDEPTH = 4;

const PI = 3.14159265359;
const DIFF = 0;
const SPEC = 1;
const REFR = 2;
const NUM_SPHERES = 9;

var<private> seed: f32 = 0.;
fn rand() -> f32 {
    let tmp = fract(sin(seed)*43758.5453123);
    seed = seed + 1.;
    return tmp;
}

//@block
struct Ray {
    o: vec3<f32>,
    d: vec3<f32>
};

//[[block]]
struct Sphere {
    r: f32,
    p: vec3<f32>,
    e: vec3<f32>,
    c: vec3<f32>,
    refl: i32
};

var<private> lightSourceVolume: Sphere;
var<private> spheres: array<Sphere, NUM_SPHERES>;

fn initSpheres() {
    lightSourceVolume = Sphere(20., vec3<f32>(50., 81.6, 81.6), vec3<f32>(12.), vec3<f32>(0.), DIFF);
    spheres[0] = Sphere(1.e5, vec3<f32>(-1.e5 + 1., 40.8, 81.6),      vec3<f32>(0.), vec3<f32>(.75, .25, .25), DIFF); // left wall
    spheres[1] = Sphere(1.e5, vec3<f32>( 1.e5+99., 40.8, 81.6),       vec3<f32>(0.), vec3<f32>(.25, .25, .75), DIFF); // right wall
    spheres[2] = Sphere(1.e5, vec3<f32>(50.,       40.8, -1.e5),      vec3<f32>(0.), vec3<f32>(.75), DIFF); // back wall
    spheres[3] = Sphere(1.e5, vec3<f32>(50.,       40.8,  1.e5+170.), vec3<f32>(0.), vec3<f32>(0.), DIFF); // front wall
    spheres[4] = Sphere(1.e5, vec3<f32>(50.,      -1.e5, 81.6),		  vec3<f32>(0.), vec3<f32>(.75), DIFF); // bottom wall
    spheres[5] = Sphere(1.e5, vec3<f32>(50.,  1.e5+81.6, 81.6),       vec3<f32>(0.0), vec3<f32>(.75), DIFF); // top wall
    spheres[6] = Sphere(16.5, vec3<f32>(27.,       16.5, 47.), 	      vec3<f32>(0.), vec3<f32>(1.), SPEC);
    spheres[7] = Sphere(16.5, vec3<f32>(73.,       16.5, 78.), 	      vec3<f32>(0.), vec3<f32>(.7, 1., .9), REFR);
    spheres[8] = Sphere(600., vec3<f32>(50.,     681.33, 81.6),	      vec3<f32>(12.), vec3<f32>(0.), DIFF); // another light source?
}

fn intersectSphere(s: Sphere, r: Ray) -> f32 {
    var op: vec3<f32> = s.p - r.o;
    var t: f32;
    var epsilon = 1.e-3;
    var b = dot(op, r.d);
    var det = b * b - dot(op, op) + s.r * s.r;

    if (det < 0.) {
        return 0.;
    } else {
        det = sqrt(det);
    }

    t = b - det;
    if (t > epsilon) {
        return t;
    }

    t = b + det;
    if (t > epsilon) {
        return t;
    }

    return 0.;
}

fn intersect(r: Ray, t: ptr<function, f32>, s: ptr<function, Sphere>, avoid: i32) -> i32 {
    var id = -1;
    *t = 1.e5;
    *s = spheres[0];
    let n : i32 = NUM_SPHERES;
    for(var i: i32 = 0; i<n; i = i + 1) {
        var S: Sphere = spheres[i];
        var d: f32 = intersectSphere(S, r);
        if ((i != avoid) && (d != 0.) && (d < *t)) {
            *t = d;
            id = i;
            *s = S;
        }
    }
    return id;
}

fn jitter(d: vec3<f32>, phi: f32, sina: f32, cosa: f32) -> vec3<f32> {
    let w = normalize(d);
    let u = normalize(cross(w.yzx, w));
    let v = cross(w, u);
    return (u * cos(phi) + v * sin(phi)) * sina + w * cosa;
}

fn radiance(r_par: Ray) -> vec3<f32> {
    var acc = vec3<f32>(0.);
    var mask = vec3<f32>(1.);
    var id = -1;
    var r = r_par;

    for(var depth: i32 = 0; depth<MAXDEPTH; depth = depth + 1) {
        var t = 0.;
        var obj: Sphere;

        id = intersect(r, &t, &obj, id);
        if (id < 0) {
            break;
        }
        var x = t * r.d + r.o;
        var n = normalize(x - obj.p);
        var nl = n * sign(-dot(n, r.d));

        //vec3 f = obj.c;
        //float p = dot(f, vec3(1.2126, 0.7152, 0.0722));
        //if (depth > DEPTH_RUSSIAN || p == 0.) if (rand() < p) f /= p; else { acc += mask * obj.e * E; break; }

        if (obj.refl == DIFF) {
            var r2 = rand();
            var d = jitter(nl, 2.*PI*rand(), sqrt(r2), sqrt(1. - r2));
            var e = vec3<f32>(0.);

//ifdef ENABLE_NEXT_EVENT_PREDICTION
            //for (int i = 0; i < NUM_SPHERES; ++i)
            {
                // Sphere s = sphere(i);
                // if (dot(s.e, vec3(1.)) == 0.) continue;

                // Normally we would loop over the light sources and
                // cast rays toward them, but since there is only one
                // light source, that is mostly occluded, here goes
                // the ad hoc optimization:

                var s: Sphere = lightSourceVolume;
                let i = 8; // light source

                let l0 = s.p - x;
                let cos_a_max = sqrt(1. - clamp(s.r * s.r / dot(l0, l0), 0., 1.));
                let cosa = mix(cos_a_max, 1., rand());
                let l = jitter(l0, 2. * PI * rand(), sqrt(1. - cosa * cosa), cosa);

                if (intersect(Ray(x, l), &t, &s, id) == i) { // if light source is hit
                    let omega = 2. * PI * (1. - cos_a_max);
                    e = e + ((s.e * clamp ( dot(l, n), 0., 1.) * omega) / PI);
                }
            }

//#endif
            var E = 1.; // float(depth==0);
            acc = acc + (mask * obj.e * E + mask * obj.c * e);
            mask = mask * obj.c;
            r = Ray(x, d);
        } else {
        if (obj.refl == SPEC) {
            acc = acc + mask * obj.e;
            mask = mask * obj.c;
            r = Ray(x, reflect(r.d, n));
        } else {
            var a = dot(n, r.d);
            var ddn = abs(a);
            var nc = 1.;
            var nt = 1.5;
            var nnt = mix(nc / nt, nt / nc, f32(a > 0.));
            var cos2t = 1. - nnt * nnt * (1. - ddn * ddn);
            r = Ray(x, reflect(r.d, n));
            if (cos2t > 0.) {
                var tdir = normalize(r.d * nnt + sign(a) * n * (ddn * nnt + sqrt(cos2t)));
                var R0 = (nt - nc) * (nt - nc) / ((nt + nc) * (nt + nc));
                var c = 1. - mix(ddn, dot(tdir, n), f32(a > 0.));
                var Re = R0 + (1. - R0) * c * c * c * c * c;
                var P = .25 + .5 * Re;
                var RP = Re / P;
                var TP = (1. - Re) / (1. - P);
                if (rand() < P) {
                    mask = mask * RP;
                } else {
                    mask = mask * obj.c * TP;
                    r = Ray(x, tdir);
                }
            }
        }
        }
    }
    return acc;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    initSpheres();
    var iResolution = vec2<f32>(textureDimensions(img_output));
    var fragCoord = vec2<f32>(global_id.xy) + 0.5;

    seed = staging.iTime + iResolution.y * fragCoord.x / iResolution.x + fragCoord.y / iResolution.y;

    var uv: vec2<f32> = 2. * fragCoord.xy / iResolution.xy - 1.;
    //var camPos = vec3<f32>((2. * (staging.iMouse.xy==vec2(0.)?.5*iResolution.xy:staging.iMouse.xy) / iResolution.xy - 1.) * vec2<f32>(48., 40.) + vec2<f32>(50., 40.8), 169.);
    var camPos = vec3<f32>((2. * staging.iMouse.xy / iResolution.xy - 1.) * vec2<f32>(48., 40.) + vec2<f32>(50., 40.8), 169.);
    //var camPos = vec3<f32>((2. * (.5 * iResolution.xy) / iResolution.xy - 1.) * vec2<f32>(48., 40.) + vec2<f32>(50., 40.8), 169.);
    var cz = normalize(vec3<f32>(50., 40., 81.6) - camPos);
    var cx = vec3<f32>(1., 0., 0.);
    var cy = normalize(cross(cx, cz)); cx = cross(cz, cy);
    var color = vec3<f32>(0.);
    for(var i: i32 = 0; i<SAMPLES; i = i + 1) {
        color = color + radiance(Ray(camPos, normalize(.53135 * (iResolution.x / iResolution.y * uv.x * cx + uv.y * cy) + cz)));
    }
    var fragColor = vec4<f32>(pow( clamp(color / f32(SAMPLES), vec3<f32>(0.), vec3<f32>(1.)), vec3<f32>(1. / 2.2)), 1.);
    textureStore(img_output, vec2<i32>(global_id.xy), fragColor);
}
