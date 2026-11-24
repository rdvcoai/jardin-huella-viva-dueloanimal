import React, { useState } from 'react';
import { Globe, Mail, User, X } from 'lucide-react';
import { UserProfile } from '../types/memorial';

interface EmailAccessModalProps {
  profile: UserProfile;
  onSaveProfile: (profile: UserProfile) => void;
  onClose: () => void;
}

export const EmailAccessModal: React.FC<EmailAccessModalProps> = ({
  profile,
  onSaveProfile,
  onClose,
}) => {
  const [email, setEmail] = useState(profile.email);
  const [grievingName, setGrievingName] = useState(profile.grievingName);
  const [country, setCountry] = useState(profile.country);

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
      </div>
    </div>
  );
};
