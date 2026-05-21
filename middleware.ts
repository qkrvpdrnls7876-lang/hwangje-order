import { NextRequest, NextResponse } from "next/server";

const LOCKED_PATHS = ["/admin", "/rider", "/kitchen"];

function isLockedPath(pathname: string) {
  return LOCKED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function unauthorized() {
  return new NextResponse("인증이 필요합니다.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Hwangje Order Admin"',
    },
  });
}

export function middleware(request: NextRequest) {
  const { pathname, hostname } = request.nextUrl;

  if (pathname === "/manifest.json") {
    const url = request.nextUrl.clone();

    if (hostname.startsWith("admin.")) {
      url.pathname = "/admin-manifest.json";
      return NextResponse.rewrite(url);
    }

    if (hostname.startsWith("rider.")) {
      url.pathname = "/rider-manifest.json";
      return NextResponse.rewrite(url);
    }

    return NextResponse.next();
  }

  if (hostname.startsWith("admin.") && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  if (hostname.startsWith("rider.") && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/rider";
    return NextResponse.redirect(url);
  }

  if (!isLockedPath(pathname)) {
    return NextResponse.next();
  }

  const adminUser = process.env.HWANGJE_ADMIN_USER || "admin";
  const adminPassword = process.env.HWANGJE_ADMIN_PASSWORD || "";

  if (!adminPassword) {
    return new NextResponse(
      "HWANGJE_ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.",
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return unauthorized();
  }

  try {
    const base64 = authHeader.replace("Basic ", "");
    const decoded = atob(base64);
    const [user, ...passwordParts] = decoded.split(":");
    const password = passwordParts.join(":");

    if (user === adminUser && password === adminPassword) {
      return NextResponse.next();
    }

    return unauthorized();
  } catch {
    return unauthorized();
  }
}

export const config = {
  matcher: [
    "/manifest.json",
    "/admin/:path*",
    "/rider/:path*",
    "/kitchen/:path*",
    "/",
  ],
};