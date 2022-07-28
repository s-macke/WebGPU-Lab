import {GPU} from "../../webgpu/gpu";
import {Texture} from "../../webgpu/texture";
import {toHalf} from "../../webgpu/utils";

export class Div {
    width: number;
    height: number;

    velocity: Texture;
    div: Texture;
    flags: Texture;

    bind_group_layout: GPUBindGroupLayout;
    bind_group: GPUBindGroup;
    pipeline_layout: GPUPipelineLayout;
    compute_pipeline: GPUComputePipeline;

    constructor(velocity: Texture, flags: Texture) {
        this.velocity = velocity;
        this.flags = flags;
        this.width = velocity.width;
        this.height = velocity.height;
    }

    async Init() {
        console.log("Init div");
        let shader = await GPU.CreateWGSLShader("scripts/fluid/div/div.wgsl")
        this.div = GPU.CreateTexture(this.velocity.width, this.velocity.height, "r32float");

        this.bind_group_layout = GPU.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                texture: {},
                visibility: GPUShaderStage.COMPUTE
            }, {
                binding: 1,
                storageTexture: {
                    access: "write-only",
                    format: "r32float"
                },
                visibility: GPUShaderStage.COMPUTE
            }, {
                binding: 2,
                texture: {sampleType: "sint"},
                visibility: GPUShaderStage.COMPUTE
            }]
        });

        this.bind_group = GPU.device.createBindGroup({
            layout: this.bind_group_layout,
            entries: [{
                binding: 0,
                resource: this.velocity.textureView
            },{
                binding: 1,
                resource: this.div.textureView
            },{
                binding: 2,
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
        let command_buffer: GPUCommandBuffer = encoder.finish();
        return command_buffer;
    }

    async Step() {
        GPU.device.queue.submit([this.GetCommandBuffer()]);
        await GPU.device.queue.onSubmittedWorkDone()
    }

}
