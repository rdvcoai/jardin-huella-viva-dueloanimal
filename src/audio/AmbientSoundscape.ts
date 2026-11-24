/**
 * Música ambiental suave y relajante para DueloAnimal.co (sin letra).
 * Arpegios lentos estilo arpa/piano suave con eco cálido y volumen bajo y delicado.
 */
export class AmbientSoundscape {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private wetBus: GainNode | null = null;
  private isPlaying = false;
  private volume = 0.16;
  private noteTimer: number | null = null;
  private stepIndex = 0;

  // Progresión serena (Cmaj9 -> Fmaj7 -> Am7 -> Fmaj7) en registro medio-suave
  private readonly arpeggioSequence: number[] = [
    261.63, 329.63, 392.0, 493.88, 587.33, 493.88, 392.0, 329.63,
    174.61, 261.63, 329.63, 440.0, 523.25, 440.0, 329.63, 261.63,
    220.0, 261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 261.63,
    174.61, 220.0, 261.63, 349.23, 440.0, 349.23, 261.63, 220.0,
  ];

  public start(): void {
    if (this.isPlaying) return;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.setupSoftSpace();
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    if (this.masterGain) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(this.volume, this.ctx.currentTime + 2.0);
    }

    this.isPlaying = true;
    this.scheduleNextNote(250);
  }

  public stop(): void {
    if (!this.isPlaying || !this.ctx || !this.masterGain) return;
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.9);
    this.isPlaying = false;
    if (this.noteTimer !== null) {
      window.clearTimeout(this.noteTimer);
      this.noteTimer = null;
    }
  }

  public setVolume(val: number): void {
    this.volume = Math.max(0, Math.min(0.4, val));
    if (this.isPlaying && this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.25);
    }
  }

  public dispose(): void {
    this.stop();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.masterGain = null;
    this.wetBus = null;
  }

  private setupSoftSpace(): void {
    if (!this.ctx || !this.masterGain) return;

    // Warm low-pass filter so nothing ever sounds sharp or piercing
    const toneFilter = this.ctx.createBiquadFilter();
    toneFilter.type = 'lowpass';
    toneFilter.frequency.value = 1100;
    toneFilter.connect(this.masterGain);

    // Gentle stereo-like echo/reverb tail using a soft feedback delay
    const delay = this.ctx.createDelay(1.5);
    delay.delayTime.value = 0.48;

    const feedback = this.ctx.createGain();
    feedback.gain.value = 0.34;

    const delayFilter = this.ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 820;

    delay.connect(delayFilter);
    delayFilter.connect(feedback);
    feedback.connect(delay);
    delayFilter.connect(toneFilter);

    this.wetBus = this.ctx.createGain();
    this.wetBus.gain.value = 1.0;
    this.wetBus.connect(toneFilter);
    this.wetBus.connect(delay);

    // Whisper-soft pure sine pad underneath (barely-there warmth, zero harshness)
    const padFilter = this.ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 380;
    padFilter.connect(this.masterGain);

    [130.81, 196.0, 261.63].forEach((freq) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const g = this.ctx.createGain();
      g.gain.value = 0.014;
      osc.connect(g);
      g.connect(padFilter);
      osc.start();
    });
  }

  private scheduleNextNote(initialDelayMs?: number): void {
    if (!this.isPlaying) return;
    // Calm, unhurried tempo (~1.15s - 1.5s between notes, with a soft breath at phrase ends)
    const isPhraseEnd = this.stepIndex > 0 && this.stepIndex % 8 === 0;
    const delay = initialDelayMs ?? (isPhraseEnd ? 1950 : 1150 + Math.random() * 250);

    this.noteTimer = window.setTimeout(() => {
      if (!this.isPlaying) return;
      this.playSoftHarpNote(this.arpeggioSequence[this.stepIndex % this.arpeggioSequence.length]);
      this.stepIndex = (this.stepIndex + 1) % this.arpeggioSequence.length;
      this.scheduleNextNote();
    }, delay);
  }

  private playSoftHarpNote(freq: number): void {
    if (!this.ctx || !this.wetBus) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    const overtone = this.ctx.createOscillator();
    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(freq * 2, now);

    const overtoneGain = this.ctx.createGain();
    overtoneGain.gain.value = 0.14;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.11, now + 0.08);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 3.4);

    osc.connect(env);
    overtone.connect(overtoneGain);
    overtoneGain.connect(env);
    env.connect(this.wetBus);

    osc.start(now);
    overtone.start(now);
    osc.stop(now + 3.5);
    overtone.stop(now + 3.5);
  }
}
