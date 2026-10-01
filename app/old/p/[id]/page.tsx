import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPost, postExtras, sectionOf } from "@/lib/posts";
import { currentUser } from "@/lib/users";
import Shell from "../../Shell";
import PostView from "../../PostView";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const post = await getPost((await params).id);
  return { title: post ? `${post.title} :: 3310.nz` : "not found :: 3310.nz" };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [post, me] = await Promise.all([getPost(id), currentUser()]);
  if (!post) notFound();
  const extras = await postExtras([post], me);
  const devlog = sectionOf(post) === "devlog";

  return (
    <Shell me={me} latest={post}>
      <p className="old-back">
        <a href={devlog ? "/devlog" : "/"}>« back to {devlog ? "the devlog" : "all posts"}</a>
      </p>
      <PostView post={post} me={me} extras={extras} full />
    </Shell>
  );
}
