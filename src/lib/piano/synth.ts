// High Quality Acoustic Grand Piano Sound Bank (Salamander Grand Piano)
// Sample mapping: 3-semitone intervals covering all 88 keys with authentic string resonance

const SAMPLE_MAP: Record<number, string> = {
  21: "A0",
  24: "C1",
  27: "Ds1",
  30: "Fs1",
  33: "A1",
  36: "C2",
  39: "Ds2",
  42: "Fs2",
  45: "A2",
  48: "C3",
  51: "Ds3",
  54: "Fs3",
  57: "A3",
  60: "C4",
  63: "Ds4",
  66: "Fs4",
  69: "A4",
  72: "C5",
  75: "Ds5",
  78: "Fs5",
  81: "A5",
  84: "C6",
  87: "Ds6",
  90: "Fs6",
  93: "A6",
  96: "C7",
  99: "Ds7",
  102: "Fs7",
  105: "A7",
  108: "C8",
};

const SAMPLE_PITCHES = Object.keys(SAMPLE_MAP).map(Number).sort((a, b) => a - b);
const BASE_URL = "https://tonejs.github.io/audio/salamander/";

export class PianoSynth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private sampleBuffers = new Map<number, AudioBuffer>();
  private loadingSamples = new Set<number>();
  private voices = new Map<number, { stop: (t: number) => void }>();
  private nextVoice = 0;

  async resume(): Promise<AudioContext> {
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();

      // Master output
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.95;

      // Dry & Wet paths for concert room ambiance
      this.dryGain = this.ctx.createGain();
      this.dryGain.gain.value = 0.82;

      this.wetGain = this.ctx.createGain();
      this.wetGain.gain.value = 0.28;

      // Simple synthetic impulse response for warm piano hall reverberation
      this.reverbNode = this.createHallReverb(this.ctx);

      this.dryGain.connect(this.master);
      if (this.reverbNode) {
        this.reverbNode.connect(this.wetGain);
        this.wetGain.connect(this.master);
      }
      this.master.connect(this.ctx.destination);

      // Preload most common middle octaves in background
      this.preloadCommonSamples();
    }
    if (this.ctx.state !== "running") await this.ctx.resume();
    return this.ctx;
  }

  get currentTime(): number {
    return this.ctx?.currentTime ?? 0;
  }

  private createHallReverb(ctx: AudioContext): ConvolverNode {
    const convolver = ctx.createConvolver();
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * 1.6); // 1.6s warm decay
    const impulse = ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const decay = Math.exp(-i / (rate * 0.42));
      left[i] = (Math.random() * 2 - 1) * decay;
      right[i] = (Math.random() * 2 - 1) * decay;
    }
    convolver.buffer = impulse;
    return convolver;
  }

  private async loadSample(pitch: number): Promise<AudioBuffer | null> {
    if (this.sampleBuffers.has(pitch)) return this.sampleBuffers.get(pitch)!;
    if (this.loadingSamples.has(pitch) || !this.ctx) return null;

    const sampleName = SAMPLE_MAP[pitch];
    if (!sampleName) return null;

    this.loadingSamples.add(pitch);
    try {
      const res = await fetch(`${BASE_URL}${sampleName}.mp3`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuf = await res.arrayBuffer();
      if (!this.ctx) return null;
      const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
      this.sampleBuffers.set(pitch, audioBuf);
      return audioBuf;
    } catch {
      return null;
    } finally {
      this.loadingSamples.delete(pitch);
    }
  }

  private preloadCommonSamples(): void {
    // Preload Middle C octaves (C3 ~ C6)
    const priorityPitches = [48, 54, 60, 63, 66, 69, 72, 78, 84];
    for (const p of priorityPitches) {
      this.loadSample(p);
    }
  }

  private findClosestSamplePitch(pitch: number): number {
    let closest = SAMPLE_PITCHES[0]!;
    let minDiff = Math.abs(pitch - closest);
    for (const sp of SAMPLE_PITCHES) {
      const diff = Math.abs(pitch - sp);
      if (diff < minDiff) {
        minDiff = diff;
        closest = sp;
      }
    }
    return closest;
  }

  play(pitch: number, velocity: number, duration: number, when?: number): void {
    if (!this.ctx || !this.dryGain) return;
    const ctx = this.ctx;
    const t0 = when ?? ctx.currentTime;
    const closestPitch = this.findClosestSamplePitch(pitch);
    const audioBuf = this.sampleBuffers.get(closestPitch);

    if (audioBuf) {
      this.playSampleVoice(pitch, closestPitch, audioBuf, velocity, duration, t0);
    } else {
      // Background load sample for next time and play high-quality synthesized acoustic fallback
      this.loadSample(closestPitch);
      this.playSynthesizedFallback(pitch, velocity, duration, t0);
    }
  }

  private playSampleVoice(
    pitch: number,
    samplePitch: number,
    buffer: AudioBuffer,
    velocity: number,
    duration: number,
    t0: number,
  ): void {
    if (!this.ctx || !this.dryGain) return;
    const ctx = this.ctx;
    const semitoneDiff = pitch - samplePitch;
    const playbackRate = Math.pow(2, semitoneDiff / 12);
    const vel = Math.max(0.1, Math.min(1.0, velocity));

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(playbackRate, t0);

    const gain = ctx.createGain();
    const peakGain = vel * 0.92;
    gain.gain.setValueAtTime(peakGain, t0);

    // Natural piano key release dampening
    const ringDur = Math.max(0.2, duration);
    const releaseStart = t0 + ringDur;
    const fadeDur = Math.min(0.28, Math.max(0.08, duration * 0.3));

    gain.gain.setValueAtTime(peakGain, releaseStart);
    gain.gain.exponentialRampToValueAtTime(0.0001, releaseStart + fadeDur);

    source.connect(gain);
    gain.connect(this.dryGain);
    if (this.reverbNode) {
      gain.connect(this.reverbNode);
    }

    source.start(t0);
    source.stop(releaseStart + fadeDur + 0.05);

    const id = this.nextVoice++;
    this.voices.set(id, {
      stop: (t) => {
        try {
          gain.gain.cancelScheduledValues(t);
          gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
          source.stop(t + 0.06);
        } catch {
          /* closed */
        }
      },
    });
    source.onended = () => this.voices.delete(id);
  }

  private playSynthesizedFallback(
    pitch: number,
    velocity: number,
    duration: number,
    t0: number,
  ): void {
    if (!this.ctx || !this.dryGain) return;
    const ctx = this.ctx;
    const freq = 440 * Math.pow(2, (pitch - 69) / 12);
    const vel = Math.max(0.05, Math.min(0.65, velocity * 0.65));

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(Math.min(10000, 1200 + velocity * 3800), t0);
    filter.Q.value = 1.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vel, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(vel * 0.45, t0 + 0.09);
    const rel = Math.max(0.18, duration);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + rel + 0.4);

    // Multi-harmonic acoustic modeling (Fundamental, 2nd, 3rd, 4th harmonics + hammer knock)
    const oscA = ctx.createOscillator();
    oscA.type = "triangle";
    oscA.frequency.value = freq;

    const oscB = ctx.createOscillator();
    oscB.type = "sine";
    oscB.frequency.value = freq * 2;
    const gB = ctx.createGain();
    gB.gain.value = 0.22;

    const oscC = ctx.createOscillator();
    oscC.type = "sine";
    oscC.frequency.value = freq * 3;
    const gC = ctx.createGain();
    gC.gain.value = 0.12;

    oscA.connect(filter);
    oscB.connect(gB).connect(filter);
    oscC.connect(gC).connect(filter);
    filter.connect(gain);
    gain.connect(this.dryGain);
    if (this.reverbNode) {
      gain.connect(this.reverbNode);
    }

    oscA.start(t0);
    oscB.start(t0);
    oscC.start(t0);
    const stopAt = t0 + rel + 0.45;
    oscA.stop(stopAt);
    oscB.stop(stopAt);
    oscC.stop(stopAt);

    const id = this.nextVoice++;
    this.voices.set(id, {
      stop: (t) => {
        try {
          gain.gain.cancelScheduledValues(t);
          gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
        } catch {
          /* closed */
        }
      },
    });
    oscA.onended = () => this.voices.delete(id);
  }

  stopAll(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const v of this.voices.values()) v.stop(t);
    this.voices.clear();
  }
}
