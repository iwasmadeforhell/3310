"use client";
import { useState } from "react";
import type { PublicUser, Role } from "@/lib/users";
import UserName from "../UserName";

/** Role and account management. `owner` unlocks changing other admins; the API enforces the same rules. */
export default function UsersAdmin({ initial, owner }: { initial: PublicUser[]; owner: boolean }) {
  const [users, setUsers] = useState(initial);
  const [err, setErr] = useState<string | null>(null);

  async function setRole(u: PublicUser, role: Role) {
    setErr(null);
    const res = await fetch("/api/old/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, role }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) return setErr(data?.error ?? "Could not change the role");
    setUsers((list) => list.map((x) => (x.id === u.id ? data : x)));
  }

  async function remove(u: PublicUser) {
    if (!confirm(`Delete the account “${u.name}”? They will be logged out and the name becomes free again.`)) return;
    const posts = confirm(`Also delete every post written by ${u.name}?\n\nOK = delete their posts too\nCancel = keep their posts`);
    setErr(null);
    const res = await fetch(`/api/old/users?id=${encodeURIComponent(u.id)}${posts ? "&posts=1" : ""}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return setErr("Could not delete the account");
    setUsers((list) => list.filter((x) => x.id !== u.id));
  }

  return (
    <>
      <p className="old-intro">
        <b>member</b>: posts, edits and deletes their own posts, likes and dislikes. <b>moderator</b>: can also delete other people&apos;s board posts.{" "}
        <b>admin</b>: posts in the devlog, edits or deletes anything, manages members. only the owner can make or change admins.
      </p>
      {err && <p className="old-err">⚠ {err}</p>}
      <table className="old-table">
        <thead>
          <tr>
            <th>name</th>
            <th>joined</th>
            <th>role</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const locked = u.role === "admin" && !owner;
            return (
              <tr key={u.id}>
                <td>
                  <UserName user={u} badge={false} />
                </td>
                <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-GB") : ""}</td>
                <td>
                  <select value={u.role} disabled={locked} onChange={(e) => setRole(u, e.target.value as Role)} aria-label={`Role of ${u.name}`}>
                    <option value="member">member</option>
                    <option value="moderator">moderator</option>
                    <option value="admin" disabled={!owner}>
                      admin
                    </option>
                  </select>
                </td>
                <td>
                  {!locked && (
                    <button type="button" className="old-linkbtn" onClick={() => remove(u)}>
                      delete
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {!users.length && (
            <tr>
              <td colSpan={4} className="old-note">
                nobody has registered yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
