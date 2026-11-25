/**
 * Valida formato y tamaño, genera una copia optimizada en formato WebP
 * y elimina metadatos EXIF (incluida ubicación) al re-dibujar en canvas
 * conservando la proporción original sin recortar rostros.
 */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface ProcessedImage {
  dataUrl: string;
  blob: Blob;
  aspectRatio: number;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header?.match(/data:([^;]+);base64/);
  const mime = mimeMatch?.[1] || 'image/webp';
  const binary = atob(base64 || '');
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export function processAndStripImage(file: File): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      reject(new Error('Formato no compatible. Usa JPG, PNG o WebP.'));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error('La imagen supera el límite de 4 MB.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Archivo de imagen inválido.'));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo procesar la imagen.'));
      img.onload = () => {
        const maxDim = 1280;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        const aspectRatio = w > 0 && h > 0 ? w / h : 1;

        if (w > maxDim || h > maxDim) {
          if (w >= h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const fallbackUrl = reader.result as string;
          resolve({ dataUrl: fallbackUrl, blob: dataUrlToBlob(fallbackUrl), aspectRatio });
          return;
        }

        // Re-drawing onto canvas strips EXIF/GPS metadata while preserving aspect ratio
        ctx.drawImage(img, 0, 0, w, h);
        const webpDataUrl = canvas.toDataURL('image/webp', 0.82);
        const finalUrl = webpDataUrl.startsWith('data:image/webp')
          ? webpDataUrl
          : canvas.toDataURL('image/jpeg', 0.84);
        resolve({
          dataUrl: finalUrl,
          blob: dataUrlToBlob(finalUrl),
          aspectRatio,
        });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
