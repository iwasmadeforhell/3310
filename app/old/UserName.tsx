import type { CSSProperties } from "react";
import type { PublicUser } from "@/lib/users";

type Shown = Pick<PublicUser, "name" | "role" | "color" | "owner" | "deleted">;

/** A display name styled like a forum rank: the user's colour (or the owner's
 *  gradient) on a dark chip, followed by a badge for moderators and admins. */
export default function UserName({ user, badge = true }: { user: Shown; badge?: boolean }) {
  if (user.deleted) return <span className="old-gone">{user.name} (deleted)</span>;
  const rank = user.owner ? "owner" : user.role === "admin" ? "admin" : user.role === "moderator" ? "mod" : null;
  return (
    <>
      <span className={`old-user ${user.color ? "solid" : ""}`} style={user.color ? ({ "--c": user.color } as CSSProperties) : undefined}>
        <span>{user.name}</span>
      </span>
      {badge && rank && <span className={`old-rank r-${rank}`}>{rank}</span>}
    </>
  );
}
