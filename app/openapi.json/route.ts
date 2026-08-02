import { getOpenApiDocument, getRequestOrigin } from "../lib/openapi";

export async function GET(request: Request) {
  return Response.json(getOpenApiDocument(getRequestOrigin(request)), {
    headers: { "cache-control": "public, max-age=300" },
  });
}
