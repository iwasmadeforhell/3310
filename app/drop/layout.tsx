import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Lora, IBM_Plex_Mono } from "next/font/google";
import "../stars.css";
import "./drop.css";

const serif = Instrument_Serif({ weight: "400", subsets: ["latin"], variable: "--serif", style: ["normal", "italic"] });
const body = Lora({ subsets: ["latin"], variable: "--body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--mono", weight: ["400", "500"] });

const title = "Drop.";
const description = "links + files · authorised use only";

export const metadata: Metadata = {
  title: "drop · 3310.nz",
  description,
  robots: { index: false, follow: false },
  // Link preview (Discord etc). The big card comes from the large image + twitter card;
  // Discord takes the embed's side colour from themeColor below.
  openGraph: {
    type: "website",
    siteName: "drop.3310.nz",
    title,
    description,
    url: "https://drop.3310.nz",
    images: [{ url: "/drop-og.png", width: 1200, height: 630, alt: "Drop. on a starry night sky" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/drop-og.png"] },
};

export const viewport: Viewport = {
  themeColor: "#ffd84d",
};

export default function DropLayout({ children }: { children: React.ReactNode }) {
  return <div className={`dr starry ${serif.variable} ${body.variable} ${mono.variable}`}>{children}</div>;
}
