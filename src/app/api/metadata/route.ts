import { z } from "zod";
import { backend } from "@/lib/backend";
import { webUrl } from "@/lib/model";
import { fetchPublicHtml, parseMetadata } from "@/lib/metadata";
import { apiFailure, assertSameOrigin, jsonBody, noCache } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const store = await backend();
    if (store.mode === "supabase") await store.read();
    const { url } = z
      .object({ url: webUrl })
      .parse(await jsonBody(request, 8192));
    const page = await fetchPublicHtml(url);
    return Response.json(parseMetadata(page.html, page.url), {
      headers: noCache,
    });
  } catch (error) {
    return apiFailure(error);
  }
}
