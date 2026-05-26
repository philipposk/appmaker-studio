/**
 * AppMaker design tokens.
 *
 * Hand-extracted from the design mockup (originally shared.jsx).
 * Use these instead of hard-coded hex values so accent palette swaps
 * propagate everywhere.
 */
export const TOKENS = {
  bg: '#0B0B0E',
  panel: '#121217',
  panel2: '#171720',
  panel3: '#1D1D27',
  hairline: '#22222C',
  hairline2: '#2C2C38',
  text1: '#F2F2F5',
  text2: '#A6A6B0',
  text3: '#666673',
  text4: '#42424D',
  accent: '#FF6A3D',
  accentSoft: 'rgba(255,106,61,0.14)',
  accentLine: 'rgba(255,106,61,0.35)',
  green: '#4ADE80',
  amber: '#F5B647',
  violet: '#9F8CFF',
  blue: '#5BB3FF',
  mono: "'Geist Mono', ui-monospace, SFMono-Regular, monospace",
  sans: "'Geist', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
} as const;

export type Tokens = typeof TOKENS;
