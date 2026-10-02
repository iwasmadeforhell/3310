import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/users";
import Shell from "../Shell";
import AccountForm from "./AccountForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "my account :: 3310.nz" };

export default async function Account() {
  const me = await currentUser();
  if (!me) redirect("/login");
  return (
    <Shell me={me} count={false}>
      <div className="old-board-h">
        <span>☺ my account</span>
      </div>
      <AccountForm me={me} />
    </Shell>
  );
}
