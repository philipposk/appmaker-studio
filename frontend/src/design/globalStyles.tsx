import { useEffect } from 'react';
import { TOKENS } from './tokens';

/**
 * Injects the design's CSS reset / scrollbar / caret styles into the
 * document once. Idempotent — safe to mount in `<App />` even with
 * StrictMode double-effects.
 */
export function useGlobalDesignStyles() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById('am-styles')) return;
    const s = document.createElement('style');
    s.id = 'am-styles';
    s.textContent = `
      :root { --am-accent: ${TOKENS.accent}; }
      body { background: ${TOKENS.bg}; }
      .am-root, .am-root * { box-sizing: border-box; }
      .am-root { font-family: ${TOKENS.sans}; -webkit-font-smoothing: antialiased; color: ${TOKENS.text1}; }
      .am-root button { font-family: inherit; }
      .am-mono { font-family: ${TOKENS.mono}; font-feature-settings: 'ss01','cv11'; }
      .am-caret {
        display: inline-block; width: 1.5px; height: 1em;
        background: var(--am-accent); vertical-align: -2px; margin-left: 1px;
        animation: amBlink 1.1s steps(1) infinite;
      }
      @keyframes amBlink { 50% { opacity: 0; } }
      ::-webkit-scrollbar { width: 10px; height: 10px; }
      ::-webkit-scrollbar-thumb { background: ${TOKENS.hairline2}; border-radius: 6px; }
      ::-webkit-scrollbar-track { background: transparent; }
    `;
    document.head.appendChild(s);
  }, []);
}
