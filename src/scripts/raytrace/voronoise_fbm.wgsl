struct StagingBuffer
{
    iMouse: vec2<f32>,
    iTime: f32
};

@group(0) @binding(0) var img_output: texture_storage_2d<rgba32float, write>;
@group(0) @binding(1) var<uniform> staging: StagingBuffer;

const NUM_OCTAVES : i32 = 6;

fn rnd33( p : vec3<f32> ) -> vec3<f32> {
    let q = vec3<f32>( dot(p,vec3<f32>(127.1,311.7, 109.2)),
                   dot(p,vec3<f32>(269.5,183.3, 432.6)),
                   dot(p,vec3<f32>(419.2,371.9, 304.4)) );
    return fract(sin(q)*43758.5453);
}

fn rnd13( p : vec3<f32> ) -> f32 {
    return fract(43758.5453*sin(dot(p,vec3(127.1,311.7, 109.2))));
}

fn worley3D(u : vec3<f32>) -> f32 {
    let d = 1.e4;
    let a = 0.;
    var acc = 0.;
    var acc_w = 0.;
    let k = floor(u);
    let f = u - k;
    var p : vec3<f32>;
    let q = k;
    const r : i32 = 3;
    for(var i = -r; i < r; i++) {
        for(var j = -r; j < r; j++) {
            for(var l = -r; l < r; l++) {
	            let p_i = vec3<f32>(f32(i), f32(j), f32(l));
                let p_f = rnd33(k+p_i);
        	    let d = length(p_i - f + p_f);
            	let w = exp(-8. * d) * (1. - step(sqrt(f32(r*r)),d));
            	acc += w * rnd13(k+p_i);
            	acc_w += w;
    	    }
    	}
    }
    return acc / acc_w;
}

fn fbm3D(_u : vec3<f32>) -> f32 {
    var u = _u;
    var v : f32 = 0.;
    for(var i = 0; i < NUM_OCTAVES; i++) {
        v += pow(.5, f32(i+1)) * worley3D(u);
        u = 2. * u + 1e3;
    }
    return v;
}


@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let pixel_coords = vec2<i32>(global_id.xy);
    var iResolution = vec2<f32>(textureDimensions(img_output));
    let uv : vec2<f32> = vec2<f32>(pixel_coords)/iResolution.y;

	let p = uv * 3.;
    var col = vec3<f32>(0.);
    let t = staging.iTime/3.;
//    col += fbm3D( vec3(p, staging.iTime/3.) );

   	col += fbm3D( vec3(p, t) +
           	   vec3( fbm3D(vec3(p, t)+vec3(1e3)),
                   	 fbm3D(vec3(p, t)-vec3(1e3)),
                     fbm3D(vec3(p, -t))
                   )
      		 );

/*
    	col = vec3( fbm3D(vec3(p, t)+vec3(1e3)),
                    fbm3D(vec3(p, t)-vec3(1e3)),
                    fbm3D(vec3(p, -t))
                   );
*/
    let fragColor = vec4<f32>(col, 1.0);
    textureStore(img_output, pixel_coords, fragColor);
}
