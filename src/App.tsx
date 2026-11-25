import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AmbientSoundscape } from './audio/AmbientSoundscape';
import { AddMemorialModal } from './components/AddMemorialModal';
import { BookModal } from './components/BookModal';
import { BreathingModal } from './components/BreathingModal';
import { DirectoryListView } from './components/DirectoryListView';
import { EmailAccessModal } from './components/EmailAccessModal';
import { HUD } from './components/HUD';
import { MemorialModal } from './components/MemorialModal';
import { PodcastBenchWidget } from './components/PodcastBenchWidget';
import { QuickGuideModal } from './components/QuickGuideModal';
import { ServicesAndAboutModal } from './components/ServicesAndAboutModal';
import { WelcomeGateOverlay } from './components/WelcomeGateOverlay';
import { PODCAST_CONFIG } from './config/podcastConfig';
import { createSuggestedChapters, DEMO_MEMORIALS } from './data/initialData';
import { detectLanguage, SupportedLang } from './i18n/translations';
import {
  deleteCloudBook,
  deleteCloudMemorial,
  ensureAnonymousSession,
  fetchCloudBooks,
  fetchCloudMemorialsPage,
  findPublicMemorialsByEmail,
  isSupabaseConfigured,
  redeemCloudInviteCode,
  supabase,
  upsertCloudBook,
  upsertCloudMemorial,
} from './lib/supabase';
import { SanctuaryScene, TimeMode } from './three/SanctuaryScene';
import { Memorial, MemoryBook, UserProfile } from './types/memorial';

const STORAGE_OWNER = 'dueloanimal_owner_v2';
const STORAGE_PROFILE = 'dueloanimal_profile_v2';
const STORAGE_MEMORIALS = 'dueloanimal_memorials_v2';
const STORAGE_BOOKS = 'dueloanimal_books_v2';
const STORAGE_INVITES = 'dueloanimal_invites_v2';
const STORAGE_DELETED_IDS = 'dueloanimal_deleted_ids_v1';
const STORAGE_GUIDE_SEEN_EMAILS = 'dueloanimal_guide_seen_emails_v1';

function getOrCreateOwnerId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_OWNER);
    if (existing) return existing;
    const created = `owner-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    localStorage.setItem(STORAGE_OWNER, created);
    return created;
  } catch {
    return 'local-owner';
  }
}

function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SanctuaryScene | null>(null);
  const soundRef = useRef<AmbientSoundscape | null>(null);

  const [deviceOwnerId] = useState<string>(() => getOrCreateOwnerId());
  const [userProfile, setUserProfile] = useState<UserProfile>(() =>
    loadStored<UserProfile>(STORAGE_PROFILE, { email: '', grievingName: '', country: '' })
  );
  const userProfileRef = useRef(userProfile);
  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);
  const [lang, setLang] = useState<SupportedLang>(() =>
    detectLanguage(loadStored<UserProfile>(STORAGE_PROFILE, { email: '', grievingName: '', country: '' }).country)
  );
  const [authUid, setAuthUid] = useState<string | null>(null);
  const ownerId = authUid ? `uid:${authUid}` : deviceOwnerId;
  const [memorials, setMemorials] = useState<Memorial[]>(() => {
    const stored = loadStored(STORAGE_MEMORIALS, DEMO_MEMORIALS).filter(
      (m) => !(m.ownerId === 'demo-owner' && !m.photoUrl)
    );
    const existingIds = new Set(stored.map((m) => m.id));
    const missingDefaults = DEMO_MEMORIALS.filter((m) => !existingIds.has(m.id));
    return [...missingDefaults, ...stored];
  });
  const [books, setBooks] = useState<MemoryBook[]>(() =>
    loadStored(STORAGE_BOOKS, [])
  );
  const [unlockedInvites, setUnlockedInvites] = useState<string[]>(() =>
    loadStored(STORAGE_INVITES, [])
  );
  const [deletedIds, setDeletedIds] = useState<string[]>(() =>
    loadStored(STORAGE_DELETED_IDS, [])
  );
  const [cloudTotalMemorials, setCloudTotalMemorials] = useState<number | null>(null);

  const [hasEntered, setHasEntered] = useState(false);
  const [gateAnimationDone, setGateAnimationDone] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [hudHidden, setHudHidden] = useState(false);
  const [viewMode, setViewMode] = useState<'3d' | 'list'>('3d');
  const [timeMode, setTimeMode] = useState<TimeMode>('auto');
  const [isNightNow] = useState(() => {
    const h = new Date().getHours();
    return h >= 18 || h < 6;
  });

  const [hoveredMemorial, setHoveredMemorial] = useState<Memorial | null>(null);
  const [hoveredBook, setHoveredBook] = useState<Memorial | null>(null);
  const [hoveredPodcast, setHoveredPodcast] = useState(false);
  const [hoveredRainbow, setHoveredRainbow] = useState(false);
  const [selectedMemorialId, setSelectedMemorialId] = useState<string | null>(null);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [activeBookChapterId, setActiveBookChapterId] = useState<string | undefined>(undefined);
  const [activeModal, setActiveModal] = useState<'none' | 'add' | 'services' | 'guide' | 'email' | 'breathing'>('none');
  const [saveStatus, setSaveStatus] = useState<'Guardando...' | 'Guardado' | 'No se pudo guardar'>('Guardado');

  const canAccessMemorial = (m: Memorial): boolean => {
    if (m.ownerId === ownerId || m.ownerId === deviceOwnerId) return true;
    if (m.privacy === 'publico') return true;
    if (m.privacy === 'invitados' && m.inviteCode && unlockedInvites.includes(m.inviteCode.toUpperCase())) {
      return true;
    }
    return false;
  };

  const canAccessBook = (b: MemoryBook): boolean => {
    if (b.ownerId === ownerId) return true;
    // Visitors can only read if a published snapshot exists AND privacy allows it
    if (!b.publishedSnapshot) return false;
    if (b.privacy === 'publico') return true;
    if (b.privacy === 'invitados' && b.inviteCode && unlockedInvites.includes(b.inviteCode.toUpperCase())) {
      return true;
    }
    return false;
  };

  const [currentSanctuary, setCurrentSanctuary] = useState(0);

  // Only render authorized memorials in the 3D garden, grouped into sanctuaries of 30 altars
  const ALTARS_PER_SANCTUARY = 30;
  const visibleMemorials = useMemo(
    () => memorials.filter((m) => canAccessMemorial(m)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [memorials, ownerId, unlockedInvites]
  );

  const totalSanctuaries = Math.max(
    1,
    Math.ceil(Math.max(visibleMemorials.length, cloudTotalMemorials ?? 0) / ALTARS_PER_SANCTUARY)
  );
  const sanctuaryMemorials = useMemo(
    () =>
      visibleMemorials.slice(
        currentSanctuary * ALTARS_PER_SANCTUARY,
        (currentSanctuary + 1) * ALTARS_PER_SANCTUARY
      ),
    [visibleMemorials, currentSanctuary]
  );

  const selectedMemorial = visibleMemorials.find((m) => m.id === selectedMemorialId) ?? null;
  const activeBook = books.find((b) => b.id === activeBookId) ?? null;
  const activeBookMemorial = activeBook?.memorialId
    ? memorials.find((m) => m.id === activeBook.memorialId)
    : undefined;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PROFILE, JSON.stringify(userProfile));
    } catch {
      // ignore
    }
  }, [userProfile]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MEMORIALS, JSON.stringify(memorials));
    } catch {
      // ignore
    }
    sceneRef.current?.syncMemorials(sanctuaryMemorials);
  }, [memorials, sanctuaryMemorials]);

  useEffect(() => {
    setSaveStatus('Guardando...');
    try {
      localStorage.setItem(STORAGE_BOOKS, JSON.stringify(books));
      setSaveStatus('Guardado');
    } catch {
      setSaveStatus('No se pudo guardar');
    }
  }, [books]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_INVITES, JSON.stringify(unlockedInvites));
    } catch {
      // ignore
    }
  }, [unlockedInvites]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_DELETED_IDS, JSON.stringify(deletedIds));
    } catch {
      // ignore
    }
  }, [deletedIds]);

  // Listen to Supabase Auth state changes
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => setAuthUid(data.user?.id ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUid(session?.user?.id ?? null);
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // Paginated cloud sync (Supabase as source of truth, 30 memorials per sanctuary)
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;

    void (async () => {
      const [pageResult, cloudBooks] = await Promise.all([
        fetchCloudMemorialsPage(currentSanctuary, ALTARS_PER_SANCTUARY),
        fetchCloudBooks(),
      ]);
      if (cancelled) return;

      if (pageResult) {
        setCloudTotalMemorials(pageResult.totalCount);
        const deletedSet = new Set(deletedIds);
        setMemorials((localList) => {
          const map = new Map<string, Memorial>();
          // Keep non-demo local items only if not deleted; cloud is source of truth for synced items
          localList.forEach((m) => {
            if (!deletedSet.has(m.id)) map.set(m.id, m);
          });
          pageResult.memorials.forEach((m) => {
            if (!deletedSet.has(m.id)) map.set(m.id, m);
          });
          return Array.from(map.values());
        });
      }

      if (cloudBooks) {
        setBooks((localBooks) => {
          const map = new Map<string, MemoryBook>();
          localBooks.forEach((b) => map.set(b.id, b));
          cloudBooks.forEach((b) => map.set(b.id, b));
          return Array.from(map.values());
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentSanctuary, authUid, deletedIds]);

  const openOrCreateBookForMemorial = (memorial?: Memorial, chapterId?: string) => {
    if (memorial) {
      const existing = books.find((b) => b.memorialId === memorial.id);
      if (existing) {
        if (!canAccessBook(existing)) return;
        setActiveBookChapterId(chapterId);
        setActiveBookId(existing.id);
        return;
      }
      // Create private draft book linked to this memorial
      const newBook: MemoryBook = {
        id: `book-${crypto.randomUUID()}`,
        ownerId: memorial.ownerId === 'demo-owner' ? ownerId : memorial.ownerId,
        memorialId: memorial.id,
        title: 'Nuestra historia: un libro de la vida que compartimos',
        subtitle: `En memoria de ${memorial.name}`,
        template: 'historia',
        cover: {
          title: 'Nuestra historia: un libro de la vida que compartimos',
          animalName: memorial.name,
          authorName: '',
          dates: memorial.dates,
          photoUrl: memorial.photoUrl,
        },
        privacy: 'privado',
        chapters: createSuggestedChapters(),
        voiceContributions: [],
        updatedAt: new Date().toISOString(),
      };
      setBooks((prev) => [...prev, newBook]);
      setActiveBookChapterId(chapterId);
      setActiveBookId(newBook.id);
    } else {
      const independent = books.find((b) => !b.memorialId && b.ownerId === ownerId);
      if (independent) {
        setActiveBookChapterId(chapterId);
        setActiveBookId(independent.id);
        return;
      }
      const newBook: MemoryBook = {
        id: `book-${crypto.randomUUID()}`,
        ownerId,
        title: 'Nuestra historia: un libro de la vida que compartimos',
        subtitle: 'Libro de recuerdos',
        template: 'historia',
        cover: {
          title: 'Nuestra historia: un libro de la vida que compartimos',
          animalName: '',
          authorName: '',
        },
        privacy: 'privado',
        chapters: createSuggestedChapters(),
        voiceContributions: [],
        updatedAt: new Date().toISOString(),
      };
      setBooks((prev) => [...prev, newBook]);
      setActiveBookChapterId(chapterId);
      setActiveBookId(newBook.id);
    }
  };

  const openBookRef = useRef<(m?: Memorial, chId?: string) => void>(() => {});
  openBookRef.current = openOrCreateBookForMemorial;

  // Initialize 3D Sanctuary (without automatic audio!)
  useEffect(() => {
    if (!containerRef.current) return;

    const sound = new AmbientSoundscape();
    soundRef.current = sound;

    const scene = new SanctuaryScene(containerRef.current, sanctuaryMemorials, {
      onSelectMemorial: (m) => setSelectedMemorialId(m.id),
      onSelectBook: (m) => openBookRef.current(m),
      onHoverMemorial: (m) => setHoveredMemorial(m),
      onHoverBook: (m) => setHoveredBook(m),
      onHoverPodcast: (h) => setHoveredPodcast(h),
      onSelectPodcast: () => {
        if (PODCAST_CONFIG.spotifyUrl.trim()) {
          window.open(PODCAST_CONFIG.spotifyUrl, '_blank', 'noopener,noreferrer');
        } else {
          setHoveredPodcast((v) => !v);
        }
      },
      onHoverRainbow: (h) => setHoveredRainbow(h),
      onSelectRainbow: () => {
        window.open(PODCAST_CONFIG.rainbowLegendUrl, '_blank', 'noopener,noreferrer');
      },
      onEnterComplete: () => {
        setGateAnimationDone(true);
      },
    });
    sceneRef.current = scene;

    return () => {
      scene.dispose();
      sound.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maybeOpenGuideForFirstEmail = (emailRaw: string) => {
    const email = emailRaw.trim().toLowerCase();
    if (!email) return;
    try {
      const seenEmails = loadStored<string[]>(STORAGE_GUIDE_SEEN_EMAILS, []);
      if (!seenEmails.includes(email)) {
        localStorage.setItem(STORAGE_GUIDE_SEEN_EMAILS, JSON.stringify([...seenEmails, email]));
        setActiveModal('guide');
      }
    } catch {
      setActiveModal('guide');
    }
  };

  const mergeDiscoveredPublicMemorials = (found: Memorial[]) => {
    if (found.length === 0) return;
    setMemorials((prev) => {
      const map = new Map(prev.map((m) => [m.id, m]));
      found.forEach((m) => {
        if (!map.has(m.id)) map.set(m.id, m);
      });
      return Array.from(map.values());
    });
  };

  const handleEnter = (profile: UserProfile) => {
    userProfileRef.current = profile;
    setUserProfile(profile);
    if (profile.country) {
      setLang(detectLanguage(profile.country));
    }
    setHasEntered(true);
    sceneRef.current?.enterSanctuary();
    if (!audioEnabled) {
      soundRef.current?.start();
      setAudioEnabled(true);
    }
    if (isSupabaseConfigured) {
      void ensureAnonymousSession();
      if (profile.email) {
        void findPublicMemorialsByEmail(profile.email).then(mergeDiscoveredPublicMemorials);
      }
    }
    maybeOpenGuideForFirstEmail(profile.email);
  };

  const handleToggleAudio = () => {
    if (audioEnabled) {
      soundRef.current?.stop();
      setAudioEnabled(false);
    } else {
      soundRef.current?.start();
      setAudioEnabled(true);
    }
  };

  const handleChangeTimeMode = (mode: TimeMode) => {
    setTimeMode(mode);
    sceneRef.current?.setTimeMode(mode);
  };

  const handleCreateMemorial = (
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
  ) => {
    const idx = memorials.length;
    const side = idx % 2 === 0 ? -1 : 1;
    const row = Math.floor(idx / 2);
    const x = side * (5.5 + (row % 3) * 2.2);
    const z = -10.5 - row * 6.8;
    const rotationY = side * -0.45;

    const newMemorial: Memorial = {
      ...data,
      id: `mem-${crypto.randomUUID()}`,
      position: [x, 0, z],
      rotationY,
      objectMemories: [],
      lifeMoments: [],
      privateLetters: [],
      valueReflections: [],
      familyContributions: [],
      createdAt: new Date().toISOString().slice(0, 10),
    };

    const nextSanctuary = Math.floor(visibleMemorials.length / ALTARS_PER_SANCTUARY);
    setCurrentSanctuary(nextSanctuary);
    setMemorials((prev) => [...prev, newMemorial]);
    void upsertCloudMemorial(newMemorial, userProfileRef.current.email);
    setActiveModal('none');
    setTimeout(() => {
      if (viewMode === '3d') {
        sceneRef.current?.focusMemorial(newMemorial);
      }
      if (openBookAfter) {
        openOrCreateBookForMemorial(newMemorial);
      } else {
        setSelectedMemorialId(newMemorial.id);
      }
    }, 160);
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {!hasEntered && (
        <WelcomeGateOverlay
          initialProfile={userProfile}
          onEnter={handleEnter}
          isNight={isNightNow}
        />
      )}

      {gateAnimationDone && viewMode === 'list' && (
        <DirectoryListView
          memorials={memorials}
          currentOwnerId={ownerId}
          unlockedInviteCodes={unlockedInvites}
          onUnlockInviteCode={(code) => {
            setUnlockedInvites((prev) => (prev.includes(code) ? prev : [...prev, code]));
            void redeemCloudInviteCode(code).then((unlocked) => {
              if (unlocked.length === 0) return;
              setMemorials((prev) => {
                const map = new Map(prev.map((m) => [m.id, m]));
                unlocked.forEach((m) => map.set(m.id, m));
                return Array.from(map.values());
              });
            });
          }}
          onSelectMemorial={(m) => {
            setSelectedMemorialId(m.id);
          }}
        />
      )}

      {gateAnimationDone && (
        <HUD
          audioEnabled={audioEnabled}
          onToggleAudio={handleToggleAudio}
          hudHidden={hudHidden}
          onToggleHud={() => setHudHidden((v) => !v)}
          viewMode={viewMode}
          onToggleViewMode={() => setViewMode((v) => (v === '3d' ? 'list' : '3d'))}
          timeMode={timeMode}
          onChangeTimeMode={handleChangeTimeMode}
          hoveredMemorial={hoveredMemorial}
          hoveredBook={hoveredBook}
          searchableMemorials={visibleMemorials}
          lang={lang}
          onChangeLang={setLang}
          userProfile={userProfile}
          onSelectSearchResult={(m) => {
            const idx = visibleMemorials.findIndex((x) => x.id === m.id);
            if (idx >= 0) {
              setCurrentSanctuary(Math.floor(idx / ALTARS_PER_SANCTUARY));
            }
            setViewMode('3d');
            setTimeout(() => {
              sceneRef.current?.focusMemorial(m);
              setSelectedMemorialId(m.id);
            }, 80);
          }}
          memorialsCount={memorials.length}
          currentSanctuary={currentSanctuary}
          totalSanctuaries={totalSanctuaries}
          hoveredRainbow={hoveredRainbow}
          onChangeSanctuary={(idx) => {
            setCurrentSanctuary(idx);
            sceneRef.current?.resetView();
          }}
          countriesCount={
            new Set(
              memorials
                .map((m) => m.country?.trim().toLowerCase())
                .filter((c): c is string => Boolean(c))
            ).size
          }
          onOpenAdd={() => setActiveModal('add')}
          onOpenBook={() => openOrCreateBookForMemorial()}
          onOpenServices={() => setActiveModal('services')}
          onOpenGuide={() => setActiveModal('guide')}
          onOpenEmailAccess={() => setActiveModal('email')}
          onResetView={() => {
            setViewMode('3d');
            sceneRef.current?.resetView();
          }}
          onNavigateKey={(key, active) => sceneRef.current?.setNavigationKey(key, active)}
          onOpenBreathing={() => setActiveModal('breathing')}
        />
      )}

      {gateAnimationDone && viewMode === '3d' && !hudHidden && (
        <PodcastBenchWidget externalHover={hoveredPodcast} />
      )}

      {selectedMemorial && (() => {
        const isMemorialOwner =
          selectedMemorial.ownerId === ownerId ||
          selectedMemorial.ownerId === deviceOwnerId ||
          selectedMemorial.ownerId === 'demo-owner';
        const linkedBook = books.find((b) => b.memorialId === selectedMemorial.id);
        const allowBook = isMemorialOwner;
        const bookCtaLabel = linkedBook
          ? 'Continuar escribiendo'
          : 'Comenzar nuestra historia';

        return (
          <MemorialModal
            memorial={selectedMemorial}
            isOwner={isMemorialOwner}
            canAccessBook={allowBook}
            bookCtaLabel={bookCtaLabel}
            onClose={() => setSelectedMemorialId(null)}
            onUpdateMemorial={(updated) => {
              setMemorials((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
              setSaveStatus('Guardando...');
              void upsertCloudMemorial(updated, userProfileRef.current.email).then((res) => {
                setSaveStatus(res.ok ? 'Guardado' : 'No se pudo guardar');
              });
            }}
            onDeleteMemorial={(id) => {
              setDeletedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
              setMemorials((prev) => prev.filter((m) => m.id !== id));
              void deleteCloudMemorial(id);
              setSelectedMemorialId(null);
            }}
            onOpenBook={(m) => {
              setSelectedMemorialId(null);
              openOrCreateBookForMemorial(m);
            }}
          />
        );
      })()}

      {activeBook && canAccessBook(activeBook) && (
        <BookModal
          book={activeBook}
          memorial={activeBookMemorial}
          ownedMemorials={memorials.filter(
            (m) => m.ownerId === ownerId || m.ownerId === 'demo-owner'
          )}
          isOwner={activeBook.ownerId === ownerId}
          canAccessMemorial={activeBookMemorial ? canAccessMemorial(activeBookMemorial) : false}
          saveStatus={saveStatus}
          initialChapterId={activeBookChapterId}
          onClose={() => {
            setActiveBookId(null);
            setActiveBookChapterId(undefined);
          }}
          onUpdateBook={(updated) => {
            setBooks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
            setSaveStatus('Guardando...');
            void upsertCloudBook(updated).then((res) => {
              setSaveStatus(res.ok ? 'Guardado' : 'No se pudo guardar');
            });
          }}
          onDeleteBook={(bookId) => {
            setBooks((prev) => prev.filter((b) => b.id !== bookId));
            void deleteCloudBook(bookId);
            setActiveBookId(null);
          }}
          onViewInGarden={(m) => {
            setActiveBookId(null);
            setViewMode('3d');
            sceneRef.current?.focusMemorial(m);
            setSelectedMemorialId(m.id);
          }}
        />
      )}

      {activeModal === 'add' && (
        <AddMemorialModal
          ownerId={ownerId}
          userProfile={userProfile}
          onUpdateProfile={(p) => setUserProfile(p)}
          onClose={() => setActiveModal('none')}
          onCreate={handleCreateMemorial}
        />
      )}

      {activeModal === 'services' && (
        <ServicesAndAboutModal onClose={() => setActiveModal('none')} />
      )}

      {activeModal === 'guide' && (
        <QuickGuideModal
          onClose={() => setActiveModal('none')}
          onStartCreate={() => setActiveModal('add')}
          onOpenBook={() => openOrCreateBookForMemorial()}
        />
      )}

      {activeModal === 'breathing' && (
        <BreathingModal onClose={() => setActiveModal('none')} />
      )}

      {activeModal === 'email' && (
        <EmailAccessModal
          profile={userProfile}
          onSaveProfile={(p) => {
            setUserProfile(p);
            maybeOpenGuideForFirstEmail(p.email);
          }}
          onPublicMemorialsFound={mergeDiscoveredPublicMemorials}
          onExportBackup={() => {
            const payload = JSON.stringify({ memorials, books }, null, 2);
            const blob = new Blob([payload], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `jardin-huella-viva-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          onImportBackup={(jsonText) => {
            try {
              const parsed = JSON.parse(jsonText) as { memorials?: Memorial[]; books?: MemoryBook[] } | Memorial[];
              const incomingMemorials = Array.isArray(parsed) ? parsed : parsed.memorials || [];
              const incomingBooks = Array.isArray(parsed) ? [] : parsed.books || [];
              if (incomingMemorials.length === 0 && incomingBooks.length === 0) return null;

              setMemorials((prev) => {
                const map = new Map(prev.map((m) => [m.id, m]));
                incomingMemorials.forEach((m) => {
                  if (m?.id && m?.name) {
                    map.set(m.id, m);
                    void upsertCloudMemorial(m);
                  }
                });
                return Array.from(map.values());
              });

              if (incomingBooks.length > 0) {
                setBooks((prev) => {
                  const map = new Map(prev.map((b) => [b.id, b]));
                  incomingBooks.forEach((b) => {
                    if (b?.id) {
                      map.set(b.id, b);
                      void upsertCloudBook(b);
                    }
                  });
                  return Array.from(map.values());
                });
              }

              return { importedMemorials: incomingMemorials.length, importedBooks: incomingBooks.length };
            } catch {
              return null;
            }
          }}
          onClose={() => setActiveModal('none')}
        />
      )}
    </div>
  );
};

export default App;
