struct StagingBuffer
{
    iMouse: vec2<f32>,
    iTime: f32
};
@group(0) @binding(1) var img_output: texture_storage_2d<rgba32float, write>;
@group(0) @binding(2) var<uniform> staging: StagingBuffer;

fn hash3(p: vec2<f32>) -> vec3<f32>
{
    let q: vec3<f32> = vec3<f32>(
                   dot(p, vec2<f32>(127.1, 311.7)),
				   dot(p, vec2<f32>(269.5, 183.3)),
				   dot(p, vec2<f32>(419.2, 371.9)) );
	return fract(sin(q)*43758.5453);
}

fn voronoise(p: vec2<f32>, u: f32, v: f32) -> f32
{
	let k: f32 = 1.0+63.0*pow(1.0-v,6.0);

    let i: vec2<f32> = floor(p);
    let f: vec2<f32> = fract(p);

	var a = vec2<f32>(0.0, 0.0);

    for( var y=-2; y<=2; y++ ) {
    for( var x=-2; x<=2; x++ ) {

        var  g = vec2<f32>( f32(x), f32(y) );
		let  o: vec3<f32> = hash3( i + g ) * vec3<f32>(u, u, 1.0);
		var  d = g - f + o.xy;
		var w = pow( 1.0-smoothstep(0.0,1.414,length(d)), k );
		a = a + vec2<f32>(o.z*w,w);
    }
    }

    return a.x/a.y;
}
/*
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
*/
fn fbm(p_par: vec2<f32>, octaveNum: i32, u: f32, v: f32) -> f32 {
    var p = p_par;
    var acc = 0.;
    let freq = 1.0;
    var amp = 0.5;
    let shift = vec2<f32>(100.);
    for (var i = 0; i < octaveNum; i = i + 1) {
        acc = acc + voronoise(p, u, v) * amp;
        p = p * 2.0 + shift;
        amp = amp * 0.5;
    }
    return acc;
}

/*
fn vignette(color: vec3<f32>, q: vec2<f32>, v: f32) -> vec3<f32> {
    return color * mix(1., pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), v), 0.02);
}
*/

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let pixel_coords = vec2<i32>(global_id.xy);
    var p = vec2<f32>(f32(pixel_coords.x)*0.02, f32(pixel_coords.y)*0.02);

    var uv = 0.5 - 0.5*cos( staging.iTime*vec2<f32>(1.0, 0.5) );
   	uv = uv*uv*(3.0-uv * 2.0);
   	uv = uv*uv*(3.0-uv * 2.0);
  	uv = uv*uv*(3.0-uv * 2.0);

    var col = voronoise(p, uv.x, uv.y);
    //var col = fbm(p, 5, 1., 1.);
    textureStore(img_output, pixel_coords, vec4<f32>(col, col, col, 0.0));

    //textureStore(img_output, pixel_coords, vec4<f32>(fbm(vec3<f32>(f32(global_id.x), f32(global_id.y), 0.)*0.02,5).x));
}
