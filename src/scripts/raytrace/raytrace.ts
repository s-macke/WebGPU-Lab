import {GPU} from "../webgpu/gpu";
import {Texture} from "../webgpu/texture";
import {Buffer} from "../webgpu/buffer";
import {GPUAbstractRunner, RunnerType} from "../AbstractGPURunner";
import {Render} from "../render/render";

export class Raytrace extends GPUAbstractRunner {
    width: number;
    height: number;

    texturesrc: Texture;
    texturedest: Texture;
    render: Render;

    bind_group_layout: GPUBindGroupLayout
    bind_group: GPUBindGroup
    pipeline_layout: GPUPipelineLayout
    compute_pipeline: GPUComputePipeline
    shader: GPUProgrammableStage
    stagingBuffer: Buffer
    stagingData: Float32Array

    filename: string;

    showOnScreen: boolean;
    fragmentShaderFilename: string;

    startTime: number;

    constructor(filename: string, showOnScreen: boolean, fragmentShaderFilename: string = null) {
        super();
        this.showOnScreen = showOnScreen
        this.filename = filename
        this.width = GPU.viewport.width
        this.height = GPU.viewport.height
        this.fragmentShaderFilename = fragmentShaderFilename
    }

    override getType(): RunnerType {
        return RunnerType.ANIM
    }

    override async Destroy() {
        if (this.showOnScreen) {
            await this.render.Destroy()
        }
        this.texturesrc.destroy()
        this.texturedest.destroy()
    }

    override async Init() {
        console.log("Create Texture")
        this.texturesrc = GPU.CreateStorageTexture(this.width, this.height, "rgba32float")
        this.texturedest = GPU.CreateStorageTexture(this.width, this.height, "rgba32float")

        if (this.showOnScreen) {
            if (this.fragmentShaderFilename === null) {
                this.render = new Render([this.texturedest])
            } else {
                this.render = new Render([this.texturedest], "scripts/raytrace/" + this.fragmentShaderFilename)
            }
            await this.render.Init()
        }

        this.stagingBuffer = GPU.CreateUniformBuffer(4*3 + 4) // must be a multiple of 16 bytes
        this.stagingData = new Float32Array(4)

        this.shader = await GPU.CreateShaderFromURL("scripts/raytrace/" + this.filename)

        this.bind_group_layout = GPU.device.createBindGroupLayout({
            entries: [{
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
                buffer: {
                    type: "uniform"
                }
            }]
        })

        this.bind_group = GPU.device.createBindGroup({
            layout: this.bind_group_layout,
            entries: [{
                binding: 0,
                resource: this.texturesrc.textureView
            },{
                binding: 1,
                resource: this.texturedest.textureView
            }, {
                binding: 2,
                resource: this.stagingBuffer.resource
            }]
        })

        this.pipeline_layout = GPU.device.createPipelineLayout({
            bindGroupLayouts: [this.bind_group_layout]
        })

        this.compute_pipeline = GPU.device.createComputePipeline({
            layout: this.pipeline_layout,
            compute: this.shader
        })

        this.startTime = new Date().getTime();

    }

    previousMouseCoordinatex: number = 0
    previousMouseCoordinatey: number = 0

    override getCommandBuffer(): GPUCommandBuffer {
        this.stagingData[0] = GPU.mouseCoordinate.x // set iMouseX
        this.stagingData[1] = GPU.mouseCoordinate.y // set iMouseY
        this.stagingData[2] = (new Date().getTime() - this.startTime)*0.001;
        this.stagingData[3] += 1. // iFrame

        if (this.previousMouseCoordinatex != GPU.mouseCoordinate.x || this.previousMouseCoordinatey != GPU.mouseCoordinate.y) {
            this.stagingData[3] = 0 // reset iFrame
        }
        this.previousMouseCoordinatex = GPU.mouseCoordinate.x
        this.previousMouseCoordinatey = GPU.mouseCoordinate.y

        GPU.device.queue.writeBuffer(this.stagingBuffer.buffer, 0, this.stagingData)
        let encoder: GPUCommandEncoder = GPU.device.createCommandEncoder({})
        //let uploadbuffer: GPUBuffer = this.stagingBuffer.updateBufferData(0, this.stagingData, encoder) // TODO: must be destoryed
        {
            let pass: GPUComputePassEncoder = encoder.beginComputePass()
            pass.setBindGroup(0, this.bind_group)
            pass.setPipeline(this.compute_pipeline)
            pass.dispatchWorkgroups(this.width/8, this.height/8)
            pass.end()
        }
        encoder.copyTextureToTexture({texture: this.texturedest.texture}, {texture: this.texturesrc.texture}, [this.width, this.height, 1])
        return encoder.finish()
    }

    override async Run() {
        if (this.showOnScreen) {
            GPU.device.queue.submit([this.getCommandBuffer(), this.render.getCommandBuffer()])
        } else {
            GPU.device.queue.submit([this.getCommandBuffer()])
        }
        await GPU.device.queue.onSubmittedWorkDone()
    }
}
