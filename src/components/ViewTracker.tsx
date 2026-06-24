"use client";

import { useEffect } from "react";

export default function ViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const referrer = document.referrer;
    let referrerType = "direct";
    if (referrer.includes("google")) referrerType = "google";
    else if (referrer.includes("twitter") || referrer.includes("t.co")) referrerType = "twitter";
    else if (referrer.includes("linkedin")) referrerType = "linkedin";
    else if (referrer.includes("facebook") || referrer.includes("fb.com")) referrerType = "facebook";
    else if (referrer.includes("wa.me") || referrer.includes("whatsapp")) referrerType = "whatsapp";

    const device = window.innerWidth < 768 ? "mobile" : window.innerWidth < 1024 ? "tablet" : "desktop";

    fetch("/api/views/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, referrer: referrerType, device }),
    }).catch(() => {
      // Silently ignore errors — view tracking is non-critical
    });
  }, [slug]);

  return null;
}
