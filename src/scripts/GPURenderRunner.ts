import {GPUAbstractRunner, GPURunner, RunnerType} from "./AbstractGPURunner";
import {Render} from "./render/render";
import {Texture} from "./webgpu/texture";
import {GPU} from "./webgpu/gpu";

export class GPURenderRunner implements GPUAbstractRunner {
    runner: GPURunner
    render: Render

    constructor(runner: GPURunner) {
        this.runner = runner
    }

    Render() {
        GPU.device.queue.submit([this.render.getCommandBuffer()])
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
        this.render = new Render(renderInfo.textures,[], renderInfo.fragmentShader)
        await this.render.Init()
    }

    async Run() {
        await this.runner.Run()
    }

    getCommandBuffer(): GPUCommandBuffer {
        throw new Error("Method not implemented.");
    }

    getRenderInfo(): { textures: Texture[]; fragmentShader: string } {
        throw new Error("Method not implemented.");
    }
}