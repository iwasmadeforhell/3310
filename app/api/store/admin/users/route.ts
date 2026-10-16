import { CHANNELS, getRelease } from "@/lib/releases";
import { devHwids, listUsers, publicUser } from "@/lib/store";
import { needAdmin } from "@/lib/storeApi";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const a = await needAdmin(req, false);
  if (a instanceof Response) return a;
  const [users, releases] = await Promise.all([listUsers(), Promise.all(CHANNELS.map(getRelease))]);
  return Response.json({ users: users.map(publicUser), devHwids: devHwids(), releases: releases.filter(Boolean) });
}
