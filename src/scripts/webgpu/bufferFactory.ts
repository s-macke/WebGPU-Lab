import {GPU} from "./gpu";
import {Buffer} from "./buffer";

export class BufferFactory {
    static createUniformBuffer(size: number) : Buffer {
        let buffer = new Buffer()
        buffer.size = size;
        buffer.buffer =
            GPU.device.createBuffer({
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                size: size,
                mappedAtCreation: false
            });
        buffer.resource = {
            buffer: buffer.buffer
        }
        return buffer;
    }

    static createStorageBuffer(size: number) : Buffer {
        let buffer = new Buffer()
        buffer.size = size;
        buffer.buffer =
            GPU.device.createBuffer({
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
                size: size,
                mappedAtCreation: false
            });
        buffer.resource = {
            buffer: buffer.buffer
        }
        return buffer;
    }


    static createCopyBuffer(size: number) : Buffer {
        let buffer = new Buffer()
        buffer.size = size;
        buffer.buffer =
            GPU.device.createBuffer({
                usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
                size: size,
                mappedAtCreation: false
            });
        buffer.resource = {
            buffer: buffer.buffer
        }
        return buffer;
    }


    static createFromArrayBuffer(data: ArrayBufferLike) : Buffer {
        console.log("create Buffer from array buffer of size " + data.byteLength);
        let buffer = new Buffer()
        buffer.size = data.byteLength;

        buffer.buffer =
            GPU.device.createBuffer({
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
                //usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
                //usage: GPUBufferUsage.STORAGE,
                //usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE,
                //usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE,
                //usage: GPUBufferUsage.STORAGE | GPUBufferUsage.MAP_READ | GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
                size: data.byteLength,
                mappedAtCreation: true
            });

        const typedBuffer = new Uint8Array(data);
        const typedArray = new Uint8Array(buffer.buffer.getMappedRange());
        typedArray.set(typedBuffer);

        buffer.buffer.unmap();

        buffer.resource = {
            buffer: buffer.buffer
        }
        console.log("create Buffer from array buffer done");
        return buffer;
    }

    static createQueryBuffer(entries: number) : Buffer {
        let buffer = new Buffer()
        buffer.size = entries*8;
        buffer.buffer =
            GPU.device.createBuffer({
                usage: GPUBufferUsage.QUERY_RESOLVE
                    | GPUBufferUsage.STORAGE
                    | GPUBufferUsage.COPY_SRC
                    | GPUBufferUsage.COPY_DST,
                size: buffer.size,
                mappedAtCreation: false
            });
        buffer.resource = {
            buffer: buffer.buffer
        }
        return buffer;
    }


}