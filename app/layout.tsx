import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegister from "./PwaRegister";
import ManifestSelector from "./ManifestSelector";

export const metadata: Metadata = {
  title: "황제떡볶이",
  description: "황제떡볶이 자체 주문앱",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "황제떡볶이",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      {
        url: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icon-192.png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#d4af37",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <meta name="application-name" content="황제떡볶이" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="황제떡볶이" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>
        <ManifestSelector />
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
