import { toast } from "../store/useToastStore";

/**
 * Shared clipboard helper. Every `navigator.clipboard.writeText` call
 * site had its own ad-hoc try/catch (or worse, no error handling at
 * all). Consolidating into one helper closes three real problems:
 *
 *   1. Sentry noise. Without `.catch`, the rejection bubbles to
 *      `window.onunhandledrejection` and Sentry captures
 *      `NotAllowedError: Write permission denied` every time the
 *      analyst is in a Safari iframe, a Teams screen-share session,
 *      or any insecure context. Multiple call sites had no .catch.
 *   2. Inconsistent UX. Some sites silently swallowed the failure,
 *      some toasted the raw error message, one site (ContactsPanel)
 *      claimed success on a toast that never wrote anything to the
 *      clipboard. Now a single failure path with a clear "Couldn't
 *      copy. Try Ctrl-C." prompt.
 *   3. Test surface. One helper to mock instead of N call sites.
 *
 * The clipboard API throws under many real-world conditions —
 * insecure context, no user gesture (auto-copy on mount), denied
 * permissions, focused iframe, in-progress permission prompt. We
 * treat all of them the same: log to console, optionally toast, and
 * return `false` so the caller can branch on the result if they need
 * a fallback path (e.g. ErrorBoundary's console.log).
 */

export interface CopyOptions {
  /** Toast message on success. Omit to suppress the success toast
   *  (useful when the caller already toggles a "✓ Copied" UI state). */
  successMessage?: string;
  /** Toast message on failure. Omit for the default
   *  "Couldn't copy to clipboard. Try Ctrl-C instead." text.
   *  Pass `null` to suppress the error toast entirely. */
  errorMessage?: string | null;
}

/** Copy `text` to the system clipboard. Returns `true` on success,
 *  `false` on failure. Failure is silent at the console.warn level —
 *  pass `errorMessage: null` to also suppress the toast. */
export async function copyText(text: string, options: CopyOptions = {}): Promise<boolean> {
  const { successMessage, errorMessage } = options;
  try {
    await navigator.clipboard.writeText(text);
    if (successMessage) toast.success(successMessage);
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[copyText] clipboard write failed:", err);
    if (errorMessage !== null) {
      toast.error(errorMessage || "Couldn't copy to clipboard. Try Ctrl-C instead.");
    }
    return false;
  }
}
