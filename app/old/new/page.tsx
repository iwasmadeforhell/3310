import { redirect } from "next/navigation";
import { currentUser, isAdmin } from "@/lib/users";
import Shell from "../Shell";
import PostEditor from "../PostEditor";

export const dynamic = "force-dynamic";

export default async function NewPost({ searchParams }: { searchParams: Promise<{ in?: string }> }) {
  const me = await currentUser();
  if (!me) redirect("/login");
  const admin = isAdmin(me);
  const section = admin && (await searchParams).in === "devlog" ? "devlog" : "board";
  return (
    <Shell me={me} count={false}>
      <PostEditor initial={{ title: "", body: "", tag: "news", mood: "", section }} admin={admin} />
    </Shell>
  );
}
