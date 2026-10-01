import { redirect } from "next/navigation";
import { hasSession } from "@/lib/auth";
import { hasRedis } from "@/lib/redis";
import { listFiles, listLinks } from "@/lib/drop";
import { QUOTA_BYTES, storageUsage } from "@/lib/storage";
import DropClient from "./DropClient";

export const dynamic = "force-dynamic";

export default async function DropPage() {
  if (!(await hasSession("drop"))) redirect("/login");
  const [links, files, usage] = await Promise.all([listLinks(), listFiles(), storageUsage()]);
  return (
    <DropClient
      initialLinks={links}
      initialFiles={files}
      configured={hasRedis()}
      quota={QUOTA_BYTES}
      otherBytes={usage.portfolio}
    />
  );
}
