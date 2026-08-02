const REDOC_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>Solaris Grid API · Reference</title>
    <style>
      body { margin: 0; background: #020806; }
      .docs-bar { min-height: 56px; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; gap: 20px; color: #eefbf4; background: #06100c; border-bottom: 1px solid rgba(39,239,145,.18); font: 600 14px system-ui,sans-serif; }
      .docs-bar strong { letter-spacing: .12em; }
      .docs-bar span, .docs-bar a { color: #8fffc2; font-weight: 500; letter-spacing: 0; }
      .docs-bar a { text-decoration: none; }
      @media (max-width: 640px) { .docs-bar { padding: 0 14px; } .docs-bar span { display: none; } }
    </style>
  </head>
  <body>
    <header class="docs-bar">
      <strong>SOLARIS <span>API Reference</span></strong>
      <a href="/">← Back to dashboard</a>
    </header>
    <redoc spec-url="/openapi.json?v=1.0.1" hide-download-button="false" expand-responses="200,201" theme='{
      "colors": { "primary": { "main": "#20db81" }, "text": { "primary": "#dcefe5", "secondary": "#87a295" }, "http": { "get": "#20db81", "post": "#f0a85a" } },
      "sidebar": { "backgroundColor": "#06100c", "textColor": "#b7cdc1", "activeTextColor": "#25ef91" },
      "rightPanel": { "backgroundColor": "#07100c" },
      "typography": { "fontFamily": "system-ui, sans-serif", "headings": { "fontFamily": "system-ui, sans-serif" }, "code": { "fontFamily": "ui-monospace, monospace" } }
    }'></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js" crossorigin="anonymous"></script>
  </body>
</html>`;

export async function GET() {
  return new Response(REDOC_HTML, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
