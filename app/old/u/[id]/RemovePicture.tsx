"use client";

/** Moderation: clear a member's profile picture (the API checks who may do this). */
export default function RemovePicture({ id }: { id: string }) {
  async function remove() {
    if (!confirm("Remove this member's profile picture?")) return;
    const res = await fetch(`/api/old/avatar?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) window.location.reload();
    else alert("Could not remove the picture");
  }
  return (
    <p className="old-small">
      [
      <button type="button" className="old-linkbtn" onClick={remove}>
        remove picture
      </button>
      ]
    </p>
  );
}
