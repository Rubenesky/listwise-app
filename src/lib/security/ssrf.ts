import { promises as dns, LookupAddress } from "dns";
import { log } from "@/lib/logger";

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 255
  );
}

function isPrivateIPv6(ip: string): boolean {
  const norm = ip.toLowerCase();
  if (norm === "::1") return true;
  if (/^f[cd]/i.test(norm)) return true; // fc00::/7 unique-local
  if (/^fe[89ab]/i.test(norm)) return true; // fe80::/10 link-local
  const v4mapped = norm.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4mapped) return isPrivateIPv4(v4mapped[1]);
  return false;
}

export async function validateUrlSSRF(
  raw: string
): Promise<{ ok: boolean; error?: string; normalized?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, error: "La URL no es válida" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Solo se permiten URLs http:// o https://" };
  }

  const host = parsed.hostname.toLowerCase();

  if (/^localhost$/i.test(host) || /^0\.0\.0\.0$/.test(host)) {
    return { ok: false, error: "No se permiten direcciones internas" };
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return { ok: false, error: "No se permiten direcciones IP directas" };
  }
  if (/^\[/.test(host)) {
    return { ok: false, error: "No se permiten direcciones IPv6 directas" };
  }

  let addresses: LookupAddress[];
  try {
    addresses = await dns.lookup(host, { all: true });
  } catch {
    return { ok: false, error: "No se pudo resolver el dominio" };
  }

  if (addresses.length === 0) {
    return { ok: false, error: "El dominio no resuelve a ninguna dirección" };
  }

  for (const { address, family } of addresses) {
    if (family === 4 && isPrivateIPv4(address)) {
      log.warn({ host, address }, "SSRF block: private IPv4");
      return { ok: false, error: "La URL apunta a una red interna" };
    }
    if (family === 6 && isPrivateIPv6(address)) {
      log.warn({ host, address }, "SSRF block: private IPv6");
      return { ok: false, error: "La URL apunta a una red interna" };
    }
  }

  return { ok: true, normalized: parsed.href };
}
