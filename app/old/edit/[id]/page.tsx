import { notFound, redirect } from "next/navigation";
import { hasSession } from "@/lib/auth";
import { getPost } from "@/lib/posts";
import Shell from "../../Shell";
import PostEditor from "../../PostEditor";

export const dynamic = "force-dynamic";

export default async function EditPost({ params }: { params: Promise<{ id: string }> }) {
  if (!(await hasSession("admin"))) redirect("/login");
  const post = await getPost((await params).id);
  if (!post) notFound();
  return (
    <Shell isAdmin count={false}>
      <PostEditor initial={{ id: post.id, title: post.title, body: post.body, tag: post.tag, mood: post.mood ?? "" }} />
    </Shell>
  );
}
