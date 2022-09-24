import {GPU} from "./webgpu/gpu"
import {Collatz} from "./collatz/collatz";
import {Render} from "./render/render";
import {Raytrace} from "./raytrace/raytrace";
import {SDF} from "./sdf/sdf";
import {Fluid} from "./fluid/fluid";
import {Texture} from "./webgpu/texture";

let stop_raytrace = true;
let stop_sdf = true;

function stopAll() {
    stop_raytrace = true;
    stop_sdf = true;
}

let frame = async () => {
}

let lastframeTime = 0 as number;
let nFrame = 0 as number;
function MeasureFrame() {
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


function ShowError(message: string, e: Error) {
    let errorObject = document.createElement("pre");

    errorObject.style.color = "#dc3545"

    errorObject.innerHTML = message
    errorObject.innerHTML += "\n"
    errorObject.innerHTML += e.stack

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
        return;
    }
}

function ShowFeatures() {
    if (!GPU.isInitialized) return;
    stopAll();
    let infoElement = document.getElementById("info");
    document.getElementById("screen").style.visibility = "hidden";

    infoElement.innerHTML = "<h4>Adapter Features</h4>"
    let features = GPU.GetAdapterFeatures();
    if (features.size == 0) {
        infoElement.innerHTML += "-- none --";
    }
    for (let item of features.values()) {
        infoElement.innerHTML += item + "<br>";
    }
    infoElement.innerHTML += "<br><h4>Device Features</h4>"
    features = GPU.GetDeviceFeatures();
    if (features.size == 0) {
        infoElement.innerHTML += "-- none --";
    }
    for (let item of features.values()) {
        infoElement.innerHTML += item + "<br>";
    }
    infoElement.innerHTML += "<br><br><h4>Preferred Output Format</h4>" + navigator.gpu.getPreferredCanvasFormat();

    infoElement.innerHTML += "<br><br><h4>Device Limits</h4>"

    let s = ""
    let limits = GPU.GetDeviceLimits()
    s += "<table>"
    for (let limitsKey in limits) {
        s += "<tr>"
        s += "<td>"
        s += limitsKey
        s += "</td>"
        s += "<td>"
        s += limits[limitsKey]
        s += "</td>"
        s += "</tr>"
    }
    s += "</table>"
    infoElement.innerHTML += s
}

async function ShowTexture() {
    if (!GPU.isInitialized) return;
    stopAll();
    document.getElementById("info").innerHTML = "";
    //document.getElementById("info").innerHTML = "Hello world";
    document.getElementById("screen").style.visibility = "visible";

    let render: Render
    let texture: Texture
    try {
        texture = await GPU.createTextureFromImage("scripts/render/Lenna.png");
        render = new Render(texture);
        await render.Init();
    } catch (e) {
        ShowError("Creation of GPU objects failed", e as Error)
        throw e
    }

    frame = async () => {
        await render.Render();
        await GPU.device.queue.onSubmittedWorkDone();
        texture.destroy()
    }

    requestAnimationFrame(frame);
}

async function ShowFluid() {
    if (!GPU.isInitialized) return;
    stopAll();
    document.getElementById("info").innerHTML = "";
    document.getElementById("screen").style.visibility = "visible";
    let fluid: Fluid
    try {
        fluid = new Fluid();
        await fluid.Init();
    } catch (e) {
        ShowError("GPU object creation failed", e as Error)
        throw e
    }

    stop_raytrace = false;
    frame = async () => {
        await fluid.Step();
        if (stop_raytrace) {
            return;
        }
        //await GPU.device.queue.onSubmittedWorkDone();
        MeasureFrame()
        requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
}


async function ShowRaytrace(filename: string) {
    if (!GPU.isInitialized) return;
    stopAll();
    document.getElementById("info").innerHTML = "";
    document.getElementById("screen").style.visibility = "visible";

    let raytrace = new Raytrace();
    await raytrace.Init(filename);

    let render = new Render(raytrace.texture);
    await render.Init();

    stop_raytrace = false;
    frame = async () => {
        GPU.device.queue.submit([raytrace.GetCommandBuffer(), render.GetCommandBuffer()]);
        await GPU.device.queue.onSubmittedWorkDone();
        MeasureFrame()
        if (stop_raytrace) {
            raytrace.destroy()
            return;
        }
        requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
}

async function ShowSDF() {
    if (!GPU.isInitialized) return;
    stopAll();
    document.getElementById("info").innerHTML = "";
    document.getElementById("screen").style.visibility = "visible";

    let raytrace = new Raytrace();
    await raytrace.Init("fbm.wgsl");
    await raytrace.Run();

    let sdf = new SDF(raytrace.texture);
    await sdf.Init();

    let render = new Render(sdf.render_output);
    await render.Init();
    stop_sdf = false;
    let count = 0;
    frame = async () => {
        GPU.device.queue.submit([sdf.GetCommandBuffer(), render.GetCommandBuffer()]);
        await GPU.device.queue.onSubmittedWorkDone();
        MeasureFrame()
        count++;
        if (stop_sdf || count > 200) {
            raytrace.destroy()
            sdf.destroy()
            return;
        }
        requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
}

async function ShowCollatz() {
    if (!GPU.isInitialized) return;
    stopAll();
    document.getElementById("info").innerHTML = "";
    document.getElementById("screen").style.visibility = "hidden";

    let infoElement = document.getElementById("info");

    let integers = new Uint32Array(4);
    integers[0] = 64;
    integers[1] = 200;
    integers[2] = 300;
    integers[3] = 400;

    let stopping_time = await Collatz(integers);
    let table = ""

    table += "<table class=\"table text-white\">"
    table += "<thead></thead><tr><th scope=\"col\">Positive Integer</th><th scope=\"col\">Stopping Time</th></tr></thead>"
    table += "<tbody>"
    for (let i = 0; i < integers.length; i++) {
        table += "<tr scope=\"row\">";
        table += "<td>" + integers[i] + "</td>";
        table += "<td>" + stopping_time[i] + "</td>";
        table += "</tr>";
    }
    table += "</tbody>"
    table += "</table>"

    infoElement.innerHTML = table
}

document.getElementById("button_features").addEventListener("click", ShowFeatures)
document.getElementById("button_texture").addEventListener("click", ShowTexture)
document.getElementById("button_collatz").addEventListener("click", ShowCollatz)
document.getElementById("button_clouds").addEventListener("click", () => ShowRaytrace("cloud.wgsl"))
document.getElementById("button_gi").addEventListener("click", () => ShowRaytrace("smallpt.wgsl"))
document.getElementById("button_fbm").addEventListener("click", () => ShowRaytrace("fbm.wgsl"))
document.getElementById("button_voronoise").addEventListener("click", () => ShowRaytrace("voronoise.wgsl"))
document.getElementById("button_2dlight").addEventListener("click", () => ShowRaytrace("light.wgsl"))
document.getElementById("button_sdf").addEventListener("click", () => ShowSDF())
document.getElementById("button_fluid").addEventListener("click", () => ShowFluid())

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


