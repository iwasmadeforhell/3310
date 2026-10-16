import { redis } from "@/lib/redis";
import { EMAIL_RE, checkPassword, hashPassword, normEmail, saveUser } from "@/lib/store";
import { bad, needUser, withSession } from "@/lib/storeApi";

export const dynamic = "force-dynamic";

// Set or change the email + password login: { email?, current?, password }. Signs out every other session.
export async function POST(req: Request) {
  const u = await needUser(req);
  if (u instanceof Response) return u;
  const b = (await req.json().catch(() => ({}))) as { email?: string; current?: string; password?: string };
  const pw = String(b.password ?? "");
  if (pw.length < 8 || pw.length > 200) return bad("Use a password of 8 to 200 characters.");
  if (u.passHash && !(await checkPassword(String(b.current ?? ""), u.passHash))) return bad("Your current password is wrong.");
  let email = u.email;
  if (!email) {
    const e = normEmail(String(b.email ?? ""));
    if (!EMAIL_RE.test(e)) return bad("Enter an email to log in with.");
    const ok = await redis().set(`st:email:${e}`, u.id, { nx: true });
    if (!ok) return bad("There is already an account with that email.");
    email = e;
  }
  const next = { ...u, email, passHash: await hashPassword(pw), sv: u.sv + 1 };
  await saveUser(next);
  return withSession(next);
}
