/** Small standalone 404 page for the public /s and /f routes. */
export function notFoundPage(msg: string) {
  const safe = msg.replace(/[<>&"]/g, "");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not found · 3310.nz</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a1628;color:#c4dc8c;font:20px/1.4 ui-monospace,monospace;padding:16px;text-align:center}
.lcd{background:#a9c672;color:#1b2a10;padding:24px 28px;border-radius:6px;box-shadow:inset 0 0 18px rgba(30,50,10,.45)}a{color:#1b2a10}</style></head>
<body><div class="lcd"><div style="font-size:28px">404</div><p>${safe}</p><a href="/">3310.nz</a></div></body></html>`;
  return new Response(html, { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
