var<private> mouse_pos = vec2<f32>(0.);
var<private> mouse_wheel: f32 = 0.;

fn rotate(p: vec2<f32>, r: f32) -> vec2<f32> {
    let c: f32 = cos(r);
    let s: f32 = sin(r);
    return mat2x2f(c, s, -s, c) * p;
}

// shaded distance
struct SD {
    d : f32,
    albedo: vec3<f32>,
    emissive: bool
};

fn sd_min(a: SD, b: SD) -> SD {
    if (a.d <= b.d) {
        return a;
    } else {
        return b;
    }
}

fn sd_max(a: SD, b: SD) -> SD {
    if (a.d >= b.d) {
        return a;
    }
    else {
        return b;
    }
}

fn sd_neg(a: SD) -> SD {
    return SD(-a.d, a.albedo, a.emissive);
}

fn shade(d: f32, albedo: vec3<f32>) -> SD{
    return SD(d, albedo, false);
}

fn emitter(d : f32, light: vec3<f32>) -> SD {
    return SD(d, light, true);
}

fn box(_p: vec2<f32>, r: vec2<f32>) -> f32 {
    let p = abs(_p) - r;
    return max(p.x, p.y);
}

fn sphere(p: vec2<f32>, r: f32) -> f32 {
    return length(p) - r;
}

fn slitlight(p: vec2<f32>) -> SD {
    const color: vec3<f32> = vec3(0.01, 0.5, 0.95);
    var angle : f32 = max(0.0,cos(atan2(p.y, p.x)*6.0));
    if (angle < 0.5) {
        angle = 0.0;
    }
    let d2: SD = emitter(sphere(p, 0.1),color * angle * 20.0);
    return d2;
}

fn map(p: vec2<f32>) -> SD {
    const color1 = vec3<f32>(0.8);
    const color3 = vec3<f32>(0.95, 0.5, 0.01);
    const color4 = vec3<f32>(0.01, 1.0, 0.8);

    //let c = vec4<f32>(textureSampleLevel(signed_distance, signed_distance_sampler, p, 0.)).r;
    //let distance: vec2<f32> = textureLoad(signed_distance, p, 0).x;

    //let d: SD = SD(distance.x, color1, false);

    let d: SD = shade(sphere(p, 0.5), color1);

    let d2: SD = slitlight(p - vec2(-0.8,-0.1));

    let d3: SD = shade(box(p - vec2(-0.5,-0.2), vec2(0.52,0.05)),color1);

    let d4: SD = shade(box(rotate(p, radians(90.0+30.5)) - vec2(0.0, 0.0), vec2(0.05,0.8)), color3);
    let d5: SD = shade(box(p - vec2(0.0, 0.0), vec2(0.05,0.4)), color3);
    let d7: SD = shade(box(p - vec2(0.20, 0.1), vec2(0.05,0.2)), color4);

    let d6: SD = emitter(box(rotate(p - vec2(0.25, -0.2), radians(30.5)), vec2(0.01,0.04)), 20.0*vec3(1.0,0.9,0.8));

    //let mouse_pos: vec2<f32> = vec2<f32>(0.0, 0.0);
    let d8: SD = shade(sphere(p - mouse_pos, (-mouse_wheel*0.005+0.05)), vec3(1.0));

    return sd_min(d8,sd_min(d6,sd_min(d3,sd_min(d2, sd_max(d,sd_neg(sd_min(d7,sd_min(d4,d5))))))));
}

fn normal_map(p: vec2<f32>, eps: f32) -> vec2<f32> {
    return normalize(vec2<f32>(
        (map(p + vec2(eps, 0.0)).d - map(p - vec2(eps, 0.0)).d),
        (map(p + vec2(0.0, eps)).d - map(p - vec2(0.0, eps)).d)));
}
