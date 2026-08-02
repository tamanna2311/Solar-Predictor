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
  assert.match(html, /Generation intelligence/);
  assert.match(html, /Surya One/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("serves versioned health and OpenAPI endpoints", async () => {
  const health = await request("/api/v1/health");
  assert.equal(health.status, 200);
  assert.equal((await health.json()).service, "solaris-grid-api");

  const openapi = await request("/api/v1/openapi.json");
  assert.equal(openapi.status, 200);
  assert.equal((await openapi.json()).openapi, "3.1.0");
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
