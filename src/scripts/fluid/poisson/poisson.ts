import {GPU} from "../../webgpu/gpu";
import {Texture} from "../../webgpu/texture";
import {toHalf} from "../../webgpu/utils";

export class Poisson {
    width: number;
    height: number;
    velocity: Texture;
    flags: Texture
    rhs: Texture;
    pressurea: Texture;
    pressureb: Texture;
    scaleedges: Texture;
    scalecenter: Texture;
    bind_group_layout: GPUBindGroupLayout;
    bind_groupa: GPUBindGroup;
    bind_groupb: GPUBindGroup;
    pipeline_layout: GPUPipelineLayout;
    compute_pipeline: GPUComputePipeline;

    constructor(rhs: Texture, flags: Texture) {
        this.rhs = rhs;
        this.flags = flags;
        this.width = rhs.width;
        this.height = rhs.height;
    }

    async Init() {
        let shader = await GPU.CreateShader("scripts/fluid/poisson/jacobi.wgsl")

        await this.InitScaler();
        this.pressurea = GPU.CreateTexture(this.width, this.height, "r32float");
        this.pressureb = GPU.CreateTexture(this.width, this.height, "r32float");

        this.bind_group_layout = GPU.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                texture: {
                    sampleType: "unfilterable-float"
                },
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
                texture: {
                    sampleType: "unfilterable-float"
                },
                visibility: GPUShaderStage.COMPUTE
            }, {
                binding: 3,
                texture: {sampleType: "sint"},
                visibility: GPUShaderStage.COMPUTE
            }]
        });
        /*
        this.bind_group_layout = GPU.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                texture: {
                    sampleType: "unfilterable-float"
                },
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
                texture: {
                    sampleType: "unfilterable-float"
                },
                visibility: GPUShaderStage.COMPUTE
            }, {
                binding: 3,
                texture: {},
                visibility: GPUShaderStage.COMPUTE
            }, {
                binding: 4,
                texture: {},
                visibility: GPUShaderStage.COMPUTE
            }]
        });
*/
        /*
        this.bind_groupa = GPU.device.createBindGroup({
            layout: this.bind_group_layout,
            entries: [{
                binding: 0,
                resource: this.pressurea.textureView
            }, {
                binding: 1,
                resource: this.pressureb.textureView
            }, {
                binding: 2,
                resource: this.rhs.textureView
            }, {
                binding: 3,
                resource: this.scaleedges.textureView
            }, {
                binding: 4,
                resource: this.scalecenter.textureView
            }]
        });
         */

        this.bind_groupa = GPU.device.createBindGroup({
            layout: this.bind_group_layout,
            entries: [{
                binding: 0,
                resource: this.pressurea.textureView
            }, {
                binding: 1,
                resource: this.pressureb.textureView
            }, {
                binding: 2,
                resource: this.rhs.textureView
            }, {
                binding: 3,
                resource: this.flags.textureView
            }]
        });

        this.bind_groupb = GPU.device.createBindGroup({
            layout: this.bind_group_layout,
            entries: [{
                binding: 0,
                resource: this.pressureb.textureView
            }, {
                binding: 1,
                resource: this.pressurea.textureView
            }, {
                binding: 2,
                resource: this.rhs.textureView
            }, {
                binding: 3,
                resource: this.flags.textureView
            }]
        });

        /*
        this.bind_groupb = GPU.device.createBindGroup({
            layout: this.bind_group_layout,
            entries: [{
                binding: 0,
                resource: this.pressureb.textureView
            }, {
                binding: 1,
                resource: this.pressurea.textureView
            }, {
                binding: 2,
                resource: this.rhs.textureView
            }, {
                binding: 3,
                resource: this.scaleedges.textureView
            }, {
                binding: 4,
                resource: this.scalecenter.textureView
            }]
        });
*/
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

        for(let i=0; i<10; i++) {
            let pass: GPUComputePassEncoder;

            pass = encoder.beginComputePass();
            pass.setBindGroup(0, this.bind_groupa);
            pass.setPipeline(this.compute_pipeline);
            pass.dispatchWorkgroups((this.width-2)/8, (this.height-2)/8);
            pass.end();
            //encoder.copyTextureToTexture({texture: this.pressureb.texture}, {texture: this.pressurea.texture}, [this.width, this.height, 1]);

            pass = encoder.beginComputePass();
            pass.setBindGroup(0, this.bind_groupb);
            pass.setPipeline(this.compute_pipeline);
            pass.dispatchWorkgroups((this.width-2)/8, (this.height-2)/8);
            pass.end();


        }
        let command_buffer: GPUCommandBuffer = encoder.finish();
        return command_buffer;
    }

    async Step() {
        GPU.device.queue.submit([this.GetCommandBuffer()]);
        await GPU.device.queue.onSubmittedWorkDone();
    }

    async InitScaler() {
        let scaleedges = new Uint8Array(this.width * this.height * 4);
        let scalecenter = new Uint8Array(this.width * this.height * 4);

        for (let j = 0; j < this.height; j++)
            for (let i = 0; i < this.width; i++) {
                scaleedges[(j * this.width + i) * 4 + 0] = 255;
                scaleedges[(j * this.width + i) * 4 + 1] = 255;
                scaleedges[(j * this.width + i) * 4 + 2] = 255;
                scaleedges[(j * this.width + i) * 4 + 3] = 255;
                scalecenter[(j * this.width + i) * 4 + 0] = 0;
                scalecenter[(j * this.width + i) * 4 + 1] = 0;
                scalecenter[(j * this.width + i) * 4 + 2] = 0;
                scalecenter[(j * this.width + i) * 4 + 3] = 0;
            }

        this.scaleedges = await GPU.CreateTextureFromArrayBuffer(this.width, this.height, "rgba8unorm", scaleedges);
        this.scalecenter = await GPU.CreateTextureFromArrayBuffer(this.width, this.height, "rgba8unorm", scalecenter);
    }


}
