import React from 'react';
import { PLANT_LABELS } from '../data/initialData';
import { PlantType } from '../types/memorial';

interface PlantIllustrationProps {
  plant: PlantType;
  size?: number;
}

export const PlantIllustration: React.FC<PlantIllustrationProps> = ({ plant, size = 56 }) => {
  const info = PLANT_LABELS[plant];

  return (
    <div
      title={`${info.name} (${info.category}) — ${info.note}`}
      aria-label={`Planta elegida: ${info.name}`}
      style={{
        width: size,
        height: size,
        borderRadius: '14px',
        background: 'rgba(88, 111, 84, 0.1)',
        border: '1px solid rgba(88, 111, 84, 0.24)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {plant === 'olivo' && (
        <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path d="M24 41V18" stroke="#6b5341" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M24 27C19 24 15 20 14 15C19 15 23 18 24 23" fill="#6d8a60" />
          <path d="M24 23C29 20 33 16 34 11C29 11 25 14 24 19" fill="#7d9b6f" />
          <path d="M24 18C20 14 19 9 22 6C26 9 27 14 24 18Z" fill="#5e7c52" />
          <circle cx="19" cy="25" r="2.2" fill="#4f6343" />
          <circle cx="29" cy="20" r="2.2" fill="#4f6343" />
        </svg>
      )}
      {plant === 'cipres' && (
        <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path d="M24 42V34" stroke="#6b5341" strokeWidth="3" strokeLinecap="round" />
          <path d="M24 6C19 14 16 25 17 34H31C32 25 29 14 24 6Z" fill="#4c6b45" />
          <path d="M24 8C21 15 20 24 20.5 34H27.5C28 24 27 15 24 8Z" fill="#5b7d53" opacity="0.65" />
        </svg>
      )}
      {plant === 'cerezo' && (
        <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path d="M24 42V22M24 28L16 20M24 25L32 18" stroke="#6b5341" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="16" cy="18" r="6" fill="#f3c6cf" />
          <circle cx="25" cy="14" r="7" fill="#f7d6dc" />
          <circle cx="32" cy="19" r="5.5" fill="#efb8c3" />
          <circle cx="21" cy="21" r="5" fill="#f5ccd4" />
        </svg>
      )}
      {plant === 'guayacan' && (
        <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path d="M24 42V22M24 28L16 21M24 25L32 19" stroke="#6b5341" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="16" cy="18" r="6.5" fill="#ebc24b" />
          <circle cx="25" cy="13" r="7.5" fill="#f2cf63" />
          <circle cx="32" cy="19" r="6" fill="#e2b43b" />
          <circle cx="22" cy="21" r="5" fill="#f5d97b" />
        </svg>
      )}
      {plant === 'sauce' && (
        <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path d="M24 42V20" stroke="#6b5341" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M24 14C16 15 12 23 13 33M24 14C32 15 36 23 35 33M24 14C20 18 19 26 20 35M24 14C28 18 29 26 28 35" stroke="#688a58" strokeWidth="2.2" strokeLinecap="round" />
          <ellipse cx="24" cy="13" rx="9" ry="5" fill="#779a66" />
        </svg>
      )}
      {plant === 'lavanda' && (
        <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path d="M24 42V14M18 42L21 20M30 42L27 20" stroke="#5c7848" strokeWidth="2" strokeLinecap="round" />
          {[10, 14, 18, 22].map((y) => (
            <React.Fragment key={y}>
              <ellipse cx="24" cy={y} rx="3.2" ry="2.2" fill="#927ab0" />
              <ellipse cx="19.5" cy={y + 6} rx="2.4" ry="1.8" fill="#a28cc0" />
              <ellipse cx="28.5" cy={y + 6} rx="2.4" ry="1.8" fill="#a28cc0" />
            </React.Fragment>
          ))}
        </svg>
      )}
      {plant === 'helecho' && (
        <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path d="M24 41C24 30 18 18 11 13M24 41C24 27 24 15 24 8M24 41C24 30 30 18 37 13" stroke="#4d7a42" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M15 20L19 18M18 26L22 24M33 20L29 18M30 26L26 24M21 14L27 14M20 20L28 20" stroke="#649654" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
      {plant === 'suculenta' && (
        <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <ellipse cx="24" cy="30" rx="12" ry="6" fill="#6b967c" />
          <ellipse cx="17" cy="26" rx="6" ry="9" transform="rotate(-28 17 26)" fill="#7aa68b" />
          <ellipse cx="31" cy="26" rx="6" ry="9" transform="rotate(28 31 26)" fill="#7aa68b" />
          <ellipse cx="24" cy="22" rx="5.5" ry="9" fill="#8cb89c" />
          <circle cx="24" cy="24" r="3.2" fill="#a5ccb3" />
        </svg>
      )}
      {plant === 'jazmin' && (
        <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path d="M24 42V18" stroke="#587547" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M24 31C18 30 14 26 14 22C19 22 23 25 24 29" fill="#5c8249" />
          <path d="M24 28C30 27 34 23 34 19C29 19 25 22 24 26" fill="#6b9356" />
          {[0, 72, 144, 216, 288].map((deg) => (
            <ellipse
              key={deg}
              cx="24"
              cy="11"
              rx="2.8"
              ry="5.2"
              fill="#ffffff"
              stroke="#d9d2c5"
              strokeWidth="0.6"
              transform={`rotate(${deg} 24 16)`}
            />
          ))}
          <circle cx="24" cy="16" r="2.3" fill="#e8c766" />
        </svg>
      )}
      {plant === 'girasol' && (
        <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path d="M24 42V22" stroke="#5a7846" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M24 33C19 32 16 29 16 26C20 26 23 28 24 31" fill="#65884f" />
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
            <ellipse
              key={deg}
              cx="24"
              cy="9.5"
              rx="2.3"
              ry="5.5"
              fill="#e6b645"
              transform={`rotate(${deg} 24 17)`}
            />
          ))}
          <circle cx="24" cy="17" r="5" fill="#5c4028" />
        </svg>
      )}
      {plant === 'lirio' && (
        <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path d="M24 42V22" stroke="#587547" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M24 34C18 32 15 28 15 24C20 24 23 27 24 32" fill="#5e834c" />
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <ellipse
              key={deg}
              cx="24"
              cy="10.5"
              rx="3.2"
              ry="6.5"
              fill="#ffffff"
              stroke="#dcd4c6"
              strokeWidth="0.6"
              transform={`rotate(${deg} 24 17)`}
            />
          ))}
          <circle cx="24" cy="17" r="2.6" fill="#f0ca59" />
        </svg>
      )}
      {plant === 'orquidea' && (
        <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path d="M24 42V20" stroke="#587547" strokeWidth="2.2" strokeLinecap="round" />
          <ellipse cx="17" cy="16" rx="5" ry="4" fill="#d7a4c4" />
          <ellipse cx="31" cy="16" rx="5" ry="4" fill="#d7a4c4" />
          <ellipse cx="24" cy="11" rx="4.5" ry="5" fill="#e5bdd7" />
          <ellipse cx="24" cy="21" rx="4" ry="4.5" fill="#b978a1" />
          <circle cx="24" cy="17" r="2.2" fill="#f3d678" />
        </svg>
      )}
      {plant === 'rosal' && (
        <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path d="M24 42V22" stroke="#527344" strokeWidth="2.3" strokeLinecap="round" />
          <path d="M24 32C18 31 15 27 16 24C20 24 23 27 24 30" fill="#5e824d" />
          <circle cx="24" cy="16" r="7.5" fill="#d97b84" />
          <circle cx="24" cy="16" r="5" fill="#c7656f" />
          <circle cx="24" cy="15.5" r="2.6" fill="#b3525c" />
        </svg>
      )}
    </div>
  );
};
