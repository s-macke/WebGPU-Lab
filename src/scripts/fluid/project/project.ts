import {GPU} from "../../webgpu/gpu";
import {Texture} from "../../webgpu/texture";
import {toHalf} from "../../webgpu/utils";

export class Project {
    width: number;
    height: number;

    pressure: Texture;
    velocity: Texture;
    velocitydest: Texture;
    flags: Texture;

    bind_group_layout: GPUBindGroupLayout;
    bind_group: GPUBindGroup;
    pipeline_layout: GPUPipelineLayout;
    compute_pipeline: GPUComputePipeline;

    constructor(pressure: Texture, velocity: Texture, flags: Texture) {
        this.pressure = pressure;
        this.velocity = velocity;
        this.width = velocity.width;
        this.height = velocity.height;
        this.flags = flags;
    }

    async Init() {
        console.log("Init project");
        let shader = await GPU.CreateShaderFromURL("scripts/fluid/project/project.wgsl")
        this.velocitydest = GPU.CreateStorageTexture(this.velocity.width, this.velocity.height, this.velocity.format);

        this.bind_group_layout = GPU.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                texture: {sampleType: "unfilterable-float"},
                visibility: GPUShaderStage.COMPUTE
            }, {
                binding: 1,
                texture: {sampleType: "unfilterable-float"},
                visibility: GPUShaderStage.COMPUTE
            }, {
                binding: 2,
                storageTexture: {
                    access: "write-only",
                    format: this.velocity.format
                },
                visibility: GPUShaderStage.COMPUTE
            }, {
                binding: 3,
                texture: {sampleType: "sint"},
                visibility: GPUShaderStage.COMPUTE
            }]
        });

        this.bind_group = GPU.device.createBindGroup({
            layout: this.bind_group_layout,
            entries: [{
                binding: 0,
                resource: this.pressure.textureView
            }, {
                binding: 1,
                resource: this.velocity.textureView
            },{
                binding: 2,
                resource: this.velocitydest.textureView
            },{
                binding: 3,
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

    GetCommandBuffer() : GPUCommandBuffer {
        let encoder: GPUCommandEncoder = GPU.device.createCommandEncoder({});
        {
            let pass: GPUComputePassEncoder = encoder.beginComputePass();
            pass.setBindGroup(0, this.bind_group);
            pass.setPipeline(this.compute_pipeline);
            pass.dispatchWorkgroups((this.width-2)/8, (this.height-2)/8);
            pass.end();
        }
        encoder.copyTextureToTexture({texture: this.velocitydest.texture}, {texture: this.velocity.texture}, [this.width, this.height, 1]);

        let command_buffer: GPUCommandBuffer = encoder.finish();
        return command_buffer;
    }

    async Step() {
        GPU.device.queue.submit([this.GetCommandBuffer()]);
        await GPU.device.queue.onSubmittedWorkDone()
    }

}
