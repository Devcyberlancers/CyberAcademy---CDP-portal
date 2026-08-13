export class AudioActivityMonitor {
  private context?: AudioContext;
  private source?: MediaStreamAudioSourceNode;
  private analyser?: AnalyserNode;
  private timer?: number;

  start(stream: MediaStream, onLevel: (level: number, sustained: boolean) => void) {
    if (!stream.getAudioTracks().some((track) => track.readyState === "live")) throw new Error("A live microphone track is required");
    this.context = new AudioContext();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 512;
    this.source = this.context.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
    const samples = new Uint8Array(this.analyser.fftSize);
    let activeSamples = 0;
    this.timer = window.setInterval(() => {
      this.analyser?.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) { const value = (sample - 128) / 128; sum += value * value; }
      const level = Math.min(100, Math.round(Math.sqrt(sum / samples.length) * 320));
      activeSamples = level >= 45 ? activeSamples + 1 : Math.max(0, activeSamples - 1);
      onLevel(level, activeSamples >= 6);
      if (activeSamples >= 6) activeSamples = 0;
    }, 250);
  }

  async stop() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = undefined;
    this.source?.disconnect();
    await this.context?.close().catch(() => undefined);
    this.context = undefined;
    this.source = undefined;
    this.analyser = undefined;
  }
}
