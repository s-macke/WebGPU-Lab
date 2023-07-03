import {GPU} from "../webgpu/gpu";
import {Buffer} from "../webgpu/buffer";

export async function Collatz(data: Uint32Array) : Promise<Uint32Array> {
    console.log("Collatz");

    let shader: GPUProgrammableStage = await GPU.CreateShader("scripts/collatz/collatz.wgsl");

    let stagingBuffer: Buffer = GPU.CreateBufferCopy(data.buffer.byteLength);
    let storageBuffer: Buffer = GPU.CreateStorageBufferFromArrayBuffer(data.buffer);

    console.log("Create Bind group layout")

    let compute_pipeline: GPUComputePipeline = GPU.device.createComputePipeline({
        layout: "auto",
        //layout: pipelineLayout,
        compute: shader
    });
    let layout: GPUBindGroupLayout = compute_pipeline.getBindGroupLayout(0)

/*
    let layout: GPUBindGroupLayout = GPU.device.createBindGroupLayout({
        entries: [{
            binding: 0,
            buffer: { type: "storage" },
            visibility: GPUShaderStage.COMPUTE
        }]
    });
*/

    console.log("Create bind group")
    let bind_group: GPUBindGroup = GPU.device.createBindGroup({
        layout: layout,
        entries: [{
            binding: 0,
            resource: storageBuffer.resource
        }]
    })

    console.log("Compute");
    let encoder: GPUCommandEncoder = GPU.device.createCommandEncoder({});
    {
        let pass: GPUComputePassEncoder = encoder.beginComputePass();
        pass.setBindGroup(0, bind_group);
        pass.setPipeline(compute_pipeline);
        pass.dispatchWorkgroups(4, 1, 1);
        pass.end();
    }
    let command_buffer: GPUCommandBuffer = encoder.finish();

    GPU.device.queue.submit([command_buffer]);
    await GPU.device.queue.onSubmittedWorkDone()
    console.log("Compute finished");

    await GPU.CopyBufferToBuffer(storageBuffer, stagingBuffer, data.buffer.byteLength)

    await stagingBuffer.buffer.mapAsync(GPUMapMode.READ)
    let result = new Uint32Array(stagingBuffer.buffer.getMappedRange());
    storageBuffer.destroy();
    //stagingBuffer.destroy(); // we can't destroy staging buffer here, because it is used outside of this function
    return result;
}
