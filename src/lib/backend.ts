import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { applyAction, validateLibrary, type LibraryAction } from "./model";
import { ConflictError, readLocal, mutateLocal } from "./local-store";

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function backend() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!!url !== !!key)
    throw new ApiError(
      "Cần cấu hình cả Supabase URL và publishable key trong .env.local.",
      503,
    );
  if (!url || !key) {
    if (
      process.env.NODE_ENV !== "development" &&
      process.env.REFSITE_ALLOW_LOCAL !== "true"
    ) {
      throw new ApiError(
        "Hãy cấu hình Supabase, hoặc đặt REFSITE_ALLOW_LOCAL=true để chạy bản production trong mạng nội bộ.",
        503,
      );
    }
    return {
      mode: "local" as const,
      email: null,
      read: () => readLocal(),
      mutate: (action: LibraryAction, revision: number) =>
        mutateLocal(action, revision),
    };
  }
  const jar = await cookies();
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) =>
        values.forEach(({ name, value, options }) =>
          jar.set(name, value, options),
        ),
    },
  });
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    throw new ApiError("Đăng nhập để mở thư viện của bạn.", 401);
  const read = async () => {
    const { data, error: dbError } = await client
      .from("refsite_libraries")
      .select("data, revision")
      .eq("user_id", user.id)
      .maybeSingle();
    if (dbError) {
      console.error("Supabase read failed", dbError.code);
      throw new ApiError(
        "Không đọc được thư viện Supabase. Hãy kiểm tra kết nối và chạy supabase/schema.sql.",
        503,
      );
    }
    if (!data)
      throw new ApiError(
        "Tài khoản này chưa được cấp thư viện. Làm bước cấp quyền trong README.",
        403,
      );
    return validateLibrary({ ...data.data, revision: data.revision });
  };
  return {
    mode: "supabase" as const,
    email: user.email ?? null,
    read,
    mutate: async (action: LibraryAction, revision: number) => {
      const current = await read();
      if (current.revision !== revision) throw new ConflictError();
      const next = applyAction(current, action);
      const { data, error: writeError } = await client
        .from("refsite_libraries")
        .update({ data: next, revision: next.revision })
        .eq("user_id", user.id)
        .eq("revision", revision)
        .select("revision")
        .maybeSingle();
      if (writeError) {
        console.error("Supabase write failed", writeError.code);
        throw new ApiError(
          "Chưa lưu được lên Supabase. Dữ liệu hiện tại được giữ nguyên; vui lòng thử lại.",
          503,
        );
      }
      if (!data) throw new ConflictError();
      return next;
    },
  };
}
