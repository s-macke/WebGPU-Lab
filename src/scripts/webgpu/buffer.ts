import {GPU} from "./gpu";

export class Buffer {
    buffer: GPUBuffer;
    resource: GPUBufferBinding;
    size: number;

    constructor() {
    }

    public destroy() {
        this.buffer.destroy()
    }

    public updateBufferData(
        dstOffset: number,
        src: ArrayBuffer,
        commandEncoder: GPUCommandEncoder): GPUBuffer {
        const uploadBuffer = GPU.device.createBuffer({
            size: src.byteLength,
            usage: GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true
        });

        // @ts-ignore
        new Uint8Array(uploadBuffer.getMappedRange()).set(new Uint8Array(src));
        uploadBuffer.unmap();

        commandEncoder.copyBufferToBuffer(uploadBuffer, 0, this.buffer, dstOffset, src.byteLength);
        return uploadBuffer;
    }
}

