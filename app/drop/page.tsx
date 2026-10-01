import { redirect } from "next/navigation";
import { hasSession } from "@/lib/auth";
import { hasRedis } from "@/lib/redis";
import { listFiles, listLinks } from "@/lib/drop";
import DropClient from "./DropClient";

export const dynamic = "force-dynamic";

export default async function DropPage() {
  if (!(await hasSession("drop"))) redirect("/login");
  const [links, files] = await Promise.all([listLinks(), listFiles()]);
  return <DropClient initialLinks={links} initialFiles={files} configured={hasRedis()} />;
}
