import {GPU} from "../webgpu/gpu";
import {Texture} from "../webgpu/texture";
import {Buffer} from "../webgpu/buffer";
import {GPUAbstractRunner, RunnerType} from "../AbstractGPURunner";
import {Render} from "../render/render";
import {LightScene} from "./scene/scene";
import {ShowError} from "../ui";

export class LightMonteCarloPathTracing extends GPUAbstractRunner {
    width: number
    height: number

    render: Render
    scene: LightScene

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

    constructor() {
        super()
        this.width = GPU.viewport.width
        this.height = GPU.viewport.height
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

        this.scene = new LightScene(this.stagingBuffer)
        try {
            await this.scene.Init()
        } catch (e) {
            ShowError("Creation of Scene failed", e as Error)
            throw e
        }

        console.log("Create Render")
        this.render = new Render(
            [this.textureSrc, this.scene.emitter],
            "scripts/light_monte_carlo_path_tracing/aces-tone-mapping.wgsl")
        await this.render.Init()

        this.shader = await GPU.CreateShaderFromURL("scripts/light_monte_carlo_path_tracing/propagate.wgsl")

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
                resource: this.scene.emitter.textureView
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


    GetCommandBuffer(): GPUCommandBuffer {
        this.stagingData[0] = GPU.mouseCoordinate.x; // set iMouseX
        this.stagingData[1] = GPU.mouseCoordinate.y; // set iMouseY
        this.stagingData[2] = GPU.mouseCoordinate.wheel;
        this.stagingData[3] += 1.; // increase iFrame

        if (this.previousMouseCoordinatex != GPU.mouseCoordinate.x || this.previousMouseCoordinatey != GPU.mouseCoordinate.y || this.previousMouseWheel != GPU.mouseCoordinate.wheel) {
            this.stagingData[3] = 0 // reset iFrame
        }
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
        GPU.device.queue.submit([this.scene.GetCommandBuffer(), this.GetCommandBuffer()]);
    }

    Render() {
        GPU.device.queue.submit([this.render.getCommandBuffer()]);
    }


}
