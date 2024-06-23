import {GPU} from "./webgpu/gpu";
import {GPURunner, RunnerType} from "./AbstractGPURunner";
import {MeasureFrame, ShowError} from "./ui";

let stop_immediately = true;

export function ListenToError() {
    GPU.device.addEventListener("uncapturederror", (event) => {
        let e = event as GPUUncapturedErrorEvent
        console.error("A WebGPU error was not captured", e.error);
        stop_immediately = true;
        ShowError("GPU error", e.error as Error)
    });
}

async function ResetHTML() {
    document.getElementById("info").innerHTML = ""
    document.getElementById("info").style.overflowY = ""
    document.getElementById("textFps").innerHTML = ""
}

async function SwitchToHTML() {
    let infoElement = document.getElementById("info")
    infoElement.style.overflowY = "scroll"
    document.getElementById("screen").style.visibility = "hidden"
    document.getElementById("screen").style.width = "0%"
    document.getElementById("screen").style.height = "0%"
}

async function SwitchToGraphic() {
    document.getElementById("screen").style.visibility = "visible"
    document.getElementById("screen").style.width = "100%"
    document.getElementById("screen").style.height = "100%"
}

async function InitRunner(runner: GPURunner) : Promise<boolean> {
    stop_immediately = false;
    try {
        await runner.Init()
    } catch (e) {
        ShowError("GPU error", e as Error)
        throw e
    }
    if (stop_immediately) { // during Init, the user has pressed another button. So don't run.
        await runner.Destroy()
        return false;
    }
    return true
}

async function HandleHTML(runner: GPURunner) {
    await SwitchToHTML()
    let infoElement = document.getElementById("info")
    infoElement.style.overflowY = "scroll"

    try {
        await runner.Run()
        await runner.Destroy()
    } catch (e) {
        ShowError("GPU error", e as Error)
        throw e
    }

}

async function HandleGraphic(runner: GPURunner) {
    await SwitchToGraphic()

    await new Promise(async resolve => {
        requestAnimationFrame(async () => {
            try {
                await runner.Run()
            } catch (e) {
                ShowError("GPU error", e as Error)
                throw e
            } finally {
                await runner.Destroy()
                resolve(0)
            }
        });
    });
}

async function HandleAnimation(runner: GPURunner) {
    await SwitchToGraphic()

    // never return from this function unless the animation is stopped
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
                await GPU.device.queue.onSubmittedWorkDone()
                await runner.Destroy()
                document.getElementById("textFps").innerHTML = ""
                resolve(0)
                return;
            }
            requestAnimationFrame(frame)
        }
        requestAnimationFrame(frame)
    })
}

async function HandleBenchmark(runner: GPURunner) {
    await SwitchToHTML()

    // never return from this function unless the animation is stopped
    await new Promise(async resolve => {
        let loop = async () => {
            try {
                await runner.Run()
            } catch (e) {
                ShowError("GPU error", e as Error)
                await runner.Destroy()
                resolve(0)
                throw e
            }
            if (stop_immediately) {
                await GPU.device.queue.onSubmittedWorkDone()
                await runner.Destroy()
                resolve(0)
                return;
            }
            setTimeout(loop, 0)
        }
        setTimeout(loop, 0)
    })
}



let mutex = Promise.resolve();

export async function HandleRunner(runner: GPURunner) {
    if (!GPU.isInitialized) return;

    // signal the previous animation to stop and wait
    stop_immediately = true;

    // wait for the previous task to stop
    mutex = mutex.then(async () => {
        await ResetHTML()
        ListenToError();

        if (! await InitRunner(runner)) return Promise.resolve();

        const type = runner.getType()
        switch (type) {
            case RunnerType.HTML:
                return HandleHTML(runner)
            case RunnerType.GRAPHIC:
                return HandleGraphic(runner)
            case RunnerType.ANIM:
                return HandleAnimation(runner)
            case RunnerType.BENCHMARK:
                return HandleBenchmark(runner)
        }
    })
    await mutex
}
