const SWAGGER_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>Solaris Grid API · Swagger</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      :root { color-scheme: dark; }
      body { margin: 0; background: #020806; }
      .docs-bar { min-height: 56px; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; gap: 20px; color: #eefbf4; background: #06100c; border-bottom: 1px solid rgba(39,239,145,.18); font: 600 14px system-ui,sans-serif; }
      .docs-bar strong { letter-spacing: .12em; }
      .docs-bar span { color: #8fffc2; font-weight: 500; letter-spacing: 0; }
      .docs-bar a { color: #8fffc2; text-decoration: none; font-weight: 500; }
      .swagger-ui { color: #dcefe5; }
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info, .swagger-ui .scheme-container { margin: 28px 0; }
      .swagger-ui .scheme-container { background: #07140e; box-shadow: none; border: 1px solid rgba(39,239,145,.14); }
      .swagger-ui, .swagger-ui .info .title, .swagger-ui .info p, .swagger-ui .info li, .swagger-ui .opblock-tag, .swagger-ui .opblock-description-wrapper p, .swagger-ui .response-col_status, .swagger-ui table thead tr td, .swagger-ui table thead tr th { color: #dcefe5; }
      .swagger-ui .opblock-tag { border-bottom-color: rgba(126,147,136,.3); }
      .swagger-ui .model-box, .swagger-ui section.models { background: #07140e; }
      .swagger-ui section.models { border-color: rgba(39,239,145,.18); }
      .swagger-ui select, .swagger-ui input[type=text], .swagger-ui textarea { color: #eefbf4; background: #07140e; border-color: #315b45; }
      .swagger-ui .btn { color: #dcefe5; border-color: #4b8065; }
      @media (max-width: 640px) { .docs-bar { padding: 0 14px; } .docs-bar span { display: none; } }
    </style>
  </head>
  <body>
    <header class="docs-bar">
      <strong>SOLARIS <span>Interactive API</span></strong>
      <a href="/">← Back to dashboard</a>
    </header>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin="anonymous"></script>
    <script>
      window.addEventListener("load", function () {
        window.ui = SwaggerUIBundle({
          url: "/openapi.json?v=1.0.1",
          dom_id: "#swagger-ui",
          deepLinking: true,
          displayRequestDuration: true,
          filter: true,
          persistAuthorization: true,
          tryItOutEnabled: true,
          layout: "BaseLayout"
        });
      });
    </script>
  </body>
</html>`;

export async function GET() {
  return new Response(SWAGGER_HTML, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
