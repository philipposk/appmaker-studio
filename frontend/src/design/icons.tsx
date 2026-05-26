import React from 'react';

/**
 * Inline SVG icon set, ported from the design mockup.
 *
 * Two layers:
 *   - `Icon` — primitive that handles size, stroke, viewBox, color.
 *   - `I.*`  — named icons that wrap `Icon` with specific paths.
 *
 * No external icon dependency on purpose: keeps the bundle small and
 * ensures the icons match the mockup exactly. Replace with lucide /
 * radix-icons if you want a bigger set later.
 */

export interface IconProps {
  size?: number;
  stroke?: number;
  fill?: string;
  style?: React.CSSProperties;
  d?: string;
  children?: React.ReactNode;
}

export const Icon: React.FC<IconProps> = ({ d, size = 16, stroke = 1.6, fill = 'none', children, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0, ...style }}
  >
    {d ? <path d={d} /> : children}
  </svg>
);

type Named = React.FC<IconProps>;

export const I: Record<string, Named> = {
  Sparkle: (p) => (
    <Icon {...p}>
      <path d="M12 3l1.5 5L19 9.5 13.5 11 12 16l-1.5-5L5 9.5 10.5 8z" />
      <path d="M19 16l.7 2 2 .7-2 .7L19 22l-.7-2-2-.7 2-.7z" />
    </Icon>
  ),
  Plus: (p) => <Icon {...p} d="M12 5v14M5 12h14" />,
  Folder: (p) => <Icon {...p} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />,
  Grid: (p) => (
    <Icon {...p}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Icon>
  ),
  Settings: (p) => (
    <Icon {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5h0a1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </Icon>
  ),
  Book: (p) => (
    <Icon {...p}>
      <path d="M4 5a2 2 0 012-2h13v15H6a2 2 0 00-2 2V5z" />
      <path d="M4 19a2 2 0 002 2h13" />
    </Icon>
  ),
  Search: (p) => (
    <Icon {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </Icon>
  ),
  Arrow: (p) => <Icon {...p} d="M5 12h14M13 6l6 6-6 6" />,
  ArrowUp: (p) => <Icon {...p} d="M12 19V5M6 11l6-6 6 6" />,
  Paperclip: (p) => <Icon {...p} d="M21 12.5L12.5 21a5.5 5.5 0 01-7.8-7.8l9-9a3.7 3.7 0 015.2 5.2l-9 9a1.8 1.8 0 01-2.6-2.6l8.3-8.3" />,
  Bolt: (p) => <Icon {...p} fill="currentColor" stroke={undefined as any} d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />,
  Globe: (p) => (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
    </Icon>
  ),
  Lock: (p) => (
    <Icon {...p}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 118 0v4" />
    </Icon>
  ),
  Code: (p) => <Icon {...p} d="M16 18l6-6-6-6M8 6l-6 6 6 6" />,
  Eye: (p) => (
    <Icon {...p}>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  ),
  Check: (p) => <Icon {...p} d="M20 6L9 17l-5-5" />,
  Play: (p) => <Icon {...p} fill="currentColor" d="M6 4l14 8-14 8V4z" />,
  Rocket: (p) => (
    <Icon {...p}>
      <path d="M14 4l6 6-7 7-3-3 7-7-3-3z" />
      <path d="M9 15l-2 5 5-2" />
      <path d="M14 10l-7 7" />
    </Icon>
  ),
  Cube: (p) => (
    <Icon {...p}>
      <path d="M12 2l9 5v10l-9 5-9-5V7l9-5z" />
      <path d="M3 7l9 5 9-5M12 22V12" />
    </Icon>
  ),
  Stack: (p) => <Icon {...p} d="M12 3L2 8l10 5 10-5-10-5zM2 13l10 5 10-5M2 18l10 5 10-5" />,
  Wand: (p) => <Icon {...p} d="M15 4V2M15 10V8M11 6h2M17 6h2M9 12L3 18l3 3 6-6M14 7l3 3" />,
  Chat: (p) => (
    <Icon {...p}>
      <path d="M21 12a8 8 0 11-16 0c0-4.4 3.6-8 8-8a8 8 0 018 8z" />
      <path d="M5 19l-2 2 4-1" />
    </Icon>
  ),
  More: (p) => (
    <Icon {...p}>
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="19" cy="12" r="1.2" />
    </Icon>
  ),
  Branch: (p) => (
    <Icon {...p}>
      <circle cx="6" cy="5" r="2" />
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="7" r="2" />
      <path d="M6 7v10M6 13c0-4 4-4 6-4s6 0 6-2" />
    </Icon>
  ),
  GitHub: (p) => (
    <Icon {...p} d="M12 2a10 10 0 00-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.4-3.4-1.4-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.4 1.1 3 .8.1-.7.4-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 015 0c2-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.8v2.7c0 .3.2.6.7.5A10 10 0 0012 2z" />
  ),
  Database: (p) => (
    <Icon {...p}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6" />
    </Icon>
  ),
  Layout: (p) => (
    <Icon {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </Icon>
  ),
  Phone: (p) => (
    <Icon {...p}>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </Icon>
  ),
  Monitor: (p) => (
    <Icon {...p}>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </Icon>
  ),
  Refresh: (p) => <Icon {...p} d="M3 12a9 9 0 0115-6.7L21 8M21 3v5h-5M21 12a9 9 0 01-15 6.7L3 16M3 21v-5h5" />,
  Beaker: (p) => (
    <Icon {...p}>
      <path d="M9 3h6M10 3v6L4 20a1 1 0 00.9 1.5h14.2A1 1 0 0020 20l-6-11V3" />
      <path d="M6.5 14h11" />
    </Icon>
  ),
};
