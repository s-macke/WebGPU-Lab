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
import {LightScene} from "./scene/scene";
import {ShowError} from "../ui";
import {LightPropagation} from "../modules/light/propagation/light";

export class LightPropagation2 extends GPUAbstractRunner {
    width: number
    height: number

    scene: LightScene
    light : LightPropagation

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

    async Destroy() {}

    async Init() {
        console.log("Create Texture")

        this.stagingBuffer = GPU.CreateUniformBuffer(4 * 4) // must be a multiple of 16 bytes
        this.stagingData = new Float32Array(4)

        this.scene = new LightScene(this.stagingBuffer)
        try {
            await this.scene.Init()
        } catch (e) {
            ShowError("Creation of Scene failed", e as Error)
            throw e
        }
        this.light = new LightPropagation(this.scene.emitter)
        try {
            await this.light.Init()
        } catch (e) {
            ShowError("Creation of Scene failed", e as Error)
            throw e
        }
    }

    GetCommandBuffer(): GPUCommandBuffer {
        this.stagingData[0] = GPU.mouseCoordinate.x; // set iMouseX
        this.stagingData[1] = GPU.mouseCoordinate.y; // set iMouseY
        this.stagingData[2] = GPU.mouseCoordinate.wheel;
        this.stagingData[3] += 1.; // increase iFrame
        GPU.device.queue.writeBuffer(this.stagingBuffer.buffer, 0, this.stagingData)
        return this.light.GetCommandBuffer()
    }

    async Run() {
        GPU.device.queue.submit([this.scene.GetCommandBuffer(), this.GetCommandBuffer()]);
    }

    Render() {
        this.light.Render()
    }
}
