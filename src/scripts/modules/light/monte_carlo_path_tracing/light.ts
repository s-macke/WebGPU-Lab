import {GPU} from "../../../webgpu/gpu";
import {Texture} from "../../../webgpu/texture";
import {Buffer} from "../../../webgpu/buffer";
import {GPUAbstractRunner, RunnerType} from "../../../AbstractGPURunner";
import {Render} from "../../../render/render";

export class MonteCarloPathTracing extends GPUAbstractRunner {
    width: number
    height: number

    render: Render
    scene: Texture // texture array

    textureDest: Texture
    textureSrc: Texture

    bind_group_layout: GPUBindGroupLayout
    bind_group_atob: GPUBindGroup
    bind_group_btoa: GPUBindGroup

    scene_bind_group_layout: GPUBindGroupLayout
    scene_bind_group: GPUBindGroup

    pipeline_layout: GPUPipelineLayout
    compute_pipeline: GPUComputePipeline
    shader: GPUProgrammableStage

    stagingBuffer: Buffer
    stagingData: Float32Array

    samples: number

    constructor(scene: Texture, samples: number) {
        super()
        this.width = GPU.viewport.width
        this.height = GPU.viewport.height
        this.scene = scene
        this.samples = samples
    }

    getType(): RunnerType {
        return RunnerType.ASYNCANIM
    }

    async Destroy() {
        this.textureDest.destroy()
        this.textureSrc.destroy()
    }

    async Init() {
        console.log("Create Texture")

        this.textureDest = GPU.CreateStorageTextureArray(this.width, this.height, 3, "rgba32float")
        this.textureSrc = GPU.CreateStorageTextureArray(this.width, this.height, 3, "rgba32float")

        this.stagingBuffer = GPU.CreateUniformBuffer(4 * 4) // must be a multiple of 16 bytes
        this.stagingData = new Float32Array(4)

        console.log("Create Render")
        this.render = new Render(
            [this.textureSrc, this.scene],
            [],
            "scripts/modules/light/monte_carlo_path_tracing/aces-tone-mapping.wgsl")
        await this.render.Init()

        this.shader = await GPU.CreateShaderFromURL("scripts/modules/light/monte_carlo_path_tracing/propagate.wgsl")

        this.bind_group_layout = GPU.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: "unfilterable-float",
                        viewDimension: "2d-array"
                    }
                }, {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        access: "write-only",
                        format: this.textureDest.format,
                        viewDimension: "2d-array"
                    }
                }, {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform"
                    }
                }]
        })

        this.bind_group_atob = GPU.device.createBindGroup({
            layout: this.bind_group_layout,
            entries: [{
                binding: 0,
                resource: this.textureSrc.textureView
            }, {
                binding: 1,
                resource: this.textureDest.textureView
            }, {
                binding: 2,
                resource: this.stagingBuffer.resource
            }]
        })

        this.bind_group_btoa = GPU.device.createBindGroup({
            layout: this.bind_group_layout,
            entries: [{
                binding: 0,
                resource: this.textureDest.textureView
            }, {
                binding: 1,
                resource: this.textureSrc.textureView
            }, {
                binding: 2,
                resource: this.stagingBuffer.resource
            }]
        })

        this.scene_bind_group_layout = GPU.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: "unfilterable-float",
                        viewDimension: "2d-array"
                    }
                }]
        })

        this.scene_bind_group = GPU.device.createBindGroup({
            layout: this.scene_bind_group_layout,
            entries: [{
                binding: 0,
                resource: this.scene.textureView
            }]
        })

        this.pipeline_layout = GPU.device.createPipelineLayout({
            bindGroupLayouts: [this.bind_group_layout, this.scene_bind_group_layout]
        })

        this.compute_pipeline = GPU.device.createComputePipeline({
            layout: this.pipeline_layout,
            compute: this.shader
        })
    }

    previousMouseCoordinatex: number = 0
    previousMouseCoordinatey: number = 0
    previousMouseWheel: number = 0

    Reset() {
        this.stagingData[3] = 0 // reset iFrame
    }

    GetCommandBuffer(): GPUCommandBuffer {
        this.stagingData[0] = this.samples
        this.stagingData[1] = 0.
        this.stagingData[2] = 0.
        this.stagingData[3] += 1.; // increase iFrame

        this.previousMouseCoordinatex = GPU.mouseCoordinate.x
        this.previousMouseCoordinatey = GPU.mouseCoordinate.y
        this.previousMouseWheel = GPU.mouseCoordinate.wheel

        GPU.device.queue.writeBuffer(this.stagingBuffer.buffer, 0, this.stagingData)

        let encoder: GPUCommandEncoder = GPU.CreateCommandEncoder();

        let pass: GPUComputePassEncoder = encoder.beginComputePass();
        pass.setBindGroup(0, this.bind_group_atob);
        pass.setBindGroup(1, this.scene_bind_group);
        pass.setPipeline(this.compute_pipeline);
        pass.dispatchWorkgroups(this.width / 8, this.height / 8);
        pass.end();

        encoder.copyTextureToTexture(
            {texture: this.textureDest.texture},
            {texture: this.textureSrc.texture},
            [this.width, this.height, this.textureSrc.depth])

        return GPU.FinishCommandEncoder(encoder)
    }

    async Run() {
        GPU.device.queue.submit([this.GetCommandBuffer()]);
    }

    Render() {
        GPU.device.queue.submit([this.render.getCommandBuffer()]);
    }


}
