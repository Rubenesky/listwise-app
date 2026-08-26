import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

// Rutas públicas (no requieren autenticación). Exportado para test de
// regresión — ver __tests__/unit/middleware-public-routes.test.ts.
export const PUBLIC_ROUTE_PATTERNS = [
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
];

const isPublicRoute = createRouteMatcher(PUBLIC_ROUTE_PATTERNS);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

// Named + exported so the admin-guard branch is directly unit-testable
// without mocking clerkMiddleware's own wrapping — see
// __tests__/unit/middleware-admin-guard.test.ts.
// (clerkMiddleware is overloaded, so `Parameters<typeof clerkMiddleware>[0]`
// resolves to the wrong overload — typed explicitly instead.)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const middlewareHandler = async (auth: any, req: NextRequest) => {
  const requestId = uuidv4();
  const { userId } = await auth();
  const isPublic = isPublicRoute(req);

  // Si no está autenticado y no es pública, redirigir a login
  if (!userId && !isPublic) {
    const res = NextResponse.redirect(new URL("/sign-in", req.url));
    res.headers.set("x-request-id", requestId);
    return res;
  }

  // Defensa en profundidad: bloquear páginas admin a usuarios no-admin en la capa edge.
  // Las rutas /api/admin/* tienen su propio guard (requireAdmin) que devuelve JSON 403.
  if (isAdminRoute(req) && userId) {
    const adminId = process.env.ADMIN_USER_ID ?? "";
    if (!adminId || userId !== adminId) {
      const res = NextResponse.redirect(new URL("/dashboard", req.url));
      res.headers.set("x-request-id", requestId);
      return res;
    }
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
};

export default clerkMiddleware(middlewareHandler);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};