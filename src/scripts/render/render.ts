import {GPU} from "../webgpu/gpu";
import {Texture} from "../webgpu/texture";
import {GPUAbstractRunner, RunnerType} from "../AbstractGPURunner";
import {Buffer} from "../webgpu/buffer";

export class Render extends GPUAbstractRunner {
    bind_group_layout: GPUBindGroupLayout
    bind_group: GPUBindGroup
    pipeline_layout: GPUPipelineLayout
    pipeline: GPURenderPipeline
    textures: Texture[]
    buffers: Buffer[]
    fragmentShaderFilenames: string[]

    constructor(textures: Texture[], buffers: Buffer[], ...fragmentShaderFilenames: string[]) {
        super();
        this.fragmentShaderFilenames = fragmentShaderFilenames;
        this.textures = textures;
        this.buffers = buffers;
    }

    override getType(): RunnerType {
        return RunnerType.GRAPHIC
    }

    override async Destroy() {
    }

    override async Init() {
        let vertShader: GPUProgrammableStage
        let fragShader: GPUProgrammableStage

        if (this.fragmentShaderFilenames.length !== 0) {
            let result = await Promise.all([
                GPU.CreateShaderFromURL("scripts/render/render.vert.wgsl"),
                GPU.CreateShaderFromURL(...this.fragmentShaderFilenames)])
            vertShader = result[0];
            fragShader = result[1];
        } else {
            let result = await Promise.all([
                GPU.CreateShaderFromURL("scripts/render/render.vert.wgsl"),
                GPU.CreateShaderFromURL("scripts/render/render.frag.wgsl")])
            vertShader = result[0];
            fragShader = result[1];
        }

        let layoutEntries: GPUBindGroupLayoutEntry[] = [];
        let bindEntries: GPUBindGroupEntry[] = [];
        let bindIdx = 0

        for (let i = 0; i < this.textures.length; i++) {

            if (this.textures[i].depth > 1) {
                layoutEntries.push({
                    binding: bindIdx,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                        sampleType: "unfilterable-float",
                        viewDimension: "2d-array"
                    }
                })
            } else {
                layoutEntries.push({
                    binding: bindIdx,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                        sampleType: "unfilterable-float"
                    }
                })
            }

            bindEntries.push({
                binding: bindIdx,
                resource: this.textures[i].textureView
            })
            bindIdx++
        }

        for (let i = 0; i < this.buffers.length; i++) {
            layoutEntries.push(
                {
                    binding: bindIdx,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: {type: "storage"},
                });

            bindEntries.push({
                binding: bindIdx,
                resource: this.buffers[i].resource
            })
            bindIdx++
        }

        this.bind_group_layout = GPU.device.createBindGroupLayout({
            entries: layoutEntries
        })

        this.bind_group = GPU.device.createBindGroup({
            layout: this.bind_group_layout,
            entries: bindEntries
        })

        this.pipeline_layout = GPU.device.createPipelineLayout({
            bindGroupLayouts: [this.bind_group_layout]
        });

        this.pipeline = GPU.device.createRenderPipeline({
            layout: this.pipeline_layout,
            vertex: vertShader,
            fragment: {
                entryPoint: fragShader.entryPoint,
                module: fragShader.module,
                constants: fragShader.constants,
                targets: [{
                    format: GPU.getPreferredFormat()
                }]
            },
            primitive: {
                topology: "triangle-strip",
                stripIndexFormat: "uint32"
            }
        })
    }

    override getCommandBuffer(): GPUCommandBuffer {
        const commandEncoder = GPU.CreateCommandEncoder()
        const passEncoder = commandEncoder.beginRenderPass(GPU.getRenderPassDescriptor())
        passEncoder.setPipeline(this.pipeline)
        passEncoder.setBindGroup(0, this.bind_group)
        passEncoder.draw(4, 1, 0, 0)
        passEncoder.end()
        return GPU.FinishCommandEncoder(commandEncoder)
    }

    override async Run() {
        GPU.device.queue.submit([this.getCommandBuffer()]);
        await GPU.device.queue.onSubmittedWorkDone();
    }

}
