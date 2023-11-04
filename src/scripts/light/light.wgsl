@group(0) @binding(0) var img_output: texture_storage_2d<rgba32float, write>;

// bpx distance field. The box has the size b and and edge is at (0, 0)
fn BoxDF(p: vec2<f32>, b: vec2<f32>) -> f32 {
    let d = abs(p - b*0.5) - b*0.5;
    //return min(max(d.x,d.y), 0.) + length(max(d.x, max(d.y, 0.)));
    return min(max(d.x, d.y), 0.) + length(vec2<f32>(max(d.x, 0.), max(d.y, 0.)));
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    var iResolution = vec2<f32>(textureDimensions(img_output));
    var UV = vec2<f32>(global_id.xy) + 0.5;
    var SUV = UV / iResolution.y;

    var LDF: f32;
    var df : f32;

    var c = vec4<f32>(SUV.x, SUV.y, 0., 1.);
    //if (BoxDF(UV, iResolution.xy) < 0.) {
    df = BoxDF(UV, iResolution.xy*0.5);
    c = vec4<f32>(df*0.01, df*0.01, 0., 1.);

    /*
        //Scene
        if (length(iChannelResolution[0].xy - texture(iChannel0, vec2(3.5,0.5)*IRES).zw) > 0.5) {
                //Static geometry
                Output = vec4(0.);
                //Content round box
                if (BoxDF(SUV-vec2(0.125,0.55),vec2(0.075,0.02))-IRES.y*3.<0.) Output = vec4(vec3(0.99,0.1,0.1),1.);
                    if (length(SUV-vec2(0.2,0.5))<0.03) Output = vec4(3.6,2.4,1.6,1.);
                //Normal curve emissive and diffuse
                float fx = SUV.x-(IRES.y/IRES.x)*0.5;
                float fy = SUV.y-0.02;
                df = abs(0.2*exp(-fx*fx*12.)-fy);
                if (df<IRES.y*2.) Output = vec4(1.01+mix(vec3(0.,0.5,2.),vec3(2.,0.7,0.),1.-UV.x*IRES.x),1.);
                df = abs(0.04+0.2*exp(-fx*fx*12.)-fy);
                if (df<IRES.y*2. && abs(fract(SUV.x*7.)-0.5)>0.2) Output = vec4(vec3(0.5),1.);
                //Mandelbrot
                vec4 MOutput = vec4(0.);
                fx = (SUV.x-0.9)*3.;
                fy = (SUV.y-0.7)*3.;
                float tmpz = fx;
                float rfx = 0.707*(fx+fy);
                float rfy = 0.707*(-tmpz+fy);
                tmpz = 0.;
                float zr = 0.;
                float zi = 0.;
                for (int Iter=0; Iter<100; Iter++) {
                    if (zr*zr+zi*zi>4.) break;
                    tmpz = zr;
                    zr = zr*zr-zi*zi+rfx;
                    zi = 2.*zi*tmpz+rfy;
                }
                if (zr*zr+zi*zi<4.) {
                    MOutput = vec4(vec3(0.9),1.);
                }
                //Carving the mandelbrot
                MOutput.w *= float(BoxDF(vec2(fx,fy)-vec2(-0.4,-0.4),vec2(0.5))-0.07>0.);
                if (length(vec2(fx+0.15,fy+0.15))<0.06) Output = vec4(vec3(1.6,2.5,1.6),1.);
                if (MOutput.w>0.5) Output = MOutput;
                //Red/Green box
                if (max(BoxDF(SUV-vec2(1.2,0.3),vec2(0.3)),-BoxDF(SUV-vec2(1.21,0.31),vec2(0.28,0.5)))<0.)
                    Output = vec4(vec3(0.99),1.);
                if (BoxDF(SUV-vec2(1.3,0.325),vec2(0.1,0.01))<0.) Output = vec4(vec3(3.),1.); //Emissive
                    if (BoxDF(SUV-vec2(1.21,0.31),vec2(0.01,0.29))<0.) Output = vec4(vec3(0.99,0.1,0.1),1.); //Red
                    if (BoxDF(SUV-vec2(1.48,0.31),vec2(0.01,0.29))<0.) Output = vec4(vec3(0.05,0.99,0.05),1.); //Green
                    if (LineDF(SUV,vec2(1.3,0.4),vec2(1.4,0.5))<0.015) Output = vec4(vec3(0.99),1.);
                        if (LineDF(SUV,vec2(1.35,0.55),vec2(1.425,0.425))<0.015) Output = vec4(vec3(0.99),1.);
                        if (LineDF(SUV,vec2(1.25,0.6),vec2(1.45,0.6))<0.005) Output = vec4(vec3(0.99),1.);
                //Randomness
                if (BoxDF(SUV-vec2(1.15,0.675),vec2(0.5,0.4))<0.025) {
                    vec2 Rand2 = texture(iChannel2,(SUV-vec2(1.15,0.65))*0.05).yz;
                    if (Rand2.x>0.55) Output = vec4(vec3(0.99)+((Rand2.y>0.89)?0.:0.),1.);
                    if (length(SUV-vec2(1.3,0.815))<0.01) Output = vec4(vec3(3.,1.2,1.2),1.);
                        if (length(SUV-vec2(1.44,0.835))<0.01) Output = vec4(vec3(1.1,3.2,3.2),1.);
                }
           }
*/
    //    }

    textureStore(img_output, vec2<i32>(global_id.xy), c);
}