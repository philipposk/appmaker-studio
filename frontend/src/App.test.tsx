import React from 'react';
import { render, screen } from '@testing-library/react';

// App builds a Supabase client at import time, which needs real env vars.
// Stub it: fire INITIAL_SESSION with no session so the auth gate opens.
jest.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (event: string, session: null) => void) => {
        setTimeout(() => cb('INITIAL_SESSION', null), 0);
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      },
      signInWithOAuth: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

import App from './App';

test('signed-out visitor is redirected to the login page', async () => {
  render(<App />);
  expect(await screen.findByText(/sign in to your account/i)).toBeInTheDocument();
});
