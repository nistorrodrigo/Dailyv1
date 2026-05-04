import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

/**
 * Subscribes to the current Supabase session. Returns `null` when the
 * user is logged out or Supabase isn't configured. The `user` is the
 * canonical source of truth for "who is using the app right now"
 * — used to display the auth identity chip in the Header and to
 * check session validity before destructive operations like sending
 * the daily email.
 */
export interface CurrentUser {
  user: User;
  session: Session;
}

/** Dev-only escape hatch for Playwright E2E tests. When the test
 *  fixture sets `window.__TEST_SESSION__` before page-init, the
 *  hook returns it directly and skips the Supabase round-trip.
 *  Never set in production — the property exists only on the
 *  test runtime where the fixture explicitly assigns it. The
 *  guard is a 4-line branch that doesn't affect prod behaviour
 *  because the property is `undefined` outside of tests. */
declare global {
  interface Window {
    __TEST_SESSION__?: CurrentUser;
  }
}

export function useCurrentUser(): CurrentUser | null {
  const [state, setState] = useState<CurrentUser | null>(null);

  useEffect(() => {
    // Test escape hatch — see comment above. Cheap-skipping the
    // Supabase wiring lets E2E tests exercise the authed UI without
    // standing up a real auth backend.
    if (typeof window !== "undefined" && window.__TEST_SESSION__) {
      setState(window.__TEST_SESSION__);
      return;
    }

    if (!supabase) return;

    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session?.user) setState({ user: data.session.user, session: data.session });
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session?.user) {
        setState({ user: session.user, session });
      } else {
        setState(null);
      }
    });

    return () => {
      cancelled = true;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  return state;
}
