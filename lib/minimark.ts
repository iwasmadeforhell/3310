// Tiny, safe markdown-ish renderer for forum posts.
// Everything is HTML-escaped first; only a handful of patterns become tags.
//   **bold**  *italic*  `code`  [text](https://link)  ![alt](https://img)
//   # Heading   - list item   > quote   blank line = new paragraph

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const safeUrl = (u: string) => (/^(https?:\/\/|\/(?!\/))/i.test(u) ? u : "#");

function inline(s: string): string {
  return s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) => `<img src="${safeUrl(url)}" alt="${alt}" loading="lazy">`)
    .replace(
      /\[([^\]]+)\]\(([^)\s]+)\)/g,
      (_, text, url) => `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`,
    )
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<i>$2</i>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>");
}

export function render(src: string): string {
  const blocks = src.replace(/\r\n?/g, "\n").trim().split(/\n{2,}/);
  return blocks
    .map((block) => {
      const b = esc(block);
      const h = b.match(/^(#{1,3})\s+(.*)$/);
      if (h && !b.includes("\n")) {
        const lvl = h[1].length + 2; // # -> h3
        return `<h${lvl}>${inline(h[2])}</h${lvl}>`;
      }
      const lines = b.split("\n");
      if (lines.every((l) => /^[-*]\s+/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`;
      }
      if (lines.every((l) => l.startsWith("&gt;"))) {
        return `<blockquote>${lines.map((l) => inline(l.replace(/^&gt;\s?/, ""))).join("<br>")}</blockquote>`;
      }
      if (b.trim() === "---") return "<hr>";
      return `<p>${inline(b).replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");
}
