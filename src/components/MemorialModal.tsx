import React, { useState } from 'react';
import {
  BookHeart,
  Check,
  EyeOff,
  Globe,
  Lock,
  Send,
  Settings2,
  Share2,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { GESTURE_CATEGORIES, GESTURE_OPTIONS } from '../data/gestures';
import { PLANT_LABELS } from '../data/initialData';
import {
  Memorial,
  PlantType,
  PrivacyLevel,
} from '../types/memorial';
import { getCountryFlag } from '../utils/countryFlag';
import { PlantIllustration } from './PlantIllustration';
import { ShareMemorialModal } from './ShareMemorialModal';

interface MemorialModalProps {
  memorial: Memorial;
  isOwner: boolean;
  canAccessBook: boolean;
  bookCtaLabel?: string;
  onClose: () => void;
  onUpdateMemorial: (updated: Memorial) => void;
  onDeleteMemorial: (id: string) => void;
  onOpenBook: (memorial: Memorial) => void;
}

export const MemorialModal: React.FC<MemorialModalProps> = ({
  memorial,
  isOwner,
  canAccessBook,
  bookCtaLabel,
  onClose,
  onUpdateMemorial,
  onDeleteMemorial,
  onOpenBook,
}) => {
  const [gestureCategory, setGestureCategory] = useState<
    'luz' | 'flores' | 'comida' | 'juguetes' | 'temporada'
  >('luz');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAdminBar, setShowAdminBar] = useState(false);

  // Wall of kind words (Muro de palabras amables)
  const [wallAuthor, setWallAuthor] = useState('');
  const [wallText, setWallText] = useState('');

  const plantInfo = PLANT_LABELS[memorial.chosenPlant];
  const flag = getCountryFlag(memorial.country);

  const visibleMessages = memorial.familyContributions.filter((f) =>
    isOwner ? f.status !== 'oculto' : f.status === 'aprobado'
  );

  const handleSendGesture = (g: (typeof GESTURE_OPTIONS)[number]) => {
    const prev = memorial.sentGestures || [];
    onUpdateMemorial({
      ...memorial,
      lightLeftByUser: g.id === 'vela' ? true : memorial.lightLeftByUser,
      flowerLeftByUser: g.category === 'flores' ? true : memorial.flowerLeftByUser,
      candleCount: g.id === 'vela' ? (memorial.candleCount ?? 0) + 1 : memorial.candleCount,
      sentGestures: [
        ...prev,
        { id: `${g.id}-${Date.now()}`, label: g.label, emoji: g.emoji },
      ],
    });
  };

  const handleAddWallMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallText.trim()) return;
    onUpdateMemorial({
      ...memorial,
      familyContributions: [
        {
          id: `msg-${Date.now()}`,
          author: wallAuthor.trim() || 'Visitante',
          relation: 'Acompañante',
          text: wallText.trim(),
          status: isOwner ? 'aprobado' : 'pendiente',
          createdAt: 'Reciente',
        },
        ...memorial.familyContributions,
      ],
    });
    setWallAuthor('');
    setWallText('');
  };

  const handlePrivacyChange = (privacy: PrivacyLevel) => {
    onUpdateMemorial({
      ...memorial,
      privacy,
      inviteCode: privacy === 'invitados' ? memorial.inviteCode || 'FAMILIA' : memorial.inviteCode,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="memorial-title"
        className="glass-panel modal-card custom-scroll animate-gentle-in"
        style={{ maxWidth: '720px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Clean Header: Photo + Chosen Plant + Name + Flag + Dates */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {memorial.photoUrl ? (
              <img
                src={memorial.photoUrl}
                alt={memorial.name}
                style={{
                  width: '82px',
                  height: '94px',
                  objectFit: 'cover',
                  borderRadius: '14px',
                  border: '2px solid rgba(212, 170, 93, 0.55)',
                }}
              />
            ) : (
              <div
                style={{
                  width: '82px',
                  height: '94px',
                  borderRadius: '14px',
                  background: `linear-gradient(160deg, #fbf6eb, ${memorial.accentTone}33)`,
                  border: '2px solid rgba(212, 170, 93, 0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span className="font-serif-editorial" style={{ fontSize: '2.2rem', fontStyle: 'italic' }}>
                  {memorial.name.charAt(0)}
                </span>
              </div>
            )}

            <PlantIllustration plant={memorial.chosenPlant} size={62} />

            <div>
              <h2
                id="memorial-title"
                className="font-serif-editorial"
                style={{ fontSize: '2rem', fontWeight: 500, margin: 0, lineHeight: 1.1 }}
              >
                {memorial.name}{' '}
                <span title={memorial.country || 'Mundo'} style={{ fontSize: '1.35rem' }}>
                  {flag}
                </span>
              </h2>
              {memorial.dates && (
                <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {memorial.dates}
                </div>
              )}
              <div style={{ fontSize: '0.78rem', color: 'var(--accent-sage)', marginTop: '0.25rem', fontWeight: 500 }}>
                Planta del altar: {plantInfo.name}
              </div>
            </div>
          </div>

          <button className="btn-icon" onClick={onClose} aria-label="Cerrar altar">
            <X size={18} />
          </button>
        </div>

        {/* Tribute Phrase */}
        <p
          className="font-serif-editorial"
          style={{
            marginTop: '1rem',
            marginBottom: '0.9rem',
            padding: '0.9rem 1.1rem',
            borderRadius: '14px',
            background: 'rgba(255, 255, 255, 0.65)',
            border: '1px solid var(--border-soft)',
            fontSize: '1.2rem',
            fontStyle: 'italic',
            lineHeight: 1.5,
          }}
        >
          “{memorial.phrase}”
        </p>

        {/* Primary Clean Actions: Share + Nuestro Libro + Owner Settings */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
          <button className="btn-primary" onClick={() => setShowShareModal(true)}>
            <Share2 size={15} />
            Compartir el memorial de {memorial.name}
          </button>

          {canAccessBook && (
            <button
              className="btn-secondary"
              style={{ borderColor: '#64caca' }}
              onClick={() => onOpenBook(memorial)}
            >
              <BookHeart size={15} color="#2f7d7d" />
              Nuestro libro{bookCtaLabel ? ` · ${bookCtaLabel}` : ''}
            </button>
          )}

          {isOwner && (
            <button
              className="btn-secondary"
              style={{ marginLeft: 'auto', fontSize: '0.78rem' }}
              onClick={() => setShowAdminBar((v) => !v)}
            >
              <Settings2 size={14} />
              Administrar altar
            </button>
          )}
        </div>

        {/* Collapsible Owner Settings */}
        {isOwner && showAdminBar && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.75rem 0.95rem',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.65)',
              border: '1px solid var(--border-soft)',
              marginBottom: '1rem',
              fontSize: '0.8rem',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontWeight: 600 }}>Privacidad:</span>
              {(
                [
                  ['privado', 'Privado', Lock],
                  ['invitados', 'Invitados', Users],
                  ['publico', 'Público', Globe],
                ] as const
              ).map(([lvl, label, Icon]) => (
                <button
                  key={lvl}
                  type="button"
                  className={memorial.privacy === lvl ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '0.28rem 0.65rem', fontSize: '0.76rem' }}
                  onClick={() => handlePrivacyChange(lvl)}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}

              <select
                aria-label="Cambiar planta del altar"
                value={memorial.chosenPlant}
                onChange={(e) =>
                  onUpdateMemorial({ ...memorial, chosenPlant: e.target.value as PlantType })
                }
                style={{
                  fontSize: '0.76rem',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-soft)',
                  background: '#ffffff',
                }}
              >
                {(Object.keys(PLANT_LABELS) as PlantType[]).map((key) => (
                  <option key={key} value={key}>
                    Planta: {PLANT_LABELS[key].name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '0.28rem 0.65rem', fontSize: '0.76rem', color: '#8f392c' }}
              onClick={() => {
                if (window.confirm(`¿Deseas eliminar el altar de ${memorial.name}?`)) {
                  onDeleteMemorial(memorial.id);
                }
              }}
            >
              <Trash2 size={12} />
              Eliminar
            </button>
          </div>
        )}

        {/* SECTION 1: Enviar un gesto de cariño */}
        <section
          aria-label="Enviar un gesto de cariño"
          style={{
            padding: '1rem',
            borderRadius: '16px',
            background: 'rgba(255, 255, 255, 0.72)',
            border: '1px solid rgba(100, 202, 202, 0.45)',
            marginBottom: '1rem',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '0.92rem', marginBottom: '0.55rem' }}>
            Enviar un gesto de cariño a {memorial.name}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.65rem' }}>
            {GESTURE_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                type="button"
                className={gestureCategory === cat.key ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '0.32rem 0.75rem', fontSize: '0.77rem' }}
                onClick={() => setGestureCategory(cat.key)}
              >
                {cat.title}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.38rem' }}>
            {GESTURE_OPTIONS.filter((g) => g.category === gestureCategory).map((g) => (
              <button
                key={g.id}
                type="button"
                className="btn-secondary"
                style={{ padding: '0.36rem 0.72rem', fontSize: '0.79rem' }}
                onClick={() => handleSendGesture(g)}
              >
                <span>{g.emoji}</span>
                <span>{g.label}</span>
              </button>
            ))}
          </div>

          {memorial.sentGestures && memorial.sentGestures.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.35rem',
                marginTop: '0.75rem',
                paddingTop: '0.7rem',
                borderTop: '1px solid var(--border-soft)',
              }}
            >
              {memorial.sentGestures.map((sg) => (
                <span
                  key={sg.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.28rem',
                    fontSize: '0.77rem',
                    padding: '0.2rem 0.55rem',
                    borderRadius: '999px',
                    background: '#faf6ee',
                    border: '1px solid var(--border-soft)',
                  }}
                >
                  <span>{sg.emoji}</span>
                  <span>{sg.label}</span>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* SECTION 2: Muro de palabras amables */}
        <section
          aria-label="Muro de palabras amables"
          style={{
            padding: '1rem',
            borderRadius: '16px',
            background: 'rgba(255, 255, 255, 0.64)',
            border: '1px solid var(--border-soft)',
          }}
        >
          <h3 className="font-serif-editorial" style={{ fontSize: '1.35rem', fontWeight: 600, margin: '0 0 0.65rem' }}>
            Muro de palabras amables
          </h3>

          <form onSubmit={handleAddWallMessage} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input
                className="input-field"
                style={{ flex: '1 1 160px' }}
                placeholder="Tu nombre (opcional)"
                value={wallAuthor}
                onChange={(e) => setWallAuthor(e.target.value)}
              />
              <input
                className="input-field"
                style={{ flex: '2 1 240px' }}
                placeholder={`Deja unas palabras amables en memoria de ${memorial.name}...`}
                value={wallText}
                onChange={(e) => setWallText(e.target.value)}
              />
              <button type="submit" className="btn-primary" style={{ flexShrink: 0 }}>
                <Send size={14} />
                Dejar palabras
              </button>
            </div>
          </form>

          {visibleMessages.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Aún no hay mensajes en el muro. Sé la primera persona en acompañar con unas palabras amables.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {visibleMessages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    padding: '0.75rem 0.9rem',
                    borderRadius: '12px',
                    background: '#ffffff',
                    border: '1px solid var(--border-soft)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    <span>
                      <strong style={{ color: 'var(--text-espresso)' }}>{msg.author}</strong> · {msg.createdAt}
                      {msg.status === 'pendiente' && ' · Pendiente de aprobación'}
                    </span>
                    {isOwner && (
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {msg.status !== 'aprobado' && (
                          <button
                            className="btn-icon"
                            style={{ width: '24px', height: '24px' }}
                            title="Aprobar"
                            onClick={() =>
                              onUpdateMemorial({
                                ...memorial,
                                familyContributions: memorial.familyContributions.map((x) =>
                                  x.id === msg.id ? { ...x, status: 'aprobado' } : x
                                ),
                              })
                            }
                          >
                            <Check size={12} color="#586f54" />
                          </button>
                        )}
                        <button
                          className="btn-icon"
                          style={{ width: '24px', height: '24px' }}
                          title="Ocultar"
                          onClick={() =>
                            onUpdateMemorial({
                              ...memorial,
                              familyContributions: memorial.familyContributions.map((x) =>
                                x.id === msg.id ? { ...x, status: 'oculto' } : x
                              ),
                            })
                          }
                        >
                          <EyeOff size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.55 }}>{msg.text}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {showShareModal && (
        <ShareMemorialModal memorial={memorial} onClose={() => setShowShareModal(false)} />
      )}
    </div>
  );
};
