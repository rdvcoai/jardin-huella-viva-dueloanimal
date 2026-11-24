import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Volume2, VolumeX, Wind, X } from 'lucide-react';

interface BreathingModalProps {
  onClose: () => void;
}

type PatternId = '4-7-8' | '4-4-4-4' | '4-8';
type PhaseKey = 'inhale' | 'hold' | 'exhale' | 'hold_empty';

interface PhaseSpec {
  key: PhaseKey;
  label: string;
  guidance: string;
  durationSec: number;
  color: string;
}

interface BreathingPattern {
  id: PatternId;
  title: string;
  shortLabel: string;
  whenToUse: string;
  phases: PhaseSpec[];
}

const PATTERNS: BreathingPattern[] = [
  {
    id: '4-7-8',
    title: '4 × 7 × 8',
    shortLabel: '4s inhala · 7s sostén · 8s exhala',
    whenToUse:
      'Cuándo usarla: ideal para soltar tensión profunda o antes de descansar. Si estás muy agitado(a), prefiere la 4 × 8 para evitar hiperventilar.',
    phases: [
      {
        key: 'inhale',
        label: 'Inhala',
        guidance: 'Toma aire suavemente por la nariz sintiendo cómo se expande tu pecho.',
        durationSec: 4,
        color: '#06ada2',
      },
      {
        key: 'hold',
        label: 'Sostén',
        guidance: 'Mantén el aire con calma, sin tensión, dejando que tu cuerpo se asiente.',
        durationSec: 7,
        color: '#5dc1b9',
      },
      {
        key: 'exhale',
        label: 'Exhala',
        guidance: 'Suelta el aire despacio por la boca, dejando ir un poco de peso.',
        durationSec: 8,
        color: '#8ae0db',
      },
    ],
  },
  {
    id: '4-4-4-4',
    title: '4 × 4 × 4 × 4',
    shortLabel: '4s inhala · 4s sostén · 4s exhala · 4s sostén',
    whenToUse:
      'Cuándo usarla: respiración cuadrada para recuperar estabilidad, foco y calma cuando te sientes abrumado(a) o con muchos pensamientos.',
    phases: [
      {
        key: 'inhale',
        label: 'Inhala',
        guidance: 'Inhala por la nariz contando cuatro segundos de forma pareja y tranquila.',
        durationSec: 4,
        color: '#06ada2',
      },
      {
        key: 'hold',
        label: 'Sostén',
        guidance: 'Sostén el aire suavemente en tus pulmones durante cuatro segundos.',
        durationSec: 4,
        color: '#5dc1b9',
      },
      {
        key: 'exhale',
        label: 'Exhala',
        guidance: 'Exhala despacio por la boca vaciando el aire en cuatro segundos.',
        durationSec: 4,
        color: '#8ae0db',
      },
      {
        key: 'hold_empty',
        label: 'Sostén en calma',
        guidance: 'Permanece cuatro segundos en quietud con los pulmones vacíos antes de volver a inhalar.',
        durationSec: 4,
        color: '#5dc1b9',
      },
    ],
  },
  {
    id: '4-8',
    title: '4 × 8',
    shortLabel: '4s inhala con energía · 8s exhala suave',
    whenToUse:
      'Cuándo usarla: la mejor opción cuando estás muy agitado(a), con llanto intenso o sensación de ahogo. Al no tener retenciones, evita hiperventilar.',
    phases: [
      {
        key: 'inhale',
        label: 'Inhala con energía',
        guidance: 'Toma aire profundo y firme por la nariz llenando tu abdomen en cuatro segundos.',
        durationSec: 4,
        color: '#06ada2',
      },
      {
        key: 'exhale',
        label: 'Exhala suave',
        guidance: 'Suelta el aire largo, tibio y muy despacio por la boca durante ocho segundos.',
        durationSec: 8,
        color: '#8ae0db',
      },
    ],
  },
];

const CYCLE_OPTIONS = [7, 8, 9, 10] as const;

class BreathingAudioEngine {
  private ctx: AudioContext | null = null;
  private padGain: GainNode | null = null;
  private padOscs: OscillatorNode[] = [];

  startPad() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      if (this.padGain && this.ctx) {
        this.padGain.gain.setTargetAtTime(0.045, this.ctx.currentTime, 0.5);
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    this.ctx = ctx;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.001;
    masterGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.6);

    filter.connect(masterGain);
    masterGain.connect(ctx.destination);
    this.padGain = masterGain;

    // Warm, grounding harmonic drone (174 Hz + 261.63 Hz)
    const freqs = [174, 261.63];
    this.padOscs = freqs.map((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(filter);
      osc.start();
      return osc;
    });
  }

  playPhaseCue(phase: PhaseKey, patternId: PatternId) {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc2.type = 'sine';

    if (phase === 'inhale') {
      const startFreq = patternId === '4-8' ? 360 : 330;
      const endFreq = patternId === '4-8' ? 528 : 440;
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.85);
      osc2.frequency.setValueAtTime(startFreq * 1.5, now);
      osc2.frequency.exponentialRampToValueAtTime(endFreq * 1.5, now + 0.85);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.07, now + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 1.4);
    } else if (phase === 'hold' || phase === 'hold_empty') {
      const freq = phase === 'hold' ? 432 : 348;
      osc.frequency.setValueAtTime(freq, now);
      osc2.frequency.setValueAtTime(freq * 1.5, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.045, now + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 1.1);
    } else {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(293.66, now + 1.2);
      osc2.frequency.setValueAtTime(660, now);
      osc2.frequency.exponentialRampToValueAtTime(440, now + 1.2);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.16);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 1.8);
    }

    const subGain2 = this.ctx.createGain();
    subGain2.gain.value = 0.25;

    osc.connect(gain);
    osc2.connect(subGain2);
    subGain2.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 2.0);
    osc2.stop(now + 2.0);
  }

  pausePad() {
    if (this.padGain && this.ctx) {
      this.padGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.25);
    }
  }

  dispose() {
    this.padOscs.forEach((o) => {
      try {
        o.stop();
      } catch {
        // ignore
      }
    });
    this.padOscs = [];
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.padGain = null;
  }
}

export const BreathingModal: React.FC<BreathingModalProps> = ({ onClose }) => {
  const [patternId, setPatternId] = useState<PatternId>('4-7-8');
  const [totalCycles, setTotalCycles] = useState<number>(8);
  const [currentCycle, setCurrentCycle] = useState<number>(1);
  const [phaseIndex, setPhaseIndex] = useState<number>(0);
  const [elapsedInPhase, setElapsedInPhase] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const lastTickRef = useRef<number | null>(null);
  const audioRef = useRef<BreathingAudioEngine | null>(null);
  const lastCueKeyRef = useRef<string>('');

  const pattern = useMemo(
    () => PATTERNS.find((p) => p.id === patternId) ?? PATTERNS[0],
    [patternId]
  );
  const currentPhase = pattern.phases[phaseIndex] ?? pattern.phases[0];
  const remainingSec = Math.max(0, currentPhase.durationSec - elapsedInPhase);
  const displaySeconds = isCompleted ? 0 : Math.max(1, Math.ceil(remainingSec));

  useEffect(() => {
    const engine = new BreathingAudioEngine();
    audioRef.current = engine;
    return () => {
      engine.dispose();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const engine = audioRef.current;
    if (!engine) return;

    if (isRunning && soundEnabled && !isCompleted) {
      engine.startPad();
      const cueKey = `${patternId}-${currentCycle}-${phaseIndex}`;
      if (lastCueKeyRef.current !== cueKey) {
        lastCueKeyRef.current = cueKey;
        engine.playPhaseCue(currentPhase.key, patternId);
      }
    } else {
      engine.pausePad();
      if (!isRunning) {
        lastCueKeyRef.current = '';
      }
    }
  }, [isRunning, soundEnabled, isCompleted, patternId, currentCycle, phaseIndex, currentPhase.key]);

  useEffect(() => {
    if (!isRunning || isCompleted) {
      lastTickRef.current = null;
      return;
    }

    lastTickRef.current = performance.now();
    const interval = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.15, (now - (lastTickRef.current ?? now)) / 1000);
      lastTickRef.current = now;

      setElapsedInPhase((prevElapsed) => {
        const phase = pattern.phases[phaseIndex] ?? pattern.phases[0];
        const nextElapsed = prevElapsed + dt;
        if (nextElapsed < phase.durationSec) {
          return nextElapsed;
        }

        if (phaseIndex < pattern.phases.length - 1) {
          setPhaseIndex(phaseIndex + 1);
          return 0;
        }

        if (currentCycle < totalCycles) {
          setCurrentCycle((c) => c + 1);
          setPhaseIndex(0);
          return 0;
        }

        setIsRunning(false);
        setIsCompleted(true);
        return phase.durationSec;
      });
    }, 40);

    return () => window.clearInterval(interval);
  }, [isRunning, isCompleted, phaseIndex, currentCycle, totalCycles, pattern]);

  const handleReset = (autoStart = false) => {
    lastCueKeyRef.current = '';
    setCurrentCycle(1);
    setPhaseIndex(0);
    setElapsedInPhase(0);
    setIsCompleted(false);
    setIsRunning(autoStart);
  };

  const handleSelectPattern = (nextId: PatternId) => {
    setPatternId(nextId);
    lastCueKeyRef.current = '';
    setCurrentCycle(1);
    setPhaseIndex(0);
    setElapsedInPhase(0);
    setIsCompleted(false);
    setIsRunning(false);
  };

  const orbScale = useMemo(() => {
    if (isCompleted) return 0.72;
    const progress = Math.min(1, elapsedInPhase / currentPhase.durationSec);
    if (currentPhase.key === 'inhale') {
      const eased = 1 - Math.pow(1 - progress, 2);
      return 0.58 + 0.42 * eased;
    }
    if (currentPhase.key === 'hold') {
      return 1.0 + Math.sin(progress * Math.PI * 2) * 0.02;
    }
    if (currentPhase.key === 'hold_empty') {
      return 0.58 + Math.sin(progress * Math.PI * 2) * 0.015;
    }
    const eased = progress * (2 - progress);
    return 1.0 - 0.42 * eased;
  }, [currentPhase, elapsedInPhase, isCompleted]);

  const phaseProgress = isCompleted
    ? 1
    : Math.min(1, elapsedInPhase / currentPhase.durationSec);
  const ringRadius = 96;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = ringCircumference * (1 - phaseProgress);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="breathing-title"
        className="glass-panel modal-card custom-scroll animate-gentle-in"
        style={{ maxWidth: '580px', textAlign: 'center' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', textAlign: 'left' }}>
          <div>
            <h2
              id="breathing-title"
              className="font-serif-editorial"
              style={{ fontSize: '1.7rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}
            >
              <Wind size={22} color="#06ada2" />
              Respiremos juntos
            </h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Elige el ritmo que mejor acompañe cómo se siente tu cuerpo hoy (7 a 10 sesiones).
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              type="button"
              className="btn-icon"
              onClick={() => setSoundEnabled((s) => !s)}
              aria-label={soundEnabled ? 'Silenciar guía sonora' : 'Activar guía sonora relajante'}
              title={soundEnabled ? 'Silenciar sonido guía' : 'Activar sonido guía relajante'}
            >
              {soundEnabled ? <Volume2 size={17} color="#06ada2" /> : <VolumeX size={17} />}
            </button>
            <button className="btn-icon" onClick={onClose} aria-label="Cerrar respiración">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Breathing pattern selector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.45rem', marginBottom: '0.65rem' }}>
          {PATTERNS.map((p) => {
            const active = p.id === patternId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPattern(p.id)}
                style={{
                  padding: '0.5rem 0.55rem',
                  borderRadius: '12px',
                  border: active ? '2px solid #06ada2' : '1px solid var(--border-soft)',
                  background: active ? 'rgba(6, 173, 162, 0.12)' : 'rgba(255,255,255,0.72)',
                  color: 'var(--text-espresso)',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: active ? '#06ada2' : 'var(--text-espresso)' }}>
                  {p.title}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem', lineHeight: 1.25 }}>
                  {p.id === '4-7-8'
                    ? 'Calma profunda'
                    : p.id === '4-4-4-4'
                      ? 'Estabilidad y foco'
                      : 'Si estás agitado(a)'}
                </div>
              </button>
            );
          })}
        </div>

        {/* Brief when-to-use guidance */}
        <div
          style={{
            padding: '0.65rem 0.9rem',
            borderRadius: '12px',
            background: 'rgba(100, 202, 202, 0.1)',
            borderLeft: '3px solid #06ada2',
            fontSize: '0.8rem',
            lineHeight: 1.45,
            color: 'var(--text-espresso)',
            textAlign: 'left',
            marginBottom: '0.75rem',
          }}
        >
          {pattern.whenToUse}
        </div>

        {/* Cycle selector (7 to 10 sessions) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            flexWrap: 'wrap',
            marginBottom: '0.65rem',
          }}
        >
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Sesiones:
          </span>
          {CYCLE_OPTIONS.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => {
                setTotalCycles(count);
                if (currentCycle > count) {
                  handleReset(false);
                }
              }}
              style={{
                padding: '0.24rem 0.62rem',
                borderRadius: '999px',
                border: '1px solid var(--border-soft)',
                background: totalCycles === count ? '#06ada2' : 'rgba(255,255,255,0.75)',
                color: totalCycles === count ? '#ffffff' : 'var(--text-espresso)',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {count}
            </button>
          ))}
          <span
            style={{
              marginLeft: '0.35rem',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: '#06ada2',
            }}
          >
            {isCompleted
              ? `${totalCycles} de ${totalCycles} completadas`
              : `Sesión ${currentCycle} de ${totalCycles}`}
          </span>
        </div>

        {/* Dynamic Breathing Visual + Countdown */}
        <div
          style={{
            position: 'relative',
            width: '220px',
            height: '220px',
            margin: '0 auto 0.7rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="220"
            height="220"
            viewBox="0 0 220 220"
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0 }}
          >
            <defs>
              <radialGradient id="breathOrbGrad" cx="50%" cy="45%" r="55%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
                <stop offset="55%" stopColor="#8ae0db" stopOpacity="0.65" />
                <stop offset="100%" stopColor="#06ada2" stopOpacity="0.32" />
              </radialGradient>
            </defs>

            <circle
              cx="110"
              cy="110"
              r={ringRadius}
              fill="none"
              stroke="rgba(6, 173, 162, 0.14)"
              strokeWidth="6"
            />
            <circle
              cx="110"
              cy="110"
              r={ringRadius}
              fill="none"
              stroke={currentPhase.color}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={ringCircumference}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 110 110)"
            />

            <g transform={`translate(110 110) scale(${orbScale.toFixed(4)})`}>
              {[0, 45, 90, 135].map((deg) => (
                <ellipse
                  key={deg}
                  cx="0"
                  cy="0"
                  rx="68"
                  ry="29"
                  fill="rgba(93, 193, 185, 0.18)"
                  stroke="rgba(6, 173, 162, 0.28)"
                  strokeWidth="1"
                  transform={`rotate(${deg})`}
                />
              ))}
              <circle cx="0" cy="0" r="62" fill="url(#breathOrbGrad)" />
            </g>
          </svg>

          <div style={{ position: 'relative', zIndex: 2, pointerEvents: 'none', padding: '0 0.8rem' }}>
            {isCompleted ? (
              <>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#06ada2' }}>
                  Bien hecho
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Tu respiración está más serena
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#06ada2',
                  }}
                >
                  {currentPhase.label}
                </div>
                <div
                  style={{
                    fontSize: '2.55rem',
                    fontWeight: 700,
                    lineHeight: 1.05,
                    color: 'var(--text-espresso)',
                    margin: '0.1rem 0',
                  }}
                >
                  {displaySeconds}s
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  {pattern.shortLabel}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Phase guidance */}
        <p
          style={{
            margin: '0 auto 0.9rem',
            maxWidth: '440px',
            minHeight: '2.5rem',
            fontSize: '0.86rem',
            lineHeight: 1.5,
            color: 'var(--text-espresso)',
          }}
        >
          {isCompleted
            ? 'Completaste tus sesiones de respiración consciente. Puedes quedarte aquí un momento más o volver al jardín cuando te sientas listo(a).'
            : isRunning
              ? currentPhase.guidance
              : 'Presiona Iniciar y sigue el movimiento de la flor, el contador y las campanitas suaves.'}
        </p>

        {/* Controls */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {isCompleted ? (
            <button type="button" className="btn-primary" onClick={() => handleReset(true)}>
              <RotateCcw size={15} />
              Repetir sesiones
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={() => setIsRunning((r) => !r)}
            >
              {isRunning ? <Pause size={15} /> : <Play size={15} />}
              {isRunning ? 'Pausar' : elapsedInPhase > 0 || currentCycle > 1 || phaseIndex > 0 ? 'Continuar' : 'Iniciar'}
            </button>
          )}

          <button type="button" className="btn-secondary" onClick={() => handleReset(false)}>
            <RotateCcw size={15} />
            Reiniciar
          </button>
        </div>
      </div>
    </div>
  );
};
