import {GPU} from "../webgpu/gpu";
import {Buffer} from "../webgpu/buffer";
import {GPUAbstractRunner, RunnerType} from "../AbstractGPURunner";

export class Collatz extends GPUAbstractRunner {
    integers: Uint32Array;
    stopping_time: Uint32Array;
    storageBuffer: Buffer;
    stagingBuffer: Buffer;
    bind_group: GPUBindGroup;
    compute_pipeline: GPUComputePipeline;

    constructor() {
        super();
        this.integers = new Uint32Array(4);
        this.integers[0] = 64;
        this.integers[1] = 200;
        this.integers[2] = 300;
        this.integers[3] = 400;

        // will contain result
        this.stopping_time = new Uint32Array(4);
    }

    override getType(): RunnerType {
        return RunnerType.HTML
    }

    override async Init(): Promise<void> {
        console.log("Collatz");

        let shader: GPUProgrammableStage = await GPU.CreateShader("scripts/collatz/collatz.wgsl");

        this.stagingBuffer = GPU.CreateBufferCopy(this.integers.buffer.byteLength);
        this.storageBuffer = GPU.CreateStorageBufferFromArrayBuffer(this.integers.buffer);

        console.log("Create Bind group layout")

        this.compute_pipeline = GPU.device.createComputePipeline({
            layout: "auto",
            //layout: pipelineLayout,
            compute: shader
        });
        let layout: GPUBindGroupLayout = this.compute_pipeline.getBindGroupLayout(0)

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
        this.bind_group = GPU.device.createBindGroup({
            layout: layout,
            entries: [{
                binding: 0,
                resource: this.storageBuffer.resource
            }]
        })
    }

    override async Run(): Promise<void> {
        console.log("Compute");
        let encoder: GPUCommandEncoder = GPU.device.createCommandEncoder({});
        {
            let pass: GPUComputePassEncoder = encoder.beginComputePass();
            pass.setBindGroup(0, this.bind_group);
            pass.setPipeline(this.compute_pipeline);
            pass.dispatchWorkgroups(4, 1, 1);
            pass.end();
        }
        let command_buffer: GPUCommandBuffer = encoder.finish();

        GPU.device.queue.submit([command_buffer]);
        await GPU.device.queue.onSubmittedWorkDone()
        console.log("Compute finished");

        await GPU.CopyBufferToBuffer(this.storageBuffer, this.stagingBuffer, this.integers.buffer.byteLength)

        await this.stagingBuffer.buffer.mapAsync(GPUMapMode.READ)
        this.stopping_time = new Uint32Array(this.stagingBuffer.buffer.getMappedRange());
        return;
    }

    override async Destroy() {
        this.storageBuffer.destroy();
    }

    override getHTML(): string {
        let table = ""

        table += "<table class=\"table text-white\">"
        table += "<thead></thead><tr><th scope=\"col\">Positive Integer</th><th scope=\"col\">Stopping Time</th></tr></thead>"
        table += "<tbody>"
        for (let i = 0; i < this.integers.length; i++) {
            table += "<tr scope=\"row\">";
            table += "<td>" + this.integers[i] + "</td>";
            table += "<td>" + this.stopping_time[i] + "</td>";
            table += "</tr>";
        }
        table += "</tbody>"
        table += "</table>"

        return table;
    }
}
