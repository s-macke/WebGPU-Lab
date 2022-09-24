# WebGPU-Experiments

**[Demo][project demo]**

My experiments in WebGPU technology. The focus is especially on compute shaders.

### WebGPU Features
Shows the features and limits of the selected GPU. 
Two different GPU types can be selected. Either "high-performance" or "low-power".
This plays only a role, if you have more than one GPU in your system.

### Simple Render of Texture
Very simple texture rendering. 
The texture is created in the compute shader and then rendered in the render shader.

[Vertex Shader](src/render/render.vert.wgsl)

[Fragment Shader](src/render/render.frag.wgsl)

### Global illumination
Source: https://www.shadertoy.com/view/4sfGDB

Translated from GLSL to WGSL.

[Compute Shader](src/raytrace/light.wgsl)

### Protean Clouds
Source: https://www.shadertoy.com/view/3l23Rh

Translated from GLSL to WGSL.

[Compute Shader](src/raytrace/cloud.wgsl)

### Collatz Conjecture
Source: https://github.com/gfx-rs/wgpu/tree/master/wgpu/examples/hello-compute

[Compute Shader](src/collatz/collatz.wgsl)


### Voronoise
Source: https://www.shadertoy.com/view/Xd23Dh

Translated from GLSL to WGSL.

[Compute Shader](src/raytrace/voronoise.wgsl)

### FBM
A very simple noise + FBM shader.

[Compute Shader](src/raytrace/fbm.wgsl)

### 2D Light
Original Source: https://www.shadertoy.com/view/4dfXDn

Translated from GLSL to WGSL.

[Compute Shader](src/raytrace/light.wgsl)

### Signed Distance Field
Source: https://www.shadertoy.com/view/tdjBzG

Translated from GLSL to WGSL.

[Compute Shader](src/sdf/sdf.wgsl)

### Fluid Simulation

[Code](src/fluid)

# Tutorial

https://sotrh.github.io/learn-wgpu/beginner/tutorial5-textures/#loading-an-image-from-a-file

[project demo]: https://s-macke.github.io/WebGPU-Lab/