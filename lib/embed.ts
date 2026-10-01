/** Turn a normal share link into an embeddable iframe src. Returns null if unsupported. */
export function toEmbed(raw: string): { src: string; height: number } | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const h = u.hostname.replace(/^www\./, "");

  if (h === "youtube.com" || h === "music.youtube.com") {
    const list = u.searchParams.get("list");
    const v = u.searchParams.get("v");
    if (v) return { src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v)}${list ? `?list=${encodeURIComponent(list)}` : ""}`, height: 220 };
    if (list) return { src: `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(list)}`, height: 220 };
  }
  if (h === "youtu.be") {
    return { src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(u.pathname.slice(1))}`, height: 220 };
  }
  if (h === "open.spotify.com") {
    const path = u.pathname.replace(/^\/intl-[a-z]+/, "").replace(/^\/embed/, "");
    const tall = /^\/(playlist|album|artist|show)/.test(path);
    return { src: `https://open.spotify.com/embed${path}`, height: tall ? 352 : 152 };
  }
  if (h === "soundcloud.com" || h === "on.soundcloud.com") {
    const params = new URLSearchParams({ url: raw, color: "#8fb35a", auto_play: "false", visual: "false", show_comments: "false" });
    return { src: `https://w.soundcloud.com/player/?${params}`, height: 166 };
  }
  if (h === "w.soundcloud.com" || h === "bandcamp.com" || h.endsWith(".bandcamp.com")) {
    return { src: raw, height: h.includes("bandcamp") ? 120 : 166 };
  }
  return null;
}
