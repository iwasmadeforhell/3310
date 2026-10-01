import type { Metadata } from "next";
import { Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./portfolio.css";

const serif = Instrument_Serif({ weight: "400", subsets: ["latin"], variable: "--serif", style: ["normal", "italic"] });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--mono" });

export const metadata: Metadata = {
  title: "Portfolio · 3310.nz",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return <div className={`pf ${serif.variable} ${mono.variable}`}>{children}</div>;
}
