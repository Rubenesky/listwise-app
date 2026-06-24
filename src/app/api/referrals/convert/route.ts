import { NextResponse } from "next/server";

// Endpoint disabled: conversion happens automatically via the Stripe webhook
// on checkout.session.completed (trusted server-side path).
// Exposing this publicly created two HIGH vulnerabilities:
//   1. IDOR — any authenticated user could convert any referralId
//   2. Privilege escalation — client-supplied `plan` set reward tier
export async function POST() {
  return NextResponse.json(
    { error: "La conversión de referidos se realiza automáticamente al completar el pago" },
    { status: 410 }
  );
}
