import { getOpenApiDocument } from "../../../lib/openapi";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return Response.json(getOpenApiDocument(origin), {
    headers: { "cache-control": "public, max-age=300" },
  });
}
