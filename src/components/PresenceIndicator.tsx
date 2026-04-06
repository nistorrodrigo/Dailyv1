import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function PresenceIndicator(): React.ReactElement | null {
  const [users, setUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase.channel("daily-presence", {
      config: { presence: { key: "user-" + Math.random().toString(36).slice(2, 8) } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const online = Object.values(state).flat().map((u: Record<string, string>) => u.email || "Anonymous");
        setUsers([...new Set(online)]);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const { data } = await supabase!.auth.getUser();
          await channel.track({ email: data?.user?.email || "Anonymous", joined: new Date().toISOString() });
        }
      });

    return () => { supabase!.removeChannel(channel); };
  }, []);

  if (users.length <= 1) return null;

  return (
    <div className="flex items-center gap-1.5 mr-2">
      <div className="flex -space-x-1.5">
        {users.slice(0, 4).map((u, i) => (
          <div
            key={i}
            className="w-5 h-5 rounded-full bg-[var(--color-sky)] border-2 border-[var(--bg-header)] flex items-center justify-center text-[8px] font-bold text-white"
            title={u}
          >
            {u.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
      <span className="text-[9px] text-[var(--color-sky)] font-semibold">
        {users.length} online
      </span>
    </div>
  );
}
