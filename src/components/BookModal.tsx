import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileDown,
  Globe,
  ImagePlus,
  LayoutTemplate,
  Link2,
  Lock,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Trees,
  Users,
  X,
} from 'lucide-react';
import {
  BookChapter,
  BookPhoto,
  BookTemplate,
  Memorial,
  MemoryBook,
  PhotoFraming,
  PrivacyLevel,
} from '../types/memorial';
import { processAndStripImage } from '../utils/imageUtils';
import { exportBookTextBackup, exportBookToPdf } from '../utils/pdfExport';

interface BookModalProps {
  book: MemoryBook;
  memorial?: Memorial;
  ownedMemorials: Memorial[];
  isOwner: boolean;
  canAccessMemorial: boolean;
  saveStatus: 'Guardando...' | 'Guardado' | 'No se pudo guardar';
  initialChapterId?: string;
  onClose: () => void;
  onUpdateBook: (updated: MemoryBook) => void;
  onDeleteBook: (bookId: string) => void;
  onViewInGarden?: (memorial: Memorial) => void;
}

const TEMPLATE_INFO: Record<BookTemplate, { name: string; desc: string }> = {
  album: { name: 'Álbum de recuerdos', desc: 'Protagonismo de fotografías' },
  historia: { name: 'Nuestra historia', desc: 'Equilibrio entre texto y fotos' },
  momentos: { name: 'Pequeños momentos', desc: 'Relatos breves y detalles cotidianos' },
};

export const BookModal: React.FC<BookModalProps> = ({
  book,
  memorial,
  ownedMemorials,
  isOwner,
  canAccessMemorial,
  saveStatus,
  initialChapterId,
  onClose,
  onUpdateBook,
  onDeleteBook,
  onViewInGarden,
}) => {
  const hasAnyContent = book.chapters.some((c) =>
    c.pages.some((p) => p.content.trim() || (p.photos && p.photos.length > 0) || p.photoUrl)
  );

  const [showWelcome, setShowWelcome] = useState<boolean>(
    isOwner && !hasAnyContent && !initialChapterId
  );
  const [activeChapterId, setActiveChapterId] = useState<string>(
    initialChapterId || book.chapters[0]?.id || ''
  );
  const [viewTab, setViewTab] = useState<'edit' | 'cover' | 'preview'>(
    isOwner ? 'edit' : 'preview'
  );
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [renamingChapterId, setRenamingChapterId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletedChapterBackup, setDeletedChapterBackup] = useState<{
    chapter: BookChapter;
    index: number;
  } | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [aiNoticeOpen, setAiNoticeOpen] = useState(false);

  // Guest voice form
  const [voiceAuthor, setVoiceAuthor] = useState('');
  const [voiceRelation, setVoiceRelation] = useState('');
  const [voiceText, setVoiceText] = useState('');

  const quickPhotoInputRef = useRef<HTMLInputElement | null>(null);

  const activeChapter = book.chapters.find((c) => c.id === activeChapterId) || book.chapters[0];
  const cover = book.cover || {
    title: book.title,
    animalName: memorial?.name || '',
    authorName: '',
  };

  const updateBook = (patch: Partial<MemoryBook>) => {
    onUpdateBook({ ...book, ...patch, updatedAt: new Date().toISOString() });
  };

  const updateCover = (patch: Partial<MemoryBook['cover']>) => {
    updateBook({ cover: { ...cover, ...patch } });
  };

  const moveChapter = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= book.chapters.length) return;
    const copy = [...book.chapters];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    updateBook({ chapters: copy });
  };

  const addCustomChapter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChapterTitle.trim()) return;
    const ch: BookChapter = {
      id: `cap-${Date.now()}`,
      title: newChapterTitle.trim(),
      prompts: [],
      pages: [{ id: `p-${Date.now()}`, title: 'Primera página', content: '', photos: [] }],
    };
    updateBook({ chapters: [...book.chapters, ch] });
    setActiveChapterId(ch.id);
    setNewChapterTitle('');
  };

  const deleteChapter = (chapterId: string) => {
    const idx = book.chapters.findIndex((c) => c.id === chapterId);
    if (idx === -1) return;
    const removed = book.chapters[idx];
    const remaining = book.chapters.filter((c) => c.id !== chapterId);
    setDeletedChapterBackup({ chapter: removed, index: idx });
    updateBook({ chapters: remaining });
    if (activeChapterId === chapterId && remaining[0]) {
      setActiveChapterId(remaining[0].id);
    }
  };

  const undoDeleteChapter = () => {
    if (!deletedChapterBackup) return;
    const copy = [...book.chapters];
    copy.splice(deletedChapterBackup.index, 0, deletedChapterBackup.chapter);
    updateBook({ chapters: copy });
    setActiveChapterId(deletedChapterBackup.chapter.id);
    setDeletedChapterBackup(null);
  };

  const updatePage = (
    chapterId: string,
    pageId: string,
    patch: Partial<BookChapter['pages'][0]>
  ) => {
    updateBook({
      chapters: book.chapters.map((c) =>
        c.id === chapterId
          ? { ...c, pages: c.pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)) }
          : c
      ),
    });
  };

  const addPage = (chapterId: string, isOpenPage = false) => {
    updateBook({
      chapters: book.chapters.map((c) =>
        c.id === chapterId
          ? {
              ...c,
              pages: [
                ...c.pages,
                {
                  id: `p-${Date.now()}`,
                  title: isOpenPage ? 'Página abierta para futuros recuerdos' : 'Nuevo recuerdo',
                  content: '',
                  photos: [],
                  isOpenPage,
                },
              ],
            }
          : c
      ),
    });
  };

  const movePage = (chapterId: string, index: number, dir: -1 | 1) => {
    const ch = book.chapters.find((c) => c.id === chapterId);
    if (!ch) return;
    const target = index + dir;
    if (target < 0 || target >= ch.pages.length) return;
    const pagesCopy = [...ch.pages];
    [pagesCopy[index], pagesCopy[target]] = [pagesCopy[target], pagesCopy[index]];
    updateBook({
      chapters: book.chapters.map((c) => (c.id === chapterId ? { ...c, pages: pagesCopy } : c)),
    });
  };

  const handleUploadPagePhoto = async (
    chapterId: string,
    pageId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setPhotoError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const processed = await processAndStripImage(file);
      const ch = book.chapters.find((c) => c.id === chapterId);
      const pg = ch?.pages.find((p) => p.id === pageId);
      const currentPhotos = pg?.photos || [];
      const newPhoto: BookPhoto = {
        id: `ph-${Date.now()}`,
        dataUrl: processed.dataUrl,
        caption: '',
        altText: pg?.title || 'Fotografía del recuerdo',
        framing: 'center',
        aspectRatio: processed.aspectRatio,
      };
      updatePage(chapterId, pageId, { photos: [...currentPhotos, newPhoto] });
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'No se pudo cargar la imagen.');
    }
    e.target.value = '';
  };

  const updatePhoto = (
    chapterId: string,
    pageId: string,
    photoId: string,
    patch: Partial<BookPhoto>
  ) => {
    const ch = book.chapters.find((c) => c.id === chapterId);
    const pg = ch?.pages.find((p) => p.id === pageId);
    if (!pg?.photos) return;
    updatePage(chapterId, pageId, {
      photos: pg.photos.map((ph) => (ph.id === photoId ? { ...ph, ...patch } : ph)),
    });
  };

  const movePhoto = (chapterId: string, pageId: string, idx: number, dir: -1 | 1) => {
    const ch = book.chapters.find((c) => c.id === chapterId);
    const pg = ch?.pages.find((p) => p.id === pageId);
    if (!pg?.photos) return;
    const target = idx + dir;
    if (target < 0 || target >= pg.photos.length) return;
    const copy = [...pg.photos];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    updatePage(chapterId, pageId, { photos: copy });
  };

  const removePhoto = (chapterId: string, pageId: string, photoId: string) => {
    const ch = book.chapters.find((c) => c.id === chapterId);
    const pg = ch?.pages.find((p) => p.id === pageId);
    if (!pg?.photos) return;
    updatePage(chapterId, pageId, {
      photos: pg.photos.filter((ph) => ph.id !== photoId),
    });
  };

  const handleCoverPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const processed = await processAndStripImage(file);
      updateCover({ photoUrl: processed.dataUrl });
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'No se pudo cargar la portada.');
    }
    e.target.value = '';
  };

  const importMemorialMoment = (momentId: string) => {
    if (!memorial || !activeChapter) return;
    const mom = memorial.lifeMoments.find((m) => m.id === momentId);
    if (!mom) return;
    updateBook({
      chapters: book.chapters.map((c) =>
        c.id === activeChapter.id
          ? {
              ...c,
              pages: [
                ...c.pages,
                {
                  id: `p-${Date.now()}`,
                  title: mom.title,
                  content: mom.text,
                  photos: [],
                  linkedMomentId: mom.id,
                },
              ],
            }
          : c
      ),
    });
  };

  const importMemorialObject = (objId: string) => {
    if (!memorial || !activeChapter) return;
    const obj = memorial.objectMemories.find((o) => o.id === objId);
    if (!obj) return;
    updateBook({
      chapters: book.chapters.map((c) =>
        c.id === activeChapter.id
          ? {
              ...c,
              pages: [
                ...c.pages,
                {
                  id: `p-${Date.now()}`,
                  title: obj.title,
                  content: obj.text,
                  photos: [],
                  linkedObjectId: obj.id,
                },
              ],
            }
          : c
      ),
    });
  };

  const handlePublishSelection = () => {
    updateBook({
      publishedSnapshot: {
        cover: { ...cover },
        template: book.template || 'historia',
        openingNote: book.openingNote,
        closingNote: book.closingNote,
        chapters: JSON.parse(JSON.stringify(book.chapters)),
        publishedAt: new Date().toLocaleDateString('es-CO'),
      },
    });
  };

  const handleAddVoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voiceText.trim()) return;
    const voices = book.voiceContributions || [];
    updateBook({
      voiceContributions: [
        {
          id: `voice-${Date.now()}`,
          author: voiceAuthor.trim() || 'Familiar invitado',
          relation: voiceRelation.trim() || 'Cercano',
          text: voiceText.trim(),
          status: isOwner ? 'aprobado' : 'pendiente',
          createdAt: 'Reciente',
        },
        ...voices,
      ],
    });
    setVoiceAuthor('');
    setVoiceRelation('');
    setVoiceText('');
  };

  const handlePrivacyChange = (privacy: PrivacyLevel) => {
    updateBook({
      privacy,
      inviteCode: privacy === 'invitados' ? book.inviteCode || 'LIBRO' : book.inviteCode,
    });
  };

  const previewSource =
    !isOwner && book.publishedSnapshot ? book.publishedSnapshot : { ...book, cover };

  return (
    <div
      className="modal-backdrop"
      style={{ fontFamily: "'Open Sans', system-ui, sans-serif" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-modal-title"
        className="glass-panel modal-card custom-scroll animate-gentle-in"
        style={{
          maxWidth: '960px',
          background: '#fcfaf5',
          borderTop: '4px solid #64caca',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1rem',
            marginBottom: '0.85rem',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.78rem',
                color: '#2c7373',
                fontWeight: 600,
              }}
            >
              <span>Nuestro libro · Duelo Animal</span>
              {memorial && <span>· Vinculado a {memorial.name}</span>}
              {isOwner && (
                <span
                  aria-live="polite"
                  style={{
                    padding: '0.12rem 0.55rem',
                    borderRadius: '999px',
                    background:
                      saveStatus === 'No se pudo guardar'
                        ? 'rgba(180, 60, 45, 0.14)'
                        : 'rgba(100, 202, 202, 0.18)',
                    color: saveStatus === 'No se pudo guardar' ? '#9c3a2b' : '#235e5e',
                  }}
                >
                  {saveStatus}
                </span>
              )}
            </div>
            <h2
              id="book-modal-title"
              className="font-serif-editorial"
              style={{ fontSize: '1.9rem', fontWeight: 600, margin: '0.15rem 0 0' }}
            >
              {cover.title || book.title}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            {isOwner && (
              <button className="btn-secondary" style={{ fontSize: '0.8rem' }} onClick={onClose}>
                Guardar y salir
              </button>
            )}
            <button className="btn-icon" onClick={onClose} aria-label="Cerrar libro">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* WELCOME SCREEN (when chosen or fresh book) */}
        {showWelcome && isOwner ? (
          <div
            style={{
              padding: '2rem 1.5rem',
              borderRadius: '18px',
              background: '#ffffff',
              border: '1px solid rgba(100, 202, 202, 0.45)',
              textAlign: 'center',
              maxWidth: '640px',
              margin: '1rem auto',
            }}
          >
            <p
              style={{
                fontSize: '1.04rem',
                lineHeight: 1.75,
                color: 'var(--text-espresso)',
                margin: '0 0 1.65rem',
              }}
            >
              Su historia está hecha de muchos momentos.
              <br />
              Aquí puedes reunir sus costumbres, sus aventuras y la vida que compartieron. Puedes
              empezar por un recuerdo pequeño, saltar preguntas y volver cuando quieras.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', justifyContent: 'center' }}>
              <button
                className="btn-primary"
                onClick={() => {
                  setShowWelcome(false);
                  setActiveChapterId('cap-encontramos');
                  setViewTab('edit');
                }}
              >
                Empezar con un recuerdo
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowWelcome(false);
                  setViewTab('edit');
                }}
              >
                Explorar los capítulos
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowWelcome(false);
                  setActiveChapterId('cap-abierta');
                  setViewTab('edit');
                }}
              >
                Escribir libremente
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Main Toolbar */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.45rem',
                alignItems: 'center',
                marginBottom: '0.9rem',
                paddingBottom: '0.75rem',
                borderBottom: '1px solid var(--border-soft)',
              }}
            >
              {isOwner && (
                <>
                  <button
                    className={viewTab === 'edit' ? 'btn-primary' : 'btn-secondary'}
                    style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem' }}
                    onClick={() => setViewTab('edit')}
                  >
                    <Edit3 size={14} />
                    Escribir
                  </button>
                  <button
                    className={viewTab === 'cover' ? 'btn-primary' : 'btn-secondary'}
                    style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem' }}
                    onClick={() => setViewTab('cover')}
                  >
                    <LayoutTemplate size={14} />
                    Portada y diseño
                  </button>
                </>
              )}

              <button
                className={viewTab === 'preview' ? 'btn-primary' : 'btn-secondary'}
                style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem' }}
                onClick={() => setViewTab('preview')}
              >
                <Eye size={14} />
                Vista previa
              </button>

              <button
                className="btn-secondary"
                style={{
                  fontSize: '0.82rem',
                  padding: '0.45rem 0.9rem',
                  borderColor: '#64caca',
                }}
                onClick={() => exportBookToPdf(book, memorial?.name, !isOwner)}
              >
                <Download size={14} />
                Descargar PDF
              </button>

              {isOwner && (
                <>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem' }}
                    onClick={() => exportBookTextBackup(book)}
                    title="Exportar textos y fotografías en archivo propio"
                  >
                    <FileDown size={14} />
                    Exportar respaldo
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem' }}
                    onClick={() => setAiNoticeOpen((v) => !v)}
                  >
                    <Sparkles size={14} />
                    Asistencia IA (opcional)
                  </button>
                </>
              )}
            </div>

            {/* AI Assistance Notice (when toggled) */}
            {aiNoticeOpen && isOwner && (
              <div
                style={{
                  padding: '0.9rem 1rem',
                  borderRadius: '14px',
                  background: '#ffffff',
                  border: '1px solid #64caca',
                  marginBottom: '0.9rem',
                  fontSize: '0.83rem',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>
                  Asistencia de IA opcional (sin credenciales configuradas)
                </div>
                <p style={{ margin: '0 0 0.55rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  No hay un proveedor de IA configurado en este entorno, por lo que no se envía contenido fuera del navegador ni se simulan textos. El editor manual funciona por completo sin IA.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {[
                    'Organiza sin reescribir',
                    'Conserva mis palabras',
                    'Ayúdame a conectar estos recuerdos',
                    'Haz el texto más sencillo',
                  ].map((label) => (
                    <button
                      key={label}
                      disabled
                      className="btn-secondary"
                      style={{ opacity: 0.6, cursor: 'not-allowed', fontSize: '0.77rem' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {photoError && (
              <div
                role="alert"
                style={{
                  padding: '0.6rem 0.9rem',
                  borderRadius: '10px',
                  background: 'rgba(180, 60, 45, 0.12)',
                  color: '#8f2f22',
                  fontSize: '0.82rem',
                  marginBottom: '0.8rem',
                }}
              >
                {photoError}
              </div>
            )}

            {/* Undo deleted chapter banner */}
            {deletedChapterBackup && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.6rem 0.9rem',
                  borderRadius: '10px',
                  background: 'rgba(100, 202, 202, 0.16)',
                  marginBottom: '0.8rem',
                  fontSize: '0.83rem',
                }}
              >
                <span>Se eliminó el capítulo “{deletedChapterBackup.chapter.title}”.</span>
                <button className="btn-secondary" style={{ padding: '0.28rem 0.7rem', fontSize: '0.78rem' }} onClick={undoDeleteChapter}>
                  <RotateCcw size={13} />
                  Deshacer
                </button>
              </div>
            )}

            {/* TAB 1: COVER, TEMPLATES, LINKING & PRIVACY */}
            {viewTab === 'cover' && isOwner && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.15rem' }}>
                {/* Cover fields */}
                <div
                  style={{
                    padding: '1.1rem',
                    borderRadius: '16px',
                    background: '#ffffff',
                    border: '1px solid var(--border-soft)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <h3 className="font-serif-editorial" style={{ fontSize: '1.45rem', margin: 0 }}>
                    Portada y notas
                  </h3>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Título del libro
                    </label>
                    <input
                      className="input-field"
                      value={cover.title}
                      onChange={(e) => updateCover({ title: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                        Nombre del animal
                      </label>
                      <input
                        className="input-field"
                        value={cover.animalName}
                        onChange={(e) => updateCover({ animalName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                        Fechas (opcional)
                      </label>
                      <input
                        className="input-field"
                        placeholder="Ej. 2013 – 2026"
                        value={cover.dates || ''}
                        onChange={(e) => updateCover({ dates: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Autoría (editable)
                    </label>
                    <input
                      className="input-field"
                      placeholder="Ej. Familia Gómez"
                      value={cover.authorName}
                      onChange={(e) => updateCover({ authorName: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {cover.photoUrl && (
                      <img
                        src={cover.photoUrl}
                        alt="Portada"
                        style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '10px' }}
                      />
                    )}
                    <label className="btn-secondary" style={{ fontSize: '0.8rem' }}>
                      <ImagePlus size={14} />
                      {cover.photoUrl ? 'Cambiar foto de portada' : 'Elegir foto de portada'}
                      <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleCoverPhoto} />
                    </label>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Apertura (opcional)
                    </label>
                    <textarea
                      className="input-field"
                      rows={2}
                      placeholder="Unas palabras iniciales si lo deseas..."
                      value={book.openingNote || ''}
                      onChange={(e) => updateBook({ openingNote: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Cierre (opcional)
                    </label>
                    <textarea
                      className="input-field"
                      rows={2}
                      placeholder="Un cierre abierto si deseas incluirlo..."
                      value={book.closingNote || ''}
                      onChange={(e) => updateBook({ closingNote: e.target.value })}
                    />
                  </div>
                </div>

                {/* Templates, Memorial Link & Privacy */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  {/* 3 Templates */}
                  <div
                    style={{
                      padding: '1.1rem',
                      borderRadius: '16px',
                      background: '#ffffff',
                      border: '1px solid var(--border-soft)',
                    }}
                  >
                    <h3 className="font-serif-editorial" style={{ fontSize: '1.4rem', margin: '0 0 0.55rem' }}>
                      Plantilla visual (cambiable sin perder contenido)
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      {(['album', 'historia', 'momentos'] as BookTemplate[]).map((tpl) => (
                        <button
                          key={tpl}
                          type="button"
                          className={(book.template || 'historia') === tpl ? 'btn-primary' : 'btn-secondary'}
                          style={{ justifyContent: 'space-between', borderRadius: '12px', padding: '0.6rem 0.9rem' }}
                          onClick={() => updateBook({ template: tpl })}
                        >
                          <span>{TEMPLATE_INFO[tpl].name}</span>
                          <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>{TEMPLATE_INFO[tpl].desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Link to memorial */}
                  {ownedMemorials.length > 0 && (
                    <div
                      style={{
                        padding: '1.1rem',
                        borderRadius: '16px',
                        background: '#ffffff',
                        border: '1px solid var(--border-soft)',
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.45rem' }}>
                        <Link2 size={15} color="#2c7373" />
                        Vincular a un homenaje del jardín
                      </label>
                      <select
                        className="input-field"
                        value={book.memorialId || ''}
                        onChange={(e) => updateBook({ memorialId: e.target.value || undefined })}
                      >
                        <option value="">Libro independiente (sin vincular)</option>
                        {ownedMemorials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Independent Privacy & Publishing */}
                  <div
                    style={{
                      padding: '1.1rem',
                      borderRadius: '16px',
                      background: '#ffffff',
                      border: '1px solid var(--border-soft)',
                    }}
                  >
                    <div style={{ fontSize: '0.86rem', fontWeight: 600, marginBottom: '0.45rem' }}>
                      Privacidad independiente del libro
                    </div>
                    <p style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Publicar un memorial no publica su libro. Tu borrador privado nunca modifica la selección publicada hasta que tú lo decidas.
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.65rem' }}>
                      {(
                        [
                          ['privado', 'Solo para mí', Lock],
                          ['invitados', 'Personas invitadas', Users],
                          ['publico', 'Selección pública en el memorial', Globe],
                        ] as const
                      ).map(([lvl, label, Icon]) => (
                        <button
                          key={lvl}
                          type="button"
                          className={book.privacy === lvl ? 'btn-primary' : 'btn-secondary'}
                          style={{ padding: '0.38rem 0.75rem', fontSize: '0.77rem' }}
                          onClick={() => handlePrivacyChange(lvl)}
                        >
                          <Icon size={13} />
                          {label}
                        </button>
                      ))}
                    </div>

                    {book.privacy === 'invitados' && (
                      <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', marginBottom: '0.65rem' }}>
                        <input
                          className="input-field"
                          style={{ padding: '0.42rem 0.7rem', fontSize: '0.8rem' }}
                          value={book.inviteCode || 'LIBRO'}
                          onChange={(e) => updateBook({ inviteCode: e.target.value.toUpperCase() })}
                          placeholder="Clave de invitación"
                        />
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '0.76rem', flexShrink: 0 }}
                          onClick={() =>
                            updateBook({
                              inviteCode: `L-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
                            })
                          }
                        >
                          Revocar y generar nueva
                        </button>
                      </div>
                    )}

                    {book.privacy !== 'privado' && (
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ width: '100%', fontSize: '0.82rem' }}
                        onClick={handlePublishSelection}
                      >
                        <Check size={14} />
                        {book.publishedSnapshot
                          ? `Actualizar selección publicada (última: ${book.publishedSnapshot.publishedAt})`
                          : 'Publicar selección actual'}
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ marginTop: '0.75rem', width: '100%', color: '#8f392c', fontSize: '0.8rem' }}
                      onClick={() => {
                        if (window.confirm('¿Deseas eliminar este libro? Puedes exportar un respaldo antes de borrarlo.')) {
                          onDeleteBook(book.id);
                        }
                      }}
                    >
                      <Trash2 size={13} />
                      Eliminar libro
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PREVIEW MODE */}
            {viewTab === 'preview' && (
              <div
                style={{
                  padding: '1.75rem',
                  borderRadius: '18px',
                  background: '#ffffff',
                  border: '1px solid rgba(100, 202, 202, 0.35)',
                }}
              >
                {/* Cover Preview */}
                <div style={{ textAlign: 'center', paddingBottom: '1.75rem', borderBottom: '1px solid var(--border-soft)', marginBottom: '1.75rem' }}>
                  <div style={{ fontSize: '0.76rem', color: '#2c7373', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    {TEMPLATE_INFO[previewSource.template || 'historia'].name}
                  </div>
                  <h3 className="font-serif-editorial" style={{ fontSize: '2.2rem', margin: '0.35rem 0 0.25rem' }}>
                    {previewSource.cover.title}
                  </h3>
                  {previewSource.cover.animalName && (
                    <div className="font-serif-editorial" style={{ fontSize: '1.35rem', fontStyle: 'italic', color: 'var(--accent-sage)' }}>
                      {previewSource.cover.animalName}
                    </div>
                  )}
                  {previewSource.cover.dates && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      {previewSource.cover.dates}
                    </div>
                  )}
                  {previewSource.cover.photoUrl && (
                    <img
                      src={previewSource.cover.photoUrl}
                      alt={previewSource.cover.animalName || 'Portada'}
                      style={{ maxWidth: '240px', maxHeight: '240px', objectFit: 'contain', borderRadius: '14px', marginTop: '1rem' }}
                    />
                  )}
                  {previewSource.cover.authorName && (
                    <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '0.85rem' }}>
                      Escrito por {previewSource.cover.authorName}
                    </div>
                  )}
                </div>

                {previewSource.openingNote?.trim() && (
                  <p style={{ fontStyle: 'italic', lineHeight: 1.75, marginBottom: '1.75rem' }}>
                    {previewSource.openingNote}
                  </p>
                )}

                {previewSource.chapters.map((ch) => {
                  const nonEmpty = ch.pages.filter(
                    (p) => p.content.trim() || (p.photos && p.photos.length > 0) || p.photoUrl || p.isOpenPage
                  );
                  if (nonEmpty.length === 0) return null;
                  return (
                    <section key={ch.id} style={{ marginBottom: '2rem' }}>
                      <h4 className="font-serif-editorial" style={{ fontSize: '1.6rem', margin: '0 0 0.85rem', color: '#2d2520' }}>
                        {ch.title}
                      </h4>
                      {nonEmpty.map((p) => (
                        <div key={p.id} style={{ marginBottom: '1.25rem' }}>
                          {p.title && <div style={{ fontWeight: 600, color: 'var(--accent-sage)', marginBottom: '0.35rem' }}>{p.title}</div>}
                          {p.photos && p.photos.length > 0 && (
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns:
                                  previewSource.template === 'album'
                                    ? 'repeat(auto-fit, minmax(220px, 1fr))'
                                    : 'repeat(auto-fit, minmax(160px, 1fr))',
                                gap: '0.75rem',
                                margin: '0.6rem 0',
                              }}
                            >
                              {p.photos.map((ph) => (
                                <figure key={ph.id} style={{ margin: 0 }}>
                                  <img
                                    src={ph.dataUrl}
                                    alt={ph.altText}
                                    style={{
                                      width: '100%',
                                      maxHeight: previewSource.template === 'album' ? '340px' : '240px',
                                      objectFit: 'contain',
                                      objectPosition: ph.framing,
                                      borderRadius: '10px',
                                      background: '#f7f3eb',
                                    }}
                                  />
                                  {ph.caption && (
                                    <figcaption style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                      {ph.caption}
                                    </figcaption>
                                  )}
                                </figure>
                              ))}
                            </div>
                          )}
                          {p.content && <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.75 }}>{p.content}</p>}
                          {p.isOpenPage && !p.content && (
                            <p style={{ margin: 0, fontStyle: 'italic', color: 'var(--text-muted)' }}>
                              Página abierta para futuros recuerdos.
                            </p>
                          )}
                        </div>
                      ))}
                    </section>
                  );
                })}

                {previewSource.closingNote?.trim() && (
                  <p style={{ fontStyle: 'italic', lineHeight: 1.75, paddingTop: '1rem', borderTop: '1px solid var(--border-soft)' }}>
                    {previewSource.closingNote}
                  </p>
                )}
              </div>
            )}

            {/* TAB 3: WRITING EDITOR */}
            {viewTab === 'edit' && isOwner && (
              <>
                {/* Quick access shortcuts */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.9rem' }}>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: '0.77rem', padding: '0.35rem 0.75rem' }}
                    onClick={() => setActiveChapterId('cap-encontramos')}
                  >
                    Hoy quiero contar cómo nos conocimos
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: '0.77rem', padding: '0.35rem 0.75rem' }}
                    onClick={() => setActiveChapterId('cap-asi-eras')}
                  >
                    Quiero guardar una de sus ocurrencias
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: '0.77rem', padding: '0.35rem 0.75rem' }}
                    onClick={() => quickPhotoInputRef.current?.click()}
                  >
                    Tengo una foto con historia
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: '0.77rem', padding: '0.35rem 0.75rem' }}
                    onClick={() => setActiveChapterId('cap-abierta')}
                  >
                    Quiero escribir algo por mi cuenta
                  </button>
                  {activeChapter?.pages[0] && (
                    <input
                      ref={quickPhotoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      style={{ display: 'none' }}
                      onChange={(e) => handleUploadPagePhoto(activeChapter.id, activeChapter.pages[0].id, e)}
                    />
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem' }}>
                  {/* Chapters Sidebar */}
                  <aside style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxWidth: '280px' }}>
                    {book.chapters.map((ch, idx) => (
                      <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {renamingChapterId === ch.id ? (
                          <form
                            style={{ display: 'flex', flex: 1, gap: '0.25rem' }}
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (renameValue.trim()) {
                                updateBook({
                                  chapters: book.chapters.map((x) =>
                                    x.id === ch.id ? { ...x, title: renameValue.trim() } : x
                                  ),
                                });
                              }
                              setRenamingChapterId(null);
                            }}
                          >
                            <input
                              className="input-field"
                              style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              autoFocus
                            />
                            <button type="submit" className="btn-icon" style={{ width: '28px', height: '28px' }}>
                              <Check size={13} />
                            </button>
                          </form>
                        ) : (
                          <button
                            className={ch.id === activeChapter?.id ? 'btn-primary' : 'btn-secondary'}
                            style={{
                              flex: 1,
                              justifyContent: 'flex-start',
                              textAlign: 'left',
                              borderRadius: '10px',
                              padding: '0.5rem 0.7rem',
                              fontSize: '0.8rem',
                            }}
                            onClick={() => setActiveChapterId(ch.id)}
                          >
                            <span>
                              {ch.title}
                              {ch.isOptional ? ' —opcional—' : ''}
                            </span>
                          </button>
                        )}

                        <div style={{ display: 'flex', gap: '2px' }}>
                          <button
                            className="btn-icon"
                            style={{ width: '24px', height: '24px' }}
                            title="Renombrar"
                            onClick={() => {
                              setRenamingChapterId(ch.id);
                              setRenameValue(ch.title);
                            }}
                          >
                            <Edit3 size={11} />
                          </button>
                          <button
                            className="btn-icon"
                            style={{ width: '24px', height: '24px' }}
                            title="Subir"
                            onClick={() => moveChapter(idx, -1)}
                          >
                            <ArrowUp size={11} />
                          </button>
                          <button
                            className="btn-icon"
                            style={{ width: '24px', height: '24px' }}
                            title="Bajar"
                            onClick={() => moveChapter(idx, 1)}
                          >
                            <ArrowDown size={11} />
                          </button>
                          <button
                            className="btn-icon"
                            style={{ width: '24px', height: '24px' }}
                            title="Eliminar capítulo"
                            onClick={() => {
                              if (window.confirm(`¿Eliminar el capítulo “${ch.title}”?`)) {
                                deleteChapter(ch.id);
                              }
                            }}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    ))}

                    <form onSubmit={addCustomChapter} style={{ marginTop: '0.4rem', display: 'flex', gap: '0.35rem' }}>
                      <input
                        className="input-field"
                        style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }}
                        placeholder="Añadir capítulo propio..."
                        value={newChapterTitle}
                        onChange={(e) => setNewChapterTitle(e.target.value)}
                      />
                      <button type="submit" className="btn-icon" aria-label="Añadir capítulo">
                        <Plus size={15} />
                      </button>
                    </form>
                  </aside>

                  {/* Active Chapter Area */}
                  {activeChapter && (
                    <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      <div>
                        <h3 className="font-serif-editorial" style={{ fontSize: '1.55rem', margin: 0 }}>
                          {activeChapter.title}
                        </h3>

                        {activeChapter.prefaceNote && (
                          <div
                            style={{
                              marginTop: '0.5rem',
                              padding: '0.75rem 0.95rem',
                              borderRadius: '12px',
                              background: 'rgba(100, 202, 202, 0.14)',
                              border: '1px solid #64caca',
                              fontSize: '0.84rem',
                              lineHeight: 1.5,
                            }}
                          >
                            {activeChapter.prefaceNote}
                          </div>
                        )}

                        {activeChapter.prompts.length > 0 && (
                          <div style={{ marginTop: '0.45rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            {activeChapter.prompts.map((pr, i) => (
                              <div key={i}>· {pr}</div>
                            ))}
                            <div style={{ marginTop: '0.25rem', fontStyle: 'italic' }}>
                              Puedes dejar esta pregunta para otro día. Tu historia puede incluir emociones distintas; no necesitas encontrar las palabras perfectas.
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Chapter H: Voices of invited family */}
                      {activeChapter.isVoiceChapter ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <form onSubmit={handleAddVoice} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                              <input
                                className="input-field"
                                placeholder="Nombre"
                                value={voiceAuthor}
                                onChange={(e) => setVoiceAuthor(e.target.value)}
                              />
                              <input
                                className="input-field"
                                placeholder="Vínculo (ej. Tía, amigo)"
                                value={voiceRelation}
                                onChange={(e) => setVoiceRelation(e.target.value)}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <input
                                className="input-field"
                                placeholder="Recuerdo aportado..."
                                value={voiceText}
                                onChange={(e) => setVoiceText(e.target.value)}
                              />
                              <button type="submit" className="btn-primary" style={{ flexShrink: 0 }}>
                                Añadir voz
                              </button>
                            </div>
                          </form>

                          {(book.voiceContributions || []).map((v) => (
                            <div
                              key={v.id}
                              style={{
                                padding: '0.85rem',
                                borderRadius: '12px',
                                background: '#ffffff',
                                border: '1px solid var(--border-soft)',
                                opacity: v.status === 'oculto' ? 0.55 : 1,
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                <span>
                                  <strong>{v.author}</strong> ({v.relation}) · {v.status}
                                </span>
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                  {v.status !== 'aprobado' && (
                                    <button
                                      className="btn-icon"
                                      style={{ width: '26px', height: '26px' }}
                                      title="Aprobar"
                                      onClick={() =>
                                        updateBook({
                                          voiceContributions: book.voiceContributions.map((x) =>
                                            x.id === v.id ? { ...x, status: 'aprobado' } : x
                                          ),
                                        })
                                      }
                                    >
                                      <Check size={13} color="#586f54" />
                                    </button>
                                  )}
                                  <button
                                    className="btn-icon"
                                    style={{ width: '26px', height: '26px' }}
                                    title="Ocultar"
                                    onClick={() =>
                                      updateBook({
                                        voiceContributions: book.voiceContributions.map((x) =>
                                          x.id === v.id ? { ...x, status: 'oculto' } : x
                                        ),
                                      })
                                    }
                                  >
                                    <EyeOff size={12} />
                                  </button>
                                </div>
                              </div>
                              <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem' }}>{v.text}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <>
                          {/* Selective import from linked memorial */}
                          {memorial && (memorial.lifeMoments.length > 0 || memorial.objectMemories.length > 0) && (
                            <div
                              style={{
                                padding: '0.75rem 0.9rem',
                                borderRadius: '12px',
                                background: '#ffffff',
                                border: '1px solid var(--border-soft)',
                                fontSize: '0.8rem',
                              }}
                            >
                              <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>
                                Seleccionar recuerdos del jardín para este capítulo (opcional):
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                {memorial.lifeMoments.map((mom) => (
                                  <button
                                    key={mom.id}
                                    type="button"
                                    className="btn-secondary"
                                    style={{ padding: '0.28rem 0.65rem', fontSize: '0.75rem' }}
                                    onClick={() => importMemorialMoment(mom.id)}
                                  >
                                    <Plus size={12} />
                                    {mom.title}
                                  </button>
                                ))}
                                {memorial.objectMemories.map((obj) => (
                                  <button
                                    key={obj.id}
                                    type="button"
                                    className="btn-secondary"
                                    style={{ padding: '0.28rem 0.65rem', fontSize: '0.75rem' }}
                                    onClick={() => importMemorialObject(obj.id)}
                                  >
                                    <Plus size={12} />
                                    {obj.title}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Pages */}
                          {activeChapter.pages.map((page, pIdx) => (
                            <div
                              key={page.id}
                              style={{
                                padding: '1rem',
                                borderRadius: '14px',
                                background: '#ffffff',
                                border: '1px solid var(--border-soft)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.6rem',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                  className="input-field"
                                  style={{ fontWeight: 600, padding: '0.45rem 0.7rem' }}
                                  value={page.title}
                                  onChange={(e) => updatePage(activeChapter.id, page.id, { title: e.target.value })}
                                />
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                  <button
                                    className="btn-icon"
                                    style={{ width: '28px', height: '28px' }}
                                    onClick={() => movePage(activeChapter.id, pIdx, -1)}
                                    aria-label="Subir página"
                                  >
                                    <ArrowUp size={13} />
                                  </button>
                                  <button
                                    className="btn-icon"
                                    style={{ width: '28px', height: '28px' }}
                                    onClick={() => movePage(activeChapter.id, pIdx, 1)}
                                    aria-label="Bajar página"
                                  >
                                    <ArrowDown size={13} />
                                  </button>
                                </div>
                              </div>

                              <textarea
                                className="input-field"
                                rows={4}
                                placeholder="Escribe libremente con tus propias palabras..."
                                value={page.content}
                                onChange={(e) => updatePage(activeChapter.id, page.id, { content: e.target.value })}
                              />

                              {/* Photos list with framing, alt text, caption, reorder */}
                              {page.photos && page.photos.length > 0 && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.65rem' }}>
                                  {page.photos.map((ph, phIdx) => (
                                    <div
                                      key={ph.id}
                                      style={{
                                        padding: '0.6rem',
                                        borderRadius: '12px',
                                        background: '#faf7f0',
                                        border: '1px solid var(--border-soft)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.4rem',
                                      }}
                                    >
                                      <img
                                        src={ph.dataUrl}
                                        alt={ph.altText}
                                        style={{
                                          width: '100%',
                                          maxHeight: '180px',
                                          objectFit: 'contain',
                                          objectPosition: ph.framing,
                                          borderRadius: '8px',
                                          background: '#efeae0',
                                        }}
                                      />
                                      <input
                                        className="input-field"
                                        style={{ padding: '0.35rem 0.55rem', fontSize: '0.78rem' }}
                                        placeholder="Pie de foto..."
                                        value={ph.caption}
                                        onChange={(e) => updatePhoto(activeChapter.id, page.id, ph.id, { caption: e.target.value })}
                                      />
                                      <input
                                        className="input-field"
                                        style={{ padding: '0.35rem 0.55rem', fontSize: '0.78rem' }}
                                        placeholder="Texto alternativo (accesibilidad)..."
                                        value={ph.altText}
                                        onChange={(e) => updatePhoto(activeChapter.id, page.id, ph.id, { altText: e.target.value })}
                                      />
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.25rem' }}>
                                        <select
                                          className="input-field"
                                          style={{ padding: '0.25rem 0.4rem', fontSize: '0.74rem', width: 'auto' }}
                                          value={ph.framing}
                                          onChange={(e) =>
                                            updatePhoto(activeChapter.id, page.id, ph.id, {
                                              framing: e.target.value as PhotoFraming,
                                            })
                                          }
                                        >
                                          <option value="center">Encuadre: centro</option>
                                          <option value="top">Encuadre: arriba</option>
                                          <option value="bottom">Encuadre: abajo</option>
                                        </select>
                                        <div style={{ display: 'flex', gap: '2px' }}>
                                          <button className="btn-icon" style={{ width: '24px', height: '24px' }} onClick={() => movePhoto(activeChapter.id, page.id, phIdx, -1)}>
                                            <ArrowLeft size={11} />
                                          </button>
                                          <button className="btn-icon" style={{ width: '24px', height: '24px' }} onClick={() => movePhoto(activeChapter.id, page.id, phIdx, 1)}>
                                            <ArrowRight size={11} />
                                          </button>
                                          <button className="btn-icon" style={{ width: '24px', height: '24px' }} onClick={() => removePhoto(activeChapter.id, page.id, ph.id)}>
                                            <Trash2 size={11} />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                                <label className="btn-secondary" style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}>
                                  <ImagePlus size={13} />
                                  Añadir fotografía
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    style={{ display: 'none' }}
                                    onChange={(e) => handleUploadPagePhoto(activeChapter.id, page.id, e)}
                                  />
                                </label>

                                {(page.linkedMomentId || page.linkedObjectId) && memorial && canAccessMemorial && onViewInGarden && (
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                                    onClick={() => onViewInGarden(memorial)}
                                  >
                                    <Trees size={13} />
                                    Ver este recuerdo en el jardín
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <button className="btn-secondary" onClick={() => addPage(activeChapter.id, false)}>
                              <Plus size={14} />
                              Añadir página
                            </button>
                            <button className="btn-secondary" onClick={() => addPage(activeChapter.id, true)}>
                              <Plus size={14} />
                              Dejar página abierta para futuros recuerdos
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
