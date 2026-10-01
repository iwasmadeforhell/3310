import { redirect } from "next/navigation";
import { hasSession } from "@/lib/auth";
import Shell from "../Shell";
import PostEditor from "../PostEditor";

export const dynamic = "force-dynamic";

export default async function NewPost() {
  if (!(await hasSession("admin"))) redirect("/login");
  return (
    <Shell isAdmin count={false}>
      <PostEditor initial={{ title: "", body: "", tag: "news", mood: "" }} />
    </Shell>
  );
}
