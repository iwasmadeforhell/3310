import type { Metadata } from "next";
import Board from "../Board";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "devlog :: 3310.nz" };

export default function Devlog() {
  return <Board section="devlog" />;
}
