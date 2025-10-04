import {GPU} from "../webgpu/gpu";
import {Buffer} from "../webgpu/buffer";
import {GPUAbstractRunner, RunnerType} from "../AbstractGPURunner";
import {LightScene} from "./scene/scene";
import {ShowError} from "../ui";
import {MonteCarloPathTracing} from "../modules/light/monte_carlo_path_tracing/light";

export class LightMonteCarloPathTracing extends GPUAbstractRunner {
    width: number
    height: number

    scene: LightScene
    light: MonteCarloPathTracing

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
    }

    async Init() {
        this.stagingBuffer = GPU.CreateUniformBuffer(4 * 4) // must be a multiple of 16 bytes
        this.stagingData = new Float32Array(4)
        this.scene = new LightScene(this.stagingBuffer)
        try {
            await this.scene.Init()
        } catch (e) {
            ShowError("Creation of Scene failed", e as Error)
            throw e
        }
        this.light = new MonteCarloPathTracing(this.scene.emitter, 2)
        try {
            await this.light.Init()
        } catch (e) {
            ShowError("Creation of Scene failed", e as Error)
            throw e
        }
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
            this.light.Reset()
        }
        this.previousMouseCoordinatex = GPU.mouseCoordinate.x
        this.previousMouseCoordinatey = GPU.mouseCoordinate.y
        this.previousMouseWheel = GPU.mouseCoordinate.wheel

        GPU.device.queue.writeBuffer(this.stagingBuffer.buffer, 0, this.stagingData.buffer)
        return this.light.GetCommandBuffer()
    }

    async Run() {
        GPU.device.queue.submit([this.scene.GetCommandBuffer(), this.GetCommandBuffer()]);
    }

    Render() {
        this.light.Render()
    }


}
