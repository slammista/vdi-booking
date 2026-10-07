import { NextRequest, NextResponse } from "next/server";
import { COOKIES, verifyAdminSessionToken } from "@/lib/auth";

/**
 * Protegge le pagine sotto /admin (eccetto la pagina di login stessa).
 * Gira in Edge Runtime: per questo lib/auth.ts usa 'jose' invece di
 * 'jsonwebtoken' (quest'ultimo non è compatibile con l'Edge Runtime).
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const token = req.cookies.get(COOKIES.ADMIN_COOKIE)?.value;
    const valid = token ? await verifyAdminSessionToken(token) : false;
    if (!valid) {
      const loginUrl = new URL("/admin/login", req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
