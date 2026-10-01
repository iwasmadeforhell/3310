export const SECTIONS = ["portfolio", "drop", "old"] as const;
export type Section = (typeof SECTIONS)[number];

/** portfolio.3310.nz -> "portfolio", drop.localhost:3000 -> "drop", 3310.nz -> null */
export function sectionForHost(host: string | null): Section | null {
  if (!host) return null;
  const labels = host.split(":")[0].toLowerCase().split(".");
  if (labels.length < 2) return null;
  const sub = labels[0];
  return (SECTIONS as readonly string[]).includes(sub) ? (sub as Section) : null;
}
