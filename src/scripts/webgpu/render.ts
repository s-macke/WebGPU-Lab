import {Texture} from "./texture";
import {GPU} from "./gpu";

export async function RenderTexture(texture: Texture) {
    let result = await Promise.all([
        GPU.CreateShaderFromURL("scripts/webgpu/shader/render.vert.wgsl"),
        GPU.CreateShaderFromURL("scripts/webgpu/shader/render.frag.wgsl")])
    let vertShader = result[0];
    let fragShader = result[1];

    if (texture.isFloat == false) {
        fragShader = await GPU.CreateShaderFromURL("scripts/webgpu/shader/render_int.frag.wgsl")
    }
    let sampler = GPU.CreateSampler();

    let layout: GPUBindGroupLayout = GPU.device.createBindGroupLayout({
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            texture: {sampleType: "unfilterable-float"}
        }, {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {}
        }]
    });

    if (texture.isFloat == false) {
        layout = GPU.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {sampleType: "sint"}
            }, {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {}
            }]
        });
    }

    let bind_group: GPUBindGroup = GPU.device.createBindGroup({
        layout: layout,
        entries: [{
            binding: 0,
            resource: texture.textureView
        }, {
            binding: 1,
            resource: sampler
        }]
    })

    let pipelineLayout: GPUPipelineLayout = GPU.device.createPipelineLayout({
        bindGroupLayouts: [layout]
    });

    const pipeline = GPU.device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: vertShader,
        fragment: {
            entryPoint: fragShader.entryPoint,
            module: fragShader.module,
            constants: fragShader.constants,
            targets: [{
                format: navigator.gpu.getPreferredCanvasFormat()
            }]
        },
        primitive: {
            topology: "triangle-strip",
            stripIndexFormat: "uint32"
        }
    });

    let render = () => {
        console.log("render");
        const commandEncoder = GPU.CreateCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass(GPU.getRenderPassDescriptor());
        passEncoder.setPipeline(pipeline);
        passEncoder.setBindGroup(0, bind_group);
        passEncoder.draw(4, 1, 0, 0);
        passEncoder.end();

        GPU.device.queue.submit([GPU.FinishCommandEncoder(commandEncoder)]);
    }
    requestAnimationFrame(render);
}
