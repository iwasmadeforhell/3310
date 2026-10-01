import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/users";
import Shell from "../Shell";
import UserName from "../UserName";
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
      {me.owner ? (
        <p>
          you are <UserName user={me} />, user <b>#1</b>. the owner account is set up in the site settings, so there is nothing to change here.
        </p>
      ) : (
        <AccountForm me={me} />
      )}
    </Shell>
  );
}
