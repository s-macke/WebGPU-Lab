import {GPU} from "../../webgpu/gpu";
import {Texture} from "../../webgpu/texture";
import {Buffer} from "../../webgpu/buffer";
import {Raytrace} from "../../raytrace/raytrace";
import {ShowError} from "../../ui";
import {SDF} from "../../sdf/sdf";

export class LightScene {
    width: number
    height: number

    emitter: Texture
    stagingBuffer: Buffer

    bind_group_layout: GPUBindGroupLayout
    bind_group: GPUBindGroup
    pipeline_layout: GPUPipelineLayout
    compute_pipeline: GPUComputePipeline
    shader: GPUProgrammableStage

    sdf: SDF
    raytrace: Raytrace
    //textureSignedDistance: Texture

    constructor(stagingBuffer : Buffer) {
        this.width = GPU.viewport.width
        this.height = GPU.viewport.height
        this.stagingBuffer = stagingBuffer
    }

    async Destroy() {
        this.emitter.destroy()
        //this.textureSignedDistance.destroy()
        await this.sdf.Destroy()
        await this.raytrace.Destroy()
    }

    async Init() {
        console.log("Init Scene")
        let shader = await GPU.CreateShaderFromURL(
            "scripts/modules/light/propagation/common.wgsl",
            "scripts/light2/scene/scene.wgsl")

        // 0: color emitter circular harmonics, z-component
        // 1: normal vector of the surface
        this.emitter = GPU.CreateStorageTextureArray(this.width, this.height, 2,  "rgba8unorm")

        this.raytrace = new Raytrace("fbm.wgsl")
        try {
            await this.raytrace.Init()
            await this.raytrace.Run()
        } catch (e) {
            ShowError("Creation of FBM failed", e as Error)
            throw e
        }

        this.sdf = new SDF(this.raytrace.texturedest)
        try {
            await this.sdf.Init()
            for(let i = 0; i < 256; i++) {
                await this.sdf.Run()
            }
        } catch (e) {
            ShowError("Creation of SDF failed", e as Error)
            throw e
        }

        this.bind_group_layout = GPU.device.createBindGroupLayout({
            label: "Scene",
            entries: [{
                binding: 0,
                storageTexture: {
                    access: "write-only",
                    format: this.emitter.format,
                    viewDimension: "2d-array"
                },
                visibility: GPUShaderStage.COMPUTE
            }, {
                binding: 1,
                buffer: {
                    type: "uniform"
                },
                visibility: GPUShaderStage.COMPUTE,
            }, {
                binding: 2,
                texture: {
                    sampleType: "unfilterable-float",
                },
                visibility: GPUShaderStage.COMPUTE
            }, ]
        });

        this.bind_group = GPU.device.createBindGroup({
            label: "Scene",
            layout: this.bind_group_layout,
            entries: [{
                binding: 0,
                resource: this.emitter.textureView
            }, {
                binding: 1,
                resource: this.stagingBuffer.resource
            }, {
                binding: 2,
                resource: this.sdf.texturea.textureView
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
        let encoder: GPUCommandEncoder = GPU.CreateCommandEncoder();
        {
            let pass: GPUComputePassEncoder = encoder.beginComputePass();
            pass.setBindGroup(0, this.bind_group);
            pass.setPipeline(this.compute_pipeline);
            pass.dispatchWorkgroups(this.width/8, this.height/8);
            pass.end();
        }
        //encoder.copyTextureToTexture({texture: this.velocitydest.texture}, {texture: this.velocity.texture}, [this.width, this.height, 1]);

        let command_buffer: GPUCommandBuffer = GPU.FinishCommandEncoder(encoder)
        return command_buffer;
    }

    async Run() {
        GPU.device.queue.submit([this.GetCommandBuffer()]);
        await GPU.device.queue.onSubmittedWorkDone()
    }
}
