import { render } from "@/lib/minimark";
import { authorOf, canDelete, canEdit, fmtDate, sectionOf, type Post, type PostExtras } from "@/lib/posts";
import type { PublicUser } from "@/lib/users";
import Avatar from "./Avatar";
import PostAdmin from "./PostAdmin";
import UserName from "./UserName";
import Vote from "./Vote";

const NEW_MS = 1000 * 60 * 60 * 24 * 7;

export default function PostView({ post, me, extras, full }: { post: Post; me: PublicUser | null; extras: PostExtras; full?: boolean }) {
  const isNew = Date.now() - post.createdAt < NEW_MS;
  const author = extras.authors[authorOf(post)];
  const back = sectionOf(post) === "devlog" ? "/devlog" : "/";
  return (
    <article className="old-post">
      <div className="old-post-h">
        {author && (
          <a className="old-userlink" href={author.deleted ? undefined : `/u/${author.id}`} aria-label={`${author.name}'s profile`}>
            <Avatar user={author} size={36} />
          </a>
        )}
        <span className={`old-tag t-${post.tag}`}>[{post.tag}]</span>
        {full ? <h2>{post.title}</h2> : <a href={`/p/${post.id}`}><h2>{post.title}</h2></a>}
        {isNew && <span className="old-new">NEW!</span>}
      </div>
      <div className="old-post-body" dangerouslySetInnerHTML={{ __html: render(post.body) }} />
      <div className="old-post-f">
        <span>
          posted by {author ? <UserName user={author} /> : "?"} on {fmtDate(post.createdAt)}
          {post.updatedAt ? ` (edited ${fmtDate(post.updatedAt)})` : ""}
          {post.mood ? ` · mood: ${post.mood}` : ""}
        </span>
        <span>
          <Vote id={post.id} initial={extras.votes[post.id] ?? { up: 0, down: 0, mine: 0 }} loggedIn={!!me} />
          {!full && <a href={`/p/${post.id}`}>permalink</a>}
          <PostAdmin id={post.id} title={post.title} edit={canEdit(me, post)} del={canDelete(me, post, author)} back={back} />
        </span>
      </div>
    </article>
  );
}
