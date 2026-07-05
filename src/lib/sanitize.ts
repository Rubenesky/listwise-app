export function sanitize(s: unknown, maxLen = 600): string {
  return String(s ?? "").replace(/[\x00-\x1f<>{}\\]/g, " ").trim().slice(0, maxLen);
}
