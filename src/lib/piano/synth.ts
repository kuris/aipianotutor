export class PianoSynth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices = new Map<number, { stop: (t: number) => void }>();
  private nextVoice = 0;

  async resume(): Promise<AudioContext> {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state !== "running") await this.ctx.resume();
    return this.ctx;
  }

  get currentTime(): number {
    return this.ctx?.currentTime ?? 0;
  }

  play(pitch: number, velocity: number, duration: number, when?: number): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t0 = when ?? ctx.currentTime;
    const freq = 440 * Math.pow(2, (pitch - 69) / 12);
    const vel = Math.max(0.04, Math.min(0.42, velocity * 0.42));

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900 + velocity * 2400, t0);
    filter.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vel, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(vel * 0.55, t0 + 0.08);
    const rel = Math.max(0.18, duration);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + rel + 0.35);

    const oscA = ctx.createOscillator();
    oscA.type = "triangle";
    oscA.frequency.value = freq;
    const oscB = ctx.createOscillator();
    oscB.type = "sine";
    oscB.frequency.value = freq * 2;
    const gB = ctx.createGain();
    gB.gain.value = 0.14;
    const oscC = ctx.createOscillator();
    oscC.type = "sine";
    oscC.frequency.value = freq / 2;
    const gC = ctx.createGain();
    gC.gain.value = 0.18;

    oscA.connect(filter);
    oscB.connect(gB).connect(filter);
    oscC.connect(gC).connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    oscA.start(t0);
    oscB.start(t0);
    oscC.start(t0);
    const stopAt = t0 + rel + 0.4;
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
