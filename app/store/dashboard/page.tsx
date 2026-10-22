import { redirect } from "next/navigation";
import { CHANNELS, canGet, getRelease } from "@/lib/releases";
import { HWID_COOLDOWN_MS, currentUser, payments, publicUser } from "@/lib/store";
import Dashboard from "./Dashboard";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ paid?: string }> }) {
  const u = await currentUser();
  if (!u) redirect("/login?next=/dashboard");
  const sp = await searchParams;
  const releases = (await Promise.all(CHANNELS.filter((c) => canGet(u, c)).map(getRelease))).filter((r) => r !== null);
  return (
    <Dashboard
      initial={publicUser(u)}
      payments={await payments(u.id)}
      releases={releases.map((r) => ({ channel: r.channel, version: r.version, name: r.name, size: r.size, uploadedAt: r.uploadedAt }))}
      cooldownMs={HWID_COOLDOWN_MS}
      paid={sp.paid ?? ""}
    />
  );
}
