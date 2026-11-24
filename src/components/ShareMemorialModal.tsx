import React, { useEffect, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import { Check, Copy, Download, MessageCircle, Share2, X } from 'lucide-react';
import { Memorial } from '../types/memorial';
import { getCountryFlag } from '../utils/countryFlag';

interface ShareMemorialModalProps {
  memorial: Memorial;
  onClose: () => void;
}

type ShareFormat = 'story' | 'post' | 'desktop';

const FORMAT_DIMS: Record<ShareFormat, { w: number; h: number; label: string }> = {
  story: { w: 1080, h: 1920, label: 'Historia / Reel / TikTok (9:16)' },
  post: { w: 1080, h: 1350, label: 'Post de Instagram (4:5)' },
  desktop: { w: 1920, h: 1080, label: 'Panorámica para PC (16:9)' },
};

export const ShareMemorialModal: React.FC<ShareMemorialModalProps> = ({ memorial, onClose }) => {
  const [format, setFormat] = useState<ShareFormat>('story');
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const candleTotal = memorial.candleCount ?? (memorial.lightLeftByUser ? 1 : 0);
  const flag = getCountryFlag(memorial.country);

  const shareUrl = `${window.location.origin}/?rincon=${encodeURIComponent(memorial.id)}`;
  const whatsappText = `En memoria de ${memorial.name}. Entra a su altar en DueloAnimal.co y enciende una vela en su honor: ${shareUrl}`;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = FORMAT_DIMS[format];
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawCard = (img?: HTMLImageElement) => {
      // Soft cream-to-warm-sage gradient
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#fbf8f2');
      grad.addColorStop(0.6, '#f4ede1');
      grad.addColorStop(1, '#e8efe9');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Subtle golden pawprints pattern
      ctx.fillStyle = 'rgba(201, 154, 73, 0.14)';
      for (let i = 0; i < 18; i++) {
        const px = ((i * 211) % (w - 120)) + 60;
        const py = ((i * 317) % (h - 120)) + 60;
        ctx.beginPath();
        ctx.arc(px, py, 14, 0, Math.PI * 2);
        ctx.fill();
        [-14, -5, 5, 14].forEach((dx, j) => {
          ctx.beginPath();
          ctx.arc(px + dx, py - 18 - (j === 1 || j === 2 ? 4 : 0), 5, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Turquoise #64caca border frame
      ctx.strokeStyle = '#64caca';
      ctx.lineWidth = 8;
      ctx.strokeRect(36, 36, w - 72, h - 72);

      const isWide = format === 'desktop';
      const centerX = isWide ? w * 0.3 : w / 2;
      const photoSize = isWide ? 480 : format === 'story' ? 560 : 480;
      const photoY = isWide ? (h - photoSize) / 2 : format === 'story' ? 320 : 210;

      // Photo frame
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(centerX - photoSize / 2 - 18, photoY - 18, photoSize + 36, photoSize + 36);
      ctx.strokeStyle = '#d4b886';
      ctx.lineWidth = 4;
      ctx.strokeRect(centerX - photoSize / 2 - 18, photoY - 18, photoSize + 36, photoSize + 36);

      if (img) {
        const scale = Math.max(photoSize / img.width, photoSize / img.height);
        const iw = img.width * scale;
        const ih = img.height * scale;
        ctx.beginPath();
        ctx.rect(centerX - photoSize / 2, photoY, photoSize, photoSize);
        ctx.clip();
        ctx.drawImage(img, centerX - iw / 2, photoY + (photoSize - ih) / 2, iw, ih);
      } else {
        ctx.fillStyle = '#efe6d8';
        ctx.fillRect(centerX - photoSize / 2, photoY, photoSize, photoSize);
        ctx.fillStyle = '#5c4b3d';
        ctx.font = 'italic 160px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(memorial.name.charAt(0).toUpperCase(), centerX, photoY + photoSize / 2);
      }
      ctx.restore();

      // Text block
      const textX = isWide ? w * 0.68 : w / 2;
      let textY = isWide ? h * 0.34 : photoY + photoSize + 115;

      ctx.fillStyle = '#2f7d7d';
      ctx.font = '600 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('EN MEMORIA DE', textX, textY);
      textY += 74;

      ctx.fillStyle = '#33271e';
      ctx.font = '600 74px Georgia, serif';
      ctx.fillText(`${memorial.name} ${flag}`, textX, textY);
      textY += 56;

      if (memorial.dates) {
        ctx.fillStyle = '#6f5f52';
        ctx.font = '32px sans-serif';
        ctx.fillText(memorial.dates, textX, textY);
        textY += 54;
      }

      ctx.fillStyle = '#b86f46';
      ctx.font = '600 36px sans-serif';
      ctx.fillText(`🕯️ ${candleTotal} ${candleTotal === 1 ? 'velita encendida' : 'velitas encendidas'} en su honor`, textX, textY + 12);
      textY += 96;

      ctx.fillStyle = '#4a3b2f';
      ctx.font = 'italic 34px Georgia, serif';
      ctx.fillText('Entra a su altar en DueloAnimal.co', textX, textY);
      ctx.fillText('y enciende una vela por su recuerdo.', textX, textY + 46);
    };

    if (memorial.photoUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => drawCard(img);
      img.onerror = () => drawCard();
      img.src = memorial.photoUrl;
    } else {
      drawCard();
    }
  }, [format, memorial, candleTotal, flag]);

  const handleDownloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `en-memoria-de-${memorial.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}-${format}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleDownloadPdf = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = FORMAT_DIMS[format];
    const orientation = w > h ? 'landscape' : 'portrait';
    const doc = new jsPDF({ orientation, unit: 'px', format: [w, h] });
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);
    doc.save(`en-memoria-de-${memorial.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.pdf`);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        className="glass-panel modal-card custom-scroll animate-gentle-in"
        style={{ maxWidth: '640px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <h2 id="share-title" className="font-serif-editorial" style={{ fontSize: '1.8rem', fontWeight: 500, margin: 0 }}>
            Compartir el memorial de {memorial.name}
          </h2>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {/* Format Selector */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '1rem' }}>
          {(Object.keys(FORMAT_DIMS) as ShareFormat[]).map((key) => (
            <button
              key={key}
              className={format === key ? 'btn-primary' : 'btn-secondary'}
              style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem' }}
              onClick={() => setFormat(key)}
            >
              {FORMAT_DIMS[key].label}
            </button>
          ))}
        </div>

        {/* Canvas Preview */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', background: '#efe9de', padding: '0.75rem', borderRadius: '14px' }}>
          <canvas
            ref={canvasRef}
            style={{
              maxWidth: '100%',
              maxHeight: '340px',
              width: 'auto',
              height: 'auto',
              borderRadius: '10px',
              boxShadow: '0 8px 24px rgba(45, 32, 20, 0.14)',
            }}
          />
        </div>

        {/* Share & Download Actions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button className="btn-primary" onClick={handleDownloadImage}>
            <Download size={15} />
            Descargar imagen
          </button>
          <button className="btn-secondary" onClick={handleDownloadPdf}>
            <Share2 size={15} />
            Descargar PDF
          </button>
          <button className="btn-secondary" onClick={handleCopyLink}>
            {copied ? <Check size={15} color="#586f54" /> : <Copy size={15} />}
            {copied ? 'Enlace copiado' : 'Copiar enlace'}
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ textDecoration: 'none' }}
          >
            <MessageCircle size={15} color="#2f7d7d" />
            Enviar por WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
};
