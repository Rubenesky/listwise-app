"use client";
import { useEffect } from "react";

export function ReferralCapture({ code }: { code: string }) {
  useEffect(() => {
    if (code) localStorage.setItem("listwise_ref", code);
  }, [code]);
  return null;
}
