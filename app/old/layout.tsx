import type { Metadata } from "next";
import "./old.css";

export const metadata: Metadata = {
  title: "~ 3310.nz :: forum ~",
  description: "news & updates from 3310.nz",
};

export default function OldLayout({ children }: { children: React.ReactNode }) {
  return <div className="old">{children}</div>;
}
