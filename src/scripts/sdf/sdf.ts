import {GPU} from "../webgpu/gpu";
import {Texture} from "../webgpu/texture";

export class SDF {
    width: number;
    height: number;

    texture_border: Texture;
    texturea: Texture;
    textureb: Texture;
    render_output: Texture;

    bind_group_layout: GPUBindGroupLayout;
    bind_group: GPUBindGroup;
    pipeline_layout: GPUPipelineLayout;
    compute_pipeline: GPUComputePipeline;

    constructor(texture_border: Texture) {
        this.texture_border = texture_border;
        this.width = texture_border.width;
        this.height = texture_border.height;
        this.texturea = GPU.CreateStorageTexture(this.width, this.height, "rg32float");
        this.textureb = GPU.CreateStorageTexture(this.width, this.height, "rg32float");
        this.render_output = GPU.CreateStorageTexture(this.width, this.height, "rgba32float");
    }

    destroy() {
        this.texturea.destroy()
        this.textureb.destroy()
    }

    async Init() {
        let shader: GPUProgrammableStage = await GPU.CreateWGSLShader("scripts/sdf/sdf.wgsl");

        this.bind_group_layout = GPU.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                texture: { sampleType: "unfilterable-float" }
            }, {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                texture: { sampleType: "unfilterable-float" }
            }, {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: {
                    access: "write-only",
                    format: "rg32float"
                }
            }, {
                binding: 3,
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
                resource: this.texture_border.textureView
            }, {
                binding: 1,
                resource: this.texturea.textureView
            }, {
                binding: 2,
                resource: this.textureb.textureView
            }, {
                binding: 3,
                resource: this.render_output.textureView
            }]
        })

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
            pass.setBindGroup(0, this.bind_group);
            pass.setPipeline(this.compute_pipeline);
            pass.dispatchWorkgroups(this.width/8, this.height/8);
            pass.end();
        }
        encoder.copyTextureToTexture({ texture: this.textureb.texture }, { texture: this.texturea.texture }, [this.width, this.height, 1]);
        let command_buffer: GPUCommandBuffer = encoder.finish();
        return command_buffer;
    }
}