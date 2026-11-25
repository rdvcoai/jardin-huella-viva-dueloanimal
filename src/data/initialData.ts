import { BookChapter, Memorial, PlantType, ServiceOffering } from '../types/memorial';

export const PLANT_LABELS: Record<PlantType, { name: string; note: string; category: 'Árbol' | 'Planta' | 'Flor' }> = {
  // Árboles
  olivo: { name: 'Olivo', note: 'Serenidad y raíz firme', category: 'Árbol' },
  cipres: { name: 'Ciprés', note: 'Memoria que acompaña en pie', category: 'Árbol' },
  cerezo: { name: 'Cerezo en flor', note: 'Belleza serena en cada estación', category: 'Árbol' },
  guayacan: { name: 'Guayacán amarillo', note: 'Luz cálida y fuerza en el paisaje', category: 'Árbol' },
  sauce: { name: 'Sauce', note: 'Sombra tranquila y abrigo', category: 'Árbol' },
  // Plantas
  lavanda: { name: 'Lavanda', note: 'Calma suave en el viento', category: 'Planta' },
  helecho: { name: 'Helecho', note: 'Verdor vivo y refugio', category: 'Planta' },
  suculenta: { name: 'Suculenta', note: 'Presencia noble y resistente', category: 'Planta' },
  // Flores
  jazmin: { name: 'Jazmín', note: 'Presencia delicada', category: 'Flor' },
  girasol: { name: 'Girasol', note: 'Calidez hacia la luz', category: 'Flor' },
  lirio: { name: 'Lirio blanco', note: 'Pureza y quietud', category: 'Flor' },
  orquidea: { name: 'Orquídea', note: 'Ternura y detalle único', category: 'Flor' },
  rosal: { name: 'Rosal', note: 'Amor que permanece', category: 'Flor' },
};

export const OBJECT_LABELS: Record<'pelota' | 'ventana' | 'sillon' | 'manta', string> = {
  pelota: 'Pelota',
  ventana: 'Ventana',
  sillon: 'Sillón',
  manta: 'Manta',
};

export const VALUES_QUESTIONS: string[] = [
  '¿Qué te enseñó su forma de estar presente en lo cotidiano?',
  '¿Qué hábito o valor de su compañía quieres conservar en tu vida actual?',
  '¿Cómo describes el vínculo que construyeron juntos?',
];

export function createSuggestedChapters(): BookChapter[] {
  return [
    {
      id: 'cap-encontramos',
      title: 'Cuando nos encontramos',
      prompts: [
        '¿Cómo llegó a tu vida?',
        '¿Qué recuerdas de los primeros días?',
        '¿Cómo elegiste su nombre?',
      ],
      pages: [
        {
          id: 'p-enc-1',
          title: 'Primeros días',
          content: '',
          photos: [],
        },
      ],
    },
    {
      id: 'cap-asi-eras',
      title: 'Así eras tú',
      prompts: [
        '¿Qué costumbres lo hacían único?',
        '¿Cómo mostraba lo que quería?',
        '¿Qué ocurrencia te gustaría conservar?',
      ],
      pages: [
        {
          id: 'p-asi-1',
          title: 'Sus costumbres',
          content: '',
          photos: [],
        },
      ],
    },
    {
      id: 'cap-cotidiana',
      title: 'Nuestra vida cotidiana',
      prompts: [
        '¿Cómo era un día juntos?',
        '¿Dónde le gustaba descansar?',
        '¿Qué pequeños momentos compartían?',
      ],
      pages: [
        {
          id: 'p-cot-1',
          title: 'Un día juntos',
          content: '',
          photos: [],
        },
      ],
    },
    {
      id: 'cap-compartimos',
      title: 'Lo que compartimos',
      prompts: [
        '¿Qué significaba su compañía?',
        '¿Qué aventuras o cambios vivieron?',
        '¿Qué historia te gustaría que otras personas conocieran?',
      ],
      pages: [
        {
          id: 'p-com-1',
          title: 'Presencia y aventuras',
          content: '',
          photos: [],
        },
      ],
    },
    {
      id: 'cap-pequenas',
      title: 'Las pequeñas cosas',
      prompts: [
        'Sus apodos.',
        'Sus juguetes y objetos.',
        'Sus sonidos.',
        'Sus maneras de dormir.',
        'Las rutinas que recuerdas.',
      ],
      pages: [
        {
          id: 'p-peq-1',
          title: 'Detalles cotidianos',
          content: '',
          photos: [],
        },
      ],
    },
    {
      id: 'cap-dificiles',
      title: 'Los días difíciles',
      isOptional: true,
      prefaceNote:
        'Puedes incluir esta parte si tiene sentido para ti. También puedes dejarla fuera o volver otro día.',
      prompts: [
        '¿Hay algo de esos días que quieras contar?',
        '¿Qué prefieres mantener en privado?',
      ],
      pages: [
        {
          id: 'p-dif-1',
          title: 'Lo que decidas contar',
          content: '',
          photos: [],
        },
      ],
    },
    {
      id: 'cap-conmigo',
      title: 'Lo que llevo conmigo',
      prompts: [
        '¿Qué aprendiste de compartir la vida con él o ella?',
        '¿Qué cualidades de esa relación valoras?',
        '¿Hay algo de ese vínculo que quieras expresar en tu vida actual?',
      ],
      pages: [
        {
          id: 'p-con-1',
          title: 'Lo que permanece',
          content: '',
          photos: [],
        },
      ],
    },
    {
      id: 'cap-voces',
      title: 'Las voces de quienes te conocieron',
      isVoiceChapter: true,
      prompts: ['Recuerdos aportados por familiares invitados, sujetos a aprobación.'],
      pages: [],
    },
    {
      id: 'cap-abierta',
      title: 'Una página abierta',
      isOpenChapter: true,
      prompts: ['Espacio opcional para futuros recuerdos que quieras añadir en otro momento.'],
      pages: [
        {
          id: 'p-abi-1',
          title: 'Para futuros recuerdos',
          content: '',
          photos: [],
          isOpenPage: true,
        },
      ],
    },
  ];
}

/**
 * Homenaje sembrado por defecto en la entrada del Jardín Huella Viva.
 */
export const DEMO_MEMORIALS: Memorial[] = [
  {
    id: 'mem-mattus',
    ownerId: 'demo-owner',
    name: 'Mattus',
    species: 'perro',
    phrase: 'Siempre serás parte de nuestra familia y de cada paso que damos.',
    country: 'Colombia',
    photoUrl: '/mattus.jpg',
    chosenPlant: 'lavanda',
    privacy: 'publico',
    accentTone: '#64caca',
    position: [-3.95, 0.13, -3.6],
    rotationY: Math.PI * 0.36,
    createdAt: '2026-11-24',
    candleCount: 3,
    lightLeftByUser: true,
    flowerLeftByUser: true,
    objectMemories: [],
    lifeMoments: [],
    privateLetters: [],
    valueReflections: [],
    familyContributions: [],
    sentGestures: [
      { id: 'sg-mattus-1', label: 'Mariposa', emoji: '🦋' },
      { id: 'sg-mattus-2', label: 'Alas de ángel', emoji: '🪽' },
      { id: 'sg-mattus-3', label: 'Corazón rojo', emoji: '❤️' },
      { id: 'sg-mattus-4', label: 'Vela', emoji: '🕯️' },
    ],
  },
];

export const SERVICE_OFFERINGS: ServiceOffering[] = [
  {
    id: 'srv-primera-historia',
    title: 'Mi primera historia',
    description: 'Capítulo breve con fotografías y descarga gratuita en PDF.',
    scope: 'Disponible sin costo para conservar un primer relato fuera de la plataforma.',
    priceLabel: 'Gratuito',
    isFree: true,
  },
  {
    id: 'srv-libro',
    title: 'Nuestro libro digital',
    description: 'Libro completo: “Nuestra historia: un libro de la vida que compartimos”.',
    scope:
      'Capítulos ilimitados, plantillas editoriales, fotografías con pies de foto y exportación en PDF.',
    priceLabel: '1 USD / 1 EUR / 3.000 COP',
  },
];
