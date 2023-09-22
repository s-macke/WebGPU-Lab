import {GPU} from "./webgpu/gpu";
import {GPURunner, RunnerType} from "./AbstractGPURunner";
import {MeasureFrame, ShowError} from "./ui";

let stop_immediately = true;
let promise = Promise.resolve()

function ListenToError() {
    GPU.device.addEventListener("uncapturederror", (event) => {
        let e = event as GPUUncapturedErrorEvent
        console.error("A WebGPU error was not captured", e.error);
        stop_immediately = true;
        ShowError("GPU error", e.error as Error)
    });
}

async function HandleHTML(runner: GPURunner) {
    let infoElement = document.getElementById("info")
    infoElement.style.overflowY = "scroll"
    document.getElementById("screen").style.visibility = "hidden"
    document.getElementById("screen").style.width = "0%"
    document.getElementById("screen").style.height = "0%"
    ListenToError();

    try {
        await runner.Init()
        if (!stop_immediately) { // during Init, the user might has pressed another button. So don't run in this case.
            await runner.Run()
        }
        await runner.Destroy()
    } catch (e) {
        ShowError("GPU error", e as Error)
        throw e
    }
    infoElement.innerHTML = runner.getHTML()
}

async function HandleGraphic(runner: GPURunner) {
    document.getElementById("screen").style.visibility = "visible"
    document.getElementById("screen").style.width = "100%"
    document.getElementById("screen").style.height = "100%"
    ListenToError();
    try {
        await runner.Init()
    } catch (e) {
        ShowError("GPU error", e as Error)
        throw e
    }
    if (stop_immediately) { // during Init, the user has pressed another button. So don't run.
        await runner.Destroy()
        return;
    }
    await new Promise(async resolve => {
        try {
            await runner.Run()
        } catch (e) {
            ShowError("GPU error", e as Error)
            await runner.Destroy()
            resolve(0)
            throw e
        }
        requestAnimationFrame(async () => {
            try {
                await runner.Destroy()
            } catch (e) {
                ShowError("GPU error", e as Error)
                resolve(0)
                throw e
            }
            resolve(0)
        });
    });

}

async function HandleAnimation(runner: GPURunner) {
    document.getElementById("screen").style.visibility = "visible"
    document.getElementById("screen").style.width = "100%"
    document.getElementById("screen").style.height = "100%"
    ListenToError();

    try {
        await runner.Init()
    } catch (e) {
        ShowError("GPU error", e as Error)
        throw e
    }
    if (stop_immediately) { // during Init, the user has pressed another button. So don't run.
        await runner.Destroy()
        return;
    }
    await new Promise(async resolve => {
        let frame = async () => {
            try {
                await runner.Run()
            } catch (e) {
                ShowError("GPU error", e as Error)
                await runner.Destroy()
                resolve(0)
                throw e
            }
            MeasureFrame()
            if (stop_immediately) {
                await runner.Destroy()
                resolve(0)
                return;
            }
            requestAnimationFrame(frame)
        }
        requestAnimationFrame(frame)
    })
}

export async function HandleRunner(runner: GPURunner) {
    if (!GPU.isInitialized) return;

    // signal the previous animation to stop and wait
    stop_immediately = true;
    await promise;

    document.getElementById("info").innerHTML = ""
    document.getElementById("info").style.overflowY = ""

    promise = new Promise<void>(async resolve => {
        stop_immediately = false;
        const type = runner.getType()
        try {
            switch (type) {
                case RunnerType.HTML:
                    await HandleHTML(runner)
                    break

                case RunnerType.GRAPHIC:
                    await HandleGraphic(runner)
                    break

                case RunnerType.ANIM:
                    await HandleAnimation(runner)
                    break
            }
        } finally {
            resolve()
        }
    })
    await promise
}
