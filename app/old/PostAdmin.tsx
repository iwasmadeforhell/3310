"use client";

export default function PostAdmin({ id, title }: { id: string; title: string }) {
  async function remove() {
    if (!confirm(`Delete “${title}”?`)) return;
    const res = await fetch(`/api/old/posts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) window.location.assign("/");
    else alert("Delete failed");
  }
  return (
    <>
      {" "}
      [<a href={`/edit/${id}`}>edit</a>] [
      <button className="old-linkbtn" onClick={remove}>
        delete
      </button>
      ]
    </>
  );
}
