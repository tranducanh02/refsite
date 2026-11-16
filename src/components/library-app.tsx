"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Cloud,
  Folder,
  FolderOpen,
  FolderPlus,
  Grid2X2,
  Inbox,
  Layers3,
  LayoutGrid,
  Link2,
  List,
  LoaderCircle,
  LogOut,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  descendants,
  domainOf,
  emptyLibrary,
  folderPath,
  matchesSearch,
  sortedFolders,
  UNCATEGORY,
  validateLibrary,
  type Folder as FolderType,
  type Library,
  type LibraryAction,
  type Resource,
} from "@/lib/model";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Modal } from "./modal";
import { ResourceForm } from "./resource-form";

type ActiveModal =
  | null
  | { type: "resource"; resource?: Resource }
  | { type: "folder"; folder?: FolderType; parentId?: string }
  | { type: "search" }
  | { type: "settings" }
  | { type: "confirm"; title: string; text: string; action: LibraryAction };
type Status = "loading" | "ready" | "login" | "error";
const viewNames: Record<string, string> = {
  all: "All resources",
  favorites: "Favorites",
  uncategory: "Uncategory",
};

function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <Layers3 size={23} strokeWidth={1.8} />
      </span>
      <span>
        refsite<span className="brand-dot">.</span>
      </span>
    </div>
  );
}

function ResourceCover({ resource }: { resource: Resource }) {
  const [failed, setFailed] = useState("");
  const domain = domainOf(resource.url);
  return (
    <div className="resource-cover">
      {resource.cover && failed !== resource.cover ? (
        <img
          src={resource.cover}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(resource.cover)}
        />
      ) : (
        <div className="generated-cover">
          <span className="cover-letter">
            {resource.title.slice(0, 1).toUpperCase()}
          </span>
          <span className="cover-wordmark">
            {resource.title}
            <span>↗</span>
          </span>
          <span className="cover-domain">{domain}</span>
        </div>
      )}
      <span className="open-indicator">
        <ArrowUpRight size={19} />
      </span>
    </div>
  );
}

export function LibraryApp() {
  const [library, setLibrary] = useState<Library>(emptyLibrary);
  const libraryRef = useRef(library);
  libraryRef.current = library;
  const [status, setStatus] = useState<Status>("loading");
  const [mode, setMode] = useState<"local" | "supabase">("local");
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState("all");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState("newest");
  const [tag, setTag] = useState("");
  const [modal, setModal] = useState<ActiveModal>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [toast, setToast] = useState<{
    message: string;
    error?: boolean;
  } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<Library | null>(null);
  useEffect(() => {
    if (toast) toastRef.current?.showPopover();
  }, [toast]);

  const notify = useCallback((message: string, isError = false) => {
    setToast({ message, error: isError });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(
      () => setToast(null),
      isError ? 10000 : 4000,
    );
  }, []);
  const load = useCallback(async (quiet = false) => {
    try {
      const response = await fetch("/api/library", { cache: "no-store" });
      const data = await response.json();
      if (response.status === 401) {
        setStatus("login");
        return;
      }
      if (!response.ok) throw new Error(data.error);
      const next = validateLibrary(data.library);
      // Ignore an older background response that arrived after a mutation.
      if (!busyRef.current && next.revision >= libraryRef.current.revision) {
        libraryRef.current = next;
        setLibrary(next);
      }
      setMode(data.mode);
      setEmail(data.email);
      setStatus("ready");
      setError("");
    } catch (err) {
      if (!quiet) {
        setStatus("error");
        setError(
          err instanceof Error ? err.message : "Không kết nối được với server.",
        );
      }
    }
  }, []);
  useEffect(() => {
    void load();
    const refresh = () => {
      if (!document.hidden && !busyRef.current) void load(true);
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const interval = setInterval(refresh, 30000);
    try {
      const stored = localStorage.getItem("refsite-layout");
      if (stored === "grid" || stored === "list") setLayout(stored);
    } catch {}
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      clearInterval(interval);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [load]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (status === "ready" && (!modal || modal.type === "search")) {
          setMobileNav(false);
          setModal(modal?.type === "search" ? null : { type: "search" });
        }
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [modal, status]);
  useEffect(() => {
    if (
      !["all", "favorites"].includes(view) &&
      !library.folders.some((f) => f.id === view)
    )
      setView(UNCATEGORY);
  }, [library.folders, view]);

  async function mutate(action: LibraryAction): Promise<boolean> {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: libraryRef.current.revision, action }),
      });
      const data = await response.json();
      if (response.status === 409) {
        busyRef.current = false;
        await load(true);
      }
      if (response.status === 401) setStatus("login");
      if (!response.ok) throw new Error(data.error);
      const next = validateLibrary(data.library);
      libraryRef.current = next;
      setLibrary(next);
      notify(
        action.type === "delete-folder"
          ? "Đã xoá thư mục. Các link được chuyển về Uncategory."
          : action.type === "delete-resource"
            ? "Đã xoá resource."
            : action.type === "import"
              ? "Đã nhập dữ liệu và bỏ qua các link trùng."
              : action.type === "load-samples"
                ? "Đã thêm 8 resource mẫu vào thư viện."
                : "Đã lưu vào thư viện.",
      );
      return true;
    } catch (err) {
      notify(
        err instanceof Error
          ? err.message
          : "Không lưu được dữ liệu. Kiểm tra kết nối và thử lại.",
        true,
      );
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function selectView(next: string) {
    setView(next);
    setTag("");
    setMobileNav(false);
    window.scrollTo({ top: 0 });
  }
  function switchLayout(next: "grid" | "list") {
    setLayout(next);
    try {
      localStorage.setItem("refsite-layout", next);
    } catch {}
  }
  function exportLibrary() {
    const blob = new Blob([JSON.stringify(libraryRef.current, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `refsite-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Đã xuất bản sao thư viện.");
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 10_000_000) throw new Error("File nhập tối đa 10 MB.");
      const incoming = validateLibrary(JSON.parse(await file.text()));
      setPendingImport(incoming);
    } catch (err) {
      notify(
        err instanceof Error
          ? err.message
          : "File không đúng định dạng RefSite.",
        true,
      );
    }
    if (importRef.current) importRef.current.value = "";
  }
  async function signOut() {
    await supabaseBrowser().auth.signOut();
    libraryRef.current = emptyLibrary();
    setLibrary(emptyLibrary());
    setModal(null);
    setStatus("login");
  }

  const favorites = library.resources.filter((r) => r.favorite).length;
  const folderSet = new Set(descendants(library.folders, view));
  const inView = library.resources.filter(
    (r) =>
      view === "all" ||
      (view === "favorites" ? r.favorite : folderSet.has(r.folderId)),
  );
  const tags = [...new Set(inView.flatMap((r) => r.tags))].sort((a, b) =>
    a.localeCompare(b),
  );
  const resources = inView
    .filter((r) => !tag || r.tags.includes(tag))
    .sort((a, b) =>
      sort === "name"
        ? a.title.localeCompare(b.title)
        : sort === "oldest"
          ? a.createdAt.localeCompare(b.createdAt)
          : b.createdAt.localeCompare(a.createdAt),
    );
  const currentFolder = library.folders.find((f) => f.id === view);
  const title = viewNames[view] ?? currentFolder?.name ?? "All resources";
  const addFolderId = currentFolder?.id ?? UNCATEGORY;

  function renderFolder(folder: FolderType, depth = 0): ReactNode {
    const children = sortedFolders(library.folders, folder.id);
    const count = library.resources.filter((r) =>
      descendants(library.folders, folder.id).includes(r.folderId),
    ).length;
    const isCollapsed = collapsed.includes(folder.id);
    return (
      <div key={folder.id} className="folder-branch">
        <div
          className={`folder-row ${view === folder.id ? "active" : ""}`}
          style={{ "--depth": depth } as React.CSSProperties}
        >
          <button
            className="folder-main"
            title={folderPath(library.folders, folder.id)}
            onClick={() => selectView(folder.id)}
          >
            {depth ? <span className="subfolder-line" /> : <Folder size={17} />}
            <span>{folder.name}</span>
            <small>{count}</small>
          </button>
          {!!children.length && (
            <button
              className="folder-chevron"
              aria-label={`${isCollapsed ? "Mở" : "Thu gọn"} ${folder.name}`}
              aria-expanded={!isCollapsed}
              onClick={() =>
                setCollapsed((list) =>
                  isCollapsed
                    ? list.filter((id) => id !== folder.id)
                    : [...list, folder.id],
                )
              }
            >
              {isCollapsed ? (
                <ChevronRight size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
            </button>
          )}
          <button
            className="folder-edit"
            title="Sửa thư mục"
            aria-label={`Sửa thư mục ${folder.name}`}
            onClick={() => {
              setMobileNav(false);
              setModal({ type: "folder", folder });
            }}
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
        {!isCollapsed &&
          children.map((child) => renderFolder(child, depth + 1))}
      </div>
    );
  }
  const sidebar = (
    <>
      <Brand />
      <div className="workspace-label">
        <span className="workspace-avatar">M</span>
        <div>
          My workspace<small>Không gian của riêng bạn</small>
        </div>
        <span className="private-badge">PRIVATE</span>
      </div>
      <nav aria-label="Thư viện">
        <p className="nav-caption">LIBRARY</p>
        <button
          className={`nav-item ${view === "all" ? "active" : ""}`}
          onClick={() => selectView("all")}
        >
          <LayoutGrid size={18} />
          <span>All resources</span>
          <small>{library.resources.length}</small>
        </button>
        <button
          className={`nav-item ${view === "favorites" ? "active" : ""}`}
          onClick={() => selectView("favorites")}
        >
          <Star size={18} />
          <span>Favorites</span>
          <small>{favorites}</small>
        </button>
        <button
          className={`nav-item ${view === UNCATEGORY ? "active" : ""}`}
          onClick={() => selectView(UNCATEGORY)}
        >
          <Inbox size={18} />
          <span>Uncategory</span>
          <small>
            {library.resources.filter((r) => r.folderId === UNCATEGORY).length}
          </small>
        </button>
      </nav>
      <div className="collections">
        <div className="nav-caption with-action">
          <span>COLLECTIONS</span>
          <button
            className="tiny-button"
            aria-label="Thêm thư mục"
            onClick={() => {
              setMobileNav(false);
              setModal({ type: "folder" });
            }}
          >
            <Plus size={16} />
          </button>
        </div>
        <nav aria-label="Thư mục">
          {sortedFolders(library.folders)
            .filter((f) => f.id !== UNCATEGORY)
            .map((f) => renderFolder(f))}
        </nav>
        <button
          className="new-folder"
          onClick={() => {
            setMobileNav(false);
            setModal({ type: "folder" });
          }}
        >
          <Plus size={16} />
          Thêm thư mục
        </button>
      </div>
      <div className="sidebar-bottom">
        <div className="little-note">
          <span className="note-symbol">✳</span>
          <p>
            A little less searching.
            <br />
            <span>A little more creating.</span>
          </p>
        </div>
        <button
          className="settings-link"
          onClick={() => {
            setMobileNav(false);
            setModal({ type: "settings" });
          }}
        >
          <Settings2 size={17} />
          <span>Cài đặt thư viện</span>
          <span className="connection-dot" />
        </button>
      </div>
    </>
  );

  if (status === "loading")
    return (
      <div className="center-screen">
        <Brand />
        <LoaderCircle className="spin accent" size={26} />
        <p className="muted">Đang mở thư viện của bạn…</p>
      </div>
    );
  if (status === "login")
    return (
      <Login
        onSuccess={() => {
          libraryRef.current = emptyLibrary();
          void load();
        }}
      />
    );
  if (status === "error")
    return (
      <div className="center-screen">
        <Brand />
        <div className="error-panel">
          <Cloud size={30} className="accent" />
          <h1>Chưa mở được thư viện</h1>
          <p>{error}</p>
          <button
            className="button primary"
            onClick={() => {
              setStatus("loading");
              void load();
            }}
          >
            Thử lại
          </button>
          {process.env.NEXT_PUBLIC_SUPABASE_URL && (
            <button className="button secondary" onClick={() => void signOut()}>
              Đăng nhập lại
            </button>
          )}
        </div>
      </div>
    );

  return (
    <div className="app-shell">
      <aside className="sidebar">{sidebar}</aside>
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Mở menu thư mục"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb-home">Workspace</span>
            <ChevronRight size={14} />
            <span>{title}</span>
          </div>
          <button
            className="search-trigger"
            aria-label="Tìm kiếm thư viện"
            onClick={() => setModal({ type: "search" })}
          >
            <Search size={17} />
            <span>Tìm trong thư viện…</span>
            <kbd>Ctrl K</kbd>
          </button>
          <button
            className="profile-button"
            aria-label="Mở cài đặt tài khoản"
            onClick={() => setModal({ type: "settings" })}
          >
            M
          </button>
        </header>
        <div className="content-container">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span />
                YOUR PERSONAL LIBRARY
              </div>
              <h1>
                {title}
                <span className="heading-period">.</span>
              </h1>
              <p>
                {view === UNCATEGORY
                  ? "Cứ lưu trước. Phân loại khi bạn có thời gian."
                  : view === "favorites"
                    ? "Những resource bạn luôn muốn giữ ở gần."
                    : currentFolder
                      ? "Một góc cảm hứng, dành riêng cho công việc của bạn."
                      : "Những điều hay cho lần sáng tạo tiếp theo."}
              </p>
            </div>
            <button
              className="button primary add-resource"
              onClick={() => setModal({ type: "resource" })}
            >
              <Plus size={19} />
              Thêm resource
              <ArrowRight size={17} />
            </button>
          </div>
          <div className="library-overview">
            <div className="overview-title">
              <span className="overview-icon">
                <BookOpen size={21} />
              </span>
              <div>
                <strong>
                  Collect thoughtfully. <em>Create freely.</em>
                </strong>
                <p>Mọi nguồn cảm hứng, trong một không gian.</p>
              </div>
            </div>
            <div className="overview-stats">
              <div>
                <strong>
                  {library.resources.length.toString().padStart(2, "0")}
                </strong>
                <span>RESOURCES</span>
              </div>
              <span className="stat-divider" />
              <div>
                <strong>
                  {library.folders
                    .filter((f) => f.parentId === null && f.id !== UNCATEGORY)
                    .length.toString()
                    .padStart(2, "0")}
                </strong>
                <span>COLLECTIONS</span>
              </div>
              <div className="overview-decoration">
                <Layers3 size={78} strokeWidth={0.6} />
              </div>
            </div>
          </div>
          <div className="resource-toolbar">
            <div className="toolbar-left">
              <span className="resource-count">
                {resources.length} <span>resource</span>
              </span>
              {currentFolder && currentFolder.id !== UNCATEGORY && (
                <button
                  className="icon-button"
                  aria-label={`Chỉnh sửa ${currentFolder.name}`}
                  title="Chỉnh sửa thư mục"
                  onClick={() =>
                    setModal({ type: "folder", folder: currentFolder })
                  }
                >
                  <MoreHorizontal size={19} />
                </button>
              )}
              <select
                aria-label="Lọc theo tag"
                className="filter-select"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
              >
                <option value="">Tất cả tag</option>
                {tags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="toolbar-right">
              <select
                className="sort-select"
                aria-label="Sắp xếp resource"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="newest">Mới nhất</option>
                <option value="oldest">Cũ nhất</option>
                <option value="name">Tên A–Z</option>
              </select>
              <div
                className="view-toggle"
                role="group"
                aria-label="Kiểu hiển thị"
              >
                <button
                  className={layout === "grid" ? "selected" : ""}
                  aria-label="Dạng lưới"
                  aria-pressed={layout === "grid"}
                  onClick={() => switchLayout("grid")}
                >
                  <Grid2X2 size={17} />
                </button>
                <button
                  className={layout === "list" ? "selected" : ""}
                  aria-label="Dạng danh sách"
                  aria-pressed={layout === "list"}
                  onClick={() => switchLayout("list")}
                >
                  <List size={19} />
                </button>
              </div>
            </div>
          </div>
          {resources.length > 0 ? (
            <div
              className={`resource-grid ${layout === "list" ? "list-layout" : ""}`}
            >
              {resources.map((resource) => (
                <article className="resource-card" key={resource.id}>
                  <a
                    className="card-cover-link"
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Mở ${resource.title}`}
                  >
                    <ResourceCover resource={resource} />
                  </a>
                  <div className="card-body">
                    <div className="card-title-row">
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="card-title"
                      >
                        {resource.title}
                      </a>
                      <button
                        className={`icon-button favorite-button ${resource.favorite ? "is-favorite" : ""}`}
                        aria-label={`${resource.favorite ? "Bỏ yêu thích" : "Yêu thích"} ${resource.title}`}
                        aria-pressed={resource.favorite}
                        disabled={busy}
                        onClick={() =>
                          void mutate({
                            type: "favorite",
                            id: resource.id,
                            favorite: !resource.favorite,
                          })
                        }
                      >
                        <Star
                          size={17}
                          fill={resource.favorite ? "currentColor" : "none"}
                        />
                      </button>
                    </div>
                    <p className="card-description">
                      {resource.description ||
                        "Một resource đang chờ bạn khám phá."}
                    </p>
                    <div className="card-tags">
                      {resource.tags.slice(0, 3).map((t) => (
                        <button key={t} onClick={() => setTag(t)}>
                          {t}
                        </button>
                      ))}
                      {resource.tags.length > 3 && (
                        <span>+{resource.tags.length - 3}</span>
                      )}
                    </div>
                    <div className="card-footer">
                      <span className="card-domain">
                        <span>{domainOf(resource.url)[0].toUpperCase()}</span>
                        {domainOf(resource.url)}
                      </span>
                      <button
                        className="icon-button"
                        aria-label={`Chỉnh sửa ${resource.title}`}
                        onClick={() => setModal({ type: "resource", resource })}
                      >
                        <MoreHorizontal size={19} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-library">
              <div className="empty-art" aria-hidden="true">
                <BookOpen size={32} strokeWidth={1.5} />
              </div>
              <span className="empty-eyebrow">A SPACE FOR YOUR NEXT IDEA</span>
              <h2>
                {tag
                  ? "Chưa có resource với tag này"
                  : view === "favorites"
                    ? "Giữ những điều bạn yêu thích"
                    : "Bắt đầu từ một link hay."}
              </h2>
              <p>
                {tag
                  ? "Thử bỏ bộ lọc hoặc chọn một tag khác."
                  : view === "favorites"
                    ? "Nhấn ngôi sao trên resource để tìm lại chúng ở đây."
                    : "Website đẹp, font chữ mới, một công cụ hữu ích.\nLưu lại để cảm hứng luôn trong tầm tay."}
              </p>
              {tag ? (
                <button className="button secondary" onClick={() => setTag("")}>
                  Bỏ bộ lọc
                </button>
              ) : view === "favorites" ? (
                <button
                  className="button secondary"
                  onClick={() => selectView("all")}
                >
                  Khám phá thư viện <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  className="button secondary"
                  onClick={() => setModal({ type: "resource" })}
                >
                  <Plus size={18} />
                  Thêm resource đầu tiên
                </button>
              )}
              {!library.resources.length && (
                <button
                  className="sample-button"
                  disabled={busy}
                  onClick={() => void mutate({ type: "load-samples" })}
                >
                  {busy ? (
                    <LoaderCircle size={15} className="spin" />
                  ) : (
                    <Sparkles size={15} />
                  )}
                  Hoặc khám phá với 8 resource mẫu <ArrowRight size={14} />
                </button>
              )}
            </div>
          )}
          <footer className="library-footer">
            <span>
              <span className="connection-dot" />
              {mode === "local"
                ? "Đã lưu trên máy của bạn"
                : "Đồng bộ với Supabase"}
            </span>
            <span>
              Made for your creative flow <span className="footer-star">✳</span>
            </span>
          </footer>
        </div>
      </main>
      {mobileNav && (
        <Modal
          title="My workspace"
          className="nav-modal"
          onClose={() => setMobileNav(false)}
        >
          <div className="mobile-sidebar">{sidebar}</div>
        </Modal>
      )}
      {modal?.type === "resource" && (
        <ResourceForm
          key={modal.resource?.id ?? "new"}
          library={library}
          resource={modal.resource}
          folderId={addFolderId}
          busy={busy}
          onClose={() => setModal(null)}
          onSave={(resource) =>
            mutate({ type: "save-resource", id: modal.resource?.id, resource })
          }
          onDelete={
            modal.resource
              ? () =>
                  setModal({
                    type: "confirm",
                    title: "Xoá resource?",
                    text: `“${modal.resource!.title}” sẽ bị xoá khỏi thư viện.`,
                    action: { type: "delete-resource", id: modal.resource!.id },
                  })
              : undefined
          }
        />
      )}
      {modal?.type === "search" && (
        <SearchModal
          library={library}
          onClose={() => setModal(null)}
          onEdit={(resource) => setModal({ type: "resource", resource })}
        />
      )}
      {modal?.type === "folder" && (
        <FolderForm
          library={library}
          folder={modal.folder}
          initialParent={modal.parentId}
          busy={busy}
          onClose={() => setModal(null)}
          onSave={mutate}
          onAddChild={(folder) =>
            setModal({ type: "folder", parentId: folder.id })
          }
          onDelete={(folder) =>
            setModal({
              type: "confirm",
              title: "Xoá thư mục?",
              text: `“${folder.name}” và thư mục con sẽ bị xoá. Tất cả resource bên trong được chuyển về Uncategory.`,
              action: { type: "delete-folder", id: folder.id },
            })
          }
          key={
            modal.folder
              ? `edit:${modal.folder.id}`
              : `new:${modal.parentId ?? "root"}`
          }
        />
      )}
      {modal?.type === "confirm" && (
        <Modal
          title={modal.title}
          onClose={() => setModal(null)}
          busy={busy}
          className="compact-modal"
        >
          <p className="confirm-text">{modal.text}</p>
          <div className="modal-footer">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setModal(null)}
            >
              Huỷ
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                if (await mutate(modal.action)) setModal(null);
              }}
            >
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Trash2 size={16} />
              )}
              Xoá
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === "settings" && (
        <Modal
          title="Cài đặt thư viện"
          onClose={() => {
            setModal(null);
            setPendingImport(null);
          }}
          className="settings-modal"
          busy={busy}
        >
          <div className="settings-status">
            <span className="settings-icon">
              {mode === "local" ? <Layers3 size={24} /> : <Cloud size={24} />}
            </span>
            <div>
              <strong>
                {mode === "local" ? "Thư viện local" : "Supabase đã kết nối"}
              </strong>
              <p>
                {mode === "local"
                  ? "Dữ liệu nằm tại data/library.json trong dự án."
                  : email}
              </p>
            </div>
            <CheckCheck size={20} className="accent" />
          </div>
          <p className="settings-help">
            {mode === "local"
              ? "Các thiết bị truy cập cùng server sẽ dùng chung thư viện. Để dùng qua Internet, làm theo hướng dẫn kết nối Supabase trong README của dự án."
              : "Thư viện riêng tư được bảo vệ bằng tài khoản và quyền truy cập database. Dữ liệu tự cập nhật khi quay lại ứng dụng."}
          </p>
          <div className="settings-section">
            <h3>Dữ liệu của bạn</h3>
            <button className="settings-action" onClick={exportLibrary}>
              <ArrowDownToLine size={21} />
              <span>
                <strong>Xuất thư viện</strong>
                <small>Tải bản sao JSON gồm thư mục, resource và tag</small>
              </span>
              <ArrowUpRight size={17} />
            </button>
            <button
              className="settings-action"
              disabled={busy}
              onClick={() => importRef.current?.click()}
            >
              <Upload size={21} />
              <span>
                <strong>Nhập thư viện</strong>
                <small>Gộp dữ liệu từ file RefSite, bỏ qua link đã có</small>
              </span>
              <ArrowUpRight size={17} />
            </button>
            {pendingImport && (
              <div className="import-confirm">
                <p>
                  Nhập {pendingImport.resources.length} resource và{" "}
                  {pendingImport.folders.length} thư mục? Các resource đang có
                  được giữ nguyên.
                </p>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await mutate({ type: "import", library: pendingImport })
                    )
                      setPendingImport(null);
                  }}
                >
                  Nhập dữ liệu
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => setPendingImport(null)}
                >
                  Huỷ
                </button>
              </div>
            )}
          </div>
          <div className="settings-section">
            <h3>Phím tắt</h3>
            <div className="shortcut-row">
              <span>Tìm kiếm toàn bộ thư viện</span>
              <kbd>Ctrl / ⌘ K</kbd>
            </div>
            <div className="shortcut-row">
              <span>Đóng cửa sổ</span>
              <kbd>Esc</kbd>
            </div>
          </div>
          {mode === "supabase" && (
            <button className="button secondary" onClick={() => void signOut()}>
              <LogOut size={17} />
              Đăng xuất
            </button>
          )}
          <p className="settings-version">
            RefSite 1.0 <span>YOUR PERSONAL CREATIVE LIBRARY</span>
          </p>
        </Modal>
      )}
      <input
        type="file"
        ref={importRef}
        accept="application/json,.json"
        hidden
        onChange={(e) => void importFile(e.target.files?.[0])}
      />
      {toast && (
        <div
          ref={toastRef}
          popover="manual"
          className={`toast ${toast.error ? "toast-error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <CircleHelp size={18} /> : <Check size={18} />}
          <span>{toast.message}</span>
          <button aria-label="Đóng thông báo" onClick={() => setToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function FolderForm({
  library,
  folder,
  initialParent,
  busy,
  onClose,
  onSave,
  onDelete,
  onAddChild,
}: {
  library: Library;
  folder?: FolderType;
  initialParent?: string;
  busy: boolean;
  onClose: () => void;
  onSave: (action: LibraryAction) => Promise<boolean>;
  onDelete: (folder: FolderType) => void;
  onAddChild: (folder: FolderType) => void;
}) {
  const [name, setName] = useState(folder?.name ?? "");
  const [parentId, setParentId] = useState(
    folder?.parentId ?? initialParent ?? "",
  );
  const excluded = new Set(
    folder ? descendants(library.folders, folder.id) : [],
  );
  excluded.add(UNCATEGORY);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (
      await onSave({
        type: "save-folder",
        id: folder?.id,
        name: name.trim(),
        parentId: parentId || null,
      })
    )
      onClose();
  }
  return (
    <Modal
      title={folder ? "Chỉnh sửa thư mục" : "Tạo thư mục mới"}
      onClose={onClose}
      busy={busy}
      className="compact-modal"
    >
      <form onSubmit={submit}>
        <p className="modal-description">
          Sắp xếp thư viện theo cách bạn suy nghĩ.
        </p>
        <label className="field-label" htmlFor="folder-name">
          Tên thư mục
        </label>
        <input
          id="folder-name"
          autoFocus
          required
          maxLength={60}
          value={name}
          placeholder="Ví dụ: Motion Design"
          onChange={(e) => setName(e.target.value)}
        />
        <label className="field-label" htmlFor="folder-parent">
          Nằm trong
        </label>
        <select
          id="folder-parent"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
        >
          <option value="">Thư mục gốc</option>
          {library.folders
            .filter((f) => !excluded.has(f.id))
            .map((f) => (
              <option key={f.id} value={f.id}>
                {folderPath(library.folders, f.id)}
              </option>
            ))}
        </select>
        {folder && (
          <div className="folder-operations">
            <button
              type="button"
              className="text-button"
              onClick={() => onAddChild(folder)}
            >
              <FolderPlus size={17} />
              Thêm thư mục con
            </button>
            <div>
              <button
                type="button"
                className="icon-button"
                aria-label="Di chuyển thư mục lên"
                disabled={busy}
                onClick={() =>
                  void onSave({
                    type: "move-folder",
                    id: folder.id,
                    direction: "up",
                  })
                }
              >
                <ArrowUp size={17} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label="Di chuyển thư mục xuống"
                disabled={busy}
                onClick={() =>
                  void onSave({
                    type: "move-folder",
                    id: folder.id,
                    direction: "down",
                  })
                }
              >
                <ArrowDown size={17} />
              </button>
            </div>
          </div>
        )}
        <div className="modal-footer">
          {folder && (
            <button
              className="icon-button danger-button"
              type="button"
              aria-label="Xoá thư mục"
              disabled={busy}
              onClick={() => onDelete(folder)}
            >
              <Trash2 size={18} />
            </button>
          )}
          <div className="footer-spacer" />
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Huỷ
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={busy || !name.trim()}
          >
            {busy && <LoaderCircle className="spin" size={16} />}Lưu thư mục
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SearchModal({
  library,
  onClose,
  onEdit,
}: {
  library: Library;
  onClose: () => void;
  onEdit: (resource: Resource) => void;
}) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const results = library.resources
    .filter((r) => matchesSearch(r, query))
    .slice(0, 50);
  useEffect(() => {
    listRef.current
      ?.querySelectorAll<HTMLElement>(".search-result")
      [index]?.scrollIntoView({ block: "nearest" });
  }, [index]);
  return (
    <Modal title="Tìm kiếm thư viện" onClose={onClose} className="search-modal">
      <div className="command-input">
        <Search size={23} />
        <input
          autoFocus
          placeholder="Tên, link, mô tả hoặc tag…"
          aria-label="Tìm kiếm resource"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, results.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            }
            if (e.key === "Enter" && results[index]) {
              e.preventDefault();
              window.open(results[index].url, "_blank", "noopener,noreferrer");
              onClose();
            }
          }}
        />
        <kbd>Esc</kbd>
      </div>
      <div className="search-results" ref={listRef}>
        <p className="search-caption">
          {query
            ? `${results.length}${results.length === 50 ? "+" : ""} KẾT QUẢ`
            : "TRONG THƯ VIỆN CỦA BẠN"}
        </p>
        {results.length ? (
          results.map((resource, i) => (
            <div
              className={`search-result ${i === index ? "highlighted" : ""}`}
              key={resource.id}
            >
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                onMouseEnter={() => setIndex(i)}
              >
                <span className="result-icon">
                  {resource.title[0].toUpperCase()}
                </span>
                <span>
                  <strong>{resource.title}</strong>
                  <small>
                    {domainOf(resource.url)} <span>·</span>{" "}
                    {folderPath(library.folders, resource.folderId)}
                  </small>
                </span>
                <ArrowUpRight size={17} />
              </a>
              <button
                className="icon-button"
                aria-label={`Chỉnh sửa ${resource.title}`}
                onClick={() => onEdit(resource)}
              >
                <Pencil size={15} />
              </button>
            </div>
          ))
        ) : (
          <div className="search-empty">
            <Search size={30} />
            <strong>
              {query ? "Không tìm thấy resource" : "Thư viện chưa có link nào"}
            </strong>
            <p>
              {query
                ? "Thử từ khoá ngắn hơn hoặc tên miền của website."
                : "Thêm resource để bắt đầu tìm kiếm."}
            </p>
          </div>
        )}
      </div>
      <div className="command-footer">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> di chuyển
        </span>
        <span>
          <kbd>↵</kbd> mở link
        </span>
        <span>Tìm cả tiếng Việt không dấu</span>
      </div>
    </Modal>
  );
}

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error } = await supabaseBrowser().auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      onSuccess();
    } catch {
      setError(
        "Chưa đăng nhập được. Kiểm tra email, mật khẩu và kết nối của bạn.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-screen">
      <div className="login-brand">
        <Brand />
      </div>
      <div className="login-card">
        <span className="login-icon">
          <Layers3 size={34} />
        </span>
        <div className="eyebrow">YOUR PERSONAL LIBRARY</div>
        <h1>
          Welcome back<span>.</span>
        </h1>
        <p>Nguồn cảm hứng của bạn đang ở đây.</p>
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <label className="field-label" htmlFor="login-password">
            Mật khẩu
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? (
              <LoaderCircle size={18} className="spin" />
            ) : (
              <ArrowRight size={18} />
            )}
            Mở thư viện
          </button>
        </form>
        <small>
          Không gian riêng. Chỉ tài khoản được cấp quyền mới truy cập được.
        </small>
      </div>
      <div className="login-footer">
        A little less searching. A little more creating.
      </div>
    </div>
  );
}
