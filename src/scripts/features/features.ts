import {GPU} from "../webgpu/gpu";
import {GPUAbstractRunner, RunnerType} from "../AbstractGPURunner";

export class Features extends GPUAbstractRunner {
    Destroy(): Promise<void> {
        return Promise.resolve(undefined);
    }
    Init(): Promise<void> {
        return Promise.resolve(undefined);
    }

    Run(): Promise<void> {
        return Promise.resolve(undefined);
    }

    getType(): RunnerType {
        return RunnerType.HTML
    }

    getHTML(): string {
        return this.GetFeaturesAsHtml();
    }

    public GetFeaturesAsHtml(): string {
        let s: string
        s = "<h4>Adapter Information</h4>"
        let adapterInfo: GPUAdapterInfo = GPU.GetAdapterInfo();

        let table = ""
        table += "<table>"
        table += "<tr><td >Device  </td><td>" + adapterInfo.device + "</td></tr>"
        table += "<tr><td style=\"padding-right: 10px\">Architecture  </td><td>" + adapterInfo.architecture + "</td></tr>"
        table += "<tr><td>Vendor  </td><td>" + adapterInfo.vendor + "</td></tr>"
        table += "<tr><td>Description  </td><td>" + adapterInfo.description + "</td></tr>"
        table += "</table>"
        s += table


        s += "<br><h4>Adapter Features</h4>"
        let features = GPU.GetAdapterFeatures();
        if (features.size == 0) {
            s += "-- none --<br>";
        }
        for (let item of features.values()) {
            s += item + "<br>";
        }
        s += "<br><h4>Device Features</h4>"
        features = GPU.GetDeviceFeatures();
        if (features.size == 0) {
            s += "-- none --<br>";
        }
        for (let item of features.values()) {
            s += item + "<br>";
        }

        features = GPU.GetWGSLFeatures();
        if (features != null) {
            s += "<br><h4>WGSL Features</h4>"
            if (features.size == 0) {
                s += "-- none --";
            }
            for (let item of features.values()) {
                s += item + "<br>";
            }
        }

        s += "<br><br><h4>Preferred Output Format</h4>" + navigator.gpu.getPreferredCanvasFormat();
        s += "<br><br><h4>Device Limits</h4>"

        let limits = GPU.GetDeviceLimits()
        s += "<table>"
        for (let limitsKey in limits) {
            s += "<tr>"
            s += "<td style=\"padding-right: 10px\">"
            s += limitsKey
            s += "</td>"
            s += "<td>"
            s += limits[limitsKey]
            s += "</td>"
            s += "</tr>"
        }
        s += "</table><br>"

        return s
    }

}