export const SECTIONS = ["portfolio", "drop", "forum"] as const;
export type Section = (typeof SECTIONS)[number];

/** The app folder each section's pages live in. The forum's is still called "old". */
export const FOLDER: Record<Section, string> = { portfolio: "portfolio", drop: "drop", forum: "old" };

/** Subdomains that moved: the forum used to be old.3310.nz. They redirect to the new one. */
export const MOVED: Record<string, Section> = { old: "forum" };

const subdomain = (host: string | null) => {
  const labels = (host ?? "").split(":")[0].toLowerCase().split(".");
  return labels.length < 2 ? null : labels[0];
};

/** portfolio.3310.nz -> "portfolio", forum.localhost:3000 -> "forum", 3310.nz -> null */
export function sectionForHost(host: string | null): Section | null {
  const sub = subdomain(host);
  return (SECTIONS as readonly string[]).includes(sub ?? "") ? (sub as Section) : null;
}

/** old.3310.nz -> "forum", anything else -> null */
export function movedSectionForHost(host: string | null): Section | null {
  return MOVED[subdomain(host) ?? ""] ?? null;
}
