import {GPU} from "./webgpu/gpu"
import {Collatz} from "./collatz/collatz";
import {Render} from "./render/render";
import {Raytrace} from "./raytrace/raytrace";
import {SDF} from "./sdf/sdf";
import {Fluid} from "./fluid/fluid";

let stop_raytrace = true;
let stop_sdf = true;

function stopAll() {
    stop_raytrace = true;
    stop_sdf = true;
}

let frame = async () => {}

function ShowError(e: Error) {
    let infoElement = document.getElementById("info");
    infoElement.style.color = "#dc3545"

    infoElement.innerHTML = "WebGPU initialization failed"
    infoElement.innerHTML += "<br>"
    infoElement.innerHTML += e.message

    document.getElementById("screen").style.visibility = "hidden";
}

async function Init() {
    try {
        await GPU.Init()
        GPU.SetCanvas("screen")
    } catch (e) {
        ShowError(e as Error)
        return;
    }
/*
    let fluid = new Fluid()
    await fluid.Init();

    let count = 0;
    let dtavg = 0.;

    frame = async () => {
        let start2 = Date.now();
        await fluid.Step();
        let now = Date.now();
        let dt = now - start2;

        dtavg += dt;

        if ((count & 0xF) == 0) {
            console.log(dtavg / 16);
            dtavg = 0.;
        }

        count++;
        if (count >= 5000) return;
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
*/
    //await GPU.Render(fluid.flags)
/*
    let texture = await GPU.createTextureFromImage("scripts/webgpu/Lenna.png");
    let c = await texture.Extract()
    document.body.appendChild(c)
*/
    //let texture = await GPU.createTextureFromImage("scripts/render/Lenna.png");
    //await GPU.Render(texture);
    //let texture = await Raytrace();
    //let texture: Texture = GPU.CreateTexture(100, 100, "rgba16float");
    //await GPU.Render(texture);

    //let simpleFluid: Simplefluid = new Simplefluid();
    //await simpleFluid.Init();

    //let twodgi: Twodgi = new Twodgi();
    //await twodgi.Init();
/*
    let lightning: Lightning = new Lightning();
    await lightning.Init();

    //let render: Render = new Render(simpleFluid.texturea);
    //let render: Render = new Render(lightning.t_level);
    let render: Render = new Render(lightning.t_output);
    //let render: Render = new Render(tex);
    await render.Init();
    */
}

function ShowFeatures() {
    if (!GPU.isInitialized) return;
    let infoElement = document.getElementById("info");
    stopAll();
    document.getElementById("screen").style.visibility = "hidden";

    infoElement.innerHTML = "<h4>Adapter Features</h4>"
    let features = GPU.GetAdapterFeatures();
    if (features.size == 0) {
        infoElement.innerHTML += "-- none --";
    }
    for(let item of features.values()) {
        infoElement.innerHTML += item + "<br>";
    }
    infoElement.innerHTML += "<h4>Device Features</h4>"
    features = GPU.GetDeviceFeatures();
    if (features.size == 0) {
        infoElement.innerHTML += "-- none --";
    }
    for(let item of features.values()) {
        infoElement.innerHTML += item + "<br>";
    }
    infoElement.innerHTML += "<h4>Preferred Output Format</h4>" + GPU.getPreferredFormat();

    infoElement.innerHTML += "<h4>Device Limits</h4>"

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
    document.getElementById("info").innerHTML="";
    document.getElementById("screen").style.visibility = "visible";

    let texture = await GPU.createTextureFromImage("scripts/render/Lenna.png");

    let render = new Render(texture);
    await render.Init();

    requestAnimationFrame(async () => {
        await render.Render();
        texture.destroy()
    } );
}

async function ShowFluid() {
    if (!GPU.isInitialized) return;
    stopAll();
    document.getElementById("info").innerHTML="";
    document.getElementById("screen").style.visibility = "visible";

    let fluid = new Fluid();
    await fluid.Init();

    stop_raytrace = false;
    frame = async () => {
        await fluid.Step();
        if (stop_raytrace) {
            //.destroy()
            return;
        }
        requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
}


async function ShowRaytrace(filename: string) {
    if (!GPU.isInitialized) return;
    stopAll();
    document.getElementById("info").innerHTML="";
    document.getElementById("screen").style.visibility = "visible";

    let raytrace = new Raytrace();
    await raytrace.Init(filename);

    let render = new Render(raytrace.texture);
    await render.Init();

    stop_raytrace = false;
    frame = async () => {
        GPU.device.queue.submit([raytrace.GetCommandBuffer(), render.GetCommandBuffer()]);
        await GPU.device.queue.onSubmittedWorkDone();
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
    document.getElementById("info").innerHTML="";
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
    for(let i = 0; i< integers.length; i++) {
        table += "<tr scope=\"row\">";
        table += "<td>"+integers[i]+"</td>";
        table += "<td>"+stopping_time[i]+"</td>";
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
document.getElementById("button_sdf").addEventListener("click", () => ShowSDF())
document.getElementById("button_fluid").addEventListener("click", () => ShowFluid())

window.addEventListener("DOMContentLoaded", () => {Init().then(() => {console.log("Init finished"); ShowFeatures();});});


