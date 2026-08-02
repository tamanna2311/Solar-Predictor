import { getOpenApiDocument } from "../lib/openapi";

export async function GET(request: Request) {
  return Response.json(getOpenApiDocument(new URL(request.url).origin), {
    headers: { "cache-control": "public, max-age=300" },
  });
}
