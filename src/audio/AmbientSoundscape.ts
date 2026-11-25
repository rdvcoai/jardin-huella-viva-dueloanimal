/**
 * Música instrumental relajante tipo piano suave y saxofón cálido para DueloAnimal.co.
 * Diseñada con acordes cálidos de piano y frases líricas lentas de saxo con vibrato suave.
 */
export class AmbientSoundscape {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private wetBus: GainNode | null = null;
  private isPlaying = false;
  private volume = 0.22;
  private chordTimer: number | null = null;
  private saxTimer: number | null = null;
  private chordIndex = 0;
  private phraseIndex = 0;

  // Progresión relajante en Fa mayor (Fmaj7 -> Dm7 -> Bbmaj7 -> C9sus4)
  private readonly chords: number[][] = [
    [174.61, 220.0, 261.63, 329.63], // Fmaj7
    [146.83, 220.0, 261.63, 349.23], // Dm7
    [116.54, 174.61, 220.0, 293.66], // Bbmaj7
    [130.81, 196.0, 233.08, 293.66], // C9sus4
  ];

  // Frases líricas lentas para el saxo suave (freq, duración en seg)
  private readonly saxPhrases: Array<Array<{ freq: number; dur: number }>> = [
    [
      { freq: 440.0, dur: 1.5 }, // A4
      { freq: 523.25, dur: 1.4 }, // C5
      { freq: 587.33, dur: 2.3 }, // D5
      { freq: 523.25, dur: 1.9 }, // C5
    ],
    [
      { freq: 392.0, dur: 1.3 }, // G4
      { freq: 440.0, dur: 1.8 }, // A4
      { freq: 349.23, dur: 2.6 }, // F4
    ],
    [
      { freq: 587.33, dur: 1.4 }, // D5
      { freq: 523.25, dur: 1.3 }, // C5
      { freq: 440.0, dur: 1.5 }, // A4
      { freq: 392.0, dur: 2.4 }, // G4
    ],
    [
      { freq: 349.23, dur: 1.4 }, // F4
      { freq: 392.0, dur: 1.3 }, // G4
      { freq: 440.0, dur: 2.7 }, // A4
    ],
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
      this.setupWarmRoom();
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    if (this.masterGain) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(this.volume, this.ctx.currentTime + 1.8);
    }

    this.isPlaying = true;
    this.scheduleNextChord(150);
    this.scheduleNextSaxPhrase(1400);
  }

  public stop(): void {
    if (!this.isPlaying || !this.ctx || !this.masterGain) return;
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.9);
    this.isPlaying = false;
    if (this.chordTimer !== null) {
      window.clearTimeout(this.chordTimer);
      this.chordTimer = null;
    }
    if (this.saxTimer !== null) {
      window.clearTimeout(this.saxTimer);
      this.saxTimer = null;
    }
  }

  public setVolume(val: number): void {
    this.volume = Math.max(0, Math.min(0.45, val));
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

  private setupWarmRoom(): void {
    if (!this.ctx || !this.masterGain) return;

    const roomFilter = this.ctx.createBiquadFilter();
    roomFilter.type = 'lowpass';
    roomFilter.frequency.value = 1450;
    roomFilter.connect(this.masterGain);

    // Subtle warm lounge reverb via soft filtered feedback delay
    const delay = this.ctx.createDelay(1.5);
    delay.delayTime.value = 0.38;

    const feedback = this.ctx.createGain();
    feedback.gain.value = 0.32;

    const delayTone = this.ctx.createBiquadFilter();
    delayTone.type = 'lowpass';
    delayTone.frequency.value = 950;

    delay.connect(delayTone);
    delayTone.connect(feedback);
    feedback.connect(delay);
    delayTone.connect(roomFilter);

    this.wetBus = this.ctx.createGain();
    this.wetBus.gain.value = 1.0;
    this.wetBus.connect(roomFilter);
    this.wetBus.connect(delay);
  }

  private scheduleNextChord(initialDelayMs?: number): void {
    if (!this.isPlaying) return;
    const delay = initialDelayMs ?? 4800;
    this.chordTimer = window.setTimeout(() => {
      if (!this.isPlaying) return;
      const chord = this.chords[this.chordIndex % this.chords.length];
      this.playWarmPianoChord(chord);
      this.chordIndex = (this.chordIndex + 1) % this.chords.length;
      this.scheduleNextChord();
    }, delay);
  }

  private playWarmPianoChord(freqs: number[]): void {
    if (!this.ctx || !this.wetBus) return;
    const now = this.ctx.currentTime;

    freqs.forEach((freq, idx) => {
      if (!this.ctx || !this.wetBus) return;
      // Gentle arpeggiated roll (~65ms per note) like a soft pianist
      const start = now + idx * 0.065;

      const osc1 = this.ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, start);

      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2, start);

      const osc2Gain = this.ctx.createGain();
      osc2Gain.gain.value = 0.16;

      // Piano-like dynamic lowpass sweep (warm attack -> mellow sustain)
      const noteFilter = this.ctx.createBiquadFilter();
      noteFilter.type = 'lowpass';
      noteFilter.frequency.setValueAtTime(1150, start);
      noteFilter.frequency.exponentialRampToValueAtTime(420, start + 1.8);

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(idx === 0 ? 0.095 : 0.065, start + 0.025);
      env.gain.exponentialRampToValueAtTime(0.0001, start + 4.4);

      osc1.connect(noteFilter);
      osc2.connect(osc2Gain);
      osc2Gain.connect(noteFilter);
      noteFilter.connect(env);
      env.connect(this.wetBus);

      osc1.start(start);
      osc2.start(start);
      osc1.stop(start + 4.5);
      osc2.stop(start + 4.5);
    });
  }

  private scheduleNextSaxPhrase(initialDelayMs?: number): void {
    if (!this.isPlaying) return;
    const delay = initialDelayMs ?? 9200;
    this.saxTimer = window.setTimeout(() => {
      if (!this.isPlaying) return;
      const phrase = this.saxPhrases[this.phraseIndex % this.saxPhrases.length];
      this.playSaxPhrase(phrase);
      this.phraseIndex = (this.phraseIndex + 1) % this.saxPhrases.length;
      this.scheduleNextSaxPhrase();
    }, delay);
  }

  private playSaxPhrase(phrase: Array<{ freq: number; dur: number }>): void {
    if (!this.ctx || !this.wetBus) return;
    let offset = 0;
    phrase.forEach((note) => {
      this.playSmoothSaxNote(note.freq, offset, note.dur);
      offset += note.dur * 0.92; // subtle legato overlap
    });
  }

  private playSmoothSaxNote(freq: number, offsetSec: number, durSec: number): void {
    if (!this.ctx || !this.wetBus) return;
    const start = this.ctx.currentTime + offsetSec;

    // Smooth sax reed timbre: warm sawtooth + mellow triangle
    const reedOsc = this.ctx.createOscillator();
    reedOsc.type = 'sawtooth';
    reedOsc.frequency.setValueAtTime(freq, start);

    const bodyOsc = this.ctx.createOscillator();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(freq, start);

    // Gentle expressive vibrato (4.8 Hz)
    const vibrato = this.ctx.createOscillator();
    vibrato.frequency.value = 4.8;
    const vibratoGain = this.ctx.createGain();
    vibratoGain.gain.setValueAtTime(0.0, start);
    vibratoGain.gain.linearRampToValueAtTime(3.2, start + 0.45);
    vibrato.connect(vibratoGain);
    vibratoGain.connect(reedOsc.frequency);
    vibratoGain.connect(bodyOsc.frequency);

    const reedMix = this.ctx.createGain();
    reedMix.gain.value = 0.28;
    const bodyMix = this.ctx.createGain();
    bodyMix.gain.value = 0.72;

    // Warm sax formant filter
    const formant = this.ctx.createBiquadFilter();
    formant.type = 'lowpass';
    formant.Q.value = 1.4;
    formant.frequency.setValueAtTime(620, start);
    formant.frequency.linearRampToValueAtTime(920, start + 0.35);
    formant.frequency.linearRampToValueAtTime(640, start + durSec);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(0.085, start + 0.16);
    env.gain.setValueAtTime(0.075, start + Math.max(0.2, durSec - 0.35));
    env.gain.exponentialRampToValueAtTime(0.0001, start + durSec + 0.25);

    reedOsc.connect(reedMix);
    bodyOsc.connect(bodyMix);
    reedMix.connect(formant);
    bodyMix.connect(formant);
    formant.connect(env);
    env.connect(this.wetBus);

    reedOsc.start(start);
    bodyOsc.start(start);
    vibrato.start(start);

    const stopAt = start + durSec + 0.3;
    reedOsc.stop(stopAt);
    bodyOsc.stop(stopAt);
    vibrato.stop(stopAt);
  }
}
