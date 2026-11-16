import { z } from "zod";

export const UNCATEGORY = "uncategory";
const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const webUrl = z
  .string()
  .max(4096)
  .url()
  .refine((s) => /^https?:\/\//i.test(s), "Chỉ hỗ trợ link http hoặc https.");
export const folderSchema = z.object({
  id,
  name: z.string().trim().min(1).max(60),
  parentId: id.nullable(),
  order: z.number().int().min(0),
});
export const resourceSchema = z.object({
  id,
  title: z.string().trim().min(1).max(200),
  url: webUrl,
  description: z.string().max(2000),
  cover: z.union([webUrl, z.literal("")]),
  folderId: id,
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  favorite: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const librarySchema = z.object({
  version: z.literal(1),
  revision: z.number().int().min(0),
  folders: z.array(folderSchema).max(500),
  resources: z.array(resourceSchema).max(10000),
});
export type Folder = z.infer<typeof folderSchema>;
export type Resource = z.infer<typeof resourceSchema>;
export type Library = z.infer<typeof librarySchema>;
export type ResourceInput = Omit<Resource, "id" | "createdAt" | "updatedAt">;

export const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("save-resource"),
    id: id.optional(),
    resource: resourceSchema.omit({
      id: true,
      createdAt: true,
      updatedAt: true,
    }),
  }),
  z.object({ type: z.literal("delete-resource"), id }),
  z.object({ type: z.literal("favorite"), id, favorite: z.boolean() }),
  z.object({
    type: z.literal("save-folder"),
    id: id.optional(),
    name: z.string().trim().min(1).max(60),
    parentId: id.nullable(),
  }),
  z.object({ type: z.literal("delete-folder"), id }),
  z.object({
    type: z.literal("move-folder"),
    id,
    direction: z.enum(["up", "down"]),
  }),
  z.object({ type: z.literal("import"), library: librarySchema }),
  z.object({ type: z.literal("load-samples") }),
]);
export type LibraryAction = z.infer<typeof actionSchema>;

export function emptyLibrary(): Library {
  return {
    version: 1,
    revision: 0,
    resources: [],
    folders: [
      { id: UNCATEGORY, name: "Uncategory", parentId: null, order: 0 },
      { id: "product", name: "Product Design", parentId: null, order: 1 },
      { id: "ui-inspo", name: "UI Inspo", parentId: "product", order: 0 },
      { id: "ui-resource", name: "UI Resource", parentId: "product", order: 1 },
      { id: "learning", name: "Learning", parentId: "product", order: 2 },
      { id: "visual", name: "Visual Design", parentId: null, order: 2 },
      { id: "font", name: "Font", parentId: "visual", order: 0 },
      { id: "color", name: "Color", parentId: "visual", order: 1 },
      { id: "development", name: "Development", parentId: null, order: 3 },
      {
        id: "dev-tools",
        name: "Tools & Libraries",
        parentId: "development",
        order: 0,
      },
    ],
  };
}

export function normalizeUrl(input: string): string {
  const url = new URL(input.trim());
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  const query = Array.from(url.searchParams.entries()).filter(
    ([key]) => !key.startsWith("utm_") && key !== "fbclid",
  );
  url.search = "";
  query
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([k, v]) => url.searchParams.append(k, v));
  return url.toString().replace(/\/$/, "");
}
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "website";
  }
}
export function searchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}
export function matchesSearch(resource: Resource, query: string): boolean {
  const haystack = searchText(
    [resource.title, resource.description, resource.url, ...resource.tags].join(
      " ",
    ),
  );
  return searchText(query)
    .trim()
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}
export function descendants(folders: Folder[], parent: string): string[] {
  const found = new Set([parent]);
  for (let changed = true; changed;) {
    changed = false;
    for (const folder of folders) {
      if (
        folder.parentId &&
        found.has(folder.parentId) &&
        !found.has(folder.id)
      ) {
        found.add(folder.id);
        changed = true;
      }
    }
  }
  return [...found];
}
export function sortedFolders(
  folders: Folder[],
  parentId: string | null = null,
): Folder[] {
  return folders
    .filter((f) => f.parentId === parentId)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}
export function folderPath(folders: Folder[], folderId: string): string {
  const parts: string[] = [];
  const visited = new Set<string>();
  let current = folders.find((f) => f.id === folderId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    parts.unshift(current.name);
    current = folders.find((f) => f.id === current!.parentId);
  }
  return parts.join(" / ");
}
export function validateLibrary(value: unknown): Library {
  const library = librarySchema.parse(value);
  const folderIds = new Set(library.folders.map((f) => f.id));
  if (
    folderIds.size !== library.folders.length ||
    new Set(library.resources.map((r) => r.id)).size !==
      library.resources.length
  )
    throw new Error("Dữ liệu có ID trùng lặp.");
  const unc = library.folders.find((f) => f.id === UNCATEGORY);
  if (!unc || unc.name !== "Uncategory" || unc.parentId !== null)
    throw new Error("Thiếu thư mục mặc định Uncategory.");
  for (const folder of library.folders) {
    const visited = new Set([folder.id]);
    let parent = folder.parentId;
    while (parent) {
      if (
        !folderIds.has(parent) ||
        visited.has(parent) ||
        parent === UNCATEGORY
      )
        throw new Error("Cấu trúc thư mục không hợp lệ.");
      visited.add(parent);
      parent = library.folders.find((f) => f.id === parent)!.parentId;
    }
  }
  const urls = new Set<string>();
  for (const resource of library.resources) {
    if (!folderIds.has(resource.folderId))
      throw new Error("Resource thuộc thư mục không tồn tại.");
    const canonical = normalizeUrl(resource.url);
    if (urls.has(canonical)) throw new Error("Dữ liệu có link trùng lặp.");
    urls.add(canonical);
  }
  return library;
}

const samples: Array<[string, string, string, string, string[]]> = [
  [
    "Awwwards",
    "https://www.awwwards.com",
    "Những trải nghiệm web sáng tạo để tìm cảm hứng cho dự án tiếp theo.",
    "ui-inspo",
    ["Inspiration", "Web design"],
  ],
  [
    "Godly",
    "https://godly.website",
    "Một bộ sưu tập thiết kế website với góc nhìn mới mẻ.",
    "ui-inspo",
    ["Inspiration"],
  ],
  [
    "Mobbin",
    "https://mobbin.com",
    "Tham khảo luồng sử dụng và các mẫu giao diện sản phẩm.",
    "ui-inspo",
    ["UI", "Mobile"],
  ],
  [
    "shadcn/ui",
    "https://ui.shadcn.com",
    "Các component giao diện có thể tùy chỉnh cho dự án React.",
    "ui-resource",
    ["React", "Components"],
  ],
  [
    "Google Fonts",
    "https://fonts.google.com",
    "Khám phá typeface và tìm kiểu chữ phù hợp với thiết kế.",
    "font",
    ["Typography", "Free"],
  ],
  [
    "Realtime Colors",
    "https://www.realtimecolors.com",
    "Thử bảng màu và typography trực tiếp trên một giao diện mẫu.",
    "color",
    ["Color", "Tools"],
  ],
  [
    "MDN Web Docs",
    "https://developer.mozilla.org",
    "Tài liệu tham khảo HTML, CSS và JavaScript cho công việc hằng ngày.",
    "dev-tools",
    ["Documentation", "Learning"],
  ],
  [
    "Linear",
    "https://linear.app",
    "Tham khảo cách thiết kế giao diện tối, typography và tương tác sản phẩm.",
    "uncategory",
    ["Product", "Inspiration"],
  ],
];
export function applyAction(
  current: Library,
  action: LibraryAction,
  now = new Date().toISOString(),
): Library {
  const library = structuredClone(current);
  switch (action.type) {
    case "save-resource": {
      if (!library.folders.some((f) => f.id === action.resource.folderId))
        throw new Error("Thư mục không tồn tại.");
      if (
        library.resources.some(
          (r) =>
            r.id !== action.id &&
            normalizeUrl(r.url) === normalizeUrl(action.resource.url),
        )
      )
        throw new Error("Link này đã có trong thư viện.");
      const old = action.id
        ? library.resources.find((r) => r.id === action.id)
        : undefined;
      if (action.id && !old) throw new Error("Resource không còn tồn tại.");
      const item = {
        ...action.resource,
        tags: [...new Set(action.resource.tags)],
        id: old?.id ?? crypto.randomUUID(),
        createdAt: old?.createdAt ?? now,
        updatedAt: now,
      };
      library.resources = old
        ? library.resources.map((r) => (r.id === old.id ? item : r))
        : [item, ...library.resources];
      break;
    }
    case "delete-resource":
      library.resources = library.resources.filter((r) => r.id !== action.id);
      break;
    case "favorite": {
      const item = library.resources.find((r) => r.id === action.id);
      if (!item) throw new Error("Resource không còn tồn tại.");
      item.favorite = action.favorite;
      item.updatedAt = now;
      break;
    }
    case "save-folder": {
      if (action.id === UNCATEGORY || action.parentId === UNCATEGORY)
        throw new Error("Uncategory là thư mục mặc định.");
      if (
        action.parentId &&
        !library.folders.some((f) => f.id === action.parentId)
      )
        throw new Error("Thư mục cha không tồn tại.");
      if (
        action.id &&
        descendants(library.folders, action.id).includes(action.parentId ?? "")
      )
        throw new Error("Không thể đặt thư mục vào chính nó hoặc thư mục con.");
      if (
        library.folders.some(
          (f) =>
            f.id !== action.id &&
            f.parentId === action.parentId &&
            searchText(f.name) === searchText(action.name),
        )
      )
        throw new Error("Tên thư mục đã tồn tại ở vị trí này.");
      const existing = action.id
        ? library.folders.find((f) => f.id === action.id)
        : undefined;
      if (action.id && !existing) throw new Error("Thư mục không còn tồn tại.");
      const order =
        Math.max(
          0,
          ...sortedFolders(library.folders, action.parentId).map(
            (f) => f.order,
          ),
        ) + 1;
      if (existing) {
        if (existing.parentId !== action.parentId) existing.order = order;
        existing.name = action.name;
        existing.parentId = action.parentId;
      } else
        library.folders.push({
          id: crypto.randomUUID(),
          name: action.name,
          parentId: action.parentId,
          order,
        });
      break;
    }
    case "delete-folder": {
      if (action.id === UNCATEGORY)
        throw new Error("Không thể xoá Uncategory.");
      const ids = descendants(library.folders, action.id);
      library.folders = library.folders.filter((f) => !ids.includes(f.id));
      library.resources = library.resources.map((r) =>
        ids.includes(r.folderId)
          ? { ...r, folderId: UNCATEGORY, updatedAt: now }
          : r,
      );
      break;
    }
    case "move-folder": {
      if (action.id === UNCATEGORY)
        throw new Error("Không thể di chuyển Uncategory.");
      const folder = library.folders.find((f) => f.id === action.id);
      if (!folder) throw new Error("Thư mục không còn tồn tại.");
      const siblings = sortedFolders(library.folders, folder.parentId).filter(
        (f) => f.id !== UNCATEGORY,
      );
      const index = siblings.findIndex((f) => f.id === action.id);
      const next = index + (action.direction === "up" ? -1 : 1);
      if (next >= 0 && next < siblings.length)
        [siblings[index], siblings[next]] = [siblings[next], siblings[index]];
      siblings.forEach((f, i) => {
        f.order = i + 1;
      });
      break;
    }
    case "import": {
      const incoming = validateLibrary(action.library);
      // Merge folders by path and resources by URL. Existing user edits always win.
      const map = new Map<string, string>([[UNCATEGORY, UNCATEGORY]]);
      const pending = incoming.folders.filter((f) => f.id !== UNCATEGORY);
      while (pending.length) {
        const index = pending.findIndex(
          (f) => !f.parentId || map.has(f.parentId),
        );
        if (index < 0) throw new Error("Cấu trúc thư mục không hợp lệ.");
        const f = pending.splice(index, 1)[0];
        const parentId = f.parentId ? map.get(f.parentId)! : null;
        const existing = library.folders.find(
          (x) =>
            x.parentId === parentId &&
            searchText(x.name) === searchText(f.name),
        );
        const newId = existing?.id ?? crypto.randomUUID();
        map.set(f.id, newId);
        if (!existing) library.folders.push({ ...f, id: newId, parentId });
      }
      const urls = new Set(library.resources.map((r) => normalizeUrl(r.url)));
      for (const r of incoming.resources) {
        if (urls.has(normalizeUrl(r.url))) continue;
        library.resources.push({
          ...r,
          id: crypto.randomUUID(),
          folderId: map.get(r.folderId)!,
        });
        urls.add(normalizeUrl(r.url));
      }
      break;
    }
    case "load-samples": {
      for (const [title, url, description, targetFolder, tags] of samples) {
        if (
          library.resources.some(
            (r) => normalizeUrl(r.url) === normalizeUrl(url),
          )
        )
          continue;
        library.resources.push({
          id: crypto.randomUUID(),
          title,
          url,
          description,
          cover: "",
          folderId: library.folders.some((f) => f.id === targetFolder)
            ? targetFolder
            : UNCATEGORY,
          tags,
          favorite: false,
          createdAt: now,
          updatedAt: now,
        });
      }
      break;
    }
  }
  library.revision = current.revision + 1;
  return validateLibrary(library);
}
