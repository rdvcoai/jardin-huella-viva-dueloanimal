import React, { useState } from 'react';
import { ImagePlus, Lock, Users, Globe, X } from 'lucide-react';
import { PLANT_LABELS } from '../data/initialData';
import { Memorial, PlantType, PrivacyLevel, Species, UserProfile } from '../types/memorial';

interface AddMemorialModalProps {
  ownerId: string;
  userProfile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
  onClose: () => void;
  onCreate: (
    data: Omit<
      Memorial,
      | 'id'
      | 'position'
      | 'rotationY'
      | 'objectMemories'
      | 'lifeMoments'
      | 'privateLetters'
      | 'valueReflections'
      | 'familyContributions'
      | 'createdAt'
    >,
    openBookAfter?: boolean
  ) => void;
}

const MAX_FILE_BYTES = 3 * 1024 * 1024; // 3 MB

export const AddMemorialModal: React.FC<AddMemorialModalProps> = ({
  ownerId,
  userProfile,
  onUpdateProfile,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<Species>('perro');
  const [phrase, setPhrase] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [deathDate, setDeathDate] = useState('');
  const [invitedEmailsInput, setInvitedEmailsInput] = useState('');
  const [startBookToo, setStartBookToo] = useState(false);
  const [grievingName, setGrievingName] = useState(userProfile.grievingName);
  const [email, setEmail] = useState(userProfile.email);
  const [country, setCountry] = useState(userProfile.country);
  const [chosenPlant, setChosenPlant] = useState<PlantType>('olivo');
  const [privacy, setPrivacy] = useState<PrivacyLevel>('privado');
  const [inviteCode, setInviteCode] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [fileError, setFileError] = useState<string | null>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setFileError('Por favor selecciona una imagen JPG, PNG o WebP.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError('La imagen debe pesar máximo 3 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = grievingName.trim();
    const cleanCountry = country.trim();
    onUpdateProfile({
      email: cleanEmail,
      grievingName: cleanName,
      country: cleanCountry,
    });

    const formattedDates =
      birthDate || deathDate
        ? [birthDate || '?', deathDate || ''].filter(Boolean).join(' – ')
        : undefined;
    const invitedEmails = invitedEmailsInput
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    onCreate({
      ownerId: cleanEmail ? `email:${cleanEmail}` : ownerId,
      grievingName: cleanName || undefined,
      country: cleanCountry || undefined,
      name: name.trim(),
      species,
      phrase: phrase.trim() || 'Tu historia y tu lugar permanecen con nosotros.',
      dates: formattedDates,
      birthDate: birthDate || undefined,
      deathDate: deathDate || undefined,
      invitedEmails: invitedEmails.length > 0 ? invitedEmails : undefined,
      photoUrl,
      chosenPlant,
      privacy,
      inviteCode: privacy === 'invitados' ? inviteCode.trim() || 'FAMILIA' : undefined,
      accentTone: '#7d8f72',
    }, startBookToo);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-memorial-title"
        className="glass-panel modal-card custom-scroll animate-gentle-in"
        style={{ maxWidth: '580px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <h2 id="add-memorial-title" className="font-serif-editorial" style={{ fontSize: '1.9rem', fontWeight: 500, margin: 0 }}>
              Crear un rincón conmemorativo
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              No necesitas encontrar las palabras perfectas; puedes editar todo cuando quieras.
            </p>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '0.85rem 1rem',
              borderRadius: '14px',
              border: '1px dashed rgba(110, 88, 68, 0.35)',
              background: 'rgba(255, 255, 255, 0.55)',
              cursor: 'pointer',
            }}
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="Vista previa"
                style={{ width: '60px', height: '68px', objectFit: 'cover', borderRadius: '10px' }}
              />
            ) : (
              <div
                style={{
                  width: '60px',
                  height: '68px',
                  borderRadius: '10px',
                  background: 'rgba(92, 114, 88, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-sage)',
                }}
              >
                <ImagePlus size={22} />
              </div>
            )}
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                {photoUrl ? 'Cambiar fotografía principal' : 'Fotografía principal (opcional)'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                JPG, PNG o WebP (máx. 3 MB).
              </div>
            </div>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} style={{ display: 'none' }} />
          </label>
          {fileError && <div style={{ fontSize: '0.8rem', color: '#9c3a2b' }}>{fileError}</div>}

          <div className="responsive-grid-2">
            <div>
              <label htmlFor="pet-name" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.35rem' }}>
                Nombre *
              </label>
              <input
                id="pet-name"
                className="input-field"
                required
                placeholder="Su nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="pet-species" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.35rem' }}>
                Compañero
              </label>
              <select
                id="pet-species"
                className="input-field"
                value={species}
                onChange={(e) => setSpecies(e.target.value as Species)}
              >
                <option value="perro">Perro</option>
                <option value="gato">Gato</option>
                <option value="raton">Ratón</option>
                <option value="ave">Ave</option>
                <option value="otro">Otra especie</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="pet-phrase" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.35rem' }}>
              Unas palabras para mi peludito
            </label>
            <textarea
              id="pet-phrase"
              className="input-field"
              rows={2}
              placeholder="Escribe unas palabras o una frase especial en su honor..."
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
            />
          </div>

          <div className="responsive-grid-3">
            <div>
              <label htmlFor="pet-birth" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, marginBottom: '0.3rem' }}>
                Nacimiento (opcional)
              </label>
              <input
                id="pet-birth"
                className="input-field"
                placeholder="Ej. 2014"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="pet-death" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, marginBottom: '0.3rem' }}>
                Fallecimiento (opcional)
              </label>
              <input
                id="pet-death"
                className="input-field"
                placeholder="Ej. 2026"
                value={deathDate}
                onChange={(e) => setDeathDate(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="pet-plant" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, marginBottom: '0.3rem' }}>
                Planta del altar
              </label>
              <select
                id="pet-plant"
                className="input-field"
                value={chosenPlant}
                onChange={(e) => setChosenPlant(e.target.value as PlantType)}
              >
                {(Object.keys(PLANT_LABELS) as PlantType[]).map((key) => (
                  <option key={key} value={key}>
                    {PLANT_LABELS[key].name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="invite-emails" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, marginBottom: '0.3rem' }}>
              Invitar familiares por correo para que visiten este altar (opcional)
            </label>
            <input
              id="invite-emails"
              className="input-field"
              placeholder="Ej. mama@correo.com, hermano@correo.com"
              value={invitedEmailsInput}
              onChange={(e) => setInvitedEmailsInput(e.target.value)}
            />
          </div>

          <div
            style={{
              padding: '0.75rem 0.9rem',
              borderRadius: '12px',
              background: 'rgba(100, 202, 202, 0.12)',
              border: '1px solid #64caca',
              fontSize: '0.8rem',
              lineHeight: 1.45,
            }}
          >
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', cursor: 'pointer', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={startBookToo}
                onChange={(e) => setStartBookToo(e.target.checked)}
                style={{ marginTop: '2px' }}
              />
              <span>También quiero crear su libro (“Nuestro libro”)</span>
            </label>
            <div style={{ marginTop: '0.25rem', color: 'var(--text-muted)' }}>
              El <strong>primer capítulo con sus imágenes es gratuito</strong> y puedes descargarlo en PDF. El libro completo de varios capítulos o un video conmemorativo con apoyo de IA son servicios opcionales (<em>Consultar</em>).
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
            <div>
              <label htmlFor="owner-grieving-name" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, marginBottom: '0.3rem' }}>
                Tu nombre (doliente)
              </label>
              <input
                id="owner-grieving-name"
                className="input-field"
                placeholder="Tu nombre"
                value={grievingName}
                onChange={(e) => setGrievingName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="owner-email" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, marginBottom: '0.3rem' }}>
                Correo electrónico
              </label>
              <input
                id="owner-email"
                type="email"
                className="input-field"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="owner-country" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, marginBottom: '0.3rem' }}>
                País
              </label>
              <input
                id="owner-country"
                className="input-field"
                placeholder="Ej. Colombia"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </div>
          </div>

          {/* Privacy selector */}
          <div
            style={{
              padding: '0.9rem',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.5)',
              border: '1px solid var(--border-soft)',
            }}
          >
            <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.55rem' }}>
              Privacidad del rincón
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
              {(
                [
                  ['privado', 'Privado (solo tú)', Lock],
                  ['invitados', 'Personas invitadas', Users],
                  ['publico', 'Público en el jardín', Globe],
                ] as const
              ).map(([lvl, label, Icon]) => (
                <button
                  key={lvl}
                  type="button"
                  className={privacy === lvl ? 'btn-primary' : 'btn-secondary'}
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
                  onClick={() => setPrivacy(lvl)}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>

            {privacy === 'invitados' && (
              <div style={{ marginTop: '0.65rem' }}>
                <input
                  className="input-field"
                  placeholder="Clave de invitación para familiares (ej. FAMILIA)"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                />
              </div>
            )}
          </div>

          <button type="submit" className="btn-primary" style={{ padding: '0.8rem' }}>
            Publicar en el jardín
          </button>
        </form>
      </div>
    </div>
  );
};
