/*
Buffer A (Buffer A, keyboard, RGBA Noise Medium)   (//Stores vars)
Buffer B (Buffer A, Buffer b, RGBA Noise Medium, CubeMap a) (Temporal ReSTIR)
Buffer C (Buffer A, Buffer B, RGBA Noise Medium, CubeMap a
Buffer D (Buffer A, Buffer B, Buffer C, Buffer D)   (contains lightning, Temporal accumulation)
CubeMap A (Buffer A, Nothing , RGBA Noise Medium, CubeMap A)  (scene storage)
Image.frag (Buffer A, Buffer C, Buffer D, CubeMap A)
*/

import {GPU} from "../webgpu/gpu";
import {Texture} from "../webgpu/texture";
import {Buffer} from "../webgpu/buffer";
import {GPUAbstractRunner, RunnerType} from "../AbstractGPURunner";
import {Render} from "../render/render";
import {Raytrace} from "../raytrace/raytrace";
import {SDF} from "../sdf/sdf";
import {ShowError} from "../ui";

export class LightPropagation extends GPUAbstractRunner {
    width: number
    height: number

    render: Render
    sdf: SDF
    raytrace: Raytrace

    textureRDest: Texture
    textureGDest: Texture
    textureBDest: Texture
    textureRSrc: Texture
    textureGSrc: Texture
    textureBSrc: Texture
    textureSignedDistance: Texture

    bind_group_layout: GPUBindGroupLayout
    bind_group: GPUBindGroup
    pipeline_layout: GPUPipelineLayout
    compute_pipeline: GPUComputePipeline
    shader: GPUProgrammableStage
    stagingBuffer: Buffer
    stagingData: Float32Array

    constructor() {
        super()
        this.width = GPU.viewport.width
        this.height = GPU.viewport.height
    }

    getType(): RunnerType {
        return RunnerType.ANIM
    }

    async Destroy() {
        this.textureRDest.destroy()
        this.textureGDest.destroy()
        this.textureBDest.destroy()
        this.textureRSrc.destroy()
        this.textureGSrc.destroy()
        this.textureBSrc.destroy()
/*
        await this.sdf.Destroy()
        await this.raytrace.Destroy()
 */
    }

    async Init() {
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
        console.log("Create Texture")
        this.textureRDest = GPU.CreateStorageTexture(this.width, this.height, "rgba32float")
        this.textureGDest = GPU.CreateStorageTexture(this.width, this.height, "rgba32float")
        this.textureBDest = GPU.CreateStorageTexture(this.width, this.height, "rgba32float")
        this.textureRSrc = GPU.CreateStorageTexture(this.width, this.height, "rgba32float")
        this.textureGSrc = GPU.CreateStorageTexture(this.width, this.height, "rgba32float")
        this.textureBSrc = GPU.CreateStorageTexture(this.width, this.height, "rgba32float")

        this.stagingBuffer = GPU.CreateUniformBuffer(4 * 4) // must be a multiple of 16 bytes
        this.stagingData = new Float32Array(4)

        console.log("Create Render")
        this.render = new Render(
            [this.textureRDest, this.textureGDest, this.textureBDest], // , this.textureSignedDistance
            "scripts/light/common.wgsl", "scripts/light/distance.wgsl", "scripts/light/aces-tone-mapping.wgsl")
        await this.render.Init()

        this.shader = await GPU.CreateShaderFromURL("scripts/light/common.wgsl", "scripts/light/distance.wgsl", "scripts/light/propagate.wgsl")

        this.bind_group_layout = GPU.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: {sampleType: "unfilterable-float"}
                }, {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        access: "write-only",
                        format: "rgba32float"
                    }
                }, {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: {sampleType: "unfilterable-float"}
                }, {
                    binding: 3,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        access: "write-only",
                        format: "rgba32float"
                    }
                }, {
                    binding: 4,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: {sampleType: "unfilterable-float"}
                }, {
                    binding: 5,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        access: "write-only",
                        format: "rgba32float"
                    }
                }, {
                    binding: 6,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform"
                    }
                }/*, {
                    binding: 7,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: {sampleType: "unfilterable-float"}
                }, {
                    binding: 8,
                    visibility: GPUShaderStage.COMPUTE,
                    sampler: {}
                }*/]
        })

        this.bind_group = GPU.device.createBindGroup({
            layout: this.bind_group_layout,
            entries: [{
                binding: 0,
                resource: this.textureRSrc.textureView
            },{
                binding: 1,
                resource: this.textureRDest.textureView
            },{
                binding: 2,
                resource: this.textureGSrc.textureView
            },{
                binding: 3,
                resource: this.textureGDest.textureView
            },{
                binding: 4,
                resource: this.textureBSrc.textureView
            }, {
                binding: 5,
                resource: this.textureBDest.textureView
            }, {
                binding: 6,
                resource: this.stagingBuffer.resource
            }/*, {
                binding: 7,
                resource: this.textureSignedDistance.textureView
            }, {
                binding: 8,
                resource: GPU.CreateSampler()
            }*/]
        })


        this.pipeline_layout = GPU.device.createPipelineLayout({
            bindGroupLayouts: [this.bind_group_layout]
        })

        this.compute_pipeline = GPU.device.createComputePipeline({
            layout: this.pipeline_layout,
            compute: this.shader
        })
    }

    GetCommandBuffer(): GPUCommandBuffer {
        this.stagingData[0] = GPU.mouseCoordinate.x; // set iMouseX
        this.stagingData[1] = GPU.mouseCoordinate.y; // set iMouseY
        this.stagingData[2] = GPU.mouseCoordinate.wheel;
        this.stagingData[3] += 1.; // increase iFrame
        GPU.device.queue.writeBuffer(this.stagingBuffer.buffer, 0, this.stagingData)

        let encoder: GPUCommandEncoder = GPU.device.createCommandEncoder({});
        for(let i = 0; i < 20; i++) {
            let pass: GPUComputePassEncoder = encoder.beginComputePass();
            pass.setBindGroup(0, this.bind_group);
            pass.setPipeline(this.compute_pipeline);
            pass.dispatchWorkgroups(this.width / 8, this.height / 8);
            pass.end();

            encoder.copyTextureToTexture({texture: this.textureRDest.texture}, {texture: this.textureRSrc.texture}, [this.width, this.height, 1])
            encoder.copyTextureToTexture({texture: this.textureGDest.texture}, {texture: this.textureGSrc.texture}, [this.width, this.height, 1])
            encoder.copyTextureToTexture({texture: this.textureBDest.texture}, {texture: this.textureBSrc.texture}, [this.width, this.height, 1])
        }
        return encoder.finish();
    }

    async Run() {
        //GPU.device.queue.submit([this.GetCommandBuffer()]);
        GPU.device.queue.submit([this.GetCommandBuffer(), this.render.getCommandBuffer()]);
        await GPU.device.queue.onSubmittedWorkDone();
    }

}
