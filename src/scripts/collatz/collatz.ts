import {GPU} from "../webgpu/gpu";
import {Buffer} from "../webgpu/buffer";

export async function Collatz(data: Uint32Array) : Promise<Uint32Array> {
    console.log("Collatz");

    let shader: GPUProgrammableStage = await GPU.CreateWGSLShader("scripts/collatz/collatz.wgsl");

    let stagingBuffer: Buffer = GPU.CreateBufferEmpty(data.buffer.byteLength);
    let storageBuffer: Buffer = GPU.CreateBufferFromArrayBuffer(data.buffer);

    console.log("Create Bind group layout")
    let layout: GPUBindGroupLayout = GPU.device.createBindGroupLayout({
        entries: [{
            binding: 0,
            buffer: { type: "storage" },
            visibility: GPUShaderStage.COMPUTE
        }]
    });

    console.log("Create bind group")
    let bind_group: GPUBindGroup = GPU.device.createBindGroup({
        layout: layout,
        entries: [{
            binding: 0,
            resource: storageBuffer.resource
        }]
    })

    let pipelineLayout = GPU.device.createPipelineLayout({
        bindGroupLayouts: [layout]
    });

    let compute_pipeline: GPUComputePipeline = GPU.device.createComputePipeline({
        layout: pipelineLayout,
        compute: shader
    });

    console.log("Compute");
    let encoder: GPUCommandEncoder = GPU.device.createCommandEncoder({});
    let pass: GPUComputePassEncoder = encoder.beginComputePass();
    pass.setBindGroup(0, bind_group);
    pass.setPipeline(compute_pipeline);
    pass.dispatch(4, 1, 1);
    pass.endPass();
    let command_buffer: GPUCommandBuffer = encoder.finish();

    GPU.device.queue.submit([command_buffer]);
    await GPU.device.queue.onSubmittedWorkDone()
    console.log("Compute finished");

    await GPU.CopyBufferToBuffer(storageBuffer, stagingBuffer, data.buffer.byteLength)

    await stagingBuffer.buffer.mapAsync(GPUMapMode.READ)
    let result = new Uint32Array(stagingBuffer.buffer.getMappedRange());
    storageBuffer.destroy();
    stagingBuffer.destroy()
    return result;
}
