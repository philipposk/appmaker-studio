import React from 'react';
import { Outlet } from 'react-router-dom';
import { useGlobalDesignStyles } from '../../design';
import { TOKENS } from '../../design';

/**
 * Minimal shell — each page owns its own Sidebar + chrome.
 * Just injects global styles and provides a full-height dark canvas.
 */
const Layout: React.FC = () => {
  useGlobalDesignStyles();

  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        background: TOKENS.bg,
        color: TOKENS.text1,
        overflow: 'hidden',
      }}
    >
      <Outlet />
    </div>
  );
};

export default Layout;
