// Bot filter for the visitor counter. Nothing can tell a bot from a person with
// certainty, so this only keeps out the obvious ones: crawlers, link-preview
// fetchers (Discord etc.), scripts and HTTP libraries, headless browsers,
// uptime monitors, and requests that aren't a person opening a page.

const BOT_UA =
  /(?<!cu)bots?\b|crawl|spider|slurp|scrap|fetch|preview|embed|monitor|uptime|probe|checker|scan|archive|headless|phantom|puppeteer|playwright|selenium|lighthouse|pingdom|curl|wget|httpie|python|requests|aiohttp|urllib|node|axios|got\b|undici|deno|bun\/|go-http|okhttp|java|apache|libwww|perl|ruby|php|guzzle|restsharp|postman|insomnia|facebookexternalhit|twitterbot|discord|telegram|whatsapp|slack|skype|linkedin|pinterest|reddit|vkshare|bingpreview|yandex|baidu|duckduck|applebot|semrush|ahrefs|mj12|dotbot|petal|bytespider|gptbot|claude|anthropic|perplexity|ccbot|amazon|vercel|netlify|cloudflare|github|feedly|rss|zgrab|masscan|nmap|nikto|censys|shodan|expanse/i;

type HeaderBag = { get(name: string): string | null };

export function isBot(h: HeaderBag): boolean {
  const ua = h.get("user-agent")?.trim() ?? "";
  // Real browsers always send a long user agent that starts with Mozilla/ or Opera/.
  if (ua.length < 30 || !/^(mozilla|opera)\//i.test(ua)) return true;
  if (BOT_UA.test(ua)) return true;
  // A person opening a page asks for HTML; scripts and prefetchers usually don't.
  if (!(h.get("accept") ?? "").includes("text/html")) return true;
  // Browsers' speculative loads and Next.js link prefetches aren't visits.
  const purpose = `${h.get("purpose") ?? ""} ${h.get("sec-purpose") ?? ""}`.toLowerCase();
  if (purpose.includes("prefetch") || purpose.includes("prerender")) return true;
  if (h.get("next-router-prefetch") || h.get("rsc")) return true;
  // Browsers send these; most scripted clients don't bother.
  if (!h.get("accept-language")) return true;
  return false;
}
