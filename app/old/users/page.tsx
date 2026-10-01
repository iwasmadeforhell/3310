import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser, isAdmin, listUsers } from "@/lib/users";
import Shell from "../Shell";
import UsersAdmin from "./UsersAdmin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "members :: 3310.nz" };

export default async function Users() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (!isAdmin(me)) redirect("/");
  return (
    <Shell me={me} count={false}>
      <div className="old-board-h">
        <span>♛ manage members</span>
      </div>
      <UsersAdmin initial={await listUsers()} owner={!!me.owner} />
    </Shell>
  );
}
