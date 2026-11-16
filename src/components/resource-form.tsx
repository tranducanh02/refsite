"use client";
import { useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  ImageIcon,
  Link2,
  LoaderCircle,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import {
  domainOf,
  folderPath,
  webUrl,
  type Library,
  type Resource,
  type ResourceInput,
  UNCATEGORY,
} from "@/lib/model";
import { Modal } from "./modal";

export function ResourceForm({
  library,
  resource,
  folderId,
  busy,
  onClose,
  onSave,
  onDelete,
}: {
  library: Library;
  resource?: Resource;
  folderId: string;
  busy: boolean;
  onClose: () => void;
  onSave: (input: ResourceInput) => Promise<boolean>;
  onDelete?: () => void;
}) {
  const [url, setUrl] = useState(resource?.url ?? "");
  const [title, setTitle] = useState(resource?.title ?? "");
  const [description, setDescription] = useState(resource?.description ?? "");
  const [cover, setCover] = useState(resource?.cover ?? "");
  const [folder, setFolder] = useState(resource?.folderId ?? folderId);
  const [tags, setTags] = useState(resource?.tags.join(", ") ?? "");
  const [favorite, setFavorite] = useState(resource?.favorite ?? false);
  const [fetching, setFetching] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [failedCover, setFailedCover] = useState("");
  const touched = useRef(
    new Set<string>(resource ? ["title", "description", "cover"] : []),
  );
  const currentUrl = useRef(url);
  currentUrl.current = url;
  const lastFetched = useRef("");
  const requestId = useRef(0);
  function normalizedInput(value: string) {
    return /^https?:\/\//i.test(value.trim())
      ? value.trim()
      : `https://${value.trim()}`;
  }
  async function getMetadata(force = false) {
    if (!url.trim() || fetching) return;
    const target = normalizedInput(url);
    if (!webUrl.safeParse(target).success) {
      setNote("Kiểm tra lại địa chỉ website.");
      return;
    }
    if (!force && lastFetched.current === target) return;
    setUrl(target);
    currentUrl.current = target;
    lastFetched.current = target;
    setFetching(true);
    setNote("");
    const token = ++requestId.current;
    try {
      const response = await fetch("/api/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      });
      const data = await response.json();
      if (token !== requestId.current || currentUrl.current !== target) return;
      if (!response.ok) throw new Error(data.error);
      if (force || !touched.current.has("title")) setTitle(data.title ?? "");
      if (force || !touched.current.has("description"))
        setDescription(data.description ?? "");
      if (force || !touched.current.has("cover")) setCover(data.cover ?? "");
      setNote(
        data.cover
          ? "Đã lấy thông tin và ảnh bìa. Bạn có thể chỉnh lại bên dưới."
          : "Đã lấy thông tin. Website không cung cấp ảnh bìa.",
      );
    } catch (error) {
      if (currentUrl.current === target)
        setNote(
          error instanceof Error
            ? error.message
            : "Chưa lấy được thông tin. Bạn có thể nhập thủ công.",
        );
    } finally {
      if (token === requestId.current) setFetching(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const target = normalizedInput(url);
    if (!webUrl.safeParse(target).success) {
      setError("Nhập URL http hoặc https hợp lệ.");
      return;
    }
    if (cover.trim() && !webUrl.safeParse(cover.trim()).success) {
      setError("Ảnh bìa cần là URL http hoặc https hợp lệ.");
      return;
    }
    const parsedTags = [
      ...new Set(
        tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    ];
    if (parsedTags.length > 20 || parsedTags.some((t) => t.length > 40)) {
      setError("Tối đa 20 tag, mỗi tag không quá 40 ký tự.");
      return;
    }
    const result = await onSave({
      title: title.trim() || domainOf(target),
      url: target,
      description: description.trim(),
      cover: cover.trim(),
      folderId: library.folders.some((f) => f.id === folder)
        ? folder
        : UNCATEGORY,
      tags: parsedTags,
      favorite,
    });
    if (result) onClose();
  }
  return (
    <Modal
      title={resource ? "Chỉnh sửa resource" : "Thêm một điều hay"}
      onClose={onClose}
      busy={busy}
      className="resource-modal"
    >
      <form onSubmit={submit}>
        <p className="modal-description">
          Lưu một link hôm nay. Tìm thấy cảm hứng khi bạn cần.
        </p>
        <label className="field-label" htmlFor="resource-url">
          Đường dẫn <span>*</span>
        </label>
        <div className="url-input">
          <Link2 size={18} />
          <input
            id="resource-url"
            autoFocus
            required
            maxLength={4096}
            placeholder="https://website.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={(event) => {
              if (
                (event.relatedTarget as HTMLElement | null)?.closest(
                  "[data-fetch-metadata]",
                )
              )
                return;
              void getMetadata();
            }}
          />
          <button
            type="button"
            className="icon-button accent"
            title="Lấy thông tin từ link"
            data-fetch-metadata
            aria-label="Lấy thông tin từ link"
            disabled={fetching || !url.trim()}
            onClick={() => void getMetadata(true)}
          >
            {fetching ? (
              <LoaderCircle size={19} className="spin" />
            ) : (
              <Sparkles size={19} />
            )}
          </button>
        </div>
        {(fetching || note) && (
          <p className="field-note" role="status">
            {fetching
              ? "Đang lấy thông tin website… Bạn vẫn có thể nhập và lưu."
              : note}
          </p>
        )}
        <div className="form-cover">
          {cover && cover !== failedCover ? (
            <img
              src={cover}
              alt="Xem trước ảnh bìa"
              onError={() => setFailedCover(cover)}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="cover-placeholder">
              <ImageIcon size={28} />
              <span>{title || "Ảnh bìa từ website"}</span>
              <small>
                {cover
                  ? "Ảnh không tải được · sẽ dùng bìa mặc định"
                  : "Tự động lấy khi website có hỗ trợ"}
              </small>
            </div>
          )}
        </div>
        <label className="field-label" htmlFor="resource-title">
          Tên resource
        </label>
        <input
          id="resource-title"
          maxLength={200}
          placeholder="Một cái tên dễ nhớ"
          value={title}
          onChange={(e) => {
            touched.current.add("title");
            setTitle(e.target.value);
          }}
        />
        <label className="field-label" htmlFor="resource-description">
          Mô tả
        </label>
        <textarea
          id="resource-description"
          rows={3}
          maxLength={2000}
          placeholder="Điều gì khiến resource này hữu ích với bạn?"
          value={description}
          onChange={(e) => {
            touched.current.add("description");
            setDescription(e.target.value);
          }}
        />
        <div className="form-columns">
          <div>
            <label className="field-label" htmlFor="resource-folder">
              Thư mục
            </label>
            <select
              id="resource-folder"
              value={
                library.folders.some((f) => f.id === folder)
                  ? folder
                  : UNCATEGORY
              }
              onChange={(e) => setFolder(e.target.value)}
            >
              {[...library.folders]
                .sort((a, b) =>
                  folderPath(library.folders, a.id).localeCompare(
                    folderPath(library.folders, b.id),
                  ),
                )
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {folderPath(library.folders, f.id)}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="resource-tags">
              Tags
            </label>
            <input
              id="resource-tags"
              value={tags}
              placeholder="UI, Free, React"
              onChange={(e) => setTags(e.target.value)}
            />
          </div>
        </div>
        <label className="field-label" htmlFor="resource-cover">
          Link ảnh bìa <span className="optional">tuỳ chọn</span>
        </label>
        <input
          id="resource-cover"
          maxLength={4096}
          value={cover}
          placeholder="https://website.com/cover.jpg"
          onChange={(e) => {
            touched.current.add("cover");
            setCover(e.target.value);
          }}
        />
        <div className="form-options">
          <button
            type="button"
            className={`text-button ${favorite ? "accent" : ""}`}
            onClick={() => setFavorite(!favorite)}
          >
            <Star size={17} fill={favorite ? "currentColor" : "none"} />
            {favorite ? "Đã thêm vào yêu thích" : "Đánh dấu yêu thích"}
          </button>
          {resource && (
            <a
              className="text-button"
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Mở link <ArrowUpRight size={16} />
            </a>
          )}
        </div>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          {onDelete && (
            <button
              type="button"
              className="icon-button danger-button"
              aria-label="Xoá resource"
              disabled={busy}
              onClick={onDelete}
            >
              <Trash2 size={19} />
            </button>
          )}
          <div className="footer-spacer" />
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            disabled={busy}
          >
            Huỷ
          </button>
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? <LoaderCircle size={17} className="spin" /> : null}
            {resource ? "Lưu thay đổi" : "Lưu resource"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
