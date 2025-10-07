import "./ui";
import {ShowError} from "./ui";
import {HandleRunner} from "./RunGPURunner";
import {Features} from "./features/features";
import {Collatz} from "./collatz/collatz";
import {Benchmark} from "./benchmark/benchmark";
import {Texture} from "./webgpu/texture";
import {GPU} from "./webgpu/gpu";
import {Render} from "./render/render";
import {Raytrace} from "./raytrace/raytrace";
import {GPURenderRunner} from "./GPURenderRunner";
import {Diffuse} from "./diffuse/diffuse";
import {Fluid} from "./fluid/fluid";
import {LightPropagation} from "./light/light";
import {LightPropagation2} from "./light2/light";
import {GPURunner} from "./AbstractGPURunner";
import {SDF} from "./sdf/sdf";
import {LightMonteCarloPathTracing} from "./light_monte_carlo_path_tracing/light";
import {LightPropagationBuffer} from "./light_buffer/light";

import VoronoiFragmentShader from './raytrace/voronoise.wgsl';
import CloudFragmentShader from './raytrace/cloud.wgsl';
import SmallPTFragmentShader from './raytrace/smallpt.wgsl';
import SmallPTToneMappingFragmentShader from './raytrace/smallpt-tone-mapping.wgsl';
import FBMFragmentShader from './raytrace/fbm.wgsl';
import VoronoiseFBMFragmentShader from './raytrace/voronoise_fbm.wgsl';
import LightFragmentShader from './raytrace/light.wgsl';


export async function ShowFeatures() {
    await HandleRunner(new Features())
}

export async function ShowCollatz() {
    await HandleRunner(new Collatz())
}

export async function ShowBenchmark() {
    await HandleRunner(new Benchmark())
}


export async function ShowTexture() {
    let texture: Texture
    texture = await GPU.createTextureFromImage("images/Lenna.png")
    await HandleRunner(new Render([texture], []))
    texture.destroy()
}

export async function ShowRaytrace(filename: string, fragmentShader: string = null) {
    let raytrace = new Raytrace(filename, fragmentShader)
    await HandleRunner(new GPURenderRunner(raytrace))
}

export async function ShowDiffuse() {
    let diffuse = new Diffuse()
    await HandleRunner(new GPURenderRunner(diffuse))
}

export async function ShowFluid() {
    await HandleRunner(new Fluid())
}

export async function ShowLightPropagation() {
    await HandleRunner(new LightPropagation())
}

export async function ShowLightPropagation2() {
    await HandleRunner(new LightPropagation2())
}

export async function ShowLightPropagationBuffer() {
    await HandleRunner(new LightPropagationBuffer())
}


async function RunOnce(runner: GPURunner) {
    try {
        await runner.Init()
        await runner.Run()
    } catch (e) {
        ShowError("GPU object creation failed", e as Error)
        throw e
    }
}

export async function ShowSDF() {
    let raytrace = new Raytrace(FBMFragmentShader)
    await RunOnce(raytrace)

    let sdf = new SDF(raytrace.texturedest)
    await HandleRunner(new GPURenderRunner(sdf))
    await raytrace.Destroy()
}



interface TOCEntry {
    title: string
    elementName: string
    func: any
}

let toc: TOCEntry[] = [
    {
        title: "WebGPU Features",
        elementName: "button_features",
        func: ShowFeatures
    },
    {
        title: "Simple Render of Texture",
        elementName: "button_texture",
        func: ShowTexture
    },
    {
        title: "Global Illumination",
        elementName: "button_gi",
        func: () => ShowRaytrace(SmallPTFragmentShader, SmallPTToneMappingFragmentShader)
    },
    {
        title: "Protean Clouds",
        elementName: "button_clouds",
        func: () => ShowRaytrace(CloudFragmentShader)
    },
    {
        title: "Collatz Conjecture",
        elementName: "button_collatz",
        func: ShowCollatz
    },
    {
        title: "Benchmark",
        elementName: "button_benchmark",
        func: ShowBenchmark
    },
    {
        title: "Voronoise",
        elementName: "button_voronoise",
        func: () => ShowRaytrace(VoronoiFragmentShader)
    },
    {
        title: "FBM",
        elementName: "button_fbm",
        func: () => ShowRaytrace(VoronoiseFBMFragmentShader)
    },
    {
        title: "2D Light",
        elementName: "button_2dlight",
        func: () => ShowRaytrace(LightFragmentShader)
    },
    {
        title: "2D Light Propagation",
        elementName: "button_light_propagation",
        func: ShowLightPropagation
    },
    {
        title: "2D Light Propagation V2.0",
        elementName: "button_light_propagation2",
        func: ShowLightPropagation2
    },/*
    {
        title: "2D Light Propagation V3.0",
        elementName: "button_light_propagation_buffer",
        func: ShowLightPropagationBuffer
    },*/
    {
        title: "2D Light By Monte Carlo Path Tracing",
        elementName: "button_light_path_tracing",
        func: async() => await HandleRunner(new LightMonteCarloPathTracing())
    },
    {
        title: "Signed Distance Field",
        elementName: "button_sdf",
        func: ShowSDF
    },
    {
        title: "Diffuse Raytracing",
        elementName: "button_diffuse",
        func: ShowDiffuse
    },
    {
        title: "Fluid",
        elementName: "button_fluid",
        func: ShowFluid
    },
];

export function PrepareSidebar() {
    let tocContainer = document.getElementById("tocContainer") as HTMLUListElement

    for (let i = 0; i < toc.length; i++) {
        let tocEntry = toc[i]
        let aElement = document.createElement("a")
        aElement.href = "#"
        aElement.innerHTML = toc[i].title
        aElement.id = toc[i].elementName
        aElement.addEventListener("click", tocEntry.func)

        aElement.addEventListener("click", function () {
            let current = document.getElementsByClassName("active");
            current[0].className = current[0].className.replace(" active", "");
            this.className += " active";
        });

        aElement.classList.add("nav-link", "text-white")
        if (i == 0) {
            aElement.classList.add("active")
        }
        let liElement = document.createElement("li")
        liElement.appendChild(aElement)
        tocContainer.appendChild(liElement)
    }
}