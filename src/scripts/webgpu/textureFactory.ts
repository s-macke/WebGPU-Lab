import {GPU} from "./gpu";
import {Buffer} from "./buffer";
import {Texture} from "./texture";

export class TextureFactory {

    static async CreateTextureFromArrayBuffer(width, height: number, format: GPUTextureFormat, data: ArrayBuffer): Promise<Texture> {
        console.log("Create Texture from Buffer: " + format);
        let buffer: Buffer = GPU.CreateBufferFromArrayBuffer(data);
        let texture: Texture = GPU.CreateTexture(width, height, format);
        if (data.byteLength < texture.width * texture.height * texture.bytesPerPixel) {
            throw new Error("Create Texture from Buffer: Buffer too short");
        }
        const commandEncoder = GPU.device.createCommandEncoder({});
        commandEncoder.copyBufferToTexture({
            buffer: buffer.buffer,
            bytesPerRow: texture.width * texture.bytesPerPixel
        }, {
            texture: texture.texture
        }, {
            width: texture.width,
            height: texture.height,
        });
        GPU.device.queue.submit([commandEncoder.finish()]);
        //await this.device.queue.onSubmittedWorkDone();
        buffer.buffer.destroy();
        return texture;
    }

    static async createTextureFromImage(src: string): Promise<Texture> {
        const img = document.createElement('img');
        img.src = src;
        await img.decode();

        const imageCanvas = document.createElement('canvas');
        imageCanvas.width = img.width;
        imageCanvas.height = img.height;

        const imageCanvasContext = imageCanvas.getContext('2d');
        imageCanvasContext.translate(0, img.height);
        imageCanvasContext.scale(1, -1);
        imageCanvasContext.drawImage(img, 0, 0, img.width, img.height);
        const imageData = imageCanvasContext.getImageData(0, 0, img.width, img.height);

        let data = null;

        const bytesPerRow = Math.ceil(img.width * 4 / 256) * 256;
        if (bytesPerRow == img.width * 4) {
            data = imageData.data;
        } else {
            alert("Not tested code");
            data = new Uint8Array(bytesPerRow * img.height);
            let imagePixelIndex = 0;
            for (let y = 0; y < img.height; ++y) {
                for (let x = 0; x < img.width; ++x) {
                    let i = x * 4 + y * bytesPerRow;
                    data[i + 0] = imageData.data[imagePixelIndex + 0];
                    data[i + 1] = imageData.data[imagePixelIndex + 1];
                    data[i + 2] = imageData.data[imagePixelIndex + 2];
                    data[i + 3] = imageData.data[imagePixelIndex + 3];
                    imagePixelIndex += 4;
                }
            }
        }
        return this.CreateTextureFromArrayBuffer(img.width, img.height, "rgba8unorm", data.buffer);
    }


}