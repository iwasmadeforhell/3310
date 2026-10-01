import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listConversations } from "@/lib/messages";
import { fmtDate } from "@/lib/posts";
import { currentUser, usersById } from "@/lib/users";
import Shell from "../Shell";
import UserName from "../UserName";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "messages :: 3310.nz" };

export default async function Inbox() {
  const me = await currentUser();
  if (!me) redirect("/login");
  const convos = await listConversations(me.id);
  const people = await usersById(convos.map((c) => c.with));

  return (
    <Shell me={me} count={false}>
      <div className="old-board-h">
        <span>✉ private messages</span>
        <a className="old-btn" href="/members">
          + new message
        </a>
      </div>
      {convos.length === 0 && (
        <p className="old-note">
          no messages yet. pick someone from the <a href="/members">member list</a> to say hi!
        </p>
      )}
      {convos.length > 0 && (
        <table className="old-table">
          <thead>
            <tr>
              <th>with</th>
              <th>last message</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {convos.map((c) => (
              <tr key={c.with} className={c.unread ? "old-unread" : ""}>
                <td>
                  <UserName user={people[c.with]} />
                </td>
                <td>{fmtDate(c.last)}</td>
                <td>
                  <a href={`/messages/${c.with}`}>{c.unread ? `open (${c.unread} new)` : "open"}</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Shell>
  );
}
