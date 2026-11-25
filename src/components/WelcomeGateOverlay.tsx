import React, { useState } from 'react';
import { ArrowRight, Globe, Mail, User } from 'lucide-react';
import { detectLanguage, MESSAGES } from '../i18n/translations';
import { UserProfile } from '../types/memorial';

interface WelcomeGateOverlayProps {
  initialProfile: UserProfile;
  onEnter: (profile: UserProfile) => void;
  isNight: boolean;
}

export const WelcomeGateOverlay: React.FC<WelcomeGateOverlayProps> = ({
  initialProfile,
  onEnter,
  isNight,
}) => {
  const [email, setEmail] = useState(initialProfile.email);
  const [grievingName, setGrievingName] = useState(initialProfile.grievingName);
  const [country, setCountry] = useState(initialProfile.country);
  const [habeasAccepted, setHabeasAccepted] = useState(false);
  const t = MESSAGES[detectLanguage(country)];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onEnter({
      email: email.trim().toLowerCase(),
      grievingName: grievingName.trim(),
      country: country.trim(),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        background: isNight
          ? 'radial-gradient(circle at center, rgba(14, 22, 36, 0.3), rgba(8, 13, 22, 0.62))'
          : 'radial-gradient(circle at center, rgba(38, 30, 22, 0.12), rgba(28, 22, 16, 0.38))',
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="glass-panel animate-gentle-in custom-scroll"
        style={{
          maxWidth: '540px',
          width: '100%',
          maxHeight: 'calc(100vh - 2rem)',
          overflowY: 'auto',
          borderRadius: '24px',
          padding: '2rem 1.85rem',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: '0.8rem',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--accent-sage)',
            fontWeight: 600,
            marginBottom: '0.55rem',
          }}
        >
          DueloAnimal.co · Espacio de Memoria
        </div>

        <h1
          id="welcome-title"
          className="font-serif-editorial"
          style={{
            fontSize: 'clamp(1.65rem, 3.8vw, 2.2rem)',
            fontWeight: 500,
            lineHeight: 1.2,
            margin: '0 0 0.75rem',
            color: 'var(--text-espresso)',
          }}
        >
          Jardín Huella Viva · Siembra su recuerdo
        </h1>

        <p
          style={{
            fontSize: '0.9rem',
            lineHeight: 1.55,
            color: 'var(--text-muted)',
            margin: '0 0 1.15rem',
          }}
        >
          Al cruzar estas puertas encontrarás un campo sereno. Puedes recorrerlo libremente o
          dejar tus datos para crear y proteger tus homenajes y libros privados (sin contraseñas).
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', textAlign: 'left', marginBottom: '1.15rem' }}>
          <div>
            <label
              htmlFor="gate-name"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.28rem' }}
            >
              <User size={13} color="#586f54" />
              Nombre del doliente (tu nombre)
            </label>
            <input
              id="gate-name"
              type="text"
              className="input-field"
              placeholder="Ej. María Camila"
              value={grievingName}
              onChange={(e) => setGrievingName(e.target.value)}
            />
          </div>

          <div className="responsive-grid-2">
            <div>
              <label
                htmlFor="gate-email"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.28rem' }}
              >
                <Mail size={13} color="#586f54" />
                Correo electrónico
              </label>
              <input
                id="gate-email"
                type="email"
                className="input-field"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="gate-country"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.28rem' }}
              >
                <Globe size={13} color="#586f54" />
                País
              </label>
              <input
                id="gate-country"
                type="text"
                className="input-field"
                placeholder="Ej. Colombia"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </div>
          </div>
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            textAlign: 'left',
            fontSize: '0.78rem',
            lineHeight: 1.45,
            color: 'var(--text-muted)',
            marginBottom: '1rem',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            required
            checked={habeasAccepted}
            onChange={(e) => setHabeasAccepted(e.target.checked)}
            style={{ marginTop: '2px' }}
          />
          <span>
            Acepto el tratamiento de mis datos personales (<strong>Habeas Data</strong>) conforme a la política de privacidad de DueloAnimal.co.
          </span>
        </label>

        <button
          type="submit"
          className="btn-primary"
          style={{ padding: '0.85rem 2rem', fontSize: '0.95rem', width: '100%' }}
        >
          {email.trim() ? t.enterWithDataBtn : t.enterBtn}
          <ArrowRight size={17} />
        </button>

        <p
          style={{
            marginTop: '1.1rem',
            marginBottom: 0,
            paddingTop: '0.85rem',
            borderTop: '1px solid var(--border-soft)',
            fontSize: '0.75rem',
            lineHeight: 1.5,
            color: 'var(--text-muted)',
          }}
        >
          {t.disclaimer}
        </p>
      </form>
    </div>
  );
};
