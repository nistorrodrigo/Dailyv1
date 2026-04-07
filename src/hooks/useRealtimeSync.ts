import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import useDailyStore from "../store/useDailyStore";
import type { DailyState } from "../types";

interface ActiveEditor {
  email: string;
  section: string;
  timestamp: number;
}

export function useRealtimeSync() {
  const [activeEditors, setActiveEditors] = useState<ActiveEditor[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase.channel("daily-sync", {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "state-update" }, ({ payload }) => {
        // Another user updated the state — merge their changes
        if (payload?.state) {
          const current = useDailyStore.getState();
          // Only merge if they changed a different section
          if (payload.section && payload.section !== current._lastEditedSection) {
            useDailyStore.setState({ [payload.field]: payload.value } as Partial<DailyState>);
          }
        }
      })
      .on("broadcast", { event: "editing" }, ({ payload }) => {
        if (payload?.email && payload?.section) {
          setActiveEditors((prev) => {
            const filtered = prev.filter(
              (e) => e.email !== payload.email && Date.now() - e.timestamp < 30000
            );
            return [...filtered, { email: payload.email, section: payload.section, timestamp: Date.now() }];
          });
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const broadcastEdit = (section: string, field: string, value: unknown) => {
    if (!channelRef.current || !supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      channelRef.current?.send({
        type: "broadcast",
        event: "editing",
        payload: { email: data?.user?.email || "Anonymous", section },
      });
    });
  };

  // Clean up stale editors
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveEditors((prev) => prev.filter((e) => Date.now() - e.timestamp < 30000));
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return { activeEditors, broadcastEdit };
}

export function SectionLockIndicator({ sectionKey, activeEditors }: { sectionKey: string; activeEditors: ActiveEditor[] }) {
  const editing = activeEditors.filter((e) => e.section === sectionKey);
  if (editing.length === 0) return null;

  return (
    <div className="flex items-center gap-1 ml-2">
      {editing.map((e, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200"
          title={`${e.email} is editing this section`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse-slow" />
          {e.email.split("@")[0]}
        </span>
      ))}
    </div>
  );
}
