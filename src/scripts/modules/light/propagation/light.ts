import {GPU} from "../../../webgpu/gpu";
import {Texture} from "../../../webgpu/texture";
import {GPUAbstractRunner, RunnerType} from "../../../AbstractGPURunner";
import {Render} from "../../../render/render";
import ToneMappingShader from "./aces-tone-mapping.wgsl"
import PropagateShader from "./propagate.wgsl"

export class LightPropagation extends GPUAbstractRunner {
    width: number
    height: number

    render: Render
    scene: Texture

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

    constructor(scene: Texture) {
        super()
        this.width = GPU.viewport.width
        this.height = GPU.viewport.height
        this.scene = scene
    }

    getType(): RunnerType {
        return RunnerType.ASYNCANIM
    }

    async Destroy() {
        this.textureDest.destroy()
        this.textureSrc.destroy()
    }

    async Init() {
        console.log("Create Textures")
        this.textureDest = GPU.CreateStorageTextureArray(this.width, this.height, 3,  "rgba16float")
        this.textureSrc = GPU.CreateStorageTextureArray(this.width, this.height, 3, "rgba16float")

        console.log("Create Shader")
        this.shader = await GPU.CompileShader(PropagateShader)

        console.log("Create Render")
        this.render = new Render(
            [this.textureSrc, this.scene],
            [],
            ToneMappingShader)
        await this.render.Init()

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
                }]
        })

        this.bind_group_atob = GPU.device.createBindGroup({
            layout: this.bind_group_layout,
            entries: [{
                binding: 0,
                resource: this.textureSrc.textureView
            },{
                binding: 1,
                resource: this.textureDest.textureView
            }]
        })

        this.bind_group_btoa = GPU.device.createBindGroup({
            layout: this.bind_group_layout,
            entries: [{
                binding: 0,
                resource: this.textureDest.textureView
            },{
                binding: 1,
                resource: this.textureSrc.textureView
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

    Reset() {
        // ignore, because any changes in the scene are self-correcting
    }


    GetCommandBuffer(): GPUCommandBuffer {
        let encoder: GPUCommandEncoder = GPU.CreateCommandEncoder();
        for(let i = 0; i < 30; i++) {
            let pass: GPUComputePassEncoder = encoder.beginComputePass();
            pass.setBindGroup(0, this.bind_group_atob);
            pass.setBindGroup(1, this.scene_bind_group);
            pass.setPipeline(this.compute_pipeline);
            pass.dispatchWorkgroups(this.width / 8, this.height / 8);
            pass.end();

            pass = encoder.beginComputePass();
            pass.setBindGroup(0, this.bind_group_btoa);
            pass.setBindGroup(1, this.scene_bind_group);
            pass.setPipeline(this.compute_pipeline);
            pass.dispatchWorkgroups(this.width / 8, this.height / 8);
            pass.end();
/*
            encoder.copyTextureToTexture(
                {texture: this.textureDest.texture},
                {texture: this.textureSrc.texture},
                [this.width, this.height, this.textureSrc.depth])
*/
        }
        return GPU.FinishCommandEncoder(encoder)
    }

    async Run() {
        GPU.device.queue.submit([this.GetCommandBuffer()]);
    }

    Render() {
        GPU.device.queue.submit([this.render.getCommandBuffer()]);
    }
}
