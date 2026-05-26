import React from 'react';
import { TOKENS } from './tokens';

export type PillKind = 'default' | 'live' | 'draft' | 'building' | 'accent';

interface PillProps {
  kind?: PillKind;
  dot?: boolean;
  children: React.ReactNode;
}

const PALETTE: Record<PillKind, { bg: string; fg: string; dot: string }> = {
  default: { bg: TOKENS.panel2, fg: TOKENS.text2, dot: TOKENS.text3 },
  live: { bg: 'rgba(74,222,128,0.12)', fg: TOKENS.green, dot: TOKENS.green },
  draft: { bg: TOKENS.panel2, fg: TOKENS.text2, dot: TOKENS.amber },
  building: { bg: 'rgba(245,182,71,0.12)', fg: TOKENS.amber, dot: TOKENS.amber },
  accent: { bg: TOKENS.accentSoft, fg: TOKENS.accent, dot: TOKENS.accent },
};

const Pill: React.FC<PillProps> = ({ kind = 'default', dot, children }) => {
  const colors = PALETTE[kind];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 8px 3px 7px',
        borderRadius: 999,
        background: colors.bg,
        color: colors.fg,
        fontFamily: TOKENS.sans,
        fontSize: 11.5,
        fontWeight: 500,
        lineHeight: 1.2,
      }}
    >
      {dot !== false && (
        <span style={{ width: 6, height: 6, borderRadius: 99, background: colors.dot }} />
      )}
      {children}
    </span>
  );
};

export default Pill;
