import {GPU} from "./webgpu/gpu"
import {Collatz} from "./collatz/collatz";
import {Render} from "./render/render";
import {Raytrace} from "./raytrace/raytrace";
import {SDF} from "./sdf/sdf";
import {Fluid} from "./fluid/fluid";
import {Texture} from "./webgpu/texture";
import {Light} from "./light/light";
import {Features} from "./features/features";
import {HandleRunner} from "./GPURunner";

let lastframeTime = 0 as number;
let nFrame = 0 as number;

export function MeasureFrame() {
    if (lastframeTime == 0) {
        lastframeTime = performance.now();
        nFrame = 0;
    }
    nFrame++
    if (nFrame >= 20) {
        let currentFrameTime = performance.now();
        let fps = 20 / (currentFrameTime - lastframeTime) * 1000;
        lastframeTime = currentFrameTime;
        nFrame = 0;
        document.getElementById("textFps").innerHTML = fps.toFixed(2) + " fps";
    }
}

export function ShowError(message: string, e: Error) {
    let errorObject = document.createElement("pre");

    errorObject.style.color = "#dc3545"

    errorObject.innerHTML = "\n" + message
    errorObject.innerHTML += "\n\n"
    errorObject.innerHTML += e.message

    let infoElement = document.getElementById("info");
    infoElement.innerHTML = "";
    infoElement.appendChild(errorObject);
    document.getElementById("screen").style.visibility = "hidden";
}

async function Init(powerPreference: GPUPowerPreference) {
    let infoElement = document.getElementById("info");
    infoElement.innerHTML = "Initializing WebGPU..."
    try {
        await GPU.Init(powerPreference);
        GPU.SetCanvas("screen")
    } catch (e) {
        ShowError("WebGPU initialization failed", e as Error)
        throw e
    }
}


async function ShowFeatures() {
    await HandleRunner(new Features());
}

async function ShowCollatz() {
    await HandleRunner(new Collatz());
}

async function ShowTexture() {
    let texture: Texture;
    texture = await GPU.createTextureFromImage("scripts/render/Lenna.png");
    await HandleRunner(new Render(texture));
    texture.destroy();
}

async function ShowRaytrace(filename: string, fragmentShaderFilename: string = null) {
    await HandleRunner(new Raytrace(filename, true, fragmentShaderFilename));
}


async function ShowFluid() {
    await HandleRunner(new Fluid());
}


async function ShowLight() {
    /*
    if (!GPU.isInitialized) return;
    reset();
    document.getElementById("info").style.overflowY = "";
    document.getElementById("screen").style.visibility = "visible";
    document.getElementById("screen").style.width = "100%";
    document.getElementById("screen").style.height = "100%";

    let light = new Light();
    await light.Init();

    let render = new Render(light.texture);
    await render.Init();

    stop_animation = false;
    frame = async () => {
        GPU.device.queue.submit([light.GetCommandBuffer(), render.GetCommandBuffer()]);
        await GPU.device.queue.onSubmittedWorkDone();
        MeasureFrame()
        //if (stop_animation) {
            light.destroy()
            return;
        //}
        //requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
     */
}

async function ShowSDF() {
    let raytrace = new Raytrace("fbm.wgsl", false);
    try {
        await raytrace.Init();
        await raytrace.Run();
    } catch (e) {
        ShowError("GPU object creation failed", e as Error)
        throw e
    }
    await HandleRunner(new SDF(raytrace.texturedest));
    await raytrace.Destroy();
}

document.getElementById("button_features").addEventListener("click", ShowFeatures)
document.getElementById("button_texture").addEventListener("click", ShowTexture)
document.getElementById("button_collatz").addEventListener("click", ShowCollatz)
document.getElementById("button_clouds").addEventListener("click", () => ShowRaytrace("cloud.wgsl"))
document.getElementById("button_gi").addEventListener("click", () => ShowRaytrace("smallpt.wgsl", "smallpt-tone-mapping.wgsl"))
document.getElementById("button_fbm").addEventListener("click", () => ShowRaytrace("voronoise_fbm.wgsl"))
document.getElementById("button_voronoise").addEventListener("click", () => ShowRaytrace("voronoise.wgsl"))
document.getElementById("button_2dlight").addEventListener("click", () => ShowRaytrace("light.wgsl"))
//document.getElementById("button_restir").addEventListener("click", () => ShowLight())
document.getElementById("button_sdf").addEventListener("click", () => ShowSDF())
document.getElementById("button_fluid").addEventListener("click", () => ShowFluid())
document.getElementById("button_diffuse").addEventListener("click", () => ShowRaytrace("diffuse.wgsl", "aces-tone-mapping.wgsl"))

let gpuSelection1 = document.getElementById("gpuSelection1") as HTMLInputElement
let gpuSelection2 = document.getElementById("gpuSelection2") as HTMLInputElement
gpuSelection1.addEventListener("click", onGpuSelectionClick);
gpuSelection2.addEventListener("click", onGpuSelectionClick);

async function onGpuSelectionClick() {
    //alert(gpuSelection1.checked)
    window.location.href = window.location.href.split("#")[0] + (gpuSelection1.checked ? "#high-performance" : "#low-power")
    location.reload();
    /*
    await Init(gpuSelection1.checked? "low-power" : "high-performance");
    console.log("Init finished");
    ShowFeatures();
     */
}

window.addEventListener("DOMContentLoaded", async () => {
    let preference: GPUPowerPreference = "high-performance"
    if (window.location.hash) {
        preference = window.location.hash.substring(1) as GPUPowerPreference; //Puts hash in variable, and removes the # character
    }
    switch (preference) {
        case "high-performance":
            gpuSelection1.checked = true;
            break;
        case "low-power":
            gpuSelection2.checked = true;
            break;
    }

    await Init(preference);
    console.log("Init finished");
    ShowFeatures();
});


