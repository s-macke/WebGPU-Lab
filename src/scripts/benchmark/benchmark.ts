import {GPU} from "../webgpu/gpu";
import {Buffer} from "../webgpu/buffer";
import {GPUAbstractRunner, RunnerType} from "../AbstractGPURunner";
import Chart from 'chart.js/auto';


export class Benchmark extends GPUAbstractRunner {
    integers: Uint32Array;
    storageBufferSrc: Buffer;
    storageBufferDest: Buffer;
    bind_group: GPUBindGroup;
    compute_pipeline: GPUComputePipeline;
    chart: Chart;
    loopIndex: number = 1;

    constructor() {
        super();

        this.integers = new Uint32Array(2000 * 20);
        for (let i = 0; i < this.integers.length; i++) {
            //this.integers[i] = 5;
            //this.integers[i] = 1000003;
            this.integers[i] = 1000033;

            //this.integers[i] = 2000039;

             if (((i+1) % 256) == 0) {
                //this.integers[i] = 11;
                this.integers[i] = 2000039;
            }

        }
        //this.integers[100] = 1000003;
        //this.integers[100] = 30;
    }

    override getType(): RunnerType {
        return RunnerType.BENCHMARK
    }

    override async Init(): Promise<void> {
        if (!GPU.hasTimestamp) {
            throw new Error("GPU Device does not support timestamps")
        }
        console.log("Benchmark");

        let shader: GPUProgrammableStage = await GPU.CreateShaderFromURL("scripts/benchmark/isPrime.wgsl");

        this.storageBufferSrc = GPU.CreateStorageBufferFromArrayBuffer(this.integers.buffer);
        this.storageBufferDest = GPU.CreateStorageBufferFromArrayBuffer(this.integers.buffer);

        console.log("Create Bind group layout")

        this.compute_pipeline = GPU.device.createComputePipeline({
            layout: "auto",
            compute: shader
        });
        let layout: GPUBindGroupLayout = this.compute_pipeline.getBindGroupLayout(0)

        console.log("Create bind group")
        this.bind_group = GPU.device.createBindGroup({
            layout: layout,
            entries: [{
                binding: 0,
                resource: this.storageBufferSrc.resource
            }, {
                binding: 1,
                resource: this.storageBufferDest.resource
            }]
        })

        let element = document.getElementById("info");
        let canvas = document.createElement("canvas");
        element.appendChild(canvas)

        this.chart = new Chart(canvas, {
            type: 'line',
            data: {
                //labels: [0, 1, 2, 3, 4, 10],
                datasets: [{
                    label: 'GPU Cores Usage',
                    spanGaps: true, // enable for a single dataset
                    pointRadius: 0,
                    data: [

                        //{x: 1, y:10}, {x: 2, y:5}, {x: 5, y:1}
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                animation: {
                    duration: 0
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'time (ms)'
                        },
                        grid: {
                            display: true,
                            color: "rgba(0.5,0.5,0.5,0.5)"
                        }
                    },
                    x: {
                        beginAtZero: true,
                        type: 'linear',
                        position: 'bottom',
                        title: {
                            display: true,
                            text: 'work items'
                        },
                        grid: {
                            display: true,
                            color: "rgba(0.5,0.5,0.5,0.5)"
                        }
                    }
                },
                //parsing: false
            }
        });

    }

    delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    override async Run(): Promise<void> {
        const workGroupSize = 64;
        if (this.loopIndex >= this.integers.length / workGroupSize - 1) {
            await this.delay(100);
            return
        }
        let encoder: GPUCommandEncoder = GPU.CreateCommandEncoder();
        {
            let pass: GPUComputePassEncoder = encoder.beginComputePass(
                {
                    timestampWrites: {
                        querySet: GPU.timestampQuerySet,
                        beginningOfPassWriteIndex: 0,
                        endOfPassWriteIndex: 1
                    }
                }
            );
            pass.setBindGroup(0, this.bind_group);
            pass.setPipeline(this.compute_pipeline);
            pass.dispatchWorkgroups(this.loopIndex, 1, 1);
            //pass.dispatchWorkgroups(this.integers.length/workGroupSize-1, 1, 1);
            pass.end();
        }
        let command_buffer: GPUCommandBuffer = GPU.FinishCommandEncoder(encoder)

        GPU.device.queue.submit([command_buffer]);
        await GPU.device.queue.onSubmittedWorkDone()

        let timestampData: BigInt64Array = new BigInt64Array(await GPU.readBuffer(GPU.timestampBuffer.buffer));
        if (this.loopIndex > 5) {
            this.chart.data.datasets[0].data.push({
                x: this.loopIndex * workGroupSize,
                y: Number(timestampData[1] - timestampData[0]) / 1000000
            });
        }
        if (this.loopIndex % 10 == 0) {
            this.chart.update()
        }
        this.loopIndex++;
    }

    override async Destroy() {
        this.storageBufferSrc.destroy();
        this.storageBufferDest.destroy();
    }
}
