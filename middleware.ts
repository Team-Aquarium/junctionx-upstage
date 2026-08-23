import { NextResponse, type NextRequest } from "next/server";
import {
  VISITOR_COOKIE,
  VISITOR_HEADER,
  isVisitorId,
  newVisitorId,
} from "@/lib/visitor";

export function middleware(request: NextRequest) {
  const existing = request.cookies.get(VISITOR_COOKIE)?.value;
  const vid = existing && isVisitorId(existing) ? existing : newVisitorId();

  const headers = new Headers(request.headers);
  headers.set(VISITOR_HEADER, vid);
  if (!existing || existing !== vid) {
    const cookie = request.headers.get("cookie") ?? "";
    headers.set(
      "cookie",
      cookie ? `${cookie}; ${VISITOR_COOKIE}=${vid}` : `${VISITOR_COOKIE}=${vid}`,
    );
  }

  const response = NextResponse.next({ request: { headers } });
  if (!existing || existing !== vid) {
    response.cookies.set({
      name: VISITOR_COOKIE,
      value: vid,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2|ico)$).*)",
  ],
};
