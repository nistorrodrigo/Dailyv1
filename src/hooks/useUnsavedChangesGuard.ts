import { useEffect } from "react";
import useUIStore from "../store/useUIStore";

/**
 * Hook that warns the user before they leave the page if there are
 * unsaved changes (saveStatus === "saving" or "error"). The browser
 * shows its native "Leave site? Changes you made may not be saved."
 * dialog. We can't customise the text — modern browsers ignore the
 * returned string for security reasons — but the dialog itself fires
 * reliably as long as `event.preventDefault()` is called and a string
 * is returned (the latter is for legacy compatibility).
 *
 * Mount once near the app root.
 */
export default function useUnsavedChangesGuard(): void {
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const status = useUIStore.getState().saveStatus;
      // "saving" → write in flight, definitely unsafe to navigate away.
      // "error" → last write failed, the user might lose changes.
      // "saved"/"idle" → all in sync with Supabase, safe to leave.
      if (status === "saving" || status === "error") {
        e.preventDefault();
        // Some older browsers still display this string; modern ones don't.
        e.returnValue = "";
        return "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
}
