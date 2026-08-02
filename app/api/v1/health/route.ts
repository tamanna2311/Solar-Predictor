export async function GET() {
  return Response.json(
    {
      status: "ok",
      service: "solaris-grid-api",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
