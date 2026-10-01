import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./drop.css";

const sans = Space_Grotesk({ subsets: ["latin"], variable: "--sans", weight: ["400", "500", "700"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--mono", weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "drop · 3310.nz",
  robots: { index: false, follow: false },
};

export default function DropLayout({ children }: { children: React.ReactNode }) {
  return <div className={`dr ${sans.variable} ${mono.variable}`}>{children}</div>;
}
