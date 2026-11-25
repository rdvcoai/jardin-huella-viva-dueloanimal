import React, { useEffect, useState } from 'react';
import { Cloud, Download, Globe, HardDrive, KeyRound, LogOut, Mail, ShieldCheck, Upload, User, X } from 'lucide-react';
import {
  fetchUsageStats,
  getAuthenticatedUser,
  isSupabaseConfigured,
  signInWithEmailOtp,
  signOutCloud,
  UsageStats,
  verifyEmailOtp,
} from '../lib/supabase';
import { UserProfile } from '../types/memorial';

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
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void (async () => {
      const user = await getAuthenticatedUser();
      setAuthEmail(user?.email ?? null);
      if (user) {
        const stats = await fetchUsageStats();
        setUsage(stats);
      }
    })();
  }, []);

  const handleSendOtp = async () => {
    const clean = email.trim().toLowerCase();
    if (!clean) {
      setAuthStatus('Escribe tu correo electrónico primero.');
      return;
    }
    setAuthStatus('Enviando código de acceso...');
    const res = await signInWithEmailOtp(clean);
    if (res.ok) {
      setOtpSent(true);
      setAuthStatus('Código enviado a tu correo. Revisa tu bandeja de entrada o spam.');
    } else {
      setAuthStatus(res.error || 'No se pudo enviar el código.');
    }
  };

  const handleVerifyOtp = async () => {
    const clean = email.trim().toLowerCase();
    if (!clean || !otpCode.trim()) return;
    setAuthStatus('Verificando código...');
    const res = await verifyEmailOtp(clean, otpCode.trim());
    if (res.ok) {
      const user = await getAuthenticatedUser();
      setAuthEmail(user?.email ?? clean);
      setOtpSent(false);
      setOtpCode('');
      setAuthStatus('Sesión verificada en la nube.');
      onSaveProfile({
        email: clean,
        grievingName: grievingName.trim(),
        country: country.trim(),
      });
      const stats = await fetchUsageStats();
      setUsage(stats);
    } else {
      setAuthStatus(res.error || 'Código inválido o expirado.');
    }
  };

  const handleCloudSignOut = async () => {
    await signOutCloud();
    setAuthEmail(null);
    setUsage(null);
    setAuthStatus('Sesión cerrada.');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = onImportBackup(text);
      if (res) {
        setBackupNotice(
          `Se restauraron ${res.importedMemorials} homenajes y ${res.importedBooks} libros.`
        );
      } else {
        setBackupNotice('El archivo no tiene el formato de respaldo esperado.');
      }
    } catch {
      setBackupNotice('No se pudo leer el archivo seleccionado.');
    }
    e.target.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
        style={{ maxWidth: '490px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <h2 id="email-access-title" className="font-serif-editorial" style={{ fontSize: '1.7rem', fontWeight: 500, margin: 0 }}>
            Tus datos de acceso
          </h2>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
          No necesitas contraseña. Tu correo identifica tus rincones y libros privados para que solo tú (o tus invitados) puedan verlos desde cualquier dispositivo.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
            <Mail size={15} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="email"
              className="input-field"
              style={{ paddingLeft: '2.35rem' }}
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
            {profile.email && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  onSaveProfile({ email: '', grievingName: '', country: '' });
                  onClose();
                }}
              >
                Salir de este correo
              </button>
            )}
            <button type="submit" className="btn-primary">
              Guardar datos
            </button>
          </div>
        </form>

        {isSupabaseConfigured && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.85rem',
              borderRadius: '12px',
              background: 'rgba(6, 173, 162, 0.07)',
              border: '1px solid rgba(6, 173, 162, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.55rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 600, color: '#06ada2' }}>
                <ShieldCheck size={15} />
                {authEmail ? `Sesión verificada: ${authEmail}` : 'Verificación en la nube (OTP)'}
              </span>
              {authEmail && (
                <button type="button" className="btn-secondary" onClick={handleCloudSignOut} style={{ fontSize: '0.72rem', padding: '0.28rem 0.55rem' }}>
                  <LogOut size={12} />
                  Cerrar sesión
                </button>
              )}
            </div>

            {!authEmail && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <div style={{ display: 'flex', gap: '0.45rem' }}>
                  <button type="button" className="btn-secondary" onClick={handleSendOtp} style={{ fontSize: '0.78rem' }}>
                    <KeyRound size={13} />
                    Enviar código al correo
                  </button>
                </div>
                {otpSent && (
                  <div style={{ display: 'flex', gap: '0.45rem' }}>
                    <input
                      className="input-field"
                      style={{ fontSize: '0.82rem', padding: '0.45rem 0.7rem' }}
                      placeholder="Código de 6 dígitos"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                    />
                    <button type="button" className="btn-primary" onClick={handleVerifyOtp} style={{ fontSize: '0.78rem', flexShrink: 0 }}>
                      Verificar
                    </button>
                  </div>
                )}
              </div>
            )}

            {authStatus && (
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{authStatus}</div>
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
            marginTop: '1.1rem',
            paddingTop: '0.95rem',
            borderTop: '1px solid var(--border-soft)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {isSupabaseConfigured ? (
              <>
                <Cloud size={14} color="#06ada2" />
                <span>
                  <strong style={{ color: '#06ada2' }}>Nube conectada:</strong> tus altares se sincronizan entre dispositivos.
                </span>
              </>
            ) : (
              <>
                <HardDrive size={14} color="#707070" />
                <span>
                  <strong>Modo local:</strong> guardado en este navegador. Puedes exportar o restaurar un respaldo.
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
        </div>
      </div>
    </div>
  );
};
