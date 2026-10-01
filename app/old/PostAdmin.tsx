"use client";

/** Edit / delete links, shown only for the actions this viewer is allowed (the API re-checks). */
export default function PostAdmin({ id, title, edit, del, back }: { id: string; title: string; edit: boolean; del: boolean; back: string }) {
  async function remove() {
    if (!confirm(`Delete “${title}”?`)) return;
    const res = await fetch(`/api/old/posts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) window.location.assign(back);
    else alert("Delete failed");
  }
  return (
    <>
      {edit && (
        <>
          {" "}
          [<a href={`/edit/${id}`}>edit</a>]
        </>
      )}
      {del && (
        <>
          {" "}
          [
          <button className="old-linkbtn" onClick={remove}>
            delete
          </button>
          ]
        </>
      )}
    </>
  );
}
