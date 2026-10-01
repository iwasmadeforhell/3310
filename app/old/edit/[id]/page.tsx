import { notFound, redirect } from "next/navigation";
import { canEdit, getPost, sectionOf } from "@/lib/posts";
import { currentUser, isAdmin } from "@/lib/users";
import Shell from "../../Shell";
import PostEditor from "../../PostEditor";

export const dynamic = "force-dynamic";

export default async function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) redirect("/login");
  const post = await getPost((await params).id);
  if (!post) notFound();
  if (!canEdit(me, post)) redirect(`/p/${post.id}`);
  return (
    <Shell me={me} count={false}>
      <PostEditor
        initial={{ id: post.id, title: post.title, body: post.body, tag: post.tag, mood: post.mood ?? "", section: sectionOf(post) }}
        admin={isAdmin(me)}
      />
    </Shell>
  );
}
