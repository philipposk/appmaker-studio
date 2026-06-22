import React from 'react';
import { TOKENS } from './tokens';

interface LogoProps {
  size?: number;
  dim?: boolean;
}

/**
 * Vibecoders Studio mark + wordmark. Teal gradient tile with a custom "V" glyph.
 */
const Logo: React.FC<LogoProps> = ({ size = 22, dim = false }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        background: 'linear-gradient(135deg, #14B8A6 0%, #5EEAD4 100%)',
        display: 'grid',
        placeItems: 'center',
        boxShadow: '0 4px 12px rgba(20,184,166,0.35), inset 0 0 0 1px rgba(255,255,255,0.18)',
      }}
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
        <path d="M4 5h3.4l4.6 10.3L16.6 5H20l-6.7 14h-2.6L4 5z" fill="#0B0B0E" />
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
      Vibecoders<span style={{ color: TOKENS.accent, fontWeight: 500 }}>&nbsp;Studio</span>
    </span>
  </div>
);

export default Logo;
