import type { CSSProperties } from "react";
import type { PublicUser } from "@/lib/users";

type Shown = Pick<PublicUser, "name" | "role" | "color" | "owner" | "deleted" | "num"> & { id?: string };

/** A display name styled like a forum rank: the user's colour (or the owner's
 *  gradient) on a dark chip, followed by a badge for moderators and admins.
 *  The name links to the member's profile unless `link` is off. */
export default function UserName({ user, badge = true, link = true }: { user: Shown; badge?: boolean; link?: boolean }) {
  if (user.deleted) return <span className="old-gone">{user.name} (deleted)</span>;
  const rank = user.owner ? "owner" : user.role === "admin" ? "admin" : user.role === "moderator" ? "mod" : null;
  const chip = (
    <span className={`old-user ${user.color ? "solid" : ""}`} title={user.num ? `user #${user.num}` : undefined} style={user.color ? ({ "--c": user.color } as CSSProperties) : undefined}>
      <span>{user.name}</span>
    </span>
  );
  return (
    <>
      {link && user.id ? (
        <a className="old-userlink" href={`/u/${user.id}`}>
          {chip}
        </a>
      ) : (
        chip
      )}
      {badge && rank && <span className={`old-rank r-${rank}`}>{rank}</span>}
    </>
  );
}
