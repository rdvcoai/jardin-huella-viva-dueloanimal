export interface GestureOption {
  id: string;
  label: string;
  emoji: string;
  category: 'luz' | 'flores' | 'comida' | 'juguetes' | 'temporada';
}

export const GESTURE_CATEGORIES: { key: GestureOption['category']; title: string }[] = [
  { key: 'luz', title: 'Luz y afecto' },
  { key: 'flores', title: 'Flores' },
  { key: 'comida', title: 'Comida y mimos' },
  { key: 'juguetes', title: 'Juguetes y descanso' },
  { key: 'temporada', title: 'Temporada' },
];

export const GESTURE_OPTIONS: GestureOption[] = [
  // Luz y afecto
  { id: 'vela', label: 'Una vela', emoji: '🕯️', category: 'luz' },
  { id: 'corazon-rojo', label: 'Corazón rojo', emoji: '❤️', category: 'luz' },
  { id: 'corazon-blanco', label: 'Corazón blanco', emoji: '🤍', category: 'luz' },
  { id: 'abrazo', label: 'Un abrazo', emoji: '🫂', category: 'luz' },
  { id: 'farolito', label: 'Farolito', emoji: '🏮', category: 'luz' },
  { id: 'estrella', label: 'Estrella brillante', emoji: '🌟', category: 'luz' },
  { id: 'alas', label: 'Alas de ángel', emoji: '🪽', category: 'luz' },
  { id: 'origami', label: 'Pajarito en origami', emoji: '🕊️', category: 'luz' },
  { id: 'mariposa', label: 'Mariposa', emoji: '🦋', category: 'luz' },

  // Flores
  { id: 'girasol', label: 'Girasol', emoji: '🌻', category: 'flores' },
  { id: 'cartucho', label: 'Cartucho', emoji: '🤍', category: 'flores' },
  { id: 'lirio', label: 'Lirio', emoji: '🪷', category: 'flores' },
  { id: 'orquidea', label: 'Orquídea', emoji: '🌺', category: 'flores' },
  { id: 'rosas', label: 'Rosas', emoji: '🌹', category: 'flores' },
  { id: 'margaritas', label: 'Margaritas', emoji: '🌼', category: 'flores' },
  { id: 'tulipan', label: 'Tulipán', emoji: '🌷', category: 'flores' },

  // Comida y mimos
  { id: 'snack', label: 'Snack', emoji: '🦴', category: 'comida' },
  { id: 'zanahoria', label: 'Zanahoria', emoji: '🥕', category: 'comida' },
  { id: 'leche', label: 'Plato de leche', emoji: '🥛', category: 'comida' },
  { id: 'pastel', label: 'Pastel de cumpleaños', emoji: '🎂', category: 'comida' },
  { id: 'pollito', label: 'Pedacito de pollito', emoji: '🍗', category: 'comida' },

  // Juguetes y descanso
  { id: 'pelota', label: 'Pelota', emoji: '⚽', category: 'juguetes' },
  { id: 'ovillo', label: 'Ovillo de lana', emoji: '🧶', category: 'juguetes' },
  { id: 'peluche', label: 'Peluche', emoji: '🧸', category: 'juguetes' },
  { id: 'frisbee', label: 'Frisbee', emoji: '🥏', category: 'juguetes' },
  { id: 'cana', label: 'Caña con plumitas', emoji: '🪶', category: 'juguetes' },
  { id: 'caja', label: 'Caja de cartón', emoji: '📦', category: 'juguetes' },
  { id: 'dulce', label: 'Papel de dulce', emoji: '🍬', category: 'juguetes' },
  { id: 'palito', label: 'Palito', emoji: '🪵', category: 'juguetes' },
  { id: 'camita', label: 'Camita', emoji: '🛏️', category: 'juguetes' },
  { id: 'platico', label: 'Platico', emoji: '🥣', category: 'juguetes' },

  // Temporada
  { id: 'botica', label: 'Botica de Navidad', emoji: '🧦', category: 'temporada' },
  { id: 'arbol', label: 'Árbol de Navidad', emoji: '🎄', category: 'temporada' },
  { id: 'regalo', label: 'Regalo de Navidad', emoji: '🎁', category: 'temporada' },
];
