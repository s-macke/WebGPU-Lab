import {Texture} from "./webgpu/texture";

export enum RunnerType {
    HTML = 1,
    GRAPHIC = 2,
    ANIM= 3,
    ASYNCANIM= 4,
    BENCHMARK= 5,
}

export interface GPURunner {
    getType(): RunnerType;
    getRenderInfo(): {textures: Texture[], fragmentShaderFilenames: string[]};
    getCommandBuffer(): GPUCommandBuffer;
    Run(): Promise<void>;
    Render(): Promise<void>;
    Init(): Promise<void>;
    Destroy(): Promise<void>;
}

export abstract class GPUAbstractRunner implements GPURunner {
    public abstract getType(): RunnerType
    public abstract Destroy(): Promise<void>
    public abstract Init(): Promise<void>
    public abstract Run(): Promise<void>

    Render(): Promise<void> {
        throw new Error("Method not implemented.");
    }

    getCommandBuffer(): GPUCommandBuffer {
        throw new Error("Method not implemented.");
    }

    getRenderInfo(): { textures: Texture[]; fragmentShaderFilenames: string[] } {
        throw new Error("Method not implemented.");
    }
}
