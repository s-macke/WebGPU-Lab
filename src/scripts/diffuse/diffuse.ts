import {GPU} from "../webgpu/gpu";
import {Texture} from "../webgpu/texture";
import {Buffer} from "../webgpu/buffer";
import {GPUAbstractRunner, RunnerType} from "../AbstractGPURunner";
import {Render} from "../render/render";

export class Diffuse extends GPUAbstractRunner {
    width: number;
    height: number;

    texturesrc: Texture;
    texturedest: Texture;

    bind_group_layout: GPUBindGroupLayout
    bind_group_layout_mesh: GPUBindGroupLayout

    bind_group: GPUBindGroup
    bind_group_mesh: GPUBindGroup

    pipeline_layout: GPUPipelineLayout
    compute_pipeline: GPUComputePipeline
    shader: GPUProgrammableStage

    stagingBuffer: Buffer
    stagingData: Float32Array

    vertexBuffer: Buffer
    vertexData: Float32Array

    triangleBuffer: Buffer
    triangleData: Int32Array

    materialBuffer: Buffer
    materialData: Float32Array

    filename: string;

    showOnScreen: boolean;
    fragmentShaderFilename: string;

    startTime: number;

    constructor() {
        super();
        this.width = GPU.viewport.width
        this.height = GPU.viewport.height
    }

    override getType(): RunnerType {
        return RunnerType.ANIM
    }

    override async Destroy() {
        this.texturesrc.destroy()
        this.texturedest.destroy()
        this.vertexBuffer.destroy()
    }

    override async Init() {
        this.vertexData = new Float32Array([
            -0.57735, -0.57735, 0.57735, 0,
            0.934172, 0.356822, 0, 0,
            0.934172, -0.356822, 0, 0,
            -0.934172, 0.356822, 0, 0,
            -0.934172, -0.356822, 0, 0,
            0, 0.934172, 0.356822, 0,
            0, 0.934172, -0.356822, 0,
            0.356822, 0, -0.934172, 0,
            -0.356822, 0, -0.934172, 0,
            0, -0.934172, -0.356822, 0,
            0, -0.934172, 0.356822, 0,
            0.356822, 0, 0.934172, 0,
            -0.356822, 0, 0.934172, 0,
            0.57735, 0.57735, -0.57735, 0,
            0.57735, 0.57735, 0.57735, 0,
            -0.57735, 0.57735, -0.57735, 0,
            -0.57735, 0.57735, 0.57735, 0,
            0.57735, -0.57735, -0.57735, 0,
            0.57735, -0.57735, 0.57735, 0,
            -0.57735, -0.57735, -0.57735, 0,
            -5., -5., -1., 0,
            5., -5., -1., 0,
            5., 5., -1., 0,
            -5., 5., -1., 0,
            -2. + 5., -2. + 5., 5.5, 0,
            2. + 5., -2. + 5., 5.5, 0,
            2. + 5., 2. + 5., 5.5, 0,
            -2. + 5., 2. + 5., 5.5, 0
        ])
        this.vertexBuffer = GPU.CreateStorageBufferFromArrayBuffer(this.vertexData.buffer)

        this.triangleData = new Int32Array([
             19,  3,  2, 0,
             12,  19,  2, 0,
             15,  12,  2, 0,
              8,  14,  2, 1,
              18,  8,  2, 1,
              3,  18,  2, 1,
              20,  5,  4, 2,
              9,  20,  4, 2,
              16,  9,  4, 2,
              13,  17,  4, 3,
              1,  13,  4, 3,
              5,  1,  4, 3,
              7,  16,  4, 4,
              6,  7,  4, 4,
              17,  6,  4, 4,
              6,  15,  2, 5,
              7,  6,  2, 5,
              14,  7,  2, 5,
              10,  18,  3, 6,
              11,  10,  3, 6,
              19,  11,  3, 6,
              11,  1,  5, 7,
              10,  11,  5, 7,
              20,  10, 5, 7,
              20,  9,  8, 8,
              10,  20,  8, 8,
              18,  10, 8, 8,
              9,  16,  7, 9,
              8,  9,  7, 9,
              14,  8,  7, 9,
              12,  15,  6, 10,
              13,  12,  6, 10,
              17,  13,  6, 10,
              13,  1,  11, 11,
              12,  13,  11, 11,
              19,  12,  11, 11,
              21,  22,  23, 12,
              23,  24,  21, 12,
              25,  26,  27, 13,
              27,  28,  25, 13
        ])
        this.triangleBuffer = GPU.CreateStorageBufferFromArrayBuffer(this.triangleData.buffer)

        this.materialData = new Float32Array([
            1., 0., 0., 0.,
            1., 0., 0., 0.,
            1., 0., 0., 0.,
            1., 0., 0., 0.,
            1., 0., 0., 0.,
            1., 0., 0., 0.,
            1., 0., 0., 0.,
            1., 0., 0., 0.,
            1., 0., 0., 0.,
            1., 0., 0., 0.,
            1., 0., 0., 0.,
            1., 0., 0., 0.,
            .5, .5, .5, 0.,
            1., 1., 1., 10.
        ])
        this.materialBuffer = GPU.CreateStorageBufferFromArrayBuffer(this.materialData.buffer)

        console.log("Create Texture")
        this.texturesrc = GPU.CreateStorageTexture(this.width, this.height, "rgba32float")
        this.texturedest = GPU.CreateStorageTexture(this.width, this.height, "rgba32float")


        this.stagingBuffer = GPU.CreateUniformBuffer(4 * 4) // must be a multiple of 16 bytes
        this.stagingData = new Float32Array(4)

        this.shader = await GPU.CreateShaderFromURL("scripts/diffuse/diffuse.wgsl")

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

        this.bind_group_layout_mesh = GPU.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: "read-only-storage"
                }
            }, {
                binding: 1,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: "read-only-storage"
                }
            }, {
                binding: 2,
                visibility: GPUShaderStage.COMPUTE,
                buffer: {
                    type: "read-only-storage"
                }
            }]
        })

        this.bind_group = GPU.device.createBindGroup({
            layout: this.bind_group_layout,
            entries: [{
                binding: 0,
                resource: this.texturesrc.textureView
            }, {
                binding: 1,
                resource: this.texturedest.textureView
            }, {
                binding: 2,
                resource: this.stagingBuffer.resource
            }]
        })

        this.bind_group_mesh = GPU.device.createBindGroup({
            layout: this.bind_group_layout_mesh,
            entries: [{
                binding: 0,
                resource: this.vertexBuffer.resource
            }, {
                binding: 1,
                resource: this.triangleBuffer.resource
            }, {
                binding: 2,
                resource: this.materialBuffer.resource
            }]
        })

        this.pipeline_layout = GPU.device.createPipelineLayout({
            bindGroupLayouts: [this.bind_group_layout, this.bind_group_layout_mesh]
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
        this.stagingData[2] = (new Date().getTime() - this.startTime) * 0.001;
        this.stagingData[3] += 1. // iFrame

        if (this.previousMouseCoordinatex != GPU.mouseCoordinate.x || this.previousMouseCoordinatey != GPU.mouseCoordinate.y) {
            this.stagingData[3] = 0 // reset iFrame
        }
        this.previousMouseCoordinatex = GPU.mouseCoordinate.x
        this.previousMouseCoordinatey = GPU.mouseCoordinate.y

        GPU.device.queue.writeBuffer(this.stagingBuffer.buffer, 0, this.stagingData)
        let encoder: GPUCommandEncoder = GPU.device.createCommandEncoder({})
        {
            let pass: GPUComputePassEncoder = encoder.beginComputePass()
            pass.setBindGroup(0, this.bind_group)
            pass.setBindGroup(1, this.bind_group_mesh)
            pass.setPipeline(this.compute_pipeline)
            pass.dispatchWorkgroups(this.width / 8, this.height / 8)
            pass.end()
        }
        encoder.copyTextureToTexture({texture: this.texturedest.texture}, {texture: this.texturesrc.texture}, [this.width, this.height, 1])
        return encoder.finish()
    }

    override async Run() {
        GPU.device.queue.submit([this.getCommandBuffer()])
        await GPU.device.queue.onSubmittedWorkDone()
    }

    override getRenderInfo(): { textures: Texture[]; fragmentShaderFilenames: string[] } {
        return {
            textures: [this.texturedest],
            fragmentShaderFilenames: ["scripts/diffuse/aces-tone-mapping.wgsl"]
        }
    }

}
