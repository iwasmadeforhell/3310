import { hasSession } from "@/lib/auth";
import { hasRedis } from "@/lib/redis";
import { listPosts } from "@/lib/posts";
import Shell from "./Shell";
import PostView from "./PostView";

export const dynamic = "force-dynamic";

export default async function OldHome() {
  const [posts, isAdmin] = await Promise.all([listPosts(), hasSession("admin")]);

  return (
    <Shell isAdmin={isAdmin} latest={posts[0]}>
      <div className="old-board-h">
        <span>✉ news &amp; updates</span>
        {isAdmin && (
          <a className="old-btn" href="/new">
            + new post
          </a>
        )}
      </div>
      {!hasRedis() && <p className="old-note">the database isn&apos;t connected yet (see README) :(</p>}
      {hasRedis() && posts.length === 0 && <p className="old-note">nothing here yet... check back soon!!</p>}
      {posts.map((p) => (
        <PostView key={p.id} post={p} isAdmin={isAdmin} />
      ))}
    </Shell>
  );
}
