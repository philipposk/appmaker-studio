/**
 * AppMaker Studio Pro — client for the `appmaker-billing` Edge Function.
 *
 * Pro = $5/month + prepaid credits. Generations without the user's own key
 * run on the platform OpenRouter key (provider "pro") and are debited at
 * actual cost x markup. The upgrade modal is opened through a window event so
 * any generation entry point can trigger it.
 */

import { supabase } from './supabase';

const SUPABASE_URL = (process.env.REACT_APP_SUPABASE_URL as string)
  || 'https://fmrnqepyyjucnfbrqawl.supabase.co';
const BILLING_URL = `${SUPABASE_URL}/functions/v1/appmaker-billing`;

export interface BillingStatus {
  plan: 'free' | 'pro' | 'owner';
  status: string;
  current_period_end: string | null;
  balance_usd: number;
  markup: number;
  /** false until Pro sales open: hide Upgrade / top-up buttons. */
  pro_open: boolean;
  ledger: { kind: string; amount_usd: number; model: string | null; tokens: number | null; created_at: string }[];
}

export type UpgradeReason = 'needs_key_or_pro' | 'no_credits';
export const TOPUP_PACKS = [10, 25, 50];
export const UPGRADE_EVENT = 'appmaker:upgrade';

async function call<T>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in first.');
  const res = await fetch(BILLING_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, returnUrl: window.location.href.split('?')[0], ...extra }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Billing request failed (${res.status})`);
  return body as T;
}

let cached: { at: number; value: BillingStatus } | null = null;

/**
 * Plan + balance. Cached 30s. The server throttles Stripe syncs; `fresh`
 * skips the cache and asks it to sync sooner (e.g. after checkout).
 */
export async function getBillingStatus(fresh = false): Promise<BillingStatus> {
  if (!fresh && cached && Date.now() - cached.at < 30_000) return cached.value;
  const value = await call<BillingStatus>('status', { fresh });
  cached = { at: Date.now(), value };
  return value;
}

export function invalidateBillingStatus() { cached = null; }

export const isProPlan = (s: BillingStatus | null | undefined) => !!s && (s.plan === 'pro' || s.plan === 'owner');

/** `subscribe` may return `{ url, existing: true }` (portal for an existing sub); same redirect. */
async function redirect(action: string, extra?: Record<string, unknown>) {
  const { url } = await call<{ url: string; existing?: boolean }>(action, extra);
  invalidateBillingStatus();
  window.location.href = url;
}

export const startProCheckout = () => redirect('subscribe');
export const startTopup = (amount: number) => redirect('topup', { amount });
export const openBillingPortal = () => redirect('portal');

/** Open the "add a key or go Pro" modal (mounted once in App). */
export function showUpgrade(reason: UpgradeReason, balanceUsd?: number) {
  window.dispatchEvent(new CustomEvent(UPGRADE_EVENT, { detail: { reason, balanceUsd } }));
}
