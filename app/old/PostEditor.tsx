"use client";
import { useRef, useState, type FormEvent } from "react";
import { render } from "@/lib/minimark";

type Init = { id?: string; title: string; body: string; tag: string; mood: string; section: "board" | "devlog" };
const TAGS = ["news", "update", "random", "music"];

/** `admin` adds the choice of section; the API checks it again. */
export default function PostEditor({ initial, admin }: { initial: Init; admin: boolean }) {
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [tag, setTag] = useState(initial.tag);
  const [mood, setMood] = useState(initial.mood);
  const [section, setSection] = useState(initial.section);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);

  function wrap(before: string, after = before, placeholder = "text") {
    const el = ta.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = body.slice(s, e) || placeholder;
    const next = body.slice(0, s) + before + sel + after + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/old/posts", {
      method: initial.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: initial.id, title, body, tag, mood, section: admin ? section : undefined }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(data.error ?? "Save failed");
      setBusy(false);
      return;
    }
    window.location.assign(`/p/${data.id}`);
  }

  return (
    <form className="old-editor" onSubmit={save}>
      <div className="old-board-h">
        <span>{initial.id ? "✎ edit post" : "✎ new post"}</span>
        <a href={initial.section === "devlog" ? "/devlog" : "/"} className="old-btn">
          cancel
        </a>
      </div>
      <label>
        title
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
      </label>
      {admin && (
        <label>
          post in
          <select value={section} onChange={(e) => setSection(e.target.value as Init["section"])}>
            <option value="board">the board</option>
            <option value="devlog">devlog (admins only)</option>
          </select>
        </label>
      )}
      <div className="old-editor-row">
        <label>
          category
          <select value={tag} onChange={(e) => setTag(e.target.value)}>
            {TAGS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          current mood
          <input value={mood} onChange={(e) => setMood(e.target.value)} maxLength={60} placeholder="sleepy" />
        </label>
      </div>
      <div className="old-toolbar">
        <button type="button" onClick={() => wrap("**")}>
          <b>B</b>
        </button>
        <button type="button" onClick={() => wrap("*")}>
          <i>I</i>
        </button>
        <button type="button" onClick={() => wrap("~~")}>
          <s>S</s>
        </button>
        <button type="button" onClick={() => wrap("[", "](https://)", "link text")}>
          link
        </button>
        <button type="button" onClick={() => wrap("![", "](https://)", "image")}>
          img
        </button>
        <button type="button" onClick={() => wrap("\n- ", "", "list item")}>
          • list
        </button>
        <span className="old-spacer" />
        <button type="button" className={preview ? "on" : ""} onClick={() => setPreview((p) => !p)}>
          {preview ? "edit" : "preview"}
        </button>
      </div>
      {preview ? (
        <div className="old-post-body old-preview" dangerouslySetInnerHTML={{ __html: render(body) }} />
      ) : (
        <textarea ref={ta} value={body} onChange={(e) => setBody(e.target.value)} rows={14} maxLength={20000} required />
      )}
      <p className="old-help">
        **bold** · *italic* · [link](https://…) · ![img](https://…) · # heading · - list · &gt; quote · blank line = new paragraph
      </p>
      {err && <p className="old-err">⚠ {err}</p>}
      <button className="old-btn big" disabled={busy}>
        {busy ? "posting..." : initial.id ? "save changes" : "post it!"}
      </button>
    </form>
  );
}
