/* global AudioWorkletProcessor, registerProcessor */
class JugaadVoiceCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.active = true;
    this.recording = true;
    this.samples = new Float32Array(2048);
    this.count = 0;
    this.port.onmessage = ({ data }) => {
      if (data?.stop) {
        this.active = false;
        this.recording = false;
        this.flush();
        this.port.postMessage({ done: true });
      } else if (data?.pause) {
        this.recording = false;
        this.flush();
      } else if (data?.resume) {
        this.recording = true;
      }
    };
  }

  flush() {
    if (!this.count) return;
    const chunk = this.samples.slice(0, this.count);
    this.port.postMessage({ chunk }, [chunk.buffer]);
    this.count = 0;
  }

  process(inputs) {
    if (!this.active) return false;
    if (this.recording) {
      const mono = inputs[0]?.[0];
      if (mono) {
        for (const sample of mono) {
          this.samples[this.count++] = sample;
          if (this.count === this.samples.length) this.flush();
        }
      }
    }
    return true;
  }
}

registerProcessor("jugaad-voice-capture", JugaadVoiceCapture);

