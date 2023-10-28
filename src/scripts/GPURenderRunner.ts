import {GPURunner, RunnerType} from "./AbstractGPURunner";
import {Render} from "./render/render";
import {Texture} from "./webgpu/texture";
import {GPU} from "./webgpu/gpu";

export class GPURenderRunner implements GPURunner {
    runner: GPURunner
    render: Render

    constructor(runner: GPURunner) {
        this.runner = runner
    }

    getHTML(): string {
        return this.runner.getHTML()
    }
    getType(): RunnerType {
        return this.runner.getType()
    }

    async Destroy() {
        await this.render.Destroy()
        await this.runner.Destroy()
    }

    async Init() {
        await this.runner.Init()
        let renderInfo = this.runner.getRenderInfo()
        this.render = new Render(renderInfo.textures, ...renderInfo.fragmentShaderFilenames)
        await this.render.Init()
    }

    async Run() {
        GPU.device.queue.submit([this.runner.getCommandBuffer(), this.render.getCommandBuffer()])
    }

    getCommandBuffer(): GPUCommandBuffer {
        throw new Error("Method not implemented.");
    }

    getRenderInfo(): { textures: Texture[]; fragmentShaderFilenames: string[] } {
        throw new Error("Method not implemented.");
    }
}