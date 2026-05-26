import React from 'react';
import { TOKENS } from './tokens';

interface LogoProps {
  size?: number;
  dim?: boolean;
}

/**
 * Coral-orange AppMaker mark + wordmark. The "A" glyph is custom
 * to match the design — not the React Devs icon.
 */
const Logo: React.FC<LogoProps> = ({ size = 22, dim = false }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        background: 'linear-gradient(135deg, #FF6A3D 0%, #FF8A5C 100%)',
        display: 'grid',
        placeItems: 'center',
        boxShadow: '0 4px 12px rgba(255,106,61,0.35), inset 0 0 0 1px rgba(255,255,255,0.18)',
      }}
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
        <path
          d="M5 19L11 5h2l6 14h-3l-1.3-3.2H9.3L8 19H5z M10 13.5h4L12 8.5l-2 5z"
          fill="#0B0B0E"
        />
      </svg>
    </div>
    <span
      style={{
        fontFamily: TOKENS.sans,
        fontSize: 15,
        fontWeight: 600,
        color: dim ? TOKENS.text2 : TOKENS.text1,
        letterSpacing: '-0.01em',
      }}
    >
      AppMaker
    </span>
  </div>
);

export default Logo;
