"use client";
import { useRef, useState } from "react";
import type { PublicUser } from "@/lib/users";
import Avatar from "../Avatar";
import ColorPicker from "../ColorPicker";

const MAX_BIO = 300;
const SEND_SIZE = 320; // pictures are shrunk to this in the browser; the server makes the final 160px version

/** Centre-crop a picture to a square and shrink it, so the upload stays small. */
async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(SEND_SIZE, side);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

/** Profile picture, "about me" and name colour. The owner's name keeps its gradient, so no colour picker there. */
export default function AccountForm({ me }: { me: PublicUser }) {
  const [user, setUser] = useState(me);
  const [color, setColor] = useState(me.color);
  const [bio, setBio] = useState(me.bio ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return setMsg(data?.error ?? "That didn't work");
    setUser(data);
    return data as PublicUser;
  }

  async function pick(f: File | undefined) {
    if (!f) return;
    try {
      await call("/api/old/avatar", "POST", { image: await shrink(f) });
    } catch {
      setMsg("That file isn't a picture I can use. Try a JPG, PNG, WebP or GIF.");
    }
  }

  async function save() {
    if (await call("/api/old/users", "PATCH", { bio, color: me.owner ? undefined : color })) window.location.reload();
  }

  const changed = bio !== (me.bio ?? "") || (!me.owner && color !== me.color);

  return (
    <div className="old-editor">
      <p>
        user name: <b>{me.name}</b> · user id: <b>{me.num ? `#${me.num}` : "?"}</b> · role: <b>{me.owner ? "owner" : me.role}</b> ·{" "}
        <a href={`/u/${me.id}`}>view my profile</a>
      </p>

      <label>profile picture</label>
      <div className="old-avatar-edit">
        <Avatar user={user} size={96} />
        <div>
          <button type="button" className="old-btn" onClick={() => file.current?.click()} disabled={busy}>
            {user.avatar ? "change picture" : "upload picture"}
          </button>{" "}
          {user.avatar && (
            <button type="button" className="old-btn" onClick={() => call("/api/old/avatar", "DELETE")} disabled={busy}>
              remove
            </button>
          )}
          <p className="old-help">JPG, PNG, WebP or GIF. it gets cropped to a square.</p>
        </div>
        <input
          ref={file}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      <label>
        about me
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={MAX_BIO} rows={4} placeholder="a few words for your profile page" className="old-bio-edit" />
      </label>
      <p className="old-help">
        {bio.length}/{MAX_BIO} · plain text
      </p>

      {!me.owner && (
        <>
          <label>name colour</label>
          <ColorPicker name={me.name} color={color} onChange={setColor} />
        </>
      )}

      {msg && <p className="old-err">⚠ {msg}</p>}
      <button type="button" className="old-btn big" onClick={save} disabled={busy || !changed}>
        {busy ? "saving..." : "save profile"}
      </button>
    </div>
  );
}
