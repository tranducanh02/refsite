import { z } from "zod";
import { backend } from "@/lib/backend";
import { actionSchema } from "@/lib/model";
import { apiFailure, assertSameOrigin, jsonBody, noCache } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const store = await backend();
    return Response.json(
      { library: await store.read(), mode: store.mode, email: store.email },
      { headers: noCache },
    );
  } catch (error) {
    return apiFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const store = await backend();
    const body = z
      .object({ revision: z.number().int().min(0), action: actionSchema })
      .parse(await jsonBody(request));
    return Response.json(
      { library: await store.mutate(body.action, body.revision) },
      { headers: noCache },
    );
  } catch (error) {
    return apiFailure(error);
  }
}
