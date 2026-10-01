import type { Metadata } from "next";
import { cookies } from "next/headers";
import { THEME_COOKIE } from "@/lib/theme";
import "./old.css";

export const metadata: Metadata = {
  title: "~ 3310.nz :: forum ~",
  description: "news & updates from 3310.nz",
};

export default async function OldLayout({ children }: { children: React.ReactNode }) {
  const dark = (await cookies()).get(THEME_COOKIE)?.value === "dark";
  return <div className={dark ? "old dark" : "old"}>{children}</div>;
}
