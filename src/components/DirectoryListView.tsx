import React, { useMemo, useState } from 'react';
import { Globe, Headphones, KeyRound, Lock, Search, Trees, Users } from 'lucide-react';
import { PODCAST_CONFIG } from '../config/podcastConfig';
import { PLANT_LABELS } from '../data/initialData';
import { Memorial } from '../types/memorial';
import { SpotifyBrandIcon } from './PodcastBenchWidget';

interface DirectoryListViewProps {
  memorials: Memorial[];
  currentOwnerId: string;
  unlockedInviteCodes: string[];
  onUnlockInviteCode: (code: string) => void;
  onSelectMemorial: (memorial: Memorial) => void;
}

export const DirectoryListView: React.FC<DirectoryListViewProps> = ({
  memorials,
  currentOwnerId,
  unlockedInviteCodes,
  onUnlockInviteCode,
  onSelectMemorial,
}) => {
  const [query, setQuery] = useState('');
  const [inviteInput, setInviteInput] = useState('');

  const accessibleMemorials = useMemo(() => {
    return memorials.filter((m) => {
      if (m.ownerId === currentOwnerId) return true;
      if (m.privacy === 'publico') return true;
      if (m.privacy === 'invitados' && m.inviteCode && unlockedInviteCodes.includes(m.inviteCode.toUpperCase())) {
        return true;
      }
      return false;
    });
  }, [memorials, currentOwnerId, unlockedInviteCodes]);

  const filtered = useMemo(() => {
    return accessibleMemorials.filter(
      (m) =>
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.phrase.toLowerCase().includes(query.toLowerCase())
    );
  }, [accessibleMemorials, query]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteInput.trim()) return;
    onUnlockInviteCode(inviteInput.trim().toUpperCase());
    setInviteInput('');
  };

  return (
    <main
      aria-label="Vista en lista de memoriales"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10,
        overflowY: 'auto',
        padding: '5.5rem 1.25rem 3rem',
        background: 'linear-gradient(180deg, #f3ece1 0%, #e9dfd0 100%)',
      }}
    >
      <div style={{ maxWidth: '880px', margin: '0 auto' }}>
        <h1 className="font-serif-editorial" style={{ fontSize: '2.1rem', fontWeight: 500, margin: '0 0 0.35rem' }}>
          Rincones del jardín (vista en lista)
        </h1>
        <p style={{ margin: '0 0 1.25rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Alternativa accesible al recorrido visual 3D. Solo se muestran los homenajes públicos, los tuyos o aquellos a los que fuiste invitado.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '0.85rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              className="input-field"
              style={{ paddingLeft: '2.35rem' }}
              placeholder="Buscar por nombre o frase..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <form onSubmit={handleUnlock} style={{ display: 'flex', gap: '0.45rem', flex: '1 1 240px' }}>
            <input
              className="input-field"
              placeholder="Clave de invitación familiar..."
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
            />
            <button type="submit" className="btn-secondary" style={{ flexShrink: 0 }}>
              <KeyRound size={15} />
              Acceder
            </button>
          </form>
        </div>

        {/* Podcast "Juntos en el Adiós" access in list view */}
        <section
          aria-label="Podcast Juntos en el Adiós"
          style={{
            padding: '1.1rem 1.25rem',
            borderRadius: '16px',
            background: 'rgba(255, 255, 255, 0.78)',
            border: '1px solid var(--border-soft)',
            borderLeft: `4px solid ${PODCAST_CONFIG.accentColor}`,
            marginBottom: '1.35rem',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ flex: '1 1 320px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <Headphones size={16} color="#2f7d7d" />
              <strong className="font-serif-editorial" style={{ fontSize: '1.3rem' }}>
                {PODCAST_CONFIG.title}
              </strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.86rem', lineHeight: 1.55, color: 'var(--text-muted)' }}>
              Siéntate un momento. Escucha Juntos en el Adiós: historias y conversaciones para acompañarte en el duelo por tu animal de compañía. Este espacio es gratuito y puedes escucharlo a tu ritmo.
            </p>
          </div>

          {PODCAST_CONFIG.spotifyUrl.trim() ? (
            <a
              href={PODCAST_CONFIG.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Escuchar Juntos en el Adiós en Spotify; abre en una pestaña nueva"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 1.05rem',
                borderRadius: '999px',
                background: '#192a2a',
                color: '#ffffff',
                fontSize: '0.84rem',
                fontWeight: 600,
                textDecoration: 'none',
                border: `1px solid ${PODCAST_CONFIG.accentColor}`,
                flexShrink: 0,
              }}
            >
              <SpotifyBrandIcon size={17} />
              Abrir en Spotify ↗
            </a>
          ) : (
            <div
              style={{
                fontSize: '0.78rem',
                padding: '0.5rem 0.75rem',
                borderRadius: '10px',
                background: 'rgba(100, 202, 202, 0.16)',
                border: `1px solid ${PODCAST_CONFIG.accentColor}`,
              }}
            >
              {import.meta.env.DEV
                ? 'Vista de desarrollo: falta añadir la URL oficial de Spotify en src/config/podcastConfig.ts.'
                : 'Enlace de Spotify próximamente disponible.'}
            </div>
          )}
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          {filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => onSelectMemorial(m)}
              style={{
                textAlign: 'left',
                padding: '1.15rem',
                borderRadius: '16px',
                background: 'rgba(255, 255, 255, 0.72)',
                border: '1px solid var(--border-soft)',
                cursor: 'pointer',
                color: 'var(--text-espresso)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.55rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="font-serif-editorial" style={{ fontSize: '1.45rem', fontWeight: 600 }}>
                  {m.name}
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  {m.privacy === 'privado' && <Lock size={12} />}
                  {m.privacy === 'invitados' && <Users size={12} />}
                  {m.privacy === 'publico' && <Globe size={12} />}
                  {m.privacy}
                </span>
              </div>

              {m.dates && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{m.dates}</div>}
              <p style={{ margin: 0, fontSize: '0.86rem', lineHeight: 1.5, color: 'var(--text-muted)' }}>
                “{m.phrase}”
              </p>

              <div style={{ fontSize: '0.76rem', color: 'var(--accent-sage)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginTop: 'auto' }}>
                <Trees size={13} />
                {PLANT_LABELS[m.chosenPlant].name}
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
};
