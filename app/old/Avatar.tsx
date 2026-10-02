import type { CSSProperties } from "react";
import type { PublicUser } from "@/lib/users";

type Shown = Pick<PublicUser, "id" | "name" | "color" | "avatar" | "deleted">;

/** A member's profile picture, or a coloured tile with their initial if they haven't set one. */
export default function Avatar({ user, size = 40 }: { user: Shown; size?: number }) {
  const box = { width: size, height: size } as CSSProperties;
  if (user.avatar && !user.deleted) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="old-av" src={`/api/old/avatar/${user.id}?v=${user.avatar}`} alt="" width={size} height={size} style={box} loading="lazy" />;
  }
  return (
    <span className="old-av none" style={{ ...box, fontSize: Math.round(size * 0.5), "--c": user.color || "#a2cffe" } as CSSProperties} aria-hidden>
      {user.deleted ? "?" : user.name.slice(0, 1).toUpperCase()}
    </span>
  );
}
