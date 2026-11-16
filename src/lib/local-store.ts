import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import {
  applyAction,
  emptyLibrary,
  validateLibrary,
  type Library,
  type LibraryAction,
} from "./model";

export class ConflictError extends Error {
  constructor() {
    super(
      "Thư viện vừa thay đổi trên thiết bị khác. Dữ liệu mới đã được tải; vui lòng thử lại.",
    );
  }
}
export function dataDirectory() {
  return process.env.REFSITE_DATA_DIR || path.join(process.cwd(), "data");
}
async function withLock<T>(
  directory: string,
  run: () => Promise<T>,
): Promise<T> {
  await mkdir(directory, { recursive: true });
  const lock = path.join(directory, ".write-lock");
  let acquired = false;
  for (let i = 0; i < 100; i++) {
    try {
      await mkdir(lock);
      acquired = true;
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      await new Promise((r) => setTimeout(r, 40));
    }
  }
  if (!acquired)
    throw new Error("Thư viện đang được ghi. Vui lòng thử lại sau vài giây.");
  try {
    return await run();
  } finally {
    const { rmdir } = await import("node:fs/promises");
    await rmdir(lock);
  }
}
async function readUnlocked(directory: string): Promise<Library> {
  try {
    return validateLibrary(
      JSON.parse(await readFile(path.join(directory, "library.json"), "utf8")),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return emptyLibrary();
    throw new Error(
      "Không đọc được data/library.json. Dữ liệu được giữ nguyên; hãy kiểm tra file hoặc bản .bak.",
    );
  }
}
async function writeUnlocked(directory: string, library: Library) {
  const file = path.join(directory, "library.json");
  const temporary = path.join(directory, `${crypto.randomUUID()}.tmp`);
  try {
    try {
      await writeFile(`${file}.bak`, await readFile(file));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await writeFile(temporary, JSON.stringify(library, null, 2), "utf8");
    await rename(temporary, file);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}
export async function readLocal(directory = dataDirectory()): Promise<Library> {
  return withLock(directory, () => readUnlocked(directory));
}
export async function mutateLocal(
  action: LibraryAction,
  revision: number,
  directory = dataDirectory(),
): Promise<Library> {
  return withLock(directory, async () => {
    const current = await readUnlocked(directory);
    if (current.revision !== revision) throw new ConflictError();
    const next = applyAction(current, action);
    await writeUnlocked(directory, next);
    return next;
  });
}
