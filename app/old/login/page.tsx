import { redirect } from "next/navigation";
import { hasSession } from "@/lib/auth";
import OldLogin from "./OldLogin";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (await hasSession("admin")) redirect("/");
  return <OldLogin />;
}
