// appmaker-billing — AppMaker Studio Pro: $5/month subscription + prepaid credits.
//
// POST { action } with the user's Supabase JWT:
//   status    → sync from Stripe (throttled; { fresh: true } after a checkout),
//               return { plan, status, balance_usd, ledger, pro_open }
//   subscribe → Checkout URL for the $5/month Pro subscription
//   topup     → Checkout URL for a one-off credit pack ({ amount: 10 | 25 | 50 })
//   portal    → Stripe customer portal URL (cancel / card change)
//
// No webhook of its own: `status` pulls the customer's subscriptions and paid
// top-up sessions straight from Stripe and credits each session exactly once
// (ledger.ref is unique). The shared stripe-webhook also keeps
// public.subscriptions in sync via subscription metadata.app = "appmaker".
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { createClient } from "jsr:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const APP = "appmaker";
const PRO_PRICE_CENTS = 500;
const TOPUP_PACKS = [10, 25, 50];
const AUTOMATIC_TAX = Deno.env.get("STRIPE_AUTOMATIC_TAX") === "true";
const ALLOWED_ORIGINS = ["https://studio.6x7.gr", "http://localhost:3000", "http://localhost:3001"];
// Test-mode gate: Pro and top-ups only open on a live Stripe key (or an explicit
// opt-in for a dry run). Test cards must never mint spendable credits that burn
// the real platform OpenRouter key.
const STRIPE_LIVE = /^(sk|rk)_live_/.test(Deno.env.get("STRIPE_SECRET_KEY") ?? "");
const PRO_OPEN = STRIPE_LIVE || Deno.env.get("APPMAKER_ALLOW_TEST_PRO") === "true";

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

async function getRow(userId: string) {
  const { data } = await admin.from("subscriptions").select("*")
    .eq("user_id", userId).eq("app", APP).maybeSingle();
  return data as null | {
    plan: string; status: string; stripe_customer_id: string | null;
    stripe_subscription_id: string | null; current_period_end: string | null;
    updated_at: string | null;
  };
}

async function ensureCustomer(user: { id: string; email?: string }) {
  const row = await getRow(user.id);
  if (row?.stripe_customer_id) return row.stripe_customer_id;
  const c = await stripe.customers.create({
    email: user.email ?? undefined,
    metadata: { supabase_user_id: user.id, app: APP },
  });
  // A parallel call may have stored its own customer first; whichever landed wins.
  if (row) {
    await admin.from("subscriptions").update({ stripe_customer_id: c.id, updated_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("app", APP).is("stripe_customer_id", null);
  } else {
    const { error } = await admin.from("subscriptions")
      .insert({ user_id: user.id, app: APP, plan: "free", status: "inactive", stripe_customer_id: c.id });
    if (!error) return c.id;
  }
  const stored = (await getRow(user.id))?.stripe_customer_id;
  if (!stored) throw new Error("Could not save the billing account.");
  return stored;
}

// Pull subscription state + paid top-ups from Stripe. Idempotent.
async function sync(userId: string) {
  const row = await getRow(userId);
  const customer = row?.stripe_customer_id;
  if (!customer) return;

  try {
    if (row!.plan !== "owner") {
      const subs = await stripe.subscriptions.list({ customer, status: "all", limit: 10 });
      const mine = subs.data.filter((s: Stripe.Subscription) => s.livemode === STRIPE_LIVE && s.metadata?.app === APP);
      const sub = mine.find((s: Stripe.Subscription) => ["active", "trialing", "past_due"].includes(s.status)) ?? mine[0];
      if (sub) {
        const end = (sub as unknown as { current_period_end?: number }).current_period_end;
        // Gate closed → a (test) subscription never grants Pro.
        const live = PRO_OPEN && ["active", "trialing"].includes(sub.status);
        await admin.from("subscriptions").update({
          plan: live ? "pro" : "free",
          status: sub.status,
          stripe_subscription_id: sub.id,
          current_period_end: end ? new Date(end * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId).eq("app", APP);
      }
    }

    if (!PRO_OPEN) return;
    const sessions = await stripe.checkout.sessions.list({ customer, limit: 100 });
    for (const s of sessions.data) {
      if (s.livemode !== STRIPE_LIVE) continue;
      if (s.metadata?.kind !== "topup" || s.metadata?.supabase_user_id !== userId) continue;
      if (s.payment_status !== "paid") continue;
      // Credit the pre-tax amount: VAT is collected for the state, not spendable.
      const cents = Number(s.metadata?.credit_cents ?? s.amount_subtotal ?? 0);
      if (cents > 0) {
        await admin.schema(APP).rpc("credit_topup", { p_user: userId, p_amount: cents * 10_000, p_ref: s.id });
      }
    }
  } catch (e) {
    // Stored customer doesn't exist for this key (e.g. a test-mode cus_ id after
    // switching to live): forget it so the next checkout starts clean.
    if ((e as { code?: string } | null)?.code !== "resource_missing") throw e;
    if (row!.plan === "owner") return;
    await admin.from("subscriptions").update({
      plan: "free",
      status: "inactive",
      stripe_customer_id: null,
      stripe_subscription_id: null,
      current_period_end: null,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId).eq("app", APP);
  }
}

// Only send Stripe back to our own origins; drop query/hash so callers can't smuggle params.
function returnUrl(raw: unknown) {
  if (typeof raw === "string") {
    try {
      const u = new URL(raw);
      if (ALLOWED_ORIGINS.includes(u.origin) && !u.username && !u.password) return u.origin + u.pathname;
    } catch { /* not a URL */ }
  }
  return `${ALLOWED_ORIGINS[0]}/settings/providers`;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const json = (status: number, b: unknown) =>
    new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json", ...cors(origin) } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return json(401, { error: "Sign in first." });

  let body: { action?: string; amount?: number; returnUrl?: string; fresh?: boolean } = {};
  try { body = await req.json(); } catch { /* empty body */ }
  const back = returnUrl(body.returnUrl);
  const sep = back.includes("?") ? "&" : "?";

  try {
    switch (body.action) {
      case "status": {
        // Throttle Stripe round-trips: every page load calls status.
        const before = await getRow(user.id);
        const syncedAt = (before?.updated_at && Date.parse(before.updated_at)) || 0;
        if (before?.stripe_customer_id && Date.now() - syncedAt > (body.fresh ? 10_000 : 120_000)) {
          await sync(user.id);
          await admin.from("subscriptions").update({ updated_at: new Date().toISOString() })
            .eq("user_id", user.id).eq("app", APP);
        }
        const row = await getRow(user.id);
        const { data: bal } = await admin.schema(APP).rpc("credit_balance", { p_user: user.id });
        const { data: ledger } = await admin.schema(APP).from("credit_ledger")
          .select("kind, amount_micros, model, tokens, created_at")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(15);
        const active = !!row && ["active", "trialing"].includes(row.status) && ["pro", "owner"].includes(row.plan);
        return json(200, {
          plan: active ? row!.plan : "free",
          status: row?.status ?? "inactive",
          current_period_end: row?.current_period_end ?? null,
          balance_usd: Number(bal ?? 0) / 1e6,
          markup: Number(Deno.env.get("APPMAKER_MARKUP") ?? "1.4"),
          ledger: (ledger ?? []).map((l) => ({ ...l, amount_usd: l.amount_micros / 1e6 })),
          pro_open: PRO_OPEN,
        });
      }

      case "subscribe": {
        if (!PRO_OPEN) return json(503, { error: "Pro isn't open yet." });
        const existing = await getRow(user.id);
        if (existing?.plan === "owner") return json(409, { error: "Owner plan is already unlimited." });
        const customer = await ensureCustomer(user);
        // Already subscribed (or a payment is pending/failing): manage it in the
        // portal instead of opening a second subscription.
        const subs = await stripe.subscriptions.list({ customer, status: "all", limit: 20 });
        if (subs.data.some((s: Stripe.Subscription) => s.metadata?.app === APP
          && ["active", "trialing", "past_due", "unpaid", "incomplete"].includes(s.status))) {
          const p = await stripe.billingPortal.sessions.create({ customer, return_url: back });
          return json(200, { url: p.url, existing: true });
        }
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer,
          line_items: [{
            price_data: {
              currency: "usd",
              product_data: { name: "AppMaker Studio Pro", description: "Use AppMaker's AI with pay-as-you-go credits" },
              unit_amount: PRO_PRICE_CENTS,
              recurring: { interval: "month" },
            },
            quantity: 1,
          }],
          ...(AUTOMATIC_TAX ? { automatic_tax: { enabled: true }, customer_update: { address: "auto" } } : {}),
          allow_promotion_codes: true,
          success_url: `${back}${sep}billing=subscribed`,
          cancel_url: `${back}${sep}billing=cancel`,
          metadata: { supabase_user_id: user.id, app: APP, plan: "pro" },
          subscription_data: { metadata: { supabase_user_id: user.id, app: APP, plan: "pro" } },
        });
        return json(200, { url: session.url });
      }

      case "topup": {
        if (!PRO_OPEN) return json(503, { error: "Pro isn't open yet." });
        const amount = Number(body.amount);
        if (!TOPUP_PACKS.includes(amount)) return json(400, { error: `amount must be one of ${TOPUP_PACKS.join(", ")}` });
        const row = await getRow(user.id);
        if (!row || !["active", "trialing"].includes(row.status) || row.plan !== "pro") {
          return json(402, { error: "Subscribe to Pro first." });
        }
        const customer = await ensureCustomer(user);
        const metadata = { supabase_user_id: user.id, app: APP, kind: "topup", credit_cents: String(amount * 100) };
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          customer,
          line_items: [{
            price_data: {
              currency: "usd",
              product_data: { name: `AppMaker credits — $${amount}` },
              unit_amount: amount * 100,
            },
            quantity: 1,
          }],
          ...(AUTOMATIC_TAX ? { automatic_tax: { enabled: true }, customer_update: { address: "auto" } } : {}),
          success_url: `${back}${sep}billing=topup`,
          cancel_url: `${back}${sep}billing=cancel`,
          metadata,
          // Same tags on the PaymentIntent so a refund can be traced back to the credit.
          payment_intent_data: { metadata },
        });
        return json(200, { url: session.url });
      }

      case "portal": {
        const row = await getRow(user.id);
        if (!row?.stripe_customer_id) return json(400, { error: "No billing account yet." });
        const p = await stripe.billingPortal.sessions.create({ customer: row.stripe_customer_id, return_url: back });
        return json(200, { url: p.url });
      }

      default:
        return json(400, { error: "unknown action" });
    }
  } catch (e) {
    console.error("appmaker-billing:", e instanceof Error ? e.message : e);
    return json(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
