import { redirect } from "next/navigation";
import { currentUser } from "@/lib/store";
import { safeNext } from "@/lib/storeApi";
import AuthForm from "./AuthForm";

export const metadata = { title: "Log in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await currentUser().catch(() => null)) redirect(next);
  return <AuthForm next={next} error={sp.error} />;
}
