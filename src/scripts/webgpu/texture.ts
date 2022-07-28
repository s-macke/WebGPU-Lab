import {Buffer} from "./buffer";
import {GPU} from "./gpu";

export enum TextureType {
    Readonly,
    Storage
}

export class Texture {
    width: number;
    height: number;
    format: GPUTextureFormat;
    isFloat: boolean;
    bytesPerPixel: number;
    texture: GPUTexture;
    textureView: GPUTextureView;

    constructor(width: number, height: number, format: GPUTextureFormat, type: TextureType = TextureType.Readonly) {
        console.log("Create Texture: width: " + width + " height: " + height + " format: " + format);
        this.width = width;
        this.height = height;
        this.format = format;
        switch(format)
        {
            case "r8sint":
            case "r8uint":
                this.bytesPerPixel = 1;
                this.isFloat = false
                break;

            case "rgba32float":
                this.bytesPerPixel = 16;
                this.isFloat = true
                break;
            case "rgba16float":
                this.bytesPerPixel = 8;
                this.isFloat = true
                break;

            case "r16float":
                this.bytesPerPixel = 2;
                this.isFloat = true
                break;

            case "r32float":
                this.bytesPerPixel = 4;
                this.isFloat = true
                break;

            case "rg32float":
                this.bytesPerPixel = 8;
                this.isFloat = true
                break;

            case "r32sint":
            case "r32uint":
                this.isFloat = false
                this.bytesPerPixel = 4;
                break;

            case "rgba8unorm":
            case "bgra8unorm":
                this.bytesPerPixel = 4;
                this.isFloat = true
                break;

            default:
                throw new Error("Texture: unsupported pixel format");
        }

        const desc: GPUTextureDescriptor = {
            usage: 0,
            format: this.format,
            size: [width, height, 1]
        };
        switch(type) {
            case TextureType.Readonly: {
                desc.usage =
                    GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC;
                break;
            }

            default:
            case TextureType.Storage: {
                desc.usage =
                    GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC;
                break;
            }
        }
        this.texture = GPU.device.createTexture(desc);
        this.textureView = this.texture.createView({});
    }

    public destroy() {
        this.texture.destroy()
    }

    async Extract() : Promise<HTMLCanvasElement> {

        const imageCanvas = <HTMLCanvasElement>document.createElement('canvas');
        imageCanvas.width = this.width;
        imageCanvas.height = this.height;
        const imageCanvasContext = imageCanvas.getContext('2d');
        const imageData: ImageData = imageCanvasContext.createImageData(this.width, this.height);

        let size: number = this.width * this.height * this.bytesPerPixel;
        let buffer: Buffer = GPU.CreateBufferCopy(size);

        let encoder: GPUCommandEncoder = GPU.device.createCommandEncoder({
            label: "command_encoder"
        });
        encoder.copyTextureToBuffer({
                texture: this.texture
            }, {
                buffer: buffer.buffer,
                bytesPerRow: this.width * this.bytesPerPixel
            }, {
                width: this.width,
                height: this.height
            });
        let command_buffer: GPUCommandBuffer = encoder.finish();

        GPU.device.queue.submit([command_buffer]);
        //await GPU.device.queue.onSubmittedWorkDone()

        await buffer.buffer.mapAsync(GPUMapMode.READ);
        let bufferdata: ArrayBuffer = buffer.buffer.getMappedRange()
        let i = 0;

        switch(this.format)
        {
            case "rgba32float":
            {
                let buffer: Float32Array = new Float32Array(bufferdata);
                for (let y = 0; y < imageCanvas.height; ++y) {
                    for (let x = 0; x < imageCanvas.width; ++x) {
                        imageData.data[i + 0] = buffer[i + 0] * 255;
                        imageData.data[i + 1] = buffer[i + 1] * 255;
                        imageData.data[i + 2] = buffer[i + 2] * 255;
                        imageData.data[i + 3] = 255;
                        i += 4;
                    }
                }
                break;
            }

            case "rgba8unorm":
            {
                let buffer = new Uint8Array(bufferdata);
                for (let y = 0; y < imageCanvas.height; ++y) {
                    for (let x = 0; x < imageCanvas.width; ++x) {
                        imageData.data[i + 0] = buffer[i + 0];
                        imageData.data[i + 1] = buffer[i + 1];
                        imageData.data[i + 2] = buffer[i + 2];
                        imageData.data[i + 3] = 255;
                        i += 4;
                    }
                }
                break;
            }

            default:
                throw new Error("Extract: Texture format not supported")
        }
        imageCanvasContext.putImageData(imageData, 0, 0);

        return imageCanvas;
    }

}

