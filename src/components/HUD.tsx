import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookHeart,
  Clock,
  Eye,
  EyeOff,
  HelpCircle,
  Info,
  List,
  Mail,
  Menu,
  Moon,
  Plus,
  Sun,
  Trees,
  Volume2,
  VolumeX,
  Wind,
  X,
} from 'lucide-react';
import { MESSAGES, SupportedLang } from '../i18n/translations';
import { TimeMode } from '../three/SanctuaryScene';
import { Memorial, UserProfile } from '../types/memorial';

interface HUDProps {
  audioEnabled: boolean;
  onToggleAudio: () => void;
  hudHidden: boolean;
  onToggleHud: () => void;
  viewMode: '3d' | 'list';
  onToggleViewMode: () => void;
  timeMode: TimeMode;
  onChangeTimeMode: (mode: TimeMode) => void;
  hoveredMemorial: Memorial | null;
  hoveredBook: Memorial | null;
  hoveredRainbow?: boolean;
  searchableMemorials: Memorial[];
  userProfile: UserProfile;
  memorialsCount: number;
  countriesCount: number;
  currentSanctuary: number;
  totalSanctuaries: number;
  onChangeSanctuary: (index: number) => void;
  lang: SupportedLang;
  onChangeLang: (lang: SupportedLang) => void;
  onSelectSearchResult: (memorial: Memorial) => void;
  onOpenAdd: () => void;
  onOpenBook: () => void;
  onOpenServices: () => void;
  onOpenGuide: () => void;
  onOpenEmailAccess: () => void;
  onResetView: () => void;
  onNavigateKey: (key: 'arrowup' | 'arrowdown' | 'arrowleft' | 'arrowright', active: boolean) => void;
  onOpenBreathing: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  audioEnabled,
  onToggleAudio,
  hudHidden,
  onToggleHud,
  viewMode,
  onToggleViewMode,
  timeMode,
  onChangeTimeMode,
  hoveredMemorial,
  hoveredBook,
  hoveredRainbow,
  searchableMemorials,
  userProfile,
  memorialsCount,
  countriesCount,
  currentSanctuary,
  totalSanctuaries,
  onChangeSanctuary,
  lang,
  onChangeLang,
  onSelectSearchResult,
  onOpenAdd,
  onOpenBook,
  onOpenServices,
  onOpenGuide,
  onOpenEmailAccess,
  onResetView,
  onNavigateKey,
  onOpenBreathing,
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const t = MESSAGES[lang];

  const matchingMemorials = searchQuery.trim()
    ? searchableMemorials.filter((m) =>
        m.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : [];

  if (hudHidden) {
    return (
      <button
        className="btn-secondary"
        onClick={onToggleHud}
        style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 25 }}
        aria-label="Mostrar controles"
      >
        <Eye size={16} />
        Mostrar controles
      </button>
    );
  }

  return (
    <>
      <header
        style={{
          position: 'fixed',
          top: '0.85rem',
          left: '0.85rem',
          right: '0.85rem',
          zIndex: 20,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.55rem',
          pointerEvents: 'none',
        }}
      >
        {/* Left navigation */}
        <nav
          aria-label="Navegación principal"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.45rem',
            pointerEvents: 'auto',
          }}
        >
          <button
            className="glass-pill"
            onClick={onResetView}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.48rem 0.95rem',
              borderRadius: '999px',
              cursor: 'pointer',
              color: 'var(--text-espresso)',
            }}
          >
            <span className="font-serif-editorial" style={{ fontSize: 'clamp(0.86rem, 2.6vw, 1.05rem)', fontWeight: 600 }}>
              Jardín Huella Viva · Siembra su recuerdo
            </span>
          </button>

          <button
            type="button"
            className="btn-secondary hud-mobile-only"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-expanded={mobileMenuOpen}
            aria-label="Abrir menú del jardín"
          >
            {mobileMenuOpen ? <X size={15} /> : <Menu size={15} />}
            Menú
          </button>

          <div
            className={`hud-collapsible ${mobileMenuOpen ? 'is-open' : ''}`}
            style={{
              display: undefined,
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >

          {/* Real participation count */}
          <div
            className="glass-pill hud-hide-mobile"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.42rem 0.85rem',
              borderRadius: '999px',
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
            }}
            title="Homenajes participantes en el jardín"
          >
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#64caca' }} />
            <span>
              <strong style={{ color: 'var(--text-espresso)' }}>{memorialsCount}</strong>{' '}
              {memorialsCount === 1 ? 'homenaje' : 'homenajes'}
              {countriesCount > 0 ? ` · ${countriesCount} ${countriesCount === 1 ? 'país' : 'países'}` : ''}
            </span>
          </div>

          {/* Sanctuary selector (30 altars per sanctuary) */}
          <select
            aria-label="Seleccionar santuario"
            value={currentSanctuary}
            onChange={(e) => onChangeSanctuary(Number(e.target.value))}
            className="glass-pill"
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '999px',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: 'var(--text-espresso)',
              cursor: 'pointer',
            }}
            title="Cada santuario tiene capacidad para 30 altares; al superarse se abre uno nuevo"
          >
            {Array.from({ length: totalSanctuaries }).map((_, i) => (
              <option key={i} value={i}>
                Santuario {i + 1} (hasta 30 altares)
              </option>
            ))}
          </select>

          <button
            className="btn-secondary"
            onClick={onToggleViewMode}
            aria-pressed={viewMode === 'list'}
          >
            {viewMode === '3d' ? <List size={15} /> : <Trees size={15} />}
            {viewMode === '3d' ? 'Vista en lista' : 'Ver jardín 3D'}
          </button>

          <button className="btn-secondary" onClick={onOpenBook}>
            <BookHeart size={15} />
            Nuestro libro
          </button>

          <button className="btn-secondary" onClick={onOpenBreathing}>
            <Wind size={15} />
            Respiremos juntos
          </button>

          <button className="btn-secondary" onClick={onOpenServices}>
            <Info size={15} />
            Acompañamiento
          </button>

          <button className="btn-secondary" onClick={onOpenGuide}>
            <HelpCircle size={15} />
            {t.howItWorks}
          </button>

          {/* Buscador con corazón blanco y huella en su interior */}
          <div style={{ position: 'relative' }}>
            <div
              className="glass-pill"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.32rem 0.75rem',
                borderRadius: '999px',
                borderColor: searchOpen ? '#64caca' : undefined,
              }}
            >
              {/* White heart with pawprint inside */}
              <svg width="22" height="20" viewBox="0 0 24 22" fill="none" aria-hidden="true">
                <path
                  d="M12 20.2C12 20.2 3 14.3 3 7.9C3 4.9 5.3 2.6 8.2 2.6C10 2.6 11.4 3.5 12 4.7C12.6 3.5 14 2.6 15.8 2.6C18.7 2.6 21 4.9 21 7.9C21 14.3 12 20.2 12 20.2Z"
                  fill="#ffffff"
                  stroke="#06ada2"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                {/* Paw toes */}
                <circle cx="9.2" cy="8.4" r="0.95" fill="#06ada2" />
                <circle cx="11.1" cy="7.2" r="0.95" fill="#06ada2" />
                <circle cx="13.1" cy="7.2" r="0.95" fill="#06ada2" />
                <circle cx="14.9" cy="8.4" r="0.95" fill="#06ada2" />
                {/* Paw main pad */}
                <path
                  d="M12 10C10.5 10 9.4 11.1 9.6 12.4C9.8 13.4 10.9 13.9 12 13.9C13.1 13.9 14.2 13.4 14.4 12.4C14.6 11.1 13.5 10 12 10Z"
                  fill="#06ada2"
                />
              </svg>

              {searchOpen ? (
                <input
                  type="search"
                  aria-label="Buscar animal por nombre"
                  placeholder="Buscar por nombre..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: '0.82rem',
                    width: '140px',
                    color: 'var(--text-espresso)',
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: 500,
                    color: 'var(--text-espresso)',
                    padding: 0,
                  }}
                >
                  Buscar
                </button>
              )}
            </div>

            {searchOpen && (searchQuery.trim().length > 0 || matchingMemorials.length > 0) && (
              <div
                className="glass-panel"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 0.4rem)',
                  left: 0,
                  width: '240px',
                  borderRadius: '14px',
                  padding: '0.45rem',
                  zIndex: 35,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                }}
              >
                {matchingMemorials.length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0.35rem 0.5rem' }}>
                    No encontramos un altar con ese nombre.
                  </div>
                ) : (
                  matchingMemorials.slice(0, 6).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="btn-secondary"
                      style={{ justifyContent: 'flex-start', borderRadius: '10px', fontSize: '0.8rem', padding: '0.4rem 0.65rem' }}
                      onClick={() => {
                        setSearchOpen(false);
                        setSearchQuery('');
                        onSelectSearchResult(m);
                      }}
                    >
                      {m.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          </div>
        </nav>

        {/* Right actions */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.45rem',
            pointerEvents: 'auto',
          }}
        >
          <button className="btn-secondary" onClick={onOpenEmailAccess} title="Identificarte con tu correo para rincones privados">
            <Mail size={14} color="#586f54" />
            {userProfile.grievingName || userProfile.email || 'Entrar con correo'}
          </button>

          <select
            aria-label="Idioma"
            value={lang}
            onChange={(e) => onChangeLang(e.target.value as SupportedLang)}
            className="glass-pill"
            style={{
              padding: '0.38rem 0.65rem',
              borderRadius: '999px',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: 'var(--text-espresso)',
              cursor: 'pointer',
            }}
          >
            <option value="es">ES</option>
            <option value="en">EN</option>
            <option value="de">DE</option>
            <option value="pt">PT</option>
            <option value="fr">FR</option>
          </select>

          <button className="btn-primary" onClick={onOpenAdd}>
            <Plus size={16} />
            {t.createMemorial}
          </button>

          {/* Day / Night / Auto toggle */}
          <div
            className="glass-pill"
            role="group"
            aria-label="Luz del jardín"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: '999px',
              padding: '0.2rem',
              gap: '0.15rem',
            }}
          >
            <button
              onClick={() => onChangeTimeMode('auto')}
              title="Según tu hora local"
              aria-label="Luz automática según hora local"
              style={{
                border: 'none',
                borderRadius: '999px',
                padding: '0.32rem 0.55rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                background: timeMode === 'auto' ? 'var(--accent-sage)' : 'transparent',
                color: timeMode === 'auto' ? '#fff' : 'var(--text-espresso)',
              }}
            >
              <Clock size={13} />
              Auto
            </button>
            <button
              onClick={() => onChangeTimeMode('day')}
              title="Vista de día"
              aria-label="Vista de día"
              style={{
                border: 'none',
                borderRadius: '999px',
                padding: '0.32rem 0.5rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                background: timeMode === 'day' ? 'var(--accent-terracotta)' : 'transparent',
                color: timeMode === 'day' ? '#fff' : 'var(--text-espresso)',
              }}
            >
              <Sun size={13} />
            </button>
            <button
              onClick={() => onChangeTimeMode('night')}
              title="Vista de noche"
              aria-label="Vista de noche"
              style={{
                border: 'none',
                borderRadius: '999px',
                padding: '0.32rem 0.5rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                background: timeMode === 'night' ? '#2c3d55' : 'transparent',
                color: timeMode === 'night' ? '#fff' : 'var(--text-espresso)',
              }}
            >
              <Moon size={13} />
            </button>
          </div>

          <button
            className="btn-icon"
            onClick={onToggleAudio}
            aria-label={audioEnabled ? 'Silenciar sonido ambiente' : 'Activar sonido ambiente opcional'}
            title={audioEnabled ? 'Silenciar sonido ambiente' : 'Activar sonido ambiente opcional'}
          >
            {audioEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>

          {viewMode === '3d' && (
            <button
              className="btn-icon"
              onClick={onToggleHud}
              aria-label="Ocultar controles para contemplar el jardín"
              title="Ocultar controles"
            >
              <EyeOff size={17} />
            </button>
          )}
        </div>
      </header>

      {viewMode === '3d' && (hoveredMemorial || hoveredBook || hoveredRainbow) && (
        <div
          className="glass-pill animate-gentle-in"
          style={{
            position: 'fixed',
            bottom: '4rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            padding: '0.5rem 1.15rem',
            borderRadius: '999px',
            fontSize: '0.86rem',
            pointerEvents: 'none',
            borderColor: hoveredBook || hoveredRainbow ? '#64caca' : undefined,
          }}
        >
          {hoveredRainbow ? (
            <>
              🌈 <strong>La leyenda del puente del arcoíris</strong> · Clic para escuchar en Spotify ↗
            </>
          ) : hoveredBook ? (
            <>
              Abrir <strong>Nuestro libro</strong> de <strong>{hoveredBook.name}</strong>
            </>
          ) : (
            <>
              Visitar rincón de <strong>{hoveredMemorial?.name}</strong>
            </>
          )}
        </div>
      )}

      {viewMode === '3d' && (
        <>
          <div
            aria-label="Controles de navegación"
            style={{
              position: 'fixed',
              bottom: '3.25rem',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 18,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 42px)',
              gridTemplateRows: 'repeat(2, 42px)',
              gap: '0.35rem',
              pointerEvents: 'auto',
              userSelect: 'none',
              touchAction: 'none',
            }}
          >
            <div />
            <button
              type="button"
              aria-label="Avanzar"
              onPointerDown={() => onNavigateKey('arrowup', true)}
              onPointerUp={() => onNavigateKey('arrowup', false)}
              onPointerLeave={() => onNavigateKey('arrowup', false)}
              onPointerCancel={() => onNavigateKey('arrowup', false)}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                border: '1.5px solid #64caca',
                background: 'rgba(255, 255, 255, 0.84)',
                color: '#64caca',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
              }}
            >
              <ArrowUp size={20} strokeWidth={2.5} />
            </button>
            <div />
            <button
              type="button"
              aria-label="Mover a la izquierda"
              onPointerDown={() => onNavigateKey('arrowleft', true)}
              onPointerUp={() => onNavigateKey('arrowleft', false)}
              onPointerLeave={() => onNavigateKey('arrowleft', false)}
              onPointerCancel={() => onNavigateKey('arrowleft', false)}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                border: '1.5px solid #64caca',
                background: 'rgba(255, 255, 255, 0.84)',
                color: '#64caca',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
              }}
            >
              <ArrowLeft size={20} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              aria-label="Retroceder"
              onPointerDown={() => onNavigateKey('arrowdown', true)}
              onPointerUp={() => onNavigateKey('arrowdown', false)}
              onPointerLeave={() => onNavigateKey('arrowdown', false)}
              onPointerCancel={() => onNavigateKey('arrowdown', false)}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                border: '1.5px solid #64caca',
                background: 'rgba(255, 255, 255, 0.84)',
                color: '#64caca',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
              }}
            >
              <ArrowDown size={20} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              aria-label="Mover a la derecha"
              onPointerDown={() => onNavigateKey('arrowright', true)}
              onPointerUp={() => onNavigateKey('arrowright', false)}
              onPointerLeave={() => onNavigateKey('arrowright', false)}
              onPointerCancel={() => onNavigateKey('arrowright', false)}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                border: '1.5px solid #64caca',
                background: 'rgba(255, 255, 255, 0.84)',
                color: '#64caca',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
              }}
            >
              <ArrowRight size={20} strokeWidth={2.5} />
            </button>
          </div>

          <div
            className="glass-pill hud-hide-mobile"
            style={{
              position: 'fixed',
              bottom: '0.9rem',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 15,
              padding: '0.42rem 0.95rem',
              borderRadius: '999px',
              fontSize: '0.77rem',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
              maxWidth: '92vw',
              textAlign: 'center',
            }}
          >
            {t.walkingHint}
          </div>
        </>
      )}

      <a
        href="https://dueloanimal.co"
        target="_blank"
        rel="noopener noreferrer"
        className="glass-pill"
        title="Ir a dueloanimal.co"
        style={{
          position: 'fixed',
          bottom: '0.9rem',
          right: '1.15rem',
          zIndex: 16,
          padding: '0.42rem 0.9rem',
          borderRadius: '999px',
          fontSize: '0.78rem',
          fontWeight: 600,
          color: '#06ada2',
          textDecoration: 'none',
          borderColor: 'rgba(6, 173, 162, 0.35)',
        }}
      >
        dueloanimal.co ↗
      </a>
    </>
  );
};
