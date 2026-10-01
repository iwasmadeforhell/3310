import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { hasSession } from "@/lib/auth";
import { getPost } from "@/lib/posts";
import Shell from "../../Shell";
import PostView from "../../PostView";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const post = await getPost((await params).id);
  return { title: post ? `${post.title} :: 3310.nz` : "not found :: 3310.nz" };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [post, isAdmin] = await Promise.all([getPost(id), hasSession("admin")]);
  if (!post) notFound();

  return (
    <Shell isAdmin={isAdmin} latest={post}>
      <p className="old-back">
        <a href="/">« back to all posts</a>
      </p>
      <PostView post={post} isAdmin={isAdmin} full />
    </Shell>
  );
}
