import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

function request(path, init) {
  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the Solaris operations dashboard", async () => {
  const response = await request("/", { headers: { accept: "text/html" } });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Solaris Grid/);
  assert.match(html, /Solar power dashboard/);
  assert.match(html, /Surya One/);
  assert.match(html, /Power right now/);
  assert.doesNotMatch(html, /P10\/P50\/P90|Validation nMAE|W\/m² GHI/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("serves health, metadata, OpenAPI, Swagger, and ReDoc endpoints", async () => {
  const health = await request("/api/v1/health");
  assert.equal(health.status, 200);
  assert.equal((await health.json()).service, "solaris-grid-api");

  const meta = await request("/api/v1/meta");
  assert.equal(meta.status, 200);
  const metadata = await meta.json();
  assert.equal(metadata.capabilities.defaultSiteId, "surya-one");
  assert.match(metadata.documentation.swagger, /\/docs$/);

  const proxiedMeta = await worker.fetch(
    new Request("http://internal-render-host/api/v1/meta", {
      headers: {
        host: "solar-predictor-ft87.onrender.com",
        "x-forwarded-host": "solar-predictor-ft87.onrender.com",
        "x-forwarded-proto": "https",
      },
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(proxiedMeta.status, 200);
  assert.equal(
    (await proxiedMeta.json()).documentation.swagger,
    "https://solar-predictor-ft87.onrender.com/docs",
  );

  const openapi = await request("/openapi.json");
  assert.equal(openapi.status, 200);
  const specification = await openapi.json();
  assert.equal(specification.openapi, "3.1.0");
  assert.ok(specification.paths["/meta"]);
  assert.ok(specification.components.schemas.AnomalyRequest);

  const versionedOpenApi = await request("/api/v1/openapi.json");
  assert.equal(versionedOpenApi.status, 200);

  const swagger = await request("/docs");
  assert.equal(swagger.status, 200);
  assert.match(await swagger.text(), /SwaggerUIBundle/);

  const redoc = await request("/redoc");
  assert.equal(redoc.status, 200);
  assert.match(await redoc.text(), /redoc\.standalone\.js/);
});

test("validates and scores an inverter operating point", async () => {
  const response = await request("/api/v1/anomalies/evaluate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actualKw: 350,
      expectedKw: 400,
      inverterTemperatureC: 68,
      ambientTemperatureC: 37,
    }),
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.ok(payload.result.score > 0);
  assert.match(payload.result.severity, /healthy|watch|critical/);
});
