import React, { useState } from 'react';
import { ExternalLink, Headphones, Info, X } from 'lucide-react';
import { PODCAST_CONFIG } from '../config/podcastConfig';

export const SpotifyBrandIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    aria-hidden="true"
    style={{ flexShrink: 0 }}
  >
    <circle cx="12" cy="12" r="11" fill="#1DB954" />
    <path
      d="M17.2 10.4c-3.1-1.85-8.2-2.02-11.15-1.12a.85.85 0 1 1-.5-1.63c3.4-1.03 9.05-.83 12.6 1.28a.85.85 0 0 1-.95 1.47Zm-.1 2.75a.7.7 0 0 1-.97.23c-2.6-1.6-6.55-2.06-9.62-1.13a.7.7 0 1 1-.4-1.34c3.52-1.07 7.88-.55 10.76 1.22.33.2.43.64.23.97Zm-.9 2.65a.56.56 0 0 1-.77.18c-2.25-1.37-5.08-1.68-8.42-.92a.56.56 0 1 1-.25-1.1c3.65-.83 6.78-.47 9.26 1.04.26.16.35.5.18.8Z"
      fill="#FFFFFF"
    />
  </svg>
);

interface PodcastBenchWidgetProps {
  externalHover?: boolean;
  onOpenTrigger?: () => void;
}

export const PodcastBenchWidget: React.FC<PodcastBenchWidgetProps> = ({
  externalHover = false,
  onOpenTrigger,
}) => {
  const [hoveredOrFocused, setHoveredOrFocused] = useState(false);
  const [infoExpanded, setInfoExpanded] = useState(false);

  const isUrlConfigured = PODCAST_CONFIG.spotifyUrl.trim().length > 0;
  const isDev = import.meta.env.DEV;
  const showCard = hoveredOrFocused || infoExpanded || externalHover;

  const handleOpenSpotify = (e: React.MouseEvent) => {
    if (!isUrlConfigured) {
      e.preventDefault();
      setInfoExpanded(true);
      return;
    }
    if (onOpenTrigger) onOpenTrigger();
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '3.6rem',
        left: '1rem',
        zIndex: 22,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '0.5rem',
        maxWidth: 'calc(100vw - 2rem)',
      }}
      onMouseEnter={() => setHoveredOrFocused(true)}
      onMouseLeave={() => setHoveredOrFocused(false)}
    >
      {showCard && (
        <div
          id="podcast-info-card"
          role="region"
          aria-label="Información del podcast Juntos en el Adiós"
          className="glass-panel animate-gentle-in"
          style={{
            width: '320px',
            maxWidth: 'calc(100vw - 2rem)',
            borderRadius: '18px',
            padding: '1rem 1.1rem',
            borderLeft: `4px solid ${PODCAST_CONFIG.accentColor}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600, fontSize: '0.9rem' }}>
              <SpotifyBrandIcon size={18} />
              <span>{PODCAST_CONFIG.title}</span>
            </div>
            {infoExpanded && (
              <button
                type="button"
                className="btn-icon"
                style={{ width: '26px', height: '26px' }}
                aria-label="Cerrar información del podcast"
                onClick={() => setInfoExpanded(false)}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <p style={{ margin: '0 0 0.75rem', fontSize: '0.84rem', lineHeight: 1.55, color: 'var(--text-espresso)' }}>
            Siéntate un momento.
            <br />
            Escucha Juntos en el Adiós: historias y conversaciones para acompañarte en el duelo por tu animal de compañía. Este espacio es gratuito y puedes escucharlo a tu ritmo.
          </p>

          {isUrlConfigured ? (
            <a
              href={PODCAST_CONFIG.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Escuchar Juntos en el Adiós en Spotify; abre en una pestaña nueva"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.48rem 0.9rem',
                borderRadius: '999px',
                background: '#192a2a',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 600,
                textDecoration: 'none',
                border: `1px solid ${PODCAST_CONFIG.accentColor}`,
              }}
            >
              <SpotifyBrandIcon size={16} />
              Abrir en Spotify ↗
            </a>
          ) : (
            <div
              style={{
                fontSize: '0.78rem',
                padding: '0.5rem 0.7rem',
                borderRadius: '10px',
                background: 'rgba(100, 202, 202, 0.16)',
                border: `1px solid ${PODCAST_CONFIG.accentColor}`,
                color: 'var(--text-espresso)',
              }}
            >
              {isDev
                ? 'Vista de desarrollo: falta añadir la URL oficial de Spotify en src/config/podcastConfig.ts.'
                : 'Enlace de Spotify próximamente disponible.'}
            </div>
          )}
        </div>
      )}

      {/* Compact accessible bench pill + mobile info toggle */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
        <a
          href={isUrlConfigured ? PODCAST_CONFIG.spotifyUrl : '#podcast'}
          target={isUrlConfigured ? '_blank' : undefined}
          rel={isUrlConfigured ? 'noopener noreferrer' : undefined}
          onClick={handleOpenSpotify}
          onFocus={() => setHoveredOrFocused(true)}
          onBlur={() => setHoveredOrFocused(false)}
          aria-label="Escuchar Juntos en el Adiós en Spotify; abre en una pestaña nueva"
          className="glass-pill"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0.95rem',
            borderRadius: '999px',
            textDecoration: 'none',
            color: 'var(--text-espresso)',
            fontSize: '0.84rem',
            fontWeight: 500,
            borderColor: PODCAST_CONFIG.accentColor,
          }}
        >
          <Headphones size={15} color="#2f7d7d" />
          <span>{PODCAST_CONFIG.title}</span>
          <ExternalLink size={13} color="#2f7d7d" aria-hidden="true" />
        </a>

        <button
          type="button"
          className="btn-icon"
          aria-expanded={infoExpanded}
          aria-controls="podcast-info-card"
          aria-label="Información sobre Juntos en el Adiós"
          title="Ver descripción del podcast"
          style={{ borderColor: PODCAST_CONFIG.accentColor }}
          onClick={() => setInfoExpanded((v) => !v)}
        >
          <Info size={16} color="#2f7d7d" />
        </button>
      </div>
    </div>
  );
};
