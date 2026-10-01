"use client";
import UserName from "./UserName";

export const NAME_COLORS = ["#a2cffe", "#ff6ec7", "#9dff3e", "#3ef0ff", "#ffd84d", "#ff9a5c", "#c9a2ff", "#ff5c5c", "#ffffff"];

/** Swatches plus a free colour input, with a live preview of the name chip. */
export default function ColorPicker({ name, color, onChange }: { name: string; color: string; onChange: (c: string) => void }) {
  return (
    <div className="old-colors">
      <div className="old-swatches" role="radiogroup" aria-label="Name colour">
        {NAME_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            aria-label={c}
            className={color === c ? "on" : ""}
            style={{ background: c }}
            onClick={() => onChange(c)}
          />
        ))}
        <input type="color" value={color} onChange={(e) => onChange(e.target.value)} aria-label="Custom colour" title="custom colour" />
      </div>
      <div className="old-color-preview">
        preview: <UserName user={{ name: name || "your_name", role: "member", color }} />
      </div>
    </div>
  );
}
