import { ZodError } from "zod";
import { ApiError } from "./backend";
import { ConflictError } from "./local-store";

export const noCache = { "Cache-Control": "no-store, private" };
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host"))
    throw new ApiError("Yêu cầu không cùng nguồn.", 403);
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new ApiError("Yêu cầu không cùng nguồn.", 403);
}
export async function jsonBody(request: Request, maxBytes = 10_000_000) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ApiError("Yêu cầu phải là JSON.", 415);
  if (Number(request.headers.get("content-length")) > maxBytes)
    throw new ApiError("Dữ liệu vượt quá giới hạn cho phép.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("Thiếu dữ liệu.");
  const parts: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > maxBytes) {
      await reader.cancel();
      throw new ApiError("Dữ liệu vượt quá giới hạn cho phép.", 413);
    }
    parts.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
  } catch {
    throw new ApiError("JSON không hợp lệ.");
  }
}
export function apiFailure(error: unknown) {
  const status =
    error instanceof ApiError
      ? error.status
      : error instanceof ConflictError
        ? 409
        : error instanceof ZodError
          ? 400
          : 400;
  const message =
    error instanceof ZodError
      ? "Dữ liệu không hợp lệ. Kiểm tra URL, tên, ảnh bìa và tag."
      : error instanceof Error
        ? error.message
        : "Có lỗi xảy ra. Vui lòng thử lại.";
  return Response.json({ error: message }, { status, headers: noCache });
}
