import React, { useEffect, useState } from 'react';
import {
  Cloud,
  Copy,
  Download,
  Globe,
  HardDrive,
  KeyRound,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import {
  ensureAnonymousSession,
  fetchUsageStats,
  getAuthenticatedUser,
  getRecoveryKeyHint,
  isSupabaseConfigured,
  recoverAccountWithKey,
  registerOrRotateRecoveryKey,
  revokeRecoveryKey,
  UsageStats,
} from '../lib/supabase';
import { UserProfile } from '../types/memorial';
import { isTurnstileEnabled, TurnstileWidget } from './TurnstileWidget';

interface EmailAccessModalProps {
  profile: UserProfile;
  onSaveProfile: (profile: UserProfile) => void;
  onExportBackup: () => void;
  onImportBackup: (jsonText: string) => { importedMemorials: number; importedBooks: number } | null;
  onClose: () => void;
}

export const EmailAccessModal: React.FC<EmailAccessModalProps> = ({
  profile,
  onSaveProfile,
  onExportBackup,
  onImportBackup,
  onClose,
}) => {
  const [email, setEmail] = useState(profile.email);
  const [grievingName, setGrievingName] = useState(profile.grievingName);
  const [country, setCountry] = useState(profile.country);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [anonUid, setAnonUid] = useState<string | null>(null);
  const [keyHint, setKeyHint] = useState<string | null>(null);
  const [keyRevoked, setKeyRevoked] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [recoveryInput, setRecoveryInput] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [recoveryStatus, setRecoveryStatus] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void (async () => {
      const user = await getAuthenticatedUser();
      setAnonUid(user?.id ?? null);
      if (user) {
        const [hint, stats] = await Promise.all([getRecoveryKeyHint(), fetchUsageStats()]);
        if (hint) {
          setKeyHint(hint.keyHint);
          setKeyRevoked(Boolean(hint.revokedAt));
        }
        setUsage(stats);
      }
    })();
  }, []);

  const handleGenerateOrRotateKey = async () => {
    setRecoveryStatus('Generando clave privada de recuperación...');
    const res = await registerOrRotateRecoveryKey();
    if (res.ok && res.recoveryKey) {
      setGeneratedKey(res.recoveryKey);
      setKeyHint(res.keyHint ?? null);
      setKeyRevoked(false);
      const user = await getAuthenticatedUser();
      setAnonUid(user?.id ?? null);
      setRecoveryStatus(
        'Guarda esta clave en un lugar seguro. Por tu privacidad, no podemos volver a mostrarla ni recuperarla por correo.'
      );
    } else {
      setRecoveryStatus(res.error || 'No se pudo generar la clave.');
    }
  };

  const handleRevokeKey = async () => {
    setRecoveryStatus('Revocando clave actual...');
    const res = await revokeRecoveryKey();
    if (res.ok) {
      setGeneratedKey(null);
      setKeyRevoked(true);
      setRecoveryStatus('Clave revocada. Nadie podrá usarla para recuperar esta sesión.');
    } else {
      setRecoveryStatus(res.error || 'No se pudo revocar.');
    }
  };

  const handleRecover = async () => {
    if (!recoveryInput.trim()) return;
    if (isTurnstileEnabled && !turnstileToken) {
      setRecoveryStatus('Completa la verificación Turnstile antes de recuperar.');
      return;
    }
    setRecoveryStatus('Verificando clave de recuperación...');
    const res = await recoverAccountWithKey(recoveryInput.trim(), turnstileToken);
    if (res.ok) {
      setRecoveryInput('');
      setRecoveryStatus('Memoriales y libros recuperados en este dispositivo. Recargando...');
      setTimeout(() => window.location.reload(), 900);
    } else {
      setRecoveryStatus(res.error || 'Clave inválida o bloqueada.');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = onImportBackup(text);
      if (res) {
        setBackupNotice(`Se restauraron ${res.importedMemorials} homenajes y ${res.importedBooks} libros.`);
      } else {
        setBackupNotice('El archivo no tiene el formato de respaldo esperado.');
      }
    } catch {
      setBackupNotice('No se pudo leer el archivo seleccionado.');
    }
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSupabaseConfigured) {
      await ensureAnonymousSession();
    }
    onSaveProfile({
      email: email.trim().toLowerCase(),
      grievingName: grievingName.trim(),
      country: country.trim(),
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-access-title"
        className="glass-panel modal-card custom-scroll animate-gentle-in"
        style={{ maxWidth: '500px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <h2 id="email-access-title" className="font-serif-editorial" style={{ fontSize: '1.6rem', fontWeight: 500, margin: 0 }}>
            Identidad y recuperación
          </h2>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <p style={{ margin: '0 0 0.9rem', fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Tu sesión es anónima y privada sin contraseñas ni códigos por correo. El correo es solo un dato de perfil; la propiedad real se protege con tu <strong>clave privada de recuperación</strong>.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          <div style={{ position: 'relative' }}>
            <User size={15} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input-field"
              style={{ paddingLeft: '2.35rem' }}
              placeholder="Nombre del doliente (tu nombre)"
              value={grievingName}
              onChange={(e) => setGrievingName(e.target.value)}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <Globe size={15} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input-field"
              style={{ paddingLeft: '2.35rem' }}
              placeholder="País (ej. Colombia)"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>

          <input
            type="email"
            className="input-field"
            placeholder="Correo de perfil (opcional, no verificado)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn-primary">
              Guardar perfil
            </button>
          </div>
        </form>

        {isSupabaseConfigured && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.9rem',
              borderRadius: '12px',
              background: 'rgba(6, 173, 162, 0.07)',
              border: '1px solid rgba(6, 173, 162, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 600, color: '#06ada2' }}>
                <ShieldCheck size={15} />
                {anonUid ? 'Sesión anónima activa' : 'Sesión pendiente'}
              </span>
              {keyHint && (
                <span style={{ fontSize: '0.74rem', color: keyRevoked ? '#b43c3c' : 'var(--text-muted)' }}>
                  {keyRevoked ? `Revocada (${keyHint})` : `Clave activa: ${keyHint}`}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
              <button type="button" className="btn-secondary" onClick={handleGenerateOrRotateKey} style={{ fontSize: '0.78rem' }}>
                {keyHint && !keyRevoked ? <RefreshCw size={13} /> : <KeyRound size={13} />}
                {keyHint && !keyRevoked ? 'Rotar clave de recuperación' : 'Generar clave de recuperación'}
              </button>
              {keyHint && !keyRevoked && (
                <button type="button" className="btn-secondary" onClick={handleRevokeKey} style={{ fontSize: '0.78rem', color: '#b43c3c' }}>
                  <Trash2 size={13} />
                  Revocar
                </button>
              )}
            </div>

            {generatedKey && (
              <div
                style={{
                  padding: '0.65rem',
                  borderRadius: '10px',
                  background: '#ffffff',
                  border: '1px solid rgba(6, 173, 162, 0.45)',
                  fontSize: '0.78rem',
                }}
              >
                <div style={{ fontWeight: 700, color: '#0d827b', marginBottom: '0.25rem' }}>
                  ¡Guarda esta clave ahora! Solo se muestra una vez:
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                  <span>{generatedKey}</span>
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label="Copiar clave"
                    onClick={() => void navigator.clipboard?.writeText(generatedKey)}
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            )}

            <div style={{ borderTop: '1px solid rgba(6,173,162,0.18)', paddingTop: '0.55rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>¿Cambias de dispositivo? Recupera tus memoriales:</div>
              <div style={{ display: 'flex', gap: '0.45rem' }}>
                <input
                  className="input-field"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.7rem', fontFamily: 'monospace' }}
                  placeholder="JHV-XXXXXXXX-..."
                  value={recoveryInput}
                  onChange={(e) => setRecoveryInput(e.target.value)}
                />
                <button type="button" className="btn-primary" onClick={handleRecover} style={{ fontSize: '0.78rem', flexShrink: 0 }}>
                  Recuperar
                </button>
              </div>
              <TurnstileWidget onToken={setTurnstileToken} />
            </div>

            {recoveryStatus && (
              <div style={{ fontSize: '0.76rem', color: 'var(--text-espresso)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <ShieldAlert size={13} color="#06ada2" />
                <span>{recoveryStatus}</span>
              </div>
            )}

            {usage && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(6,173,162,0.18)', paddingTop: '0.45rem' }}>
                <div>
                  Cuota DB: {(usage.dbBytes / (1024 * 1024)).toFixed(1)} MB ({usage.dbPercent.toFixed(1)}%) ·
                  Storage: {(usage.storageBytes / (1024 * 1024)).toFixed(1)} MB ({usage.storagePercent.toFixed(1)}%)
                </div>
                {usage.alertLevel !== 'ok' && (
                  <div style={{ color: usage.alertLevel === 'critical_85' ? '#b43c3c' : '#a86b15', fontWeight: 600 }}>
                    Alerta operativa: consumo superior al {usage.alertLevel === 'critical_85' ? '85%' : '70%'} de la cuota gratuita.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div
          style={{
            marginTop: '1rem',
            paddingTop: '0.85rem',
            borderTop: '1px solid var(--border-soft)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.55rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.79rem', color: 'var(--text-muted)' }}>
            {isSupabaseConfigured ? (
              <>
                <Cloud size={14} color="#06ada2" />
                <span>
                  <strong style={{ color: '#06ada2' }}>Nube conectada:</strong> sincronización activa mediante clave privada.
                </span>
              </>
            ) : (
              <>
                <HardDrive size={14} color="#707070" />
                <span>
                  <strong>Modo local:</strong> guardado en este navegador.
                </span>
              </>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
            <button type="button" className="btn-secondary" onClick={onExportBackup} style={{ fontSize: '0.77rem' }}>
              <Download size={13} />
              Exportar respaldo (.json)
            </button>
            <label className="btn-secondary" style={{ fontSize: '0.77rem', cursor: 'pointer' }}>
              <Upload size={13} />
              Restaurar respaldo
              <input type="file" accept="application/json,.json" onChange={handleImportFile} style={{ display: 'none' }} />
            </label>
          </div>

          {backupNotice && (
            <div style={{ fontSize: '0.78rem', color: '#06ada2', fontWeight: 600 }}>{backupNotice}</div>
          )}

          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.45, marginTop: '0.25rem' }}>
            <strong>Privacidad y Beta Pública:</strong> tus cartas privadas y fotos de memoriales privados permanecen protegidas por tu sesión. Reportes de moderación o soporte: <a href="https://dueloanimal.co" target="_blank" rel="noopener noreferrer" style={{ color: '#06ada2' }}>dueloanimal.co</a>.
          </div>
        </div>
      </div>
    </div>
  );
};
