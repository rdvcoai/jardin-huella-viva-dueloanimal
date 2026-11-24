import { jsPDF } from 'jspdf';
import { BookPhoto, Memorial, MemoryBook } from '../types/memorial';

function getImageDimensions(
  aspectRatio: number,
  maxWidth: number,
  maxHeight: number
): { w: number; h: number } {
  const safeRatio = aspectRatio > 0 ? aspectRatio : 1;
  let w = maxWidth;
  let h = w / safeRatio;
  if (h > maxHeight) {
    h = maxHeight;
    w = h * safeRatio;
  }
  return { w, h };
}

export function exportBookToPdf(book: MemoryBook, memorialName?: string, usePublished = false): void {
  const source = usePublished && book.publishedSnapshot ? book.publishedSnapshot : book;
  const cover = source.cover || {
    title: book.title,
    animalName: memorialName || '',
    authorName: '',
  };

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 22;
  const contentWidth = pageWidth - margin * 2;
  let y = 30;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 22) {
      doc.addPage();
      y = 26;
    }
  };

  // --- COVER PAGE ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(64, 130, 130); // Subtle turquoise #64caca tone for print
  doc.text('Duelo Animal · Nuestro libro', pageWidth / 2, 28, { align: 'center' });

  y = 48;
  doc.setFont('times', 'bold');
  doc.setFontSize(23);
  doc.setTextColor(51, 39, 30);
  const titleLines = doc.splitTextToSize(cover.title || book.title, contentWidth);
  doc.text(titleLines, pageWidth / 2, y, { align: 'center' });
  y += titleLines.length * 9 + 6;

  if (cover.animalName) {
    doc.setFont('times', 'italic');
    doc.setFontSize(16);
    doc.setTextColor(88, 111, 84);
    doc.text(cover.animalName, pageWidth / 2, y, { align: 'center' });
    y += 9;
  }

  if (cover.dates) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(111, 95, 82);
    doc.text(cover.dates, pageWidth / 2, y, { align: 'center' });
    y += 10;
  }

  if (cover.photoUrl && cover.photoUrl.startsWith('data:image/')) {
    try {
      const { w, h } = getImageDimensions(1.1, 86, 86);
      const fmt = cover.photoUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(cover.photoUrl, fmt, (pageWidth - w) / 2, y + 4, w, h);
      y += h + 14;
    } catch {
      // ignore invalid cover image
    }
  }

  if (cover.authorName) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(90, 78, 66);
    doc.text(`Escrito por ${cover.authorName}`, pageWidth / 2, pageHeight - 44, {
      align: 'center',
    });
  }

  doc.setFontSize(9.5);
  doc.setTextColor(125, 115, 105);
  doc.text(
    'Archivo descargado en tu dispositivo. Su lectura no depende de la disponibilidad futura del sitio web.',
    pageWidth / 2,
    pageHeight - 24,
    { align: 'center', maxWidth: contentWidth }
  );

  // --- OPENING NOTE (OPTIONAL) ---
  if (source.openingNote?.trim()) {
    doc.addPage();
    y = 32;
    doc.setFont('times', 'italic');
    doc.setFontSize(15);
    doc.setTextColor(88, 111, 84);
    doc.text('Apertura', margin, y);
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(51, 39, 30);
    const openLines = doc.splitTextToSize(source.openingNote.trim(), contentWidth);
    for (const line of openLines) {
      ensureSpace(7);
      doc.text(line, margin, y);
      y += 6.5;
    }
  }

  // --- CHAPTERS (OMIT EMPTY SECTIONS) ---
  const maxPhotoW = source.template === 'album' ? 120 : 88;
  const maxPhotoH = source.template === 'album' ? 105 : 78;

  for (const chapter of source.chapters) {
    if (chapter.isVoiceChapter) {
      const approvedVoices = (book.voiceContributions || []).filter((v) => v.status === 'aprobado');
      if (approvedVoices.length === 0) continue;

      doc.addPage();
      y = 28;
      doc.setFont('times', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(51, 39, 30);
      doc.text(chapter.title, margin, y);
      y += 12;

      for (const v of approvedVoices) {
        ensureSpace(22);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(88, 111, 84);
        doc.text(`${v.author} (${v.relation})`, margin, y);
        y += 6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(51, 39, 30);
        const vLines = doc.splitTextToSize(v.text, contentWidth);
        for (const line of vLines) {
          ensureSpace(7);
          doc.text(line, margin, y);
          y += 6.2;
        }
        y += 6;
      }
      continue;
    }

    const nonEmptyPages = chapter.pages.filter((p) => {
      const hasPhotos = (p.photos && p.photos.length > 0) || Boolean(p.photoUrl);
      return p.content.trim().length > 0 || hasPhotos || p.isOpenPage;
    });

    if (nonEmptyPages.length === 0) continue;

    doc.addPage();
    y = 28;

    doc.setFont('times', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(51, 39, 30);
    const chLines = doc.splitTextToSize(chapter.title, contentWidth);
    doc.text(chLines, margin, y);
    y += chLines.length * 8 + 6;

    for (const page of nonEmptyPages) {
      ensureSpace(26);

      if (page.title.trim()) {
        doc.setFont('times', 'italic');
        doc.setFontSize(13);
        doc.setTextColor(88, 111, 84);
        doc.text(page.title, margin, y);
        y += 7;
      }

      // Render photos preserving aspect ratio (both vertical & horizontal)
      const photosToRender: BookPhoto[] =
        page.photos && page.photos.length > 0
          ? page.photos
          : page.photoUrl
            ? [
                {
                  id: 'legacy',
                  dataUrl: page.photoUrl,
                  caption: page.caption || '',
                  altText: page.title,
                  framing: 'center',
                  aspectRatio: 1.25,
                },
              ]
            : [];

      for (const ph of photosToRender) {
        if (!ph.dataUrl.startsWith('data:image/')) continue;
        const { w, h } = getImageDimensions(ph.aspectRatio, maxPhotoW, maxPhotoH);
        ensureSpace(h + (ph.caption ? 12 : 6));
        try {
          const fmt = ph.dataUrl.includes('image/png') ? 'PNG' : 'JPEG';
          doc.addImage(ph.dataUrl, fmt, margin, y, w, h);
          y += h + 4;
          if (ph.caption) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(9.5);
            doc.setTextColor(111, 95, 82);
            const capLines = doc.splitTextToSize(ph.caption, contentWidth);
            doc.text(capLines, margin, y);
            y += capLines.length * 5 + 3;
          }
        } catch {
          // skip invalid image safely
        }
      }

      if (page.content.trim()) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(51, 39, 30);
        const lines = doc.splitTextToSize(page.content.trim(), contentWidth);
        for (const line of lines) {
          ensureSpace(7);
          doc.text(line, margin, y);
          y += 6.2;
        }
      } else if (page.isOpenPage) {
        doc.setFont('times', 'italic');
        doc.setFontSize(11);
        doc.setTextColor(130, 118, 106);
        doc.text('Página abierta para futuros recuerdos.', margin, y);
        y += 8;
      }

      y += 8;
    }
  }

  // --- CLOSING NOTE (OPTIONAL) ---
  if (source.closingNote?.trim()) {
    doc.addPage();
    y = 32;
    doc.setFont('times', 'italic');
    doc.setFontSize(15);
    doc.setTextColor(88, 111, 84);
    doc.text('Cierre', margin, y);
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(51, 39, 30);
    const closeLines = doc.splitTextToSize(source.closingNote.trim(), contentWidth);
    for (const line of closeLines) {
      ensureSpace(7);
      doc.text(line, margin, y);
      y += 6.5;
    }
  }

  const baseName = (cover.animalName || cover.title || 'nuestro-libro')
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñ]+/gi, '-')
    .replace(/^-|-$/g, '');
  doc.save(`nuestra-historia-${baseName || 'libro'}.pdf`);
}

export function exportBookTextBackup(book: MemoryBook): void {
  const payload = JSON.stringify(book, null, 2);
  const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (book.cover?.animalName || book.title || 'libro')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-');
  a.href = url;
  a.download = `respaldo-${safeName}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportBriefStoryToPdf(memorial: Memorial): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 22;
  const contentWidth = doc.internal.pageSize.getWidth() - margin * 2;
  let y = 32;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(64, 130, 130);
  doc.text('Duelo Animal · Mi primera historia (descarga gratuita)', margin, y);
  y += 14;

  doc.setFont('times', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(51, 39, 30);
  doc.text(memorial.name, margin, y);
  y += 8;

  if (memorial.dates) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(111, 95, 82);
    doc.text(memorial.dates, margin, y);
    y += 10;
  }

  doc.setFont('times', 'italic');
  doc.setFontSize(13);
  doc.setTextColor(88, 111, 84);
  const phraseLines = doc.splitTextToSize(`“${memorial.phrase}”`, contentWidth);
  doc.text(phraseLines, margin, y);
  y += phraseLines.length * 7 + 8;

  if (memorial.lifeMoments.length > 0) {
    const first = memorial.lifeMoments[0];
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(51, 39, 30);
    doc.text(first.title, margin, y);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const bodyLines = doc.splitTextToSize(first.text, contentWidth);
    doc.text(bodyLines, margin, y);
  }

  const safeName = memorial.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-');
  doc.save(`mi-primera-historia-${safeName}.pdf`);
}
