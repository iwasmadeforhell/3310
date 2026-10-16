import { payments, publicUser } from "@/lib/store";
import { needUser } from "@/lib/storeApi";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = await needUser(req, false);
  if (u instanceof Response) return u;
  return Response.json({ user: publicUser(u), payments: await payments(u.id) });
}
