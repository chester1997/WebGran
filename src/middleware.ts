import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const { token } = req.nextauth;
    const role = (token?.role as string || '').toLowerCase();

    if (pathname.startsWith("/admin") && role !== "admin" && role !== "super_admin") {
      return NextResponse.redirect(new URL("/seller", req.url));
    }

    if (pathname.startsWith("/seller") && role !== "seller" && role !== "admin" && role !== "super_admin") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ["/admin/:path*", "/seller/:path*"],
};
