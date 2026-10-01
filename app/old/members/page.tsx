import type { Metadata } from "next";
import { authorOf, listPosts } from "@/lib/posts";
import { currentUser, listUsers, usersById, ownerId } from "@/lib/users";
import Shell from "../Shell";
import UserName from "../UserName";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "members :: 3310.nz" };

const RANK = { admin: 0, moderator: 1, member: 2 };

export default async function Members() {
  const [me, users, posts, withOwner] = await Promise.all([currentUser(), listUsers(), listPosts(), usersById([])]);
  const count: Record<string, number> = {};
  for (const p of posts) count[authorOf(p)] = (count[authorOf(p)] ?? 0) + 1;
  // Owner first, then admins, moderators and members, each oldest account first.
  const sorted = [...users].sort((a, b) => RANK[a.role] - RANK[b.role] || (a.createdAt ?? 0) - (b.createdAt ?? 0));
  const all = [withOwner[ownerId()], ...sorted];

  return (
    <Shell me={me}>
      <div className="old-board-h">
        <span>☺ member list</span>
        {!me && (
          <a className="old-btn" href="/register">
            join
          </a>
        )}
      </div>
      <p className="old-intro">
        {all.length} {all.length === 1 ? "member" : "members"}. {me ? "pick someone to send them a private message." : "log in to send private messages."}
      </p>
      <table className="old-table">
        <thead>
          <tr>
            <th>id</th>
            <th>name</th>
            <th>joined</th>
            <th>posts</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {all.map((u) => (
            <tr key={u.id}>
              <td className="old-uid">{u.num ? `#${u.num}` : ""}</td>
              <td>
                <UserName user={u} />
              </td>
              <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-GB") : "day one"}</td>
              <td>{count[u.id] ?? 0}</td>
              <td>{me && me.id !== u.id ? <a href={`/messages/${u.id}`}>✉ message</a> : me ? <i>you</i> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Shell>
  );
}
