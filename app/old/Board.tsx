import { hasRedis } from "@/lib/redis";
import { listPosts, postExtras, type Section } from "@/lib/posts";
import { currentUser, isAdmin } from "@/lib/users";
import Shell from "./Shell";
import PostView from "./PostView";

/** One section's list of posts: the open board or the admin-only devlog. */
export default async function Board({ section }: { section: Section }) {
  const [posts, me] = await Promise.all([listPosts(section), currentUser()]);
  const extras = await postExtras(posts, me);
  const devlog = section === "devlog";
  const canPost = devlog ? isAdmin(me) : !!me;

  return (
    <Shell me={me} latest={posts[0]}>
      <div className="old-board-h">
        <span>{devlog ? "⚙ devlog" : "✉ the board"}</span>
        {canPost ? (
          <a className="old-btn" href={devlog ? "/new?in=devlog" : "/new"}>
            + new post
          </a>
        ) : (
          !devlog && (
            <a className="old-btn" href="/register">
              register to post
            </a>
          )
        )}
      </div>
      {devlog && <p className="old-intro">what&apos;s being built, fixed and broken on 3310.nz. only admins post here; everyone can read and vote.</p>}
      {!hasRedis() && <p className="old-note">the database isn&apos;t connected yet (see README) :(</p>}
      {hasRedis() && posts.length === 0 && <p className="old-note">nothing here yet... check back soon!!</p>}
      {posts.map((p) => (
        <PostView key={p.id} post={p} me={me} extras={extras} />
      ))}
    </Shell>
  );
}
