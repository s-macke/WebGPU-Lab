import {GPU} from "../../webgpu/gpu";
import {Texture} from "../../webgpu/texture";

export class Transport {
    width: number;
    height: number;
    velocity: Texture;
    texturea: Texture;
    textureb: Texture;
    flags: Texture;
    bind_group_layout: GPUBindGroupLayout;
    bind_group_a2b: GPUBindGroup;
    bind_group_b2a: GPUBindGroup;
    pipeline_layout: GPUPipelineLayout;
    compute_pipeline: GPUComputePipeline;

    constructor(velocity: Texture, density: Texture, flags: Texture) {
        this.velocity = velocity;
        this.texturea = density;
        this.flags = flags
        this.width = velocity.width;
        this.height = velocity.height;
    }

    async Init() {
        let shader = await GPU.CreateWGSLShader("scripts/fluid/transport/transport.wgsl");
        shader.constants = {
            dt: 1.,
        }

        this.textureb = GPU.CreateTexture(this.texturea.width, this.texturea.height, this.texturea.format);

        this.bind_group_layout = GPU.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                texture: {},
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
                texture: {},
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
                resource: this.texturea.textureView
            }, {
                binding: 1,
                resource: GPU.CreateSampler()
            }, {
                binding: 2,
                resource: this.textureb.textureView
            }, {
                binding: 3,
                resource: this.velocity.textureView
            }, {
                binding: 4,
                resource: this.flags.textureView
            }]
        });

        this.bind_group_b2a = GPU.device.createBindGroup({
            layout: this.bind_group_layout,
            entries: [{
                binding: 0,
                resource: this.textureb.textureView
            }, {
                binding: 1,
                resource: GPU.CreateClampedSampler()
            }, {
                binding: 2,
                resource: this.texturea.textureView
            }, {
                binding: 3,
                resource: this.velocity.textureView
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

    GetCommandBuffer() : GPUCommandBuffer {
        let encoder: GPUCommandEncoder = GPU.device.createCommandEncoder({});
        {
            let pass: GPUComputePassEncoder = encoder.beginComputePass();
            pass.setBindGroup(0, this.bind_group_a2b);
            pass.setPipeline(this.compute_pipeline);
            pass.dispatch((this.width-2)/2, (this.height-2)/2);
            pass.endPass();
        }
        encoder.copyTextureToTexture({texture: this.textureb.texture}, {texture: this.texturea.texture}, [this.width, this.height, 1]);
        /*
        {
            let pass: GPUComputePassEncoder = encoder.beginComputePass();
            pass.setBindGroup(0, this.bind_group_b2a);
            pass.setPipeline(this.compute_pipeline);
            pass.dispatch(this.width, this.height);
            pass.endPass();
        }
        */
        let command_buffer: GPUCommandBuffer = encoder.finish();
        return command_buffer;
    }

    async Step() {
        GPU.device.queue.submit([this.GetCommandBuffer()]);
        await GPU.device.queue.onSubmittedWorkDone()
    }

}
