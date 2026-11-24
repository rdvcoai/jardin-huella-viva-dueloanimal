export type SupportedLang = 'es' | 'en' | 'de' | 'pt' | 'fr';

const COUNTRY_TO_LANG: Record<string, SupportedLang> = {
  usa: 'en',
  'estados unidos': 'en',
  'united states': 'en',
  uk: 'en',
  'reino unido': 'en',
  'united kingdom': 'en',
  canada: 'en',
  canadá: 'en',
  australia: 'en',
  alemania: 'de',
  germany: 'de',
  deutschland: 'de',
  austria: 'de',
  suiza: 'de',
  brasil: 'pt',
  brazil: 'pt',
  portugal: 'pt',
  francia: 'fr',
  france: 'fr',
};

export function detectLanguage(country?: string): SupportedLang {
  if (country && country.trim()) {
    const c = country.trim().toLowerCase();
    for (const [k, lang] of Object.entries(COUNTRY_TO_LANG)) {
      if (c.includes(k)) return lang;
    }
    if (
      ['colombia', 'méxico', 'mexico', 'argentina', 'chile', 'perú', 'peru', 'españa', 'espana', 'ecuador', 'uruguay', 'venezuela'].some((h) =>
        c.includes(h)
      )
    ) {
      return 'es';
    }
  }

  const nav = (navigator.language || 'es').slice(0, 2).toLowerCase();
  if (nav === 'en' || nav === 'de' || nav === 'pt' || nav === 'fr' || nav === 'es') {
    return nav;
  }
  return 'es';
}

export interface UIMessages {
  brandSub: string;
  welcomeTitle: string;
  welcomeDesc: string;
  enterBtn: string;
  enterWithDataBtn: string;
  disclaimer: string;
  listView: string;
  garden3d: string;
  ourBook: string;
  pauses: string;
  services: string;
  howItWorks: string;
  createMemorial: string;
  signInEmail: string;
  searchPlaceholder: string;
  searchLabel: string;
  walkingHint: string;
  podcastTooltip: string;
  openSpotify: string;
  langLabel: string;
}

export const MESSAGES: Record<SupportedLang, UIMessages> = {
  es: {
    brandSub: 'DueloAnimal.co · Jardín Huella Viva',
    welcomeTitle: 'Jardín Huella Viva · Siembra su recuerdo',
    welcomeDesc:
      'Al cruzar estas puertas encontrarás un campo sereno. Puedes recorrer los rincones públicos o ingresar tus datos para crear y proteger tus homenajes y libros privados.',
    enterBtn: 'Entrar al jardín',
    enterWithDataBtn: 'Entrar con mis datos al jardín',
    disclaimer:
      'Recurso conmemorativo acompañado por Natalia Jaller Peña, psicóloga y terapeuta de duelo animal. No constituye terapia, diagnóstico ni tratamiento.',
    listView: 'Vista en lista',
    garden3d: 'Ver jardín 3D',
    ourBook: 'Nuestro libro',
    pauses: 'Pausas opcionales',
    services: 'Servicios',
    howItWorks: '¿Cómo funciona?',
    createMemorial: 'Crear homenaje',
    signInEmail: 'Entrar con correo',
    searchPlaceholder: 'Buscar por nombre...',
    searchLabel: 'Buscar',
    walkingHint:
      'Toca el sendero para caminar · Arrastra para mirar · Selecciona un rincón o su libro en la banca',
    podcastTooltip:
      'Siéntate un momento. Escucha Juntos en el Adiós: historias y conversaciones para acompañarte en el duelo por tu animal de compañía. Este espacio es gratuito y puedes escucharlo a tu ritmo.',
    openSpotify: 'Abrir en Spotify ↗',
    langLabel: 'ES',
  },
  en: {
    brandSub: 'DueloAnimal.co · Garden of Pawprints',
    welcomeTitle: 'A peaceful garden to honor the companion you loved',
    welcomeDesc:
      'Beyond these vine-covered gates lies a quiet meadow. Walk through public memorials or enter your email to create and protect your private tributes and memory books.',
    enterBtn: 'Enter the garden',
    enterWithDataBtn: 'Enter the garden with my details',
    disclaimer:
      'Commemorative resource guided by Natalia Jaller Peña, psychologist and pet bereavement therapist. Not therapy, diagnosis, or medical treatment.',
    listView: 'List view',
    garden3d: '3D Garden',
    ourBook: 'Our book',
    pauses: 'Optional pauses',
    services: 'Services',
    howItWorks: 'How it works',
    createMemorial: 'Create memorial',
    signInEmail: 'Sign in with email',
    searchPlaceholder: 'Search by name...',
    searchLabel: 'Search',
    walkingHint:
      'Tap the path to walk · Drag to look around · Select a memorial or its book on the bench',
    podcastTooltip:
      'Have a seat for a moment. Listen to Juntos en el Adiós: stories and conversations to accompany you in pet loss grief. Free to listen at your own pace.',
    openSpotify: 'Open in Spotify ↗',
    langLabel: 'EN',
  },
  de: {
    brandSub: 'DueloAnimal.co · Garten der Pfoten',
    welcomeTitle: 'Ein ruhiger Garten, um dein geliebtes Tier zu ehren',
    welcomeDesc:
      'Hinter diesen rankenbewachsenen Toren erwartet dich eine friedliche Wiese. Besuche öffentliche Gedenkorte oder gib deine E-Mail an, um private Erinnerungen zu schützen.',
    enterBtn: 'Den Garten betreten',
    enterWithDataBtn: 'Mit meinen Daten eintreten',
    disclaimer:
      'Gedenkressource begleitet von Natalia Jaller Peña, Psychologin und Tiertrauer-Therapeutin. Keine Therapie oder medizinische Behandlung.',
    listView: 'Listenansicht',
    garden3d: '3D-Garten',
    ourBook: 'Unser Buch',
    pauses: 'Optionale Pausen',
    services: 'Angebote',
    howItWorks: 'So funktioniert es',
    createMemorial: 'Gedenkort erstellen',
    signInEmail: 'Mit E-Mail anmelden',
    searchPlaceholder: 'Nach Namen suchen...',
    searchLabel: 'Suchen',
    walkingHint:
      'Tippe auf den Weg zum Gehen · Ziehen zum Umsehen · Wähle einen Gedenkort oder das Buch',
    podcastTooltip:
      'Nimm dir einen Moment Zeit. Höre Juntos en el Adiós: Geschichten und Gespräche zur Begleitung in der Trauer um dein Tier. Kostenlos und in deinem eigenen Tempo.',
    openSpotify: 'Auf Spotify öffnen ↗',
    langLabel: 'DE',
  },
  pt: {
    brandSub: 'DueloAnimal.co · Jardim das Pegadas',
    welcomeTitle: 'Um jardim tranquilo para honrar quem você amou',
    welcomeDesc:
      'Ao cruzar estes portões você encontrará um campo sereno. Percorra os memoriais públicos ou informe seu e-mail para proteger suas homenagens e livros privados.',
    enterBtn: 'Entrar no jardim',
    enterWithDataBtn: 'Entrar com meus dados',
    disclaimer:
      'Recurso comemorativo acompanhado por Natalia Jaller Peña, psicóloga e terapeuta de luto animal. Não constitui terapia, diagnóstico ou tratamento.',
    listView: 'Vista em lista',
    garden3d: 'Jardim 3D',
    ourBook: 'Nosso livro',
    pauses: 'Pausas opcionais',
    services: 'Serviços',
    howItWorks: 'Como funciona?',
    createMemorial: 'Criar homenagem',
    signInEmail: 'Entrar com e-mail',
    searchPlaceholder: 'Buscar por nome...',
    searchLabel: 'Buscar',
    walkingHint:
      'Toque no caminho para andar · Arraste para olhar · Selecione um memorial ou o livro no banco',
    podcastTooltip:
      'Sente-se um momento. Ouça Juntos en el Adiós: histórias e conversas para acompanhar o luto pelo seu animal. Gratuito e no seu próprio ritmo.',
    openSpotify: 'Abrir no Spotify ↗',
    langLabel: 'PT',
  },
  fr: {
    brandSub: 'DueloAnimal.co · Jardin des Empreintes',
    welcomeTitle: 'Un jardin paisible pour honorer votre compagnon',
    welcomeDesc:
      'Au-delà de ces grilles fleuries s’étend une prairie sereine. Parcourez les hommages publics ou indiquez votre e-mail pour protéger vos souvenirs privés.',
    enterBtn: 'Entrer dans le jardin',
    enterWithDataBtn: 'Entrer avec mes informations',
    disclaimer:
      'Ressource commémorative accompagnée par Natalia Jaller Peña, psychologue et thérapeute du deuil animal. Ne remplace pas une thérapie ou un traitement.',
    listView: 'Vue liste',
    garden3d: 'Jardin 3D',
    ourBook: 'Notre livre',
    pauses: 'Pauses optionnelles',
    services: 'Services',
    howItWorks: 'Comment ça marche ?',
    createMemorial: 'Créer un hommage',
    signInEmail: 'Connexion par e-mail',
    searchPlaceholder: 'Rechercher par nom...',
    searchLabel: 'Rechercher',
    walkingHint:
      'Touchez le sentier pour marcher · Glissez pour regarder · Touchez un mémorial ou son livre',
    podcastTooltip:
      'Asseyez-vous un instant. Écoutez Juntos en el Adiós : histoires et conversations pour accompagner le deuil animalier. Gratuit et à votre rythme.',
    openSpotify: 'Ouvrir dans Spotify ↗',
    langLabel: 'FR',
  },
};
