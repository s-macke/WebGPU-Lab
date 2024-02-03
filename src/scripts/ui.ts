import {GPU} from "./webgpu/gpu"
import {PrepareSidebar, ShowFeatures} from "./sidebar";

let lastframeTime = 0 as number
let nFrame = 0 as number

export function MeasureFrame() {
    if (lastframeTime == 0) {
        lastframeTime = performance.now()
        nFrame = 0
    }
    nFrame++
    if (nFrame >= 20) {
        let currentFrameTime = performance.now()
        let fps = 20 / (currentFrameTime - lastframeTime) * 1000
        lastframeTime = currentFrameTime
        nFrame = 0
        document.getElementById("textFps").innerHTML = fps.toFixed(2) + " fps"
    }
}

export function ShowError(message: string, e: Error) {
    document.getElementById("screen").style.visibility = "hidden"

    let infoElement = document.getElementById("info")
    infoElement.innerHTML = ""
    infoElement.style.overflowY = ""

    let errorObject = document.createElement("pre")

    errorObject.style.color = "#dc3545"

    errorObject.innerHTML = "\n" + message
    errorObject.innerHTML += "\n\n"
    errorObject.innerHTML += e.message

    infoElement.appendChild(errorObject)
}

async function Init(powerPreference: GPUPowerPreference) {
    let infoElement = document.getElementById("info")
    infoElement.innerHTML = "Initializing WebGPU..."
    try {
        await GPU.Init(powerPreference)
        GPU.SetCanvas("screen")
    } catch (e) {
        ShowError("WebGPU initialization failed", e as Error)
        throw e
    }
}

PrepareSidebar()

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
    await ShowFeatures();
});


