export function sanitize(s: unknown, maxLen = 600): string {
  return String(s ?? "").replace(/[\x00-\x1f<>{}\\]/g, " ").trim().slice(0, maxLen);
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
