import {GPU} from "../../webgpu/gpu";
import {Texture} from "../../webgpu/texture";
import {toHalf} from "../../webgpu/utils";
import AdvectShader from "./advect.wgsl"

export class Advect {
    width: number;
    height: number;

    velocitysrc: Texture;
    velocitydest: Texture;
    flags: Texture;

    bind_group_layout: GPUBindGroupLayout;
    bind_group_a2b: GPUBindGroup;
    pipeline_layout: GPUPipelineLayout;
    compute_pipeline: GPUComputePipeline;

    constructor(velocity: Texture, flags: Texture) {
        this.velocitysrc = velocity;
        this.flags = flags
        this.width = velocity.width;
        this.height = velocity.height;
    }

    async Init() {
        let shader = await GPU.CompileShader(AdvectShader)

        this.velocitydest = GPU.CreateTexture(this.velocitysrc.width, this.velocitysrc.height, this.velocitysrc.format);

        this.bind_group_layout = GPU.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                texture: {sampleType: "float"},
                visibility: GPUShaderStage.COMPUTE
            }, {
                binding: 1,
                sampler: {},
                visibility: GPUShaderStage.COMPUTE
            }, {
                binding: 2,
                storageTexture: {
                    access: "write-only",
                    format: "rgba16float"
                },
                visibility: GPUShaderStage.COMPUTE
            }, {
                binding: 3,
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
                resource: GPU.CreateSampler()
            }, {
                binding: 2,
                resource: this.velocitydest.textureView
            }, {
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

    public async Destroy() {
        this.velocitydest.destroy();
    }


    GetCommandBuffer(): GPUCommandBuffer {

        let encoder: GPUCommandEncoder = GPU.CreateCommandEncoder();
        {
            let pass: GPUComputePassEncoder = encoder.beginComputePass();
            pass.setBindGroup(0, this.bind_group_a2b);
            pass.setPipeline(this.compute_pipeline);
            pass.dispatchWorkgroups((this.width - 2)/8, (this.height - 2)/8);
            pass.end();
        }
        encoder.copyTextureToTexture({texture: this.velocitydest.texture}, {texture: this.velocitysrc.texture}, [this.width, this.height, 1]);
        /*
        {
            let pass: GPUComputePassEncoder = encoder.beginComputePass();
            pass.setBindGroup(0, this.bind_group_b2a);
            pass.setPipeline(this.compute_pipeline);
            pass.dispatch(this.width, this.height);
            pass.endPass();
        }
        */
        let command_buffer: GPUCommandBuffer = GPU.FinishCommandEncoder(encoder)
        return command_buffer;
    }

    async Step() {
        GPU.device.queue.submit([this.GetCommandBuffer()]);
        await GPU.device.queue.onSubmittedWorkDone()
    }

}
