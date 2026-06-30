import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Rutas públicas (no requieren autenticación)
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/pricing(.*)",
  "/api/stripe/webhook(.*)",
  "/sitemap.xml",
  "/robots.txt",
  "/share(.*)",
  "/api/og(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();
  const isPublic = isPublicRoute(req);

  // Si no está autenticado y no es pública, redirigir a login
  if (!userId && !isPublic) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  // Si está autenticado y está en landing o sign-in/sign-up, redirigir a dashboard
  const path = req.nextUrl.pathname;
  const isAuthOrLanding =
    path === "/" ||
    (path.startsWith("/sign-in") && !path.includes("/sso-callback") && !path.includes("/verify")) ||
    (path.startsWith("/sign-up") && !path.includes("/sso-callback") && !path.includes("/verify"));
  if (userId && isAuthOrLanding) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};