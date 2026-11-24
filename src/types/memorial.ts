export type Species = 'perro' | 'gato' | 'raton' | 'ave' | 'otro';
export type PrivacyLevel = 'privado' | 'invitados' | 'publico';
export type PlantType =
  | 'olivo'
  | 'cipres'
  | 'cerezo'
  | 'guayacan'
  | 'sauce'
  | 'lavanda'
  | 'helecho'
  | 'suculenta'
  | 'jazmin'
  | 'girasol'
  | 'lirio'
  | 'orquidea'
  | 'rosal';
export type MemoryObjectType = 'pelota' | 'ventana' | 'sillon' | 'manta';
export type BookTemplate = 'album' | 'historia' | 'momentos';
export type PhotoFraming = 'center' | 'top' | 'bottom';

export interface ObjectMemory {
  id: string;
  objectType: MemoryObjectType;
  title: string;
  text: string;
  photoUrl?: string;
  hidden?: boolean;
  linkedBookChapterId?: string;
}

export interface LifeMoment {
  id: string;
  title: string;
  whenLabel?: string;
  text: string;
  photoUrl?: string;
  hidden?: boolean;
  linkedBookChapterId?: string;
}

export interface PrivateLetter {
  id: string;
  text: string;
  shareable: boolean;
  hidden?: boolean;
  createdAt: string;
}

export interface ValueReflection {
  id: string;
  question: string;
  answer: string;
  hidden?: boolean;
}

export interface FamilyContribution {
  id: string;
  author: string;
  relation: string;
  text: string;
  status: 'pendiente' | 'aprobado' | 'oculto';
  reported?: boolean;
  createdAt: string;
}

export interface UserProfile {
  email: string;
  grievingName: string;
  country: string;
}

export interface Memorial {
  id: string;
  ownerId: string;
  grievingName?: string;
  country?: string;
  name: string;
  species: Species;
  phrase: string;
  dates?: string;
  birthDate?: string;
  deathDate?: string;
  city?: string;
  photoUrl?: string;
  chosenPlant: PlantType;
  privacy: PrivacyLevel;
  inviteCode?: string;
  invitedEmails?: string[];
  accentTone: string;
  position: [number, number, number];
  rotationY: number;
  objectMemories: ObjectMemory[];
  lifeMoments: LifeMoment[];
  privateLetters: PrivateLetter[];
  valueReflections: ValueReflection[];
  familyContributions: FamilyContribution[];
  lightLeftByUser?: boolean;
  flowerLeftByUser?: boolean;
  toyLeftByUser?: 'perro' | 'gato';
  candleCount?: number;
  sentGestures?: { id: string; label: string; emoji: string; author?: string }[];
  createdAt: string;
}

export interface BookPhoto {
  id: string;
  /** Optimised display copy without EXIF location metadata */
  dataUrl: string;
  caption: string;
  altText: string;
  framing: PhotoFraming;
  aspectRatio: number;
}

export interface BookPage {
  id: string;
  title: string;
  content: string;
  /** Legacy single photo field kept for backwards compatibility */
  photoUrl?: string;
  caption?: string;
  photos?: BookPhoto[];
  linkedMomentId?: string;
  linkedObjectId?: string;
  isOpenPage?: boolean;
}

export interface BookChapter {
  id: string;
  title: string;
  prompts: string[];
  isOptional?: boolean;
  prefaceNote?: string;
  isVoiceChapter?: boolean;
  isOpenChapter?: boolean;
  pages: BookPage[];
}

export interface BookCover {
  title: string;
  animalName: string;
  authorName: string;
  dates?: string;
  photoUrl?: string;
  photoFraming?: PhotoFraming;
}

export interface BookVoiceContribution {
  id: string;
  author: string;
  relation: string;
  text: string;
  status: 'pendiente' | 'aprobado' | 'oculto';
  createdAt: string;
}

export interface PublishedBookSnapshot {
  cover: BookCover;
  template: BookTemplate;
  openingNote?: string;
  closingNote?: string;
  chapters: BookChapter[];
  publishedAt: string;
}

export interface MemoryBook {
  id: string;
  ownerId: string;
  memorialId?: string;
  title: string;
  subtitle: string;
  template: BookTemplate;
  cover: BookCover;
  openingNote?: string;
  closingNote?: string;
  privacy: PrivacyLevel;
  inviteCode?: string;
  chapters: BookChapter[];
  voiceContributions: BookVoiceContribution[];
  /** Independent published selection: updating private draft does NOT modify this */
  publishedSnapshot?: PublishedBookSnapshot;
  updatedAt: string;
}

export interface ServiceOffering {
  id: string;
  title: string;
  description: string;
  scope: string;
  priceLabel: string;
  isFree?: boolean;
}
