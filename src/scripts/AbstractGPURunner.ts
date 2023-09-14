
export enum RunnerType {
    HTML = 1,
    GRAPHIC = 2,
    ANIM= 3,
}

export interface GPURunner {
    getType(): RunnerType;
    getHTML(): string;
    getCommandBuffer(): GPUCommandBuffer;
    Run(): Promise<void>;
    Init(): Promise<void>;
    Destroy(): Promise<void>;
}

export abstract class GPUAbstractRunner implements GPURunner {
    public abstract getType(): RunnerType
    public abstract Destroy(): Promise<void>
    public abstract Init(): Promise<void>
    public abstract Run(): Promise<void>

    getCommandBuffer(): GPUCommandBuffer {
        throw new Error("Method not implemented.");
    }

    getHTML(): string {
        throw new Error("Method not implemented.");
    }
}
