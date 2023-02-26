// Original Source: https://www.shadertoy.com/view/4dfXDn

struct StagingBuffer
{
    iMouse: vec2<f32>,
    iTime: f32
};

@group(0) @binding(0) var img_output: texture_storage_2d<rgba32float, write>;
@group(0) @binding(1) var<uniform> staging: StagingBuffer;

fn circleDist(p: vec2<f32>,  radius: f32) -> f32
{
    return length(p) - radius;
}

fn luminance(col: vec4<f32>) -> f32
{
    return 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b;
}

fn setLuminance(col: ptr<function, vec4<f32>>, lum_par: f32)
{
    var lum = lum_par / luminance(*col);
    *col = *col * lum;
}

///////////////////////
// Masks for drawing //
///////////////////////

fn fillMask(dist: f32) -> f32
{
    return clamp(-dist, 0.0, 1.0);
}

fn innerBorderMask(dist : f32, width : f32) -> f32
{
    //dist += 1.0;
    var alpha1 : f32 = clamp(dist + width, 0.0, 1.0);
    var alpha2 : f32 = clamp(dist, 0.0, 1.0);
    return alpha1 - alpha2;
}

/*
float outerBorderMask(float dist, float width)
{
    //dist += 1.0;
    float alpha1 = clamp(dist, 0.0, 1.0);
    float alpha2 = clamp(dist - width, 0.0, 1.0);
    return alpha1 - alpha2;
}
*/

fn sceneDist(p : vec2<f32>) -> f32
{
    return circleDist(p-vec2<f32>(256., 256.), 40.5);
    //return texture(iChannel0, p/iResolution.xy).r + 1. * 0.5;
}

fn sceneSmooth(p: vec2<f32>, r: f32) -> f32
{
    var accum: f32 = sceneDist(p);
    accum += sceneDist(p + vec2(0.0, r));
    accum += sceneDist(p + vec2(0.0, -r));
    accum += sceneDist(p + vec2(r, 0.0));
    accum += sceneDist(p + vec2(-r, 0.0));
    return accum / 5.0;
}


//////////////////////
// Shadow and light //
//////////////////////

fn shadow(p: vec2<f32>,  pos: vec2<f32>, radius: f32) -> f32
{
    var dir = normalize(pos - p);
    var dl = length(p - pos);

    // fraction of light visible, starts at one radius (second half added in the end);
    var lf = radius * dl;

    // distance traveled
    var dt = 0.01;

    for (var i = 0; i < 64; i++)
    {

        // distance to scene at current position
        var sd = sceneDist(p + dir * dt);

        // early out when this ray is guaranteed to be full shadow
        if (sd < -radius) {
            return 0.;
        }

        // width of cone-overlap at light
        // 0 in center, so 50% overlap: add one radius outside of loop to get total coverage
        // should be '(sd / dt) * dl', but '*dl' outside of loop
        lf = min(lf, sd / dt);

        // move ahead
        dt += max(1.0, abs(sd));
        if (dt > dl) {
            break;
        }

    }

    // multiply by dl to get the real projected overlap (moved out of loop)
    // add one radius, before between -radius and + radius
    // normalize to 1 ( / 2*radius)
    lf = clamp((lf*dl + radius) / (2.0 * radius), 0.0, 1.0);
    lf = smoothstep(0.0, 1.0, lf);
    return lf;
}

fn drawLight(p: vec2<f32>, pos: vec2<f32>, color: vec4<f32>, dist: f32, range: f32, radius: f32) -> vec4<f32>
{
    // distance to light
    var ld = length(p - pos);

    // out of range
    if (ld > range) {return vec4<f32>(0.0);}

    // shadow and falloff
    var shad = shadow(p, pos, radius);

    var fall = (range - ld)/range;
    fall *= fall;
    var source = fillMask(circleDist(p - pos, radius));
    return (shad * fall + source) * color;
}


fn AO(p : vec2<f32>, dist : f32, radius : f32, intensity : f32) -> f32
{
    var a = clamp(dist / radius, 0.0, 1.0) - 1.0;
    return 1.0 - (pow(abs(a), 5.0) + 1.0) * intensity + (1.0 - intensity);
    //return smoothstep(0.0, 1.0, dist / radius);
}


fn modulo(a: f32, b: f32) -> f32
{
    return a - b * floor(a / b);
}



@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    var iResolution = vec2<f32>(textureDimensions(img_output));
    var gl_FragCoord = vec2<f32>(global_id.xy) + 0.5;
    var fragCoord = gl_FragCoord;

    var col = vec4(0.0);

    let p : vec2<f32> = fragCoord.xy;// + vec2(0.5);
    let c : vec2<f32> = iResolution.xy / 2.0;
    let dist : f32 = sceneDist(p);

    // Normalized pixel coordinates (from 0 to 1)
    //vec2 uv = fragCoord/iResolution.xy;

    var light1Pos = staging.iMouse.xy;
    var light1Col = vec4<f32>(0.75, 1.0, 0.5, 1.0);
    setLuminance(&light1Col, 0.4);

    var light2Pos = vec2(iResolution.x * (sin(staging.iTime + 3.1415) + 1.2) / 2.4, 175.0);
    var light2Col = vec4(1.0, 0.75, 0.5, 1.0);
    setLuminance(&light2Col, 0.5);

    var light3Pos = vec2(iResolution.x * (sin(staging.iTime) + 1.2) / 2.4, 340.0);
    var light3Col = vec4(0.5, 0.75, 1.0, 1.0);
    setLuminance(&light3Col, 0.6);

    // gradient
    col = vec4(0.5, 0.5, 0.5, 1.0) * (1.0 - length(c - p)/iResolution.x);
    // grid
    col *= clamp(min(modulo(p.y, 10.0), modulo(p.x, 10.0)), 0.9, 1.0);
    // ambient occlusion
    col *= AO(p, sceneSmooth(p, 10.0), 40.0, 0.4);

    // light
    col += drawLight(p, light1Pos, light1Col, dist, 150.0, 6.0);
    col += drawLight(p, light2Pos, light2Col, dist, 200.0, 8.0);
    col += drawLight(p, light3Pos, light3Col, dist, 300.0, 12.0);


    // shape fill
    col = mix(col, vec4(1.0, 0.4, 0.0, 1.0), fillMask(dist));
    // shape outline

    col = mix(col, vec4(0.1, 0.1, 0.1, 1.0), innerBorderMask(dist, 1.5));

    //fragColor = vec4(texture(iChannel0, uv).r + 1. * 0.5, 0., 0., 1.);
    var fragColor = col;

    textureStore(img_output, vec2<i32>(global_id.xy), fragColor);

}
