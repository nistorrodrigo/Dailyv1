// Lazy logo loader — converts PNGs to base64 only when needed
// Avoids 65KB of base64 in the JS bundle blocking the main thread

let _whiteB64: string | null = null;
let _origB64: string | null = null;

async function fetchAsBase64(url: string): Promise<string> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

export async function getLogos(): Promise<{ white: string; orig: string }> {
  if (_whiteB64 && _origB64) return { white: _whiteB64, orig: _origB64 };
  const [white, orig] = await Promise.all([
    fetchAsBase64("/logo-white.png"),
    fetchAsBase64("/logo.png"),
  ]);
  _whiteB64 = white;
  _origB64 = orig;
  return { white, orig };
}

// Synchronous getters — return cached base64 or fallback URL
export function getLogoWhiteB64(): string {
  return _whiteB64 || "/logo-white.png";
}

export function getLogoOrigB64(): string {
  return _origB64 || "/logo.png";
}

// Pre-warm cache in background after page load
if (typeof window !== "undefined") {
  setTimeout(() => getLogos(), 100);
}
