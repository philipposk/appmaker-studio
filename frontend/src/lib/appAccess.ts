import { supabase } from './supabase';

/**
 * Record that this user has used AppMaker, in the shared platform table
 * public.app_access. Lets the 6x7 hub's "your apps" dashboard show AppMaker
 * among the apps a user has touched. RLS restricts rows to the owner.
 *
 * Fire-and-forget: never block or break the UI if it fails.
 */
export async function touchAppAccess(userId: string): Promise<void> {
  if (!userId) return;
  try {
    await supabase
      .from('app_access')
      .upsert(
        { user_id: userId, app: 'appmaker', last_seen: new Date().toISOString() },
        { onConflict: 'user_id,app' },
      );
  } catch {
    /* non-critical telemetry — ignore */
  }
}
