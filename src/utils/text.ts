export function nl2br(t: string | null | undefined): string {
  return (t || "").replace(/\n/g, "<br>");
}

export function mdToHtml(text: string | null | undefined): string {
  if (!text) return "";
  let html = text;
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match: string) => `<ul>${match}</ul>`);
  html = html.replace(/\n/g, "<br>");
  return html;
}
