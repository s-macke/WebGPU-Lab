import {Texture, TextureType} from "./texture";
import {LoadTextResource} from "./utils";
import {Buffer} from "./buffer";
import {BufferFactory} from "./bufferFactory";
import {TextureFactory} from "./textureFactory";

type Rect = { width: number, height: number };
type Coordinate = { x: number, y: number, wheel: number };

export class GPU {
    private static adapter: GPUAdapter;
    private static adapterInfo: GPUAdapterInfo;
    static device: GPUDevice;
    private static gpuContext: GPUCanvasContext;
    public static viewport: Rect = {width: 0, height: 0};
    public static mouseCoordinate: Coordinate = {x: 0, y: 0, wheel: 0};
    public static isInitialized: boolean

    public static hasTimestamp: boolean
    public static timestampQuerySet: GPUQuerySet
    public static timestampBuffer: Buffer


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

        this.adapterInfo = this.adapter.info

        await this.RequestDevice()

        if (this.adapter.features.has("timestamp-query")) {
            this.CreateTimestampQuery()
        }
    }

    static async RequestDevice() {
        console.log("Request Device");
        if (this.adapter.features.has("timestamp-query")) {
            this.device = await this.adapter.requestDevice({
                    requiredFeatures: ["timestamp-query"],
                }
            );
        } else {
            this.device = await this.adapter.requestDevice()
        }
        if (this.device == null) {
            throw new Error("Cannot get GPU device");
        }
    }

    static CreateTimestampQuery() {
        const entries = 2
        if (typeof this.device.createQuerySet !== "function") {
            return
        }
        this.hasTimestamp = true
        console.log("Create Timestamp Query")
        this.timestampQuerySet = this.device.createQuerySet({
            type: "timestamp",
            count: entries
        });
        this.timestampBuffer = BufferFactory.createQueryBuffer(entries)
    }

    static async readBuffer(buffer: GPUBuffer): Promise<ArrayBuffer> {
        const size = buffer.size;
        const gpuReadBuffer = this.device.createBuffer({size, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        const copyEncoder = this.device.createCommandEncoder();
        copyEncoder.copyBufferToBuffer(buffer, 0, gpuReadBuffer, 0, size);
        const copyCommands = copyEncoder.finish();
        this.device.queue.submit([copyCommands]);
        await gpuReadBuffer.mapAsync(GPUMapMode.READ);
        return gpuReadBuffer.getMappedRange();
    }

    static SetCanvas(id: string) {
        console.log("Set Canvas")
        const canvas: HTMLCanvasElement = <HTMLCanvasElement>document.getElementById(id);
        this.gpuContext = canvas.getContext("webgpu");
        if (this.gpuContext == null) {
            throw new Error("WebGPU context null");
        }
        canvas.onmousemove = (e) => {
            this.mouseCoordinate.x = e.offsetX / canvas.clientWidth * canvas.width
            this.mouseCoordinate.y = canvas.height - e.offsetY / canvas.clientHeight * canvas.height
        }
        canvas.onwheel = (e) => {
            this.mouseCoordinate.wheel += e.deltaY * 0.001
            e.preventDefault()
        }

        this.viewport.width = canvas.width
        this.viewport.height = canvas.height
        console.log("canvas width: " + this.viewport.width)
        console.log("canvas height: " + this.viewport.height)
        console.log("canvas clientWidth: " + canvas.clientWidth)
        console.log("canvas clientHeight: " + canvas.clientHeight)
        const devicePixelRatio = window.devicePixelRatio || 1
        console.log("devicePixelRatio: " + devicePixelRatio)
        this.gpuContext.configure({
            device: this.device,
            format: navigator.gpu.getPreferredCanvasFormat(),
            alphaMode: "opaque",
        });
        console.log("Set Canvas Done")
        this.isInitialized = true
    }

    static GetAdapterInfo(): GPUAdapterInfo {
        return this.adapterInfo
    }

    static GetAdapterFeatures(): ReadonlySet<string> {
        return this.adapter.features
    }

    static GetWGSLFeatures(): ReadonlySet<string> {
        if (navigator.gpu.wgslLanguageFeatures == null) {
            const readonly: ReadonlySet<string> = new Set([]);
            return readonly
        }
        return navigator.gpu.wgslLanguageFeatures
    }


    static GetDeviceFeatures(): ReadonlySet<string> {
        return this.device.features
    }

    static GetDeviceLimits(): GPUSupportedLimits {
        return this.device.limits
    }

    static getRenderPassDescriptor(): GPURenderPassDescriptor {
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

    static CreateTexture(width: number, height: number, format: GPUTextureFormat): Texture {
        return new Texture(width, height, 1, format);
    }

    static CreateTextureArray(width: number, height: number, depth: number, format: GPUTextureFormat): Texture {
        return new Texture(width, height, depth, format);
    }

    static CreateStorageTexture(width: number, height: number, format: GPUTextureFormat): Texture {
        return new Texture(width, height, 1, format, TextureType.Storage);
    }

    static CreateStorageTextureArray(width: number, height: number, depth: number, format: GPUTextureFormat): Texture {
        return new Texture(width, height, depth, format, TextureType.Storage);
    }

    static async CreateTextureFromArrayBuffer(width: number, height: number, format: GPUTextureFormat, data: ArrayBuffer): Promise<Texture> {
        return TextureFactory.CreateTextureFromArrayBuffer(width, height, format, data)
    }

    static async createTextureFromImage(src: string): Promise<Texture> {
        return TextureFactory.createTextureFromImage(src)
    }

    static async createTextureFromTexture(src: Texture, format: GPUTextureFormat): Promise<Texture> {
        return TextureFactory.createTextureFromTexture(src, format)
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

    static CreateStorageBuffer(size: number): Buffer {
        return BufferFactory.createStorageBuffer(size)
    }


    static CreateUniformBuffer(size: number): Buffer {
        return BufferFactory.createUniformBuffer(size);
    }

    static CreateBufferCopy(size: number): Buffer {
        return BufferFactory.createCopyBuffer(size);
    }

    static workDone(): Promise<undefined> {
        return this.device.queue.onSubmittedWorkDone();
    }

    static async CreateShaderFromURL(...urls: string[]): Promise<GPUProgrammableStage> {
        console.log("Load Shader from '" + urls + "'")
        let code: string = ""
        for (let i = 0; i < urls.length; i++) {
            code += await LoadTextResource(urls[i])
        }
        return await this.CompileShader(code, urls.join(","))
    }

    static async CompileShader(code: string, label: string = null): Promise<GPUProgrammableStage> {
        let module: GPUShaderModule = this.device.createShaderModule({
            label: label,
            code: code
        });

        // check for errors during compilation
        let info = await module.getCompilationInfo()
        const containsErrors: boolean = info.messages.filter((message) => {
            return message.type === "error"
        }).length > 0

        if (containsErrors) {
            throw new Error("Shader '" + label + "' compiled with errors")
        }
        return {
            entryPoint: "main",
            module: module
        }
    }

    static async CopyBufferToBuffer(src: Buffer, dest: Buffer, size: number) {
        let encoder: GPUCommandEncoder = GPU.device.createCommandEncoder({
            label: "command_encoder"
        });
        encoder.copyBufferToBuffer(src.buffer, 0, dest.buffer, 0, size)
        GPU.device.queue.submit([encoder.finish()]);
        await GPU.device.queue.onSubmittedWorkDone();
    }

    static CreateCommandEncoder(): GPUCommandEncoder {
        let encoder =  this.device.createCommandEncoder({
            label: "command_encoder"
        });
        return encoder
    }

    static FinishCommandEncoder(encoder: GPUCommandEncoder): GPUCommandBuffer {
        if (this.hasTimestamp) {
            encoder.resolveQuerySet(
                GPU.timestampQuerySet,
                0,// index of first query to resolve
                2,//number of queries to resolve
                GPU.timestampBuffer.buffer,
                0);// destination offset

        }
        return encoder.finish()
    }

}


