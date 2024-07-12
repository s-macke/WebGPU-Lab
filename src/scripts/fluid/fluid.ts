import {Transport} from "./transport/transport";
import {Render} from "./render/render";
import {Poisson} from "./poisson/poisson";
import {Texture} from "../webgpu/texture";
import {toHalf} from "../webgpu/utils";
import {GPU} from "../webgpu/gpu";
import {Advect} from "./advect/advect";
import {Div} from "./div/div";
import {Project} from "./project/project";
import {Source} from "./source/source";
import {GPUAbstractRunner, RunnerType} from "../AbstractGPURunner";
import {LightScene} from "./scene/scene";
import {LightPropagation} from "../modules/light/propagation/light";
import {MonteCarloPathTracing} from "../modules/light/monte_carlo_path_tracing/light";

// Staggered Grid
/*
                       i,j+0.5
               ┌─────────*─────────┐
               │                   │
               │                   │
               │                   │
               │                   │
       i-0.5,j *         * i,j     * i+0.5, j
               │                   │
               │                   │
               │                   │
               │                   │
               └─────────*─────────┘
                       i,j-0.5
 */

export class Fluid extends GPUAbstractRunner {
    public getType(): RunnerType {
        return RunnerType.ASYNCANIM
    }

    n: number;
    m: number;
    width: number;
    height: number;

    source: Source;
    advect: Advect;
    transport: Transport;
    render: Render;
    poisson: Poisson;
    div: Div;
    project: Project;
    scene: LightScene;
    light: LightPropagation;

    velocity: Texture;
    density: Texture;
    flags: Texture;

    count: number;

    async Init() {
        this.n = 512;
        this.m = 512;
        this.width = this.n;
        this.height = this.m;
        this.count = 0

        await this.InitVelocity();
        await this.InitDensity();
        await this.InitCell();

        this.source = new Source(this.velocity, this.density, this.flags);
        await this.source.Init();

        this.advect = new Advect(this.velocity, this.flags);
        await this.advect.Init();

        this.transport = new Transport(this.velocity, this.density, this.flags);
        await this.transport.Init();

        this.div = new Div(this.velocity, this.flags);
        await this.div.Init();

        this.poisson = new Poisson(this.div.div, this.flags);
        await this.poisson.Init();

        this.project = new Project(this.poisson.pressurea, this.velocity, this.flags);
        await this.project.Init();

        this.scene = new LightScene(this.density)
        await this.scene.Init()
/*
        this.light = new LightPropagation(this.scene.emitter)
 */
        this.light = new MonteCarloPathTracing(this.scene.emitter, 20)
        await this.light.Init()


        this.render = new Render(this.density);
        //this.render = new Render(this.div.div);
        //this.render = new Render(this.velocity);
        //this.render = new Render(this.poisson.pressurea);
        await this.render.Init();

        /*
            await poisson.Step();
            await GPU.Render(poisson.pressurea);
        */
        //let render: Render = new Render(poisson.pressurea);
        /*
            let render: Render = new Render(transport.texturea);
            await render.Init()
        */
        //render.Render();
        /*
            requestAnimationFrame(() => {
                GPU.device.queue.submit([transport.GetCommandBuffer()])
                //GPU.device.queue.submit([render.GetCommandBuffer()])
                //GPU.device.queue.submit([render.GetCommandBuffer(), transport.GetCommandBuffer(), poisson.GetCommandBuffer(), render.GetCommandBuffer()])
            });
        */
        //await GPU.device.queue.onSubmittedWorkDone();
        //await GPU.Render(poisson.pressurea);
    }

    public async Destroy() {
        await this.light.Destroy()
        await this.scene.Destroy()
        await this.project.Destroy()
        await this.poisson.Destroy()
        await this.div.Destroy()
        await this.transport.Destroy()
        await this.advect.Destroy()
        await this.source.Destroy()
        this.velocity.destroy()
        this.density.destroy()
        this.flags.destroy()
    }


    async Run() {
        this.light.Reset()
        GPU.device.queue.submit([
            this.source.GetCommandBuffer(),
            this.transport.GetCommandBuffer(),
            this.advect.GetCommandBuffer(),
            this.div.GetCommandBuffer(),
            this.poisson.GetCommandBuffer(),
            this.project.GetCommandBuffer(),
            this.scene.GetCommandBuffer(),
            //this.light.GetCommandBuffer(),
        ])
        //await GPU.Render(this.transport.texturea);
        //await GPU.Render(this.transport.texturea);
        //await GPU.Render(this.poisson.pressurea);
    }

    Render() {
        //this.light.Render()

        GPU.device.queue.submit([
            this.render.GetCommandBuffer()
        ])
    }

        async InitVelocity() {
            let vel = new Uint16Array(this.width * this.height * 4)
/*
        for (let j = 0; j < this.height; j++)
            for (let i = 0; i < this.width; i++) {
                let x: number = i - 256;
                let y: number = j - 256;
                vel[(j * this.width + i) * 4 + 0] = toHalf(-y * 0.03);
                vel[(j * this.width + i) * 4 + 1] = toHalf(x * 0.03);
            }
 */

        for (let j = 200; j < this.height-200; j++)
            for (let i = 200; i < this.width-200; i++) {
                vel[(j * this.width + i) * 4 + 0] = toHalf(0.);
                vel[(j * this.width + i) * 4 + 1] = toHalf(0.);
            }
        this.velocity = await GPU.CreateTextureFromArrayBuffer(this.width, this.height, "rgba16float", vel.buffer);
    }

    async InitDensity() {
        let density = new Uint16Array(this.width * this.height * 4);

        for (let j = 0; j < this.height; j++)
            for (let i = 0; i < this.width; i++) {
                let x: number = i - 256;
                let y: number = j - 256;
                //density[(j * this.width + i) * 4 + 0] = toHalf(Math.exp(-(x * x + y * y) * 0.001));
                // density[(j * this.width + i) * 4 + 3] = toHalf(1.0);
                density[(j * this.width + i) * 4 + 0] = toHalf(0.);
                density[(j * this.width + i) * 4 + 3] = toHalf(0.);
            }
        this.density = await GPU.CreateTextureFromArrayBuffer(this.width, this.height, "rgba16float", density.buffer);
    }

    async InitCell() {
        let flags = new Uint32Array(this.width * this.height*4);

        const F   = 0x0001   // is Fluid
        const B_u = 0x0002   // obstacle cells adjacent to fluid cells
        const B_d = 0x0004   // in the respective direction
        const B_l = 0x0008
        const B_r = 0x0010

        for (let j = 0; j < this.height; j++)
            for (let i = 0; i < this.width; i++) {
                flags[(j * this.width + i)*4] = 0;
            }

        // is fluid
        for (let j = 1; j < this.height-1; j++)
            for (let i = 1; i < this.width-1; i++) {
                flags[(j * this.width + i)*4] = F; // is fluid
            }

        for (let i = 1; i < this.width - 1; i++) {
            let j = 1;
            flags[(j * this.width + i)] |= B_d;
            j = this.height - 2;
            flags[(j * this.width + i)] |= B_u;
        }

        for (let j = 1; j < this.height - 1; j++) {
            let i = 1;
            flags[(j * this.width + i)] |= B_l;
            i = this.width - 2;
            flags[(j * this.width + i)] |= B_r;
        }

        this.flags = await GPU.CreateTextureFromArrayBuffer(this.width, this.height, "r32sint", flags);
    }
}