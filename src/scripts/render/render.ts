import {GPU} from "../webgpu/gpu";
import {Texture} from "../webgpu/texture";

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
        let vertShader = await GPU.CreateShader("scripts/render/render.vert.wgsl")
        let fragShader = await GPU.CreateShader("scripts/render/render.frag.wgsl")

        this.bind_group_layout = GPU.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {sampleType: "unfilterable-float"}
            }]
        });

        this.bind_group = GPU.device.createBindGroup({
            layout: this.bind_group_layout,
            entries: [{
                binding: 0,
                resource: this.texture.textureView
            }]
        })

        this.pipeline_layout = GPU.device.createPipelineLayout({
            bindGroupLayouts: [this.bind_group_layout]
        });

        this.pipeline = GPU.device.createRenderPipeline({
            layout: this.pipeline_layout,
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
    }

    GetCommandBuffer() : GPUCommandBuffer {
        const commandEncoder = GPU.device.createCommandEncoder({});
        const passEncoder = commandEncoder.beginRenderPass(GPU.getRenderPassDescriptor());
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, this.bind_group);
        passEncoder.draw(4, 1, 0, 0);
        passEncoder.end();
        return commandEncoder.finish()
    }

    async Render() {
            GPU.device.queue.submit([this.GetCommandBuffer()]);
            await GPU.device.queue.onSubmittedWorkDone();
    }

}
