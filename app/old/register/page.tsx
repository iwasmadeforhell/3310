import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/users";
import AuthForm from "../AuthForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "register :: 3310.nz" };

export default async function Page() {
  if (await currentUser()) redirect("/");
  return <AuthForm mode="register" />;
}
