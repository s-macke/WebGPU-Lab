/*
Buffer A (Buffer A, keyboard, RGBA Noise Medium)   (//Stores vars)
Buffer B (Buffer A, Buffer b, RGBA Noise Medium, CubeMap a) (Temporal ReSTIR)
Buffer C (Buffer A, Buffer B, RGBA Noise Medium, CubeMap a
Buffer D (Buffer A, Buffer B, Buffer C, Buffer D)   (contains lightning, Temporal accumulation)
CubeMap A (Buffer A, Nothing , RGBA Noise Medium, CubeMap A)  (scene storage)
Image.frag (Buffer A, Buffer C, Buffer D, CubeMap A)
*/

import {GPU} from "../webgpu/gpu";
import {Buffer} from "../webgpu/buffer";
import {GPUAbstractRunner, RunnerType} from "../AbstractGPURunner";
import {Render} from "../render/render";
import {LightScene} from "./scene/scene";
import {ShowError} from "../ui";

export class LightPropagationBuffer extends GPUAbstractRunner {
    width: number
    height: number

    render: Render
    scene: LightScene

    state: Buffer

    bind_group_layout: GPUBindGroupLayout
    bind_group: GPUBindGroup

    bind_group_layout_buffer: GPUBindGroupLayout
    bind_group_buffer: GPUBindGroup

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
        this.state.destroy()
    }

    async Init() {
        console.log("Create Texture")

        this.state = GPU.CreateStorageBuffer(this.width*this.height * (16*5) )


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
            [this.scene.emitter],
            [this.state],
            "scripts/light_buffer/common.wgsl", "scripts/light_buffer/aces-tone-mapping.wgsl")
        await this.render.Init()

        this.shader = await GPU.CreateShaderFromURL("scripts/light_buffer/common.wgsl", "scripts/light_buffer/propagate.wgsl")

        this.bind_group_layout = GPU.device.createBindGroupLayout({
            label: "staging bind group layout",
            entries: [{
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform"
                    }
                }]
        })

        this.bind_group = GPU.device.createBindGroup({
            layout: this.bind_group_layout,
            entries: [{
                binding: 0,
                resource: this.stagingBuffer.resource
            }]
        })

        this.scene_bind_group_layout = GPU.device.createBindGroupLayout({
            label: "scene bind group layout",
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

        this.bind_group_layout_buffer = GPU.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "storage" },
            }]
        })

        this.bind_group_buffer = GPU.device.createBindGroup({
            layout: this.bind_group_layout_buffer,
            entries: [{
                binding: 0,
                resource: this.state.resource
            }]
        })

        this.pipeline_layout = GPU.device.createPipelineLayout({
            bindGroupLayouts: [this.bind_group_layout, this.scene_bind_group_layout, this.bind_group_layout_buffer]
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
        GPU.device.queue.writeBuffer(this.stagingBuffer.buffer, 0, this.stagingData.buffer)

        let encoder: GPUCommandEncoder = GPU.CreateCommandEncoder();
        for(let i = 0; i < 20; i++) {
            let pass: GPUComputePassEncoder = encoder.beginComputePass();
            pass.setBindGroup(0, this.bind_group);
            pass.setBindGroup(1, this.scene_bind_group);
            pass.setBindGroup(2, this.bind_group_buffer);
            pass.setPipeline(this.compute_pipeline);
            pass.dispatchWorkgroups(this.width / 8, this.height / 8);
            pass.end();
        }
        return GPU.FinishCommandEncoder(encoder)
    }

    async Run() {
        GPU.device.queue.submit([this.scene.GetCommandBuffer(), this.GetCommandBuffer()]);
    }

    Render() {
        GPU.device.queue.submit([this.render.getCommandBuffer()]);
    }
}
