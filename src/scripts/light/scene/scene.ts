import {GPU} from "../../webgpu/gpu";
import {Texture} from "../../webgpu/texture";
import {Buffer} from "../../webgpu/buffer";

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

    //sdf: SDF
    //raytrace: Raytrace
    //textureSignedDistance: Texture

    constructor(stagingBuffer : Buffer) {
        this.width = GPU.viewport.width
        this.height = GPU.viewport.height
        this.stagingBuffer = stagingBuffer
    }

    async Destroy() {
        //this.textureSignedDistance.destroy()
        //await this.sdf.Destroy()
        //await this.raytrace.Destroy()
    }

    async Init() {
        console.log("Init Scene")
        let shader = await GPU.CreateShaderFromURL("scripts/light/common.wgsl", "scripts/light/distance.wgsl", "scripts/light/scene/scene.wgsl")

        // 0: color red emitter circular harmonics
        // 1: color green emitter circular harmonics
        // 2: color blue emitter circular harmonics
        // 3: normal vector of the surface
        // 4: distance, albedo of the surface
        this.emitter = GPU.CreateStorageTextureArray(this.width, this.height, 5,  "rgba32float")
        /*
                this.raytrace = new Raytrace("fbm.wgsl", false)
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
                //this.textureSignedDistance = await GPU.createTextureFromTexture(this.sdf.texturea, "rgba16float")
                this.textureSignedDistance = this.sdf.texturea
        */

        this.bind_group_layout = GPU.device.createBindGroupLayout({
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
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: "uniform"
                }
            }]
        });

        this.bind_group = GPU.device.createBindGroup({
            layout: this.bind_group_layout,
            entries: [{
                binding: 0,
                resource: this.emitter.textureView
            }, {
                binding: 1,
                resource: this.stagingBuffer.resource
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
