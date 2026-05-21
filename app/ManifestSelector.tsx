"use client";

import { useEffect } from "react";

export default function ManifestSelector() {
  useEffect(() => {
    const host = window.location.hostname;
    const manifest = document.querySelector(
      'link[rel="manifest"]',
    ) as HTMLLinkElement | null;

    if (!manifest) return;

    if (host.startsWith("admin.")) {
      manifest.href = "/admin-manifest.json";
      document.title = "황제 관리자";
      return;
    }

    if (host.startsWith("rider.")) {
      manifest.href = "/rider-manifest.json";
      document.title = "황제 라이더";
      return;
    }

    manifest.href = "/manifest.json";
    document.title = "황제떡볶이";
  }, []);

  return null;
}
