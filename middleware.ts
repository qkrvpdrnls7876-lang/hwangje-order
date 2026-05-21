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
  const { pathname } = request.nextUrl;

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
  matcher: ["/admin/:path*", "/rider/:path*", "/kitchen/:path*"],
};
