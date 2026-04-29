import { useEffect, useState } from "react";

/**
 * Subscribes to the browser's `online`/`offline` events and returns the
 * current connection state. Initial value is `navigator.onLine` at mount.
 *
 * Note: navigator.onLine reports browser-level connectivity, not whether
 * a specific server is reachable. For "is the server up?" use a heartbeat.
 */
export default function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() => {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  });

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
}
