// Protean clouds by nimitz (twitter: @stormoid)
// https://www.shadertoy.com/view/3l23Rh
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License
// Contact the author for other licensing options

/*
    Technical details:

    The main volume noise is generated from a deformed periodic grid, which can produce
    a large range of noise-like patterns at very cheap evalutation cost. Allowing for multiple
    fetches of volume gradient computation for improved lighting.

    To further accelerate marching, since the volume is smooth, more than half the the density
    information isn't used to rendering or shading but only as an underlying volume	distance to
    determine dynamic step size, by carefully selecting an equation	(polynomial for speed) to
    step as a function of overall density (not necessarialy rendered) the visual results can be
    the	same as a naive implementation with ~40% increase in rendering performance.

    Since the dynamic marching step size is even less uniform due to steps not being rendered at all
    the fog is evaluated as the difference of the fog integral at each rendered step.

*/

//@block
struct StagingBuffer {
    iMouse: vec2<f32>,
    iTime: f32
};

@group(0) @binding(0) var img_output: texture_storage_2d<rgba32float, write>;
@group(0) @binding(1) var<uniform> staging: StagingBuffer;


fn rot(a: f32) -> mat2x2<f32> {
    let c:f32 = cos(a);
    let s:f32 = sin(a);
    return mat2x2<f32>(vec2<f32>(c,s),vec2<f32>(-s, c));
    //return mat2x2<f32>(vec2<f32>(c,-s),vec2<f32>(s, c));
}

const m3 = mat3x3<f32>(
    vec3<f32>(0.33338, 0.56034, -0.71817),
    vec3<f32>(-0.87887, 0.32651, -0.15323),
    vec3<f32>(0.15162, 0.69596, 0.61339));
    //*1.93;

fn mag2(p: vec2<f32>) -> f32{
    return dot(p, p);
}

fn linstep(mn: f32, mx: f32, x: f32) -> f32 {
    return clamp((x - mn)/(mx - mn), 0., 1.);
}

var<private> prm1: f32 = 0.;
var<private> bsMo: vec2<f32> = vec2<f32>(0.);

fn disp(t: f32) -> vec2<f32> {
    return vec2<f32>(sin(t*0.22)*1., cos(t*0.175)*1.)*2.;
}

fn map(ppar: vec3<f32>) -> vec2<f32> {
    var p = ppar;

    var p2: vec2<f32> = p.xy;
    p2 = p2 - disp(p.z);

    let ptemp = p.xy * rot(sin(p.z+staging.iTime)*(0.1 + prm1*0.05) + (staging.iTime*0.09));
    p = vec3<f32>(ptemp.x, ptemp.y, p.z);

    let cl = mag2(p2.xy);
    var d = 0.;
    p = p * .61;
    var z = 1.;
    var trk = 1.;
    let dspAmp = 0.1 + prm1*0.2;

    for(var i: i32 = 0; i<5; i = i + 1) {
        p = p + sin(p.zxy*0.75*trk + staging.iTime*trk*.8)*dspAmp;
        d = d - abs(dot(cos(p), sin(p.yzx))*z);
        z = z * 0.57;
        trk = trk * 1.4;
        p = p * m3 * 1.93; // SMA: multiplied by 1.93 here, because I can't do this in a constant
    }
    d = abs(d + prm1*3.) + prm1*.3 - 2.5 + bsMo.y;
    return vec2<f32>(d + cl*.2 + 0.25, cl);
}

fn render(ro: vec3<f32>, rd: vec3<f32>, time: f32 ) -> vec4<f32> {

    var rez = vec4<f32>(0.);
    let ldst = 8.;
    let lpos = vec3<f32>(disp(time + ldst)*0.5, time + ldst);

    var t = 1.5;
    var fogT = 0.;

    for(var i: i32 = 0; i<130; i = i + 1) {
        if (rez.a > 0.99) {break;}

        let pos = ro + t*rd;
        let mpv: vec2<f32> = map(pos);

        let den = clamp(mpv.x - 0.3, 0., 1.) * 1.12;
        let dn = clamp((mpv.x + 2.), 0., 3.);

        var col = vec4<f32>(0.);

        if (mpv.x > 0.6)
        {
            col = vec4<f32>(sin(vec3<f32>(5.,0.4,0.2) + mpv.y*0.1 +sin(pos.z*0.4)*0.5 + 1.8)*0.5 + 0.5,0.08);
            col = col*den*den*den;
            col = vec4<f32>(col.rgb * linstep(4.,-2.5, mpv.x)*2.3, col.a);
            var dif = clamp((den - map(pos+.8).x)/9., 0.001, 1.);
            dif = dif + clamp((den - map(pos+.35).x)/2.5, 0.001, 1.);
            col = vec4<f32>(col.xyz * den*(vec3<f32>(0.005,.045,.075) + 1.5*vec3<f32>(0.033,0.07,0.03)*dif), col.a);
        }

        let fogC = exp(t*0.2 - 2.2);
        col = col + vec4<f32>(0.06, 0.11, 0.11, 0.1) * clamp(fogC-fogT, 0., 1.);
        fogT = fogC;
        rez = rez + col*(1. - rez.a);
        t = t + clamp(0.5 - dn*dn*.05, 0.09, 0.3);
    }

    return clamp(rez, vec4<f32>(0.), vec4<f32>(1.));
}

fn getsat(c: vec3<f32>) -> f32{
    let mi = min(min(c.x, c.y), c.z);
    let ma = max(max(c.x, c.y), c.z);
    return (ma - mi) / (ma + 1.e-7);
}

//from my "Will it blend" shader (https://www.shadertoy.com/view/lsdGzN)
fn iLerp(a: vec3<f32>, b: vec3<f32>, x: f32) -> vec3<f32> {
    var ic = mix(a, b, x) + vec3<f32>(1.e-6, 0., 0.);
    let sd = abs(getsat(ic) - mix(getsat(a), getsat(b), x));
    let dir = normalize(vec3<f32>(2.*ic.x - ic.y - ic.z, 2.*ic.y - ic.x - ic.z, 2.*ic.z - ic.y - ic.x));
    let lgt = dot(vec3<f32>(1.0), ic);
    let ff = dot(dir, normalize(ic));
    ic = ic + 1.5*dir*sd*ff*lgt;
    return clamp(ic, vec3<f32>(0.), vec3<f32>(1.));
}


@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    var iResolution = vec2<f32>(textureDimensions(img_output));
    var gl_FragCoord = vec2<f32>(global_id.xy) + 0.5;
    var fragCoord = gl_FragCoord;

    let q = fragCoord.xy / iResolution.xy;
    let p = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
    bsMo = (staging.iMouse.xy - 0.5*iResolution.xy)/iResolution.y;

    let time = staging.iTime*3.;
    var ro = vec3<f32>(0., 0., time);

    ro = ro + vec3<f32>(sin(staging.iTime)*0.5, sin(staging.iTime*1.)*0., 0.);

    let dspAmp = .85;

    let rotemp = ro.xy + disp(ro.z)*dspAmp;
    ro = vec3<f32>(rotemp.x, rotemp.y, ro.z);

    let tgtDst = 3.5;

    let target = normalize(ro - vec3<f32>(disp(time + tgtDst)*dspAmp, time + tgtDst));
    ro.x = ro.x - bsMo.x*2.;
    var rightdir = normalize(cross(target, vec3<f32>(0. ,1. , 0.)));
    let updir = normalize(cross(rightdir, target));
    rightdir = normalize(cross(updir, target));
    var rd = normalize((p.x*rightdir + p.y*updir)*1. - target);

    let rdtemp : vec2<f32> = rd.xy * rot(-disp(time + 3.5).x*0.2 + bsMo.x); // rd.xy left or right changes something
    rd = vec3<f32>(rdtemp, rd.z);

    prm1 = smoothstep(-0.4, 0.4, sin(staging.iTime*0.3));
    let scn = render(ro, rd, time);
    //let scn = vec4<f32>(rd, 0.);

    var col = scn.rgb;
    col = iLerp(col.bgr, col.rgb, clamp(1. - prm1, 0.05, 1.));
    col = pow(col, vec3<f32>(.55, 0.65, 0.6)) * vec3<f32>(1., .97, .9);
    col = col * (pow( 16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y), 0.12) * 0.7 + 0.3); // Vign
/*
    let uv = vec2<f32>(fragCoord / iResolution);
    col = vec3<f32>( uv, 0.0 );
    col = smoothstep(col, vec3<f32>(0.), vec3<f32>(0.5));
    col = smoothstep(vec3<f32>(0.), vec3<f32>(0.5), col);
    col = normalize(col);
    col = iLerp(vec3<f32>(0.), vec3<f32>(1.), col.x);
    col = vec3<f32>(1., 0., 0.);
    col = rd;
    */
    let fragColor = vec4<f32>( col, 1.0 );

    textureStore(img_output, vec2<i32>(global_id.xy), fragColor);

}