import { notFound } from "next/navigation";
import { currentUser, isAdmin } from "@/lib/store";
import Admin from "./Admin";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const u = await currentUser().catch(() => null);
  if (!isAdmin(u)) notFound();
  return <Admin />;
}
