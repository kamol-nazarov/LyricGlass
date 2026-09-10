// No audio is retained between an explicit start and the matching complete/cancel.
class SampleProcessor extends AudioWorkletProcessor {
 constructor(){super();this.samples=null;this.at=0;this.port.onmessage=e=>{this.samples?.fill(0);this.samples=e.data==='start'?new Float32Array(160000):null;this.at=0;};}
 process(inputs){const input=inputs[0];if(this.samples&&input?.length){for(let i=0;i<input[0].length&&this.at<this.samples.length;i++){let value=0;for(const channel of input)value+=channel[i];this.samples[this.at++]=value/input.length;}if(this.at===this.samples.length){const samples=this.samples;this.samples=null;this.port.postMessage(samples.buffer,[samples.buffer]);}}return true;}
}
registerProcessor('lyricglass-sample',SampleProcessor);
