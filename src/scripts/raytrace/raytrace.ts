import {GPU} from "../webgpu/gpu";
import {Texture} from "../webgpu/texture";

export class Raytrace {
    width: number;
    height: number;

    texture: Texture;

    bind_group_layout: GPUBindGroupLayout;
    bind_group: GPUBindGroup;
    pipeline_layout: GPUPipelineLayout;
    compute_pipeline: GPUComputePipeline;
    shader: GPUProgrammableStage;

    constructor() {
        this.width = GPU.width;
        this.height = GPU.height;

        console.log("Create Texture")
        this.texture = GPU.CreateStorageTexture(this.width, this.height, "rgba32float");
    }

    destroy() {
        this.texture.destroy()
    }

    async Init(filename: string) {
        this.shader = await GPU.CreateWGSLShader("scripts/raytrace/" + filename);
        this.shader.constants = {
            iTime: 1.,
        }

        this.bind_group_layout = GPU.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: {
                    access: "write-only",
                    format: "rgba32float"
                }
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

        this.compute_pipeline = GPU.device.createComputePipeline({
            layout: this.pipeline_layout,
            compute: this.shader
        });
    }

    GetCommandBuffer(): GPUCommandBuffer {
        this.shader.constants.iTime++;

        let encoder: GPUCommandEncoder = GPU.device.createCommandEncoder({});
        {
            let pass: GPUComputePassEncoder = encoder.beginComputePass();
            pass.setBindGroup(0, this.bind_group);
            pass.setPipeline(this.compute_pipeline);
            pass.dispatch(this.width, this.height);
            pass.endPass();
        }
        let command_buffer: GPUCommandBuffer = encoder.finish();
        return command_buffer;
    }

    async Run() {
        GPU.device.queue.submit([this.GetCommandBuffer()]);
        await GPU.device.queue.onSubmittedWorkDone();
    }

}