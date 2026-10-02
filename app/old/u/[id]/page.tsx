import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { authorOf, fmtDate, listPosts, sectionOf } from "@/lib/posts";
import { currentUser, getProfile, isAdmin, isStaff } from "@/lib/users";
import { votesFor } from "@/lib/votes";
import Shell from "../../Shell";
import Avatar from "../../Avatar";
import UserName from "../../UserName";
import RemovePicture from "./RemovePicture";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const user = await getProfile((await params).id.toLowerCase());
  return { title: user ? `${user.name} :: 3310.nz` : "not found :: 3310.nz" };
}

export default async function Profile({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id.toLowerCase();
  const [user, me, all] = await Promise.all([getProfile(id), currentUser(), listPosts()]);
  if (!user) notFound();
  const posts = all.filter((p) => authorOf(p) === user.id);
  const votes = await votesFor(posts.map((p) => p.id));
  const likes = posts.reduce((n, p) => n + (votes[p.id]?.up ?? 0), 0);
  const dislikes = posts.reduce((n, p) => n + (votes[p.id]?.down ?? 0), 0);
  const mine = me?.id === user.id;
  // Staff can clear a member's picture; only the owner can clear an admin's.
  const canClear = !!user.avatar && !mine && isStaff(me) && (!isAdmin(user) || !!me?.owner);
  const rank = user.owner ? "owner" : user.role;

  return (
    <Shell me={me}>
      <div className="old-board-h">
        <span>☺ profile</span>
        {mine ? (
          <a className="old-btn" href="/account">
            edit profile
          </a>
        ) : me ? (
          <a className="old-btn" href={`/messages/${user.id}`}>
            ✉ message
          </a>
        ) : null}
      </div>

      <div className="old-profile">
        <Avatar user={user} size={120} />
        <div className="old-profile-info">
          <p className="old-profile-name">
            <UserName user={user} link={false} />
          </p>
          <dl>
            <dt>user id</dt>
            <dd>{user.num ? `#${user.num}` : "?"}</dd>
            <dt>role</dt>
            <dd>{rank}</dd>
            <dt>joined</dt>
            <dd>{user.createdAt ? fmtDate(user.createdAt) : "day one"}</dd>
            <dt>posts</dt>
            <dd>{posts.length}</dd>
            <dt>likes received</dt>
            <dd>
              ▲ {likes} · ▼ {dislikes}
            </dd>
          </dl>
          {canClear && <RemovePicture id={user.id} />}
        </div>
      </div>

      {user.bio && (
        <>
          <h3 className="old-h3">about me</h3>
          <p className="old-bio">{user.bio}</p>
        </>
      )}

      <h3 className="old-h3">posts by {user.name}</h3>
      {posts.length === 0 && <p className="old-note">no posts yet.</p>}
      {posts.length > 0 && (
        <table className="old-table">
          <thead>
            <tr>
              <th>title</th>
              <th>in</th>
              <th>posted</th>
              <th>votes</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id}>
                <td>
                  <span className={`old-tag t-${p.tag}`}>[{p.tag}]</span> <a href={`/p/${p.id}`}>{p.title}</a>
                </td>
                <td>{sectionOf(p) === "devlog" ? "devlog" : "the board"}</td>
                <td>{fmtDate(p.createdAt)}</td>
                <td>
                  ▲ {votes[p.id]?.up ?? 0} · ▼ {votes[p.id]?.down ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Shell>
  );
}
