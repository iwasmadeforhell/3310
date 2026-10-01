// Host-based routing (Next.js 16 "proxy", formerly middleware).
//
//   3310.nz            -> app/page.tsx, /s/<code>, /f/<id>
//   portfolio.3310.nz  -> app/portfolio/*
//   drop.3310.nz       -> app/drop/*
//   old.3310.nz        -> app/old/*
//
// The auth redirects here are only for convenience. Every protected page and
// API route re-checks the signed cookie on the server itself, so nothing is
// exposed even if this file were bypassed.

import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, verifyToken } from "./lib/session";
import { SECTIONS, sectionForHost } from "./lib/hosts";

const ROOT = process.env.ROOT_DOMAIN ?? "3310.nz";

export async function proxy(req: NextRequest) {
  const url = req.nextUrl;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const path = url.pathname;
  const section = sectionForHost(host);

  // Shared routes that are never rewritten.
  const passthrough =
    path.startsWith("/api/") ||
    path.startsWith("/_next/") ||
    /\.[a-z0-9]{2,5}$/i.test(path);

  // ---------- main domain ----------
  if (!section) {
    // Keep section pages on their own subdomains (cookies are per-subdomain).
    const first = path.split("/")[1];
    if ((SECTIONS as readonly string[]).includes(first) && host.endsWith(ROOT)) {
      const dest = new URL(`https://${first}.${ROOT}${path.slice(first.length + 1) || "/"}`);
      return NextResponse.redirect(dest, 308);
    }
    return NextResponse.next();
  }

  if (passthrough || path.startsWith("/s/") || path.startsWith("/f/")) {
    return NextResponse.next();
  }

  const cookie = (name: string) => req.cookies.get(name)?.value;
  const isManager = await verifyToken("manage", cookie(COOKIE.manage));
  const toLogin = (extra = "") => {
    const dest = url.clone();
    dest.pathname = "/login";
    dest.search = extra;
    return NextResponse.redirect(dest);
  };

  // ---------- section gates ----------
  if (section === "portfolio" && path !== "/login") {
    if (path.startsWith("/manage")) {
      if (!isManager) return toLogin("?as=admin");
    } else if (!isManager && !(await verifyToken("portfolio", cookie(COOKIE.portfolio)))) {
      return toLogin();
    }
  }
  if (section === "drop" && path !== "/login") {
    if (!(await verifyToken("drop", cookie(COOKIE.drop)))) return toLogin();
  }
  // old.3310.nz is public; its pages check the forum account themselves.

  // ---------- rewrite into the section's folder ----------
  const dest = url.clone();
  dest.pathname = `/${section}${path === "/" ? "" : path}`;
  const res = NextResponse.rewrite(dest);
  if (section !== "old") {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Cache-Control", "private, no-store");
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
