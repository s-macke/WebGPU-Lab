import {GPU} from "../../webgpu/gpu";
import {Texture} from "../../webgpu/texture";

export class Render {
    bind_group_layout: GPUBindGroupLayout;
    bind_group: GPUBindGroup;
    pipeline_layout: GPUPipelineLayout;
    pipeline: GPURenderPipeline;
    texture: Texture;

    constructor(texture: Texture) {
        this.texture = texture;
    }

    async Init() {
        let vertShader = await GPU.CreateWGSLShader("scripts/fluid/render/render.vert.wgsl")
        let fragShader = await GPU.CreateWGSLShader("scripts/fluid/render/render.frag.wgsl")
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

        this.bind_group = GPU.device.createBindGroup({
            layout: layout,
            entries: [{
                binding: 0,
                resource: this.texture.textureView
            }, {
                binding: 1,
                resource: sampler
            }]
        })

        let pipelineLayout: GPUPipelineLayout = GPU.device.createPipelineLayout({
            bindGroupLayouts: [layout]
        });

        this.pipeline = GPU.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: vertShader,
            fragment: {
                entryPoint: fragShader.entryPoint,
                module: fragShader.module,
                constants: fragShader.constants,
                targets: [{
                    format: GPU.getPreferredFormat()
                }]
            },
            primitive: {
                topology: "triangle-strip",
                stripIndexFormat: "uint32"
            }
        });
    }

    GetCommandBuffer() : GPUCommandBuffer {
        const commandEncoder = GPU.device.createCommandEncoder({});
        const passEncoder = commandEncoder.beginRenderPass(GPU.getRenderPassDescriptor());
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, this.bind_group);
        passEncoder.draw(4, 1, 0, 0);
        passEncoder.endPass();
        return commandEncoder.finish()
    }

    Render() {
            GPU.device.queue.submit([this.GetCommandBuffer()]);
    }

}
