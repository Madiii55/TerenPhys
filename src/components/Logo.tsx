import React from 'react';
import { useLanguage } from '../i18n/LanguageContext.tsx';

interface LogoProps {
  onClick?: () => void;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ onClick, className = '' }) => {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      aria-label={t("На главную")}
      data-einstein="navigate-home"
      onClick={onClick}
      className={`site-home-logo flex items-center cursor-pointer select-none ${className}`}
      title={t("TerenPhys - На главную")}
    >
      <svg
        className="h-8 sm:h-10 w-auto"
        viewBox="0 0 240 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="teren-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>

        {/* ============================================================ */}
        {/* FEYNMAN DIAGRAM ICON (Exact match to uploaded logo image)     */}
        {/* ============================================================ */}
        <g id="feynman-diagram" transform="translate(4, 0)">
          {/* Top outgoing branches (Dark Navy Blue #1e3a8a) */}
          <line
            x1="22"
            y1="23"
            x2="5"
            y2="7"
            stroke="#1e3a8a"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          {/* Arrowhead top-left */}
          <polygon points="3,5 11,6 7,12" fill="#1e3a8a" />

          <line
            x1="22"
            y1="23"
            x2="39"
            y2="7"
            stroke="#1e3a8a"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          {/* Arrowhead top-right */}
          <polygon points="41,5 33,6 37,12" fill="#1e3a8a" />

          {/* Top interaction vertex */}
          <circle cx="22" cy="23" r="3.2" fill="#1e3a8a" />

          {/* Vertical Wavy Photon Propagator Line (Cyan-Blue #0284c7) */}
          <path
            d="M 22 23 C 18 25, 18 27, 22 29 C 26 31, 26 33, 22 35"
            stroke="#0284c7"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />

          {/* Bottom interaction vertex */}
          <circle cx="22" cy="35" r="3.2" fill="#0284c7" />

          {/* Bottom incoming branches (Light Cyan-Blue #0284c7 / #38bdf8) */}
          <line
            x1="22"
            y1="35"
            x2="5"
            y2="51"
            stroke="#0284c7"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          {/* Arrowhead bottom-left */}
          <polygon points="3,53 11,52 7,46" fill="#0284c7" />

          <line
            x1="22"
            y1="35"
            x2="39"
            y2="51"
            stroke="#0284c7"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          {/* Arrowhead bottom-right */}
          <polygon points="41,53 33,52 37,46" fill="#0284c7" />
        </g>

        {/* ============================================================ */}
        {/* TEXT "Teren"                                                 */}
        {/* ============================================================ */}
        <text
          x="54"
          y="37"
          fontFamily="Inter, system-ui, -apple-system, sans-serif"
          fontSize="30"
          fontWeight="400"
          fill="url(#teren-gradient)"
          letterSpacing="-0.5px"
        >
          Teren
        </text>

        {/* ============================================================ */}
        {/* PHYSICS 'p' (Vertical double-arrow stem + wavy loop)          */}
        {/* ============================================================ */}
        <g id="physics-p" transform="translate(142, 0)">
          {/* Vertical stem line */}
          <line
            x1="8"
            y1="10"
            x2="8"
            y2="48"
            stroke="#475569"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          {/* Arrowhead top (pointing up) */}
          <polygon points="8,7 4,14 12,14" fill="#475569" />
          {/* Arrowhead bottom (pointing down) */}
          <polygon points="8,51 4,44 12,44" fill="#475569" />

          {/* Wavy semicircle loop forming the head of the 'p' */}
          <path
            d="M 8 18 
               C 12 17, 14 19, 16 19 
               C 18 19, 21 21, 21 24 
               C 21 27, 19 28, 18 30 
               C 16 32, 13 34, 11 35
               L 8 36"
            stroke="#475569"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />
          {/* Subtle wavy scallops for boson loop */}
          <path
            d="M 8 19 Q 12 18, 14 20 Q 17 21, 19 24 Q 19 28, 16 31 Q 13 33, 8 35"
            stroke="#475569"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        </g>

        {/* ============================================================ */}
        {/* TEXT "hys"                                                   */}
        {/* ============================================================ */}
        <text
          x="166"
          y="37"
          fontFamily="Inter, system-ui, -apple-system, sans-serif"
          fontSize="30"
          fontWeight="400"
          fill="#475569"
          letterSpacing="-0.5px"
        >
          hys
        </text>
      </svg>
    </button>
  );
};
