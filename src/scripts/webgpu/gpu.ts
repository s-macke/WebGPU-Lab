import {Texture, TextureType} from "./texture";
import {LoadTextResource} from "./utils";
import {Buffer} from "./buffer";
import {BufferFactory} from "./bufferFactory";
import {TextureFactory} from "./textureFactory";

type Rect = {width: number, height: number};
type Coordinate = {x: number, y: number};

export class GPU {
    private static adapter: GPUAdapter;
    static device: GPUDevice;
    private static glslang: any;
    private static gpuContext: GPUCanvasContext;
    public static viewport: Rect = {width: 0, height: 0};
    public static mouseCoordinate: Coordinate = {x: 0, y: 0};
    public static isInitialized: boolean

    static async Init(powerPreference: GPUPowerPreference) {
        this.isInitialized = false;
        console.log("Initialize WebGPU");
        console.log("Request Adapter");
        if (navigator.gpu == null) {
            throw new Error("WebGPU not supported");
        }
        await this.RequestAdapterAndDevice(powerPreference);
    }

    static async RequestAdapterAndDevice(powerPreference: GPUPowerPreference) {
        this.adapter = await navigator.gpu.requestAdapter({
            //powerPreference: "high-performance"
            //powerPreference: "low-power"
            powerPreference: powerPreference
        });
        if (this.adapter == null) {
            throw new Error("Cannot request GPU adapter");
        }

        console.log("Request Device");
        this.device = await this.adapter.requestDevice();
        if (this.device == null) {
            throw new Error("Cannot get GPU device");
        }
    }

    static SetCanvas(id: string) {
        console.log("Set Canvas")
        const canvas: HTMLCanvasElement = <HTMLCanvasElement>document.getElementById(id);
        this.gpuContext = canvas.getContext("webgpu");
        if (this.gpuContext == null) {
            throw new Error("WebGPU context null");
        }
        canvas.onmousemove = (e) => {
            this.mouseCoordinate.x = e.offsetX / canvas.clientWidth * canvas.width;
            this.mouseCoordinate.y = canvas.height - e.offsetY / canvas.clientHeight * canvas.height;
        }

        this.viewport.width = canvas.width;
        this.viewport.height = canvas.height;
        console.log("canvas width: " + this.viewport.width)
        console.log("canvas height: " + this.viewport.height)
        console.log("canvas clientWidth: " + canvas.clientWidth)
        console.log("canvas clientHeight: " + canvas.clientHeight)
        const devicePixelRatio = window.devicePixelRatio || 1;
        console.log("devicePixelRatio: " + devicePixelRatio)
        /*
        const presentationSize = [
            //canvas.clientWidth * devicePixelRatio,
            //canvas.clientHeight * devicePixelRatio,
            canvas.width,
            canvas.height
        ];
*/
        this.gpuContext.configure({
            device: this.device,
            format: navigator.gpu.getPreferredCanvasFormat(),
            alphaMode: "opaque"
            //size: presentationSize,
        });
        console.log("Set Canvas Done")
        this.isInitialized = true;
    }

    static GetAdapterFeatures() : ReadonlySet<string> {
        return this.adapter.features
    }

    static GetDeviceFeatures() : ReadonlySet<string> {
        return this.device.features
    }

    static GetDeviceLimits() : GPUSupportedLimits {
        return this.device.limits
    }

    static getRenderPassDescriptor() : GPURenderPassDescriptor {
        return {
            colorAttachments: [{
                view: GPU.gpuContext.getCurrentTexture().createView(),
                clearValue: {r: 0.0, g: 0.0, b: 0.0, a: 1.0},
                loadOp: "clear",
                storeOp: "store"
            }],
        };
    }

    static getPreferredFormat(): GPUTextureFormat {
        return navigator.gpu.getPreferredCanvasFormat()
    }

    static getMouseCoordinate(): Coordinate {
        return this.mouseCoordinate;
    }

    static CreateTexture(width, height: number, format: GPUTextureFormat): Texture {
        return new Texture(width, height, format);
    }

    static CreateStorageTexture(width, height: number, format: GPUTextureFormat): Texture {
        return new Texture(width, height, format, TextureType.Storage);
    }

    static async CreateTextureFromArrayBuffer(width, height: number, format: GPUTextureFormat, data: ArrayBuffer): Promise<Texture> {
        return TextureFactory.CreateTextureFromArrayBuffer(width, height, format, data)
    }
    static async createTextureFromImage(src: string): Promise<Texture> {
        return TextureFactory.createTextureFromImage(src)
    }

    static CreateSampler(): GPUSampler {
        return this.device.createSampler({
            magFilter: "linear",
            addressModeU: "repeat",
            addressModeV: "repeat",
            addressModeW: "repeat"
        });
    }

    static CreateClampedSampler(): GPUSampler {
        return this.device.createSampler({
            magFilter: "linear",
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
            addressModeW: "clamp-to-edge"
        });
    }

    static CreateStorageBufferFromArrayBuffer(data: ArrayBuffer): Buffer {
        return BufferFactory.createFromArrayBuffer(data)
    }

    static CreateUniformBuffer(size: number): Buffer {
        return BufferFactory.createUniformBuffer(size);
    }

    static CreateBufferCopy(size: number): Buffer {
        return BufferFactory.createCopyBuffer(size);
    }

    static async CreateShader(url: string): Promise<GPUProgrammableStage> {
        return new Promise<GPUProgrammableStage>((resolve, reject) => {
            LoadTextResource(url).then(
                code => {
                    let spirv: string;

                    if (url.endsWith(".comp")) {
                        spirv = this.glslang.compileGLSL(code, "compute");
                    } else if (url.endsWith(".vert")) {
                        spirv = this.glslang.compileGLSL(code, "vertex");
                    } else if (url.endsWith(".frag")) {
                        spirv = this.glslang.compileGLSL(code, "fragment");
                    } else {
                        throw new Error("Cannot identify shader " + url);
                        //reject(null);
                    }
                    let module: GPUShaderModule = this.device.createShaderModule({
                        label: "shader",
                        code: spirv
                    });
                    resolve({
                        entryPoint: "main",
                        module: module
                    })
                }
            )
        })
    }

    static async CreateWGSLShader(url: string): Promise<GPUProgrammableStage> {
        console.log("Load Shader from '" + url + "'")
        return new Promise<GPUProgrammableStage>((resolve, reject) => {
            LoadTextResource(url).then(
                code => {
                    let module: GPUShaderModule = this.device.createShaderModule({
                        code: code
                    });
                    resolve({
                        entryPoint: "main",
                        module: module
                    })
                }
            )
        })
    }

    static async CopyBufferToBuffer(src: Buffer, dest: Buffer, size: number) {
        let encoder: GPUCommandEncoder = GPU.device.createCommandEncoder({
            label: "command_encoder"
        });
        encoder.copyBufferToBuffer(src.buffer, 0, dest.buffer, 0, size)
        GPU.device.queue.submit([encoder.finish()]);
        await GPU.device.queue.onSubmittedWorkDone();
    }

    static async Render(texture: Texture) {

        let vertShader = await this.CreateWGSLShader("scripts/webgpu/shader/render.vert.wgsl")
        let fragShader = await this.CreateWGSLShader("scripts/webgpu/shader/render.frag.wgsl")
        if (texture.isFloat == false) {
            fragShader = await this.CreateWGSLShader("scripts/webgpu/shader/render_int.frag.wgsl")
        }
        let sampler = this.CreateSampler();

        let layout: GPUBindGroupLayout = GPU.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {sampleType: "unfilterable-float"}
            }, {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {}
            }]
        });

        if (texture.isFloat == false) {
            layout = GPU.device.createBindGroupLayout({
                entries: [{
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {sampleType: "sint"}
                }, {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {}
                }]
            });
        }

        let bind_group: GPUBindGroup = GPU.device.createBindGroup({
            layout: layout,
            entries: [{
                binding: 0,
                resource: texture.textureView
            }, {
                binding: 1,
                resource: sampler
            }]
        })

        let pipelineLayout: GPUPipelineLayout = GPU.device.createPipelineLayout({
            bindGroupLayouts: [layout]
        });

        const pipeline = this.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: vertShader,
            fragment: {
                entryPoint: fragShader.entryPoint,
                module: fragShader.module,
                constants: fragShader.constants,
                targets: [{
                    format: navigator.gpu.getPreferredCanvasFormat()
                }]
            },
            primitive: {
                topology: "triangle-strip",
                stripIndexFormat: "uint32"
            }
        });

        let render = () => {
            console.log("render");

                        const renderPassDescriptor: GPURenderPassDescriptor = {
                            colorAttachments: [{
                                view: this.gpuContext.getCurrentTexture().createView(),
                                clearValue: {r: 0.0, g: 0.0, b: 0.0, a: 1.0},
                                loadOp: "clear",
                                storeOp: "store"
                            }],
                        };

                        const commandEncoder = this.device.createCommandEncoder({});
                        const passEncoder = commandEncoder.beginRenderPass(this.getRenderPassDescriptor());
                        passEncoder.setPipeline(pipeline);
                        passEncoder.setBindGroup(0, bind_group);
                        passEncoder.draw(4, 1, 0, 0);
                        passEncoder.end();

                        this.device.queue.submit([commandEncoder.finish()]);
        }
        requestAnimationFrame(render);
    }
}


