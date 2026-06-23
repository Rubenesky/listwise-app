import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/pricing(.*)",
  "/api/stripe/webhook(.*)",
]);

const isDashboardRoute = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();
  const isPublic = isPublicRoute(req);
  const isDashboard = isDashboardRoute(req);

  // Si no está autenticado y no es pública, redirigir a login
  if (!userId && !isPublic) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  // Si está autenticado y es pública (excepto pricing), redirigir a dashboard
  if (userId && isPublic && req.nextUrl.pathname === "/") {
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