import React, { useState } from 'react';
import { Cloud, Download, Globe, HardDrive, Mail, Upload, User, X } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';
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
        className="glass-panel modal-card animate-gentle-in"
        style={{ maxWidth: '480px' }}
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
          No necesitas contraseña. Tu correo identifica tus rincones y libros privados para que solo tú (o tus invitados) puedan verlos. En producción recibirás un enlace seguro en tu correo para entrar desde cualquier dispositivo.
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
