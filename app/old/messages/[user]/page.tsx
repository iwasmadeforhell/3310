import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { readThread } from "@/lib/messages";
import { currentUser, usersById } from "@/lib/users";
import Shell from "../../Shell";
import UserName from "../../UserName";
import Thread from "./Thread";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "messages :: 3310.nz" };

export default async function Conversation({ params }: { params: Promise<{ user: string }> }) {
  const me = await currentUser();
  if (!me) redirect("/login");
  const id = (await params).user.toLowerCase();
  if (!/^[a-z0-9_-]{3,20}$/.test(id) || id === me.id) notFound();
  const other = (await usersById([id]))[id];
  // Read before rendering the shell, so its unread count is already up to date.
  const messages = await readThread(me.id, id);
  if (other.deleted && !messages.length) notFound();

  return (
    <Shell me={me} count={false}>
      <div className="old-board-h">
        <span>
          ✉ you &amp; <UserName user={other} badge={false} />
        </span>
        <a className="old-btn" href="/messages">
          all messages
        </a>
      </div>
      <Thread me={me} other={other} initial={messages} />
    </Shell>
  );
}
