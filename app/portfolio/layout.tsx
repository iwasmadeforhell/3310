import type { Metadata } from "next";
import { Instrument_Serif, Lora } from "next/font/google";
import "../stars.css";
import "./portfolio.css";

const serif = Instrument_Serif({ weight: "400", subsets: ["latin"], variable: "--serif", style: ["normal", "italic"] });
const body = Lora({ subsets: ["latin"], variable: "--body" });

export const metadata: Metadata = {
  title: "Portfolio · 3310.nz",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return <div className={`pf starry ${serif.variable} ${body.variable}`}>{children}</div>;
}
