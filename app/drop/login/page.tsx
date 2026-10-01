import { redirect } from "next/navigation";
import { hasSession } from "@/lib/auth";
import DropLogin from "./DropLogin";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (await hasSession("drop")) redirect("/");
  return <DropLogin />;
}
