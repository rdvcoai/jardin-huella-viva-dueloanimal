import React, { useState } from 'react';
import { BookHeart, Compass, Flame, MessageSquarePlus, Plus, Send, X } from 'lucide-react';
import { submitCloudSuggestion } from '../lib/supabase';
import { isTurnstileEnabled, TurnstileWidget } from './TurnstileWidget';

interface QuickGuideModalProps {
  onClose: () => void;
  onStartCreate: () => void;
  onOpenBook: () => void;
}

export const QuickGuideModal: React.FC<QuickGuideModalProps> = ({
  onClose,
  onStartCreate,
  onOpenBook,
}) => {
  const [suggestion, setSuggestion] = useState('');
  const [suggestionSent, setSuggestionSent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');

  const handleSuggestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestion.trim()) return;
    if (isTurnstileEnabled && !turnstileToken) return;
    const id = `sug-${Date.now()}`;
    const trimmed = suggestion.trim();
    try {
      const existing = JSON.parse(localStorage.getItem('dueloanimal_suggestions_v1') || '[]') as {
        id: string;
        text: string;
        createdAt: string;
      }[];
      existing.unshift({
        id,
        text: trimmed,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem('dueloanimal_suggestions_v1', JSON.stringify(existing));
    } catch {
      // ignore storage errors
    }
    void submitCloudSuggestion(id, trimmed, turnstileToken);
    setSuggestion('');
    setSuggestionSent(true);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        className="glass-panel modal-card custom-scroll animate-gentle-in"
        style={{ maxWidth: '660px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
          <div>
            <h2 id="guide-title" className="font-serif-editorial" style={{ fontSize: '1.75rem', fontWeight: 500, margin: 0 }}>
              Bienvenido(a) al Jardín Huella Viva
            </h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.84rem', color: 'var(--accent-sage)', fontWeight: 600 }}>
              Siembra su recuerdo · ¿Cómo funciona?
            </p>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar guía">
            <X size={18} />
          </button>
        </div>

        {/* Empathetic introduction by Natalia */}
        <div
          style={{
            padding: '1rem 1.15rem',
            borderRadius: '14px',
            background: 'rgba(100, 202, 202, 0.12)',
            borderLeft: '4px solid #64caca',
            marginBottom: '1.1rem',
            fontSize: '0.9rem',
            lineHeight: 1.6,
            color: 'var(--text-espresso)',
          }}
        >
          Soy <strong>Natalia Jaller Peña, psicóloga y terapeuta de duelo animal</strong>. Sé cuánto amor habita en el vínculo con un animal de compañía y lo profundo que puede ser extrañarlo. Creé este jardín para acompañarte y ofrecerte un lugar sereno donde honrar su vida con respeto, ternura y gratitud.
        </div>

        {/* 3 Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.15rem' }}>
          <div style={{ padding: '0.85rem 1rem', borderRadius: '14px', background: 'rgba(255,255,255,0.68)', border: '1px solid var(--border-soft)', display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
            <Compass size={19} color="#586f54" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ fontSize: '0.9rem' }}>1. Recorre el jardín</strong>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.83rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                Toca cualquier punto del sendero o de la pradera para caminar a tu ritmo y arrastra para mirar alrededor; allí irás encontrando los altares de otros peluditos para visitarlos. Si buscas a alguien en especial, también puedes usar la <strong>“Vista en lista”</strong> o la <strong>lupita buscadora</strong> en la parte superior.
              </p>
            </div>
          </div>

          <div style={{ padding: '0.85rem 1rem', borderRadius: '14px', background: 'rgba(255,255,255,0.68)', border: '1px solid var(--border-soft)', display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
            <Flame size={19} color="#b86f46" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ fontSize: '0.9rem' }}>2. Visita un altar</strong>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.83rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                Al tocar el portarretrato de uno de los peluditos podrás acercarte a saludarlo y acompañar su memoria enviándole flores, mimos, una velita encendida o palabras reconfortantes.
              </p>
            </div>
          </div>

          <div style={{ padding: '0.85rem 1rem', borderRadius: '14px', background: 'rgba(255,255,255,0.68)', border: '1px solid var(--border-soft)', display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
            <BookHeart size={19} color="#2f7d7d" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ fontSize: '0.9rem' }}>3. Crea un homenaje</strong>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.83rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                Usa la opción <strong>“Crear homenaje”</strong> para construir el altar de tu peludito con su fotografía, sus fechas especiales, la planta que deseas sembrar en su recuerdo y una frase o texto dedicado a él. Allí mismo encontrarás la opción para comenzar un libro sobre su vida y el vínculo tan especial que construyeron juntos.
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem', justifyContent: 'flex-end', marginBottom: '1.2rem' }}>
          <button className="btn-secondary" onClick={() => { onClose(); onOpenBook(); }}>
            <BookHeart size={15} />
            Abrir Nuestro libro
          </button>
          <button className="btn-primary" onClick={() => { onClose(); onStartCreate(); }}>
            <Plus size={15} />
            Crear homenaje
          </button>
        </div>

        {/* Suggestion Box */}
        <div
          style={{
            padding: '0.95rem 1.05rem',
            borderRadius: '14px',
            background: 'rgba(255, 255, 255, 0.58)',
            border: '1px solid var(--border-soft)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600, fontSize: '0.86rem', marginBottom: '0.45rem' }}>
            <MessageSquarePlus size={16} color="#586f54" />
            Buzón de sugerencias para mejorar este jardín
          </div>
          {suggestionSent ? (
            <div style={{ fontSize: '0.82rem', color: 'var(--accent-sage)' }}>
              Gracias por compartir tu idea. Tu sugerencia fue guardada con cariño para seguir cuidando y mejorando este espacio.
            </div>
          ) : (
            <form onSubmit={handleSuggestionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <div style={{ display: 'flex', gap: '0.45rem' }}>
                <input
                  className="input-field"
                  style={{ fontSize: '0.83rem', padding: '0.48rem 0.75rem' }}
                  placeholder="¿Qué te gustaría que agreguemos o mejoremos?"
                  value={suggestion}
                  onChange={(e) => setSuggestion(e.target.value)}
                />
                <button type="submit" className="btn-secondary" style={{ flexShrink: 0, fontSize: '0.8rem' }}>
                  <Send size={13} />
                  Enviar
                </button>
              </div>
              <TurnstileWidget onToken={setTurnstileToken} />
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
