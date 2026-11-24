const COUNTRY_FLAGS: Record<string, string> = {
  colombia: '🇨🇴',
  méxico: '🇲🇽',
  mexico: '🇲🇽',
  argentina: '🇦🇷',
  chile: '🇨🇱',
  perú: '🇵🇪',
  peru: '🇵🇪',
  ecuador: '🇪🇨',
  españa: '🇪🇸',
  espana: '🇪🇸',
  venezuela: '🇻🇪',
  uruguay: '🇺🇾',
  paraguay: '🇵🇾',
  bolivia: '🇧🇴',
  costa: '🇨🇷',
  'costa rica': '🇨🇷',
  panamá: '🇵🇦',
  panama: '🇵🇦',
  guatemala: '🇬🇹',
  estados: '🇺🇸',
  'estados unidos': '🇺🇸',
  usa: '🇺🇸',
  canadá: '🇨🇦',
  canada: '🇨🇦',
  brasil: '🇧🇷',
  francia: '🇫🇷',
  italia: '🇮🇹',
  alemania: '🇩🇪',
  reino: '🇬🇧',
  'reino unido': '🇬🇧',
};

export function getCountryFlag(country?: string): string {
  if (!country) return '🌍';
  const normalized = country.trim().toLowerCase();
  if (COUNTRY_FLAGS[normalized]) return COUNTRY_FLAGS[normalized];
  for (const [key, flag] of Object.entries(COUNTRY_FLAGS)) {
    if (normalized.includes(key)) return flag;
  }
  return '🌍';
}

/**
 * Dibuja una bandera nítida en Canvas 2D (evita que Windows oculte o simplifique emojis de banderas).
 */
export function drawCountryFlagOnCanvas(
  ctx: CanvasRenderingContext2D,
  country: string | undefined,
  x: number,
  y: number,
  w = 28,
  h = 18
): void {
  const c = (country || '').trim().toLowerCase();

  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;

  if (c.includes('colombia') || c.includes('ecuador')) {
    ctx.fillStyle = '#FCD116';
    ctx.fillRect(x, y, w, h * 0.5);
    ctx.fillStyle = '#003893';
    ctx.fillRect(x, y + h * 0.5, w, h * 0.25);
    ctx.fillStyle = '#CE1126';
    ctx.fillRect(x, y + h * 0.75, w, h * 0.25);
  } else if (c.includes('méxico') || c.includes('mexico')) {
    ctx.fillStyle = '#006847';
    ctx.fillRect(x, y, w / 3, h);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x + w / 3, y, w / 3, h);
    ctx.fillStyle = '#CE1126';
    ctx.fillRect(x + (w * 2) / 3, y, w / 3, h);
    ctx.fillStyle = '#7A542E';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (c.includes('argentina')) {
    ctx.fillStyle = '#74ACDF';
    ctx.fillRect(x, y, w, h / 3);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y + h / 3, w, h / 3);
    ctx.fillStyle = '#74ACDF';
    ctx.fillRect(x, y + (h * 2) / 3, w, h / 3);
    ctx.fillStyle = '#F6B40E';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (c.includes('españa') || c.includes('espana')) {
    ctx.fillStyle = '#AA151B';
    ctx.fillRect(x, y, w, h * 0.25);
    ctx.fillStyle = '#F1BF00';
    ctx.fillRect(x, y + h * 0.25, w, h * 0.5);
    ctx.fillStyle = '#AA151B';
    ctx.fillRect(x, y + h * 0.75, w, h * 0.25);
  } else if (c.includes('chile')) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, w, h / 2);
    ctx.fillStyle = '#D52B1E';
    ctx.fillRect(x, y + h / 2, w, h / 2);
    ctx.fillStyle = '#0039A6';
    ctx.fillRect(x, y, w * 0.36, h / 2);
  } else if (c.includes('perú') || c.includes('peru')) {
    ctx.fillStyle = '#D91023';
    ctx.fillRect(x, y, w / 3, h);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x + w / 3, y, w / 3, h);
    ctx.fillStyle = '#D91023';
    ctx.fillRect(x + (w * 2) / 3, y, w / 3, h);
  } else if (c.includes('usa') || c.includes('estados') || c.includes('united states')) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#B22234';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x, y + i * (h / 3.5), w, h / 7);
    }
    ctx.fillStyle = '#3C3B6E';
    ctx.fillRect(x, y, w * 0.45, h * 0.55);
  } else if (c.includes('alemania') || c.includes('germany')) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, w, h / 3);
    ctx.fillStyle = '#DD0000';
    ctx.fillRect(x, y + h / 3, w, h / 3);
    ctx.fillStyle = '#FFCE00';
    ctx.fillRect(x, y + (h * 2) / 3, w, h / 3);
  } else if (c.includes('brasil') || c.includes('brazil')) {
    ctx.fillStyle = '#009C3B';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#FFDF00';
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + 2);
    ctx.lineTo(x + w - 3, y + h / 2);
    ctx.lineTo(x + w / 2, y + h - 2);
    ctx.lineTo(x + 3, y + h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#002776';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 3.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (c.includes('francia') || c.includes('france')) {
    ctx.fillStyle = '#0055A4';
    ctx.fillRect(x, y, w / 3, h);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x + w / 3, y, w / 3, h);
    ctx.fillStyle = '#EF4135';
    ctx.fillRect(x + (w * 2) / 3, y, w / 3, h);
  } else {
    // Fallback soft turquoise globe badge
    ctx.fillStyle = '#64caca';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c ? c.slice(0, 2).toUpperCase() : 'CO', x + w / 2, y + h / 2);
  }

  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}
