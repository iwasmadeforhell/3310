import { render } from "@/lib/minimark";
import { fmtDate, type Post } from "@/lib/posts";
import PostAdmin from "./PostAdmin";
import UserName from "./UserName";

const NEW_MS = 1000 * 60 * 60 * 24 * 7;

export default function PostView({ post, isAdmin, full }: { post: Post; isAdmin: boolean; full?: boolean }) {
  const isNew = Date.now() - post.createdAt < NEW_MS;
  return (
    <article className="old-post">
      <div className="old-post-h">
        <span className={`old-tag t-${post.tag}`}>[{post.tag}]</span>
        {full ? <h2>{post.title}</h2> : <a href={`/p/${post.id}`}><h2>{post.title}</h2></a>}
        {isNew && <span className="old-new">NEW!</span>}
      </div>
      <div className="old-post-body" dangerouslySetInnerHTML={{ __html: render(post.body) }} />
      <div className="old-post-f">
        <span>
          posted by <UserName /> on {fmtDate(post.createdAt)}
          {post.updatedAt ? ` (edited ${fmtDate(post.updatedAt)})` : ""}
          {post.mood ? ` · mood: ${post.mood}` : ""}
        </span>
        <span>
          {!full && <a href={`/p/${post.id}`}>permalink</a>}
          {isAdmin && <PostAdmin id={post.id} title={post.title} />}
        </span>
      </div>
    </article>
  );
}
