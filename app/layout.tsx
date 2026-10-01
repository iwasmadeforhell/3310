import type { Metadata, Viewport } from "next";
import { site } from "@/site.config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://3310.nz"),
  title: site.name,
  description: site.tagline,
  // Link preview (Discord etc). Discord takes the embed's side colour from themeColor below.
  openGraph: {
    type: "website",
    siteName: site.name,
    title: site.name,
    description: site.tagline,
    images: [{ url: "/nokia.png", width: 720, height: 1641, alt: "Nokia 3310" }],
  },
  twitter: { card: "summary" },
};

export const viewport: Viewport = {
  themeColor: "#a2cffe",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
