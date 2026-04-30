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

export function useCurrentUser(): CurrentUser | null {
  const [state, setState] = useState<CurrentUser | null>(null);

  useEffect(() => {
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
