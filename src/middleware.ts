import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

// Rutas públicas (no requieren autenticación)
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/pricing(.*)",
  "/api/health",
  "/api/stripe/webhook(.*)",
  "/api/webhooks/clerk(.*)",
  "/api/leads(.*)",
  "/api/cron(.*)",
  "/sitemap.xml",
  "/robots.txt",
  "/share(.*)",
  "/api/og(.*)",
  "/blog(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const requestId = uuidv4();
  const { userId } = await auth();
  const isPublic = isPublicRoute(req);

  // Si no está autenticado y no es pública, redirigir a login
  if (!userId && !isPublic) {
    const res = NextResponse.redirect(new URL("/sign-in", req.url));
    res.headers.set("x-request-id", requestId);
    return res;
  }

  // Si está autenticado y está en landing o sign-in/sign-up, redirigir a dashboard
  const path = req.nextUrl.pathname;
  const isAuthOrLanding =
    path === "/" ||
    (path.startsWith("/sign-in") && !path.includes("/sso-callback") && !path.includes("/verify")) ||
    (path.startsWith("/sign-up") && !path.includes("/sso-callback") && !path.includes("/verify"));
  if (userId && isAuthOrLanding) {
    const res = NextResponse.redirect(new URL("/dashboard", req.url));
    res.headers.set("x-request-id", requestId);
    return res;
  }

  const res = NextResponse.next();
  res.headers.set("x-request-id", requestId);
  return res;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};