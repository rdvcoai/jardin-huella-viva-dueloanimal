import React, { useState } from 'react';
import { ExternalLink, Send, X } from 'lucide-react';
import { SERVICE_OFFERINGS } from '../data/initialData';

interface ServicesAndAboutModalProps {
  onClose: () => void;
}

export const ServicesAndAboutModal: React.FC<ServicesAndAboutModalProps> = ({ onClose }) => {
  const [inquiryService, setInquiryService] = useState<string | null>(null);
  const [inquiryEmail, setInquiryEmail] = useState('');
  const [inquiryNotes, setInquiryNotes] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [inquirySent, setInquirySent] = useState(false);

  const handleInquirySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryEmail.trim()) return;
    setInquirySent(true);
    setInquiryNotes('');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="services-title"
        className="glass-panel modal-card custom-scroll animate-gentle-in"
        style={{ maxWidth: '720px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.1rem' }}>
          <div>
            <h2 id="services-title" className="font-serif-editorial" style={{ fontSize: '1.85rem', fontWeight: 500, margin: 0 }}>
              Acompañamiento y recuerdos
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Un espacio creado con amor para honrar la memoria de tu compañero de vida y acompañarte a tu propio ritmo.
            </p>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {SERVICE_OFFERINGS.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: '1rem 1.15rem',
                  borderRadius: '14px',
                  background: 'rgba(255, 255, 255, 0.62)',
                  border: '1px solid var(--border-soft)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                  <strong className="font-serif-editorial" style={{ fontSize: '1.3rem' }}>
                    {s.title}
                  </strong>
                  <span
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      padding: '0.25rem 0.7rem',
                      borderRadius: '999px',
                      background: s.isFree ? 'rgba(88, 111, 84, 0.14)' : 'rgba(184, 111, 70, 0.14)',
                      color: s.isFree ? 'var(--accent-sage)' : 'var(--accent-terracotta)',
                    }}
                  >
                    {s.priceLabel}
                  </span>
                </div>
                <p style={{ margin: '0.35rem 0', fontSize: '0.88rem' }}>{s.description}</p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <strong>Alcance:</strong> {s.scope}
                </p>
                {!s.isFree && (
                  <button
                    className="btn-secondary"
                    style={{ marginTop: '0.65rem', padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}
                    onClick={() => {
                      setInquiryService(s.title);
                      setInquirySent(false);
                    }}
                  >
                    Solicitar información (sin cobro automático)
                  </button>
                )}
              </div>
            ))}

            <div
              style={{
                padding: '1rem 1.15rem',
                borderRadius: '14px',
                background: 'rgba(100, 202, 202, 0.12)',
                border: '1px solid rgba(6, 173, 162, 0.35)',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <div style={{ flex: '1 1 260px' }}>
                <strong className="font-serif-editorial" style={{ fontSize: '1.25rem', color: 'var(--text-espresso)' }}>
                  Conoce DueloAnimal.co
                </strong>
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Descubre nuestros servicios de acompañamiento emocional para personas y familias que atraviesan el duelo por su animal de compañía.
                </p>
              </div>
              <a
                href="https://dueloanimal.co/servicios-de-acompanamiento/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
                style={{ textDecoration: 'none', flexShrink: 0 }}
              >
                <ExternalLink size={15} />
                Acompañamiento personas
              </a>
            </div>

            {inquiryService && (
              <form
                onSubmit={handleInquirySubmit}
                style={{
                  padding: '1rem',
                  borderRadius: '14px',
                  background: 'rgba(255, 255, 255, 0.78)',
                  border: '1px solid var(--accent-sage)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                  Solicitud de información: {inquiryService}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Esta es una solicitud de información, no una compra confirmada. No se realizan cobros en línea sin proveedor de pagos configurado.
                </div>
                {inquirySent ? (
                  <div style={{ fontSize: '0.86rem', color: 'var(--accent-sage)', fontWeight: 500 }}>
                    Solicitud registrada localmente como borrador de contacto. Cuando se conecte el servidor de correo, se enviará de forma segura.
                  </div>
                ) : (
                  <>
                    <input
                      type="email"
                      required
                      className="input-field"
                      placeholder="Tu correo electrónico"
                      value={inquiryEmail}
                      onChange={(e) => setInquiryEmail(e.target.value)}
                    />
                    <input
                      className="input-field"
                      placeholder="Cuéntanos brevemente qué necesitas..."
                      value={inquiryNotes}
                      onChange={(e) => setInquiryNotes(e.target.value)}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem' }}>
                      <input
                        type="checkbox"
                        checked={marketingConsent}
                        onChange={(e) => setMarketingConsent(e.target.checked)}
                      />
                      Acepto recibir información comercial relacionada (consentimiento independiente y opcional).
                    </label>
                    <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start' }}>
                      <Send size={14} />
                      Enviar solicitud de información
                    </button>
                  </>
                )}
              </form>
            )}
          </div>
      </div>
    </div>
  );
};
