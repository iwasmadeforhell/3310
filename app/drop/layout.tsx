import type { Metadata } from "next";
import { Instrument_Serif, Lora, IBM_Plex_Mono } from "next/font/google";
import "../stars.css";
import "./drop.css";

const serif = Instrument_Serif({ weight: "400", subsets: ["latin"], variable: "--serif", style: ["normal", "italic"] });
const body = Lora({ subsets: ["latin"], variable: "--body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--mono", weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "drop · 3310.nz",
  robots: { index: false, follow: false },
};

export default function DropLayout({ children }: { children: React.ReactNode }) {
  return <div className={`dr starry ${serif.variable} ${body.variable} ${mono.variable}`}>{children}</div>;
}
