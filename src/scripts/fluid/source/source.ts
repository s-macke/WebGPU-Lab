import {GPU} from "../../webgpu/gpu";
import {Texture} from "../../webgpu/texture";

export class Source {
    width: number;
    height: number;

    velocitysrc: Texture;
    velocitydest: Texture;
    densitysrc: Texture;
    densitydest: Texture;
    flags: Texture;

    bind_group_layout: GPUBindGroupLayout;
    bind_group_a2b: GPUBindGroup;
    pipeline_layout: GPUPipelineLayout;
    compute_pipeline: GPUComputePipeline;

    constructor(velocity: Texture, density: Texture, flags: Texture) {
        this.velocitysrc = velocity;
        this.densitysrc = density;
        this.flags = flags;
        this.width = velocity.width;
        this.height = velocity.height;
    }

    async Init() {
        let shader = await GPU.CreateShaderFromURL("scripts/fluid/source/source.wgsl")

        this.velocitydest = GPU.CreateTexture(this.velocitysrc.width, this.velocitysrc.height, this.velocitysrc.format);
        this.densitydest = GPU.CreateTexture(this.densitysrc.width, this.densitysrc.height, this.densitysrc.format);

        this.bind_group_layout = GPU.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                texture: {sampleType: "unfilterable-float"},
                visibility: GPUShaderStage.COMPUTE
            }, {
                binding: 1,
                storageTexture: {access: "write-only", format: this.velocitydest.format},
                visibility: GPUShaderStage.COMPUTE
            }, {
                binding: 2,
                texture: {sampleType: "unfilterable-float"},
                visibility: GPUShaderStage.COMPUTE
            }, {
                binding: 3,
                storageTexture: {access: "write-only", format: this.densitydest.format},
                visibility: GPUShaderStage.COMPUTE
            }, {
                binding: 4,
                texture: {sampleType: "sint"},
                visibility: GPUShaderStage.COMPUTE
            }]
        });

        this.bind_group_a2b = GPU.device.createBindGroup({
            layout: this.bind_group_layout,
            entries: [{
                binding: 0,
                resource: this.velocitysrc.textureView
            }, {
                binding: 1,
                resource: this.velocitydest.textureView
            }, {
                binding: 2,
                resource: this.densitysrc.textureView
            }, {
                binding: 3,
                resource: this.densitydest.textureView
            }, {
                binding: 4,
                resource: this.flags.textureView
            }]
        });

        this.pipeline_layout = GPU.device.createPipelineLayout({
            bindGroupLayouts: [this.bind_group_layout]
        });

        this.compute_pipeline = GPU.device.createComputePipeline({
            layout: this.pipeline_layout,
            compute: shader
        });
    }

    GetCommandBuffer(): GPUCommandBuffer {

        let encoder: GPUCommandEncoder = GPU.device.createCommandEncoder({});
        {
            let pass: GPUComputePassEncoder = encoder.beginComputePass();
            pass.setBindGroup(0, this.bind_group_a2b);
            pass.setPipeline(this.compute_pipeline);
            pass.dispatchWorkgroups((this.width)/2, (this.height)/2);
            pass.end();
        }
        encoder.copyTextureToTexture({texture: this.velocitydest.texture}, {texture: this.velocitysrc.texture}, [this.width, this.height, 1]);
        encoder.copyTextureToTexture({texture: this.densitydest.texture}, {texture: this.densitysrc.texture}, [this.width, this.height, 1]);

        let command_buffer: GPUCommandBuffer = encoder.finish();
        return command_buffer;
    }

    async Step() {
        GPU.device.queue.submit([this.GetCommandBuffer()]);
        await GPU.device.queue.onSubmittedWorkDone()
    }

}
