import { chromium, expect, type Locator } from "@playwright/test";
import path from "node:path";

export async function runBlogEditorChecks(origin: string) {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const title = "Kiểm thử trình soạn thảo";
  const readPost = async () => {
    const response = await page.request.get(`${origin}/api/library`);
    return (await response.json()).library.posts.find(
      (post: { title: string }) => post.title === title,
    );
  };
  const selectAll = async (field: Locator) => {
    await field.click();
    await field.press("ControlOrMeta+a");
  };
  const saved = () =>
    expect(page.locator(".blog-save-status")).toHaveText("Đã lưu");
  const fields = page.locator(".tiptap");
  try {
    await page.goto(origin);
    await page.locator(".blog-nav").click();
    await page.getByRole("button", { name: "Viết bài", exact: true }).click();
    await page.getByRole("textbox", { name: "Tiêu đề bài viết" }).fill(title);
    const titleField = page.getByRole("textbox", { name: "Tiêu đề bài viết" });
    const longTitle =
      "Một tiêu đề bài viết rất dài cần tự động xuống dòng để có thể đọc và chỉnh sửa đầy đủ nội dung trên cả máy tính lẫn điện thoại";
    await titleField.click();
    await titleField.fill(longTitle);
    expect(
      await titleField.evaluate(
        (field) =>
          field.clientHeight >
            parseFloat(getComputedStyle(field).lineHeight) * 1.5 &&
          field.scrollHeight <= field.clientHeight + 1 &&
          field.scrollWidth <= field.clientWidth,
      ),
    ).toBe(true);
    await titleField.press("ControlOrMeta+z");
    await expect(titleField).toHaveValue(title);
    await titleField.press("ControlOrMeta+y");
    await expect(titleField).toHaveValue(longTitle);
    await titleField.press("ControlOrMeta+z");
    await expect(titleField).toHaveValue(title);
    await fields.first().fill("Kiến thức mới");
    await fields.first().press("ControlOrMeta+z");
    await expect(fields.first()).toHaveText("");
    await fields.first().press("ControlOrMeta+y");
    await expect(fields.first()).toHaveText("Kiến thức mới");
    // Clicking the dotted handle opens the same formats as the slash menu.
    await page.locator(".blog-drag-handle").first().click();
    await expect(
      page.getByRole("menu", { name: "Chèn nội dung" }),
    ).toBeVisible();
    await page
      .getByRole("menuitem", { name: "H1 Tiêu đề lớn", exact: true })
      .click();
    await expect(page.locator(".block-h1 .tiptap")).toHaveText("Kiến thức mới");
    await fields.first().press("ControlOrMeta+z");
    await expect(page.locator(".block-paragraph .tiptap")).toHaveText(
      "Kiến thức mới",
    );
    await fields.first().press("ControlOrMeta+y");
    await expect(page.locator(".block-h1 .tiptap")).toHaveText("Kiến thức mới");
    await fields.first().press("ControlOrMeta+z");
    await page.locator(".blog-drag-handle").first().click();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.locator(".block-h2 .tiptap")).toHaveText("Kiến thức mới");
    await fields.first().press("ControlOrMeta+z");
    await selectAll(fields.first());
    await expect(
      page.getByRole("toolbar", { name: "Định dạng văn bản" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "In đậm", exact: true }).click();
    await fields.first().press("ControlOrMeta+z");
    await expect(fields.first().locator("strong")).toHaveCount(0);
    await fields.first().press("ControlOrMeta+y");
    await expect(fields.first().locator("strong")).toHaveText("Kiến thức mới");
    await selectAll(fields.first());
    await page.getByRole("button", { name: "In nghiêng", exact: true }).click();
    await page.getByRole("button", { name: "Tô sáng", exact: true }).click();
    await page
      .getByRole("button", { name: "Chèn liên kết", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Địa chỉ liên kết" })
      .fill("https://react.dev");
    await page.getByRole("button", { name: "Áp dụng", exact: true }).click();
    await expect(fields.first().locator("strong")).toHaveText("Kiến thức mới");
    await saved();
    expect((await readPost()).blocks[0].inline[0]).toMatchObject({
      bold: true,
      italic: true,
      highlight: true,
      href: "https://react.dev",
    });

    // Splitting and merging must carry the rich text to both sides of the caret.
    await fields.first().press("ArrowRight");
    await fields.first().press("Home");
    for (let i = 0; i < 5; i++) await fields.first().press("ArrowRight");
    await fields.first().press("Enter");
    await expect(fields).toHaveCount(2);
    await expect(fields.nth(1)).toBeFocused();
    await expect(fields.nth(1).locator("strong")).toHaveText("thức mới");
    await fields.nth(1).press("ControlOrMeta+z");
    await expect(fields).toHaveCount(1);
    await expect(fields.first()).toHaveText("Kiến thức mới");
    await fields.first().press("ControlOrMeta+y");
    await expect(fields).toHaveCount(2);
    await fields.nth(1).press("Home");
    await fields.nth(1).press("Backspace");
    await expect(fields).toHaveCount(1);
    await expect(fields.first()).toHaveText("Kiến thức mới");

    await fields.first().press("End");
    await fields.first().press("Enter");
    await fields.nth(1).fill("/h2");
    await expect(
      page.getByRole("menu", { name: "Chèn nội dung" }),
    ).toBeVisible();
    await fields.nth(1).press("Enter");
    await page.locator(".block-h2 .tiptap").fill("Phần hai");
    await page.locator(".block-h2 .tiptap").press("End");
    await page.locator(".block-h2 .tiptap").press("Enter");
    await fields.last().fill("Đoạn cuối");
    await fields.last().press("End");
    await fields.last().press("Shift+Enter");
    await page.keyboard.insertText("Dòng tiếp");
    await saved();
    expect((await readPost()).blocks[2].text).toBe("Đoạn cuối\nDòng tiếp");

    const rows = page.locator(".blog-edit-block");
    const lastId = await rows.last().getAttribute("data-row-id");
    await rows.last().hover();
    await rows
      .last()
      .locator(".blog-drag-handle")
      .dragTo(rows.first(), { targetPosition: { x: 80, y: 2 } });
    await expect(rows.first()).toHaveAttribute("data-row-id", lastId!);
    await page.keyboard.press("ControlOrMeta+z");
    await expect(rows.last()).toHaveAttribute("data-row-id", lastId!);
    await page.keyboard.press("ControlOrMeta+y");
    await expect(rows.first()).toHaveAttribute("data-row-id", lastId!);
    await saved();
    expect((await readPost()).blocks[0].id).toBe(lastId);

    // Generate a valid image without contacting any external service.
    const png = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 40;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#7084ff";
      context.fillRect(0, 0, 64, 40);
      return canvas.toDataURL("image/png").split(",")[1];
    });
    await page
      .locator('input[type="file"][accept^="image/png"]')
      .setInputFiles({
        name: "test.png",
        mimeType: "image/png",
        buffer: Buffer.from(png, "base64"),
      });
    await expect(page.locator(".blog-block-content figure")).toHaveCount(1);
    await fields.last().press("ControlOrMeta+z");
    await expect(page.locator(".blog-block-content figure")).toHaveCount(0);
    await fields.last().press("ControlOrMeta+y");
    await expect(page.locator(".blog-block-content figure")).toHaveCount(1);
    await saved();
    expect(
      (await readPost()).blocks.filter(
        (block: { type: string }) => block.type === "image",
      ),
    ).toHaveLength(1);
    await fields.last().focus();
    await fields.last().evaluate((element, image) => {
      const bytes = Uint8Array.from(atob(image), (char) => char.charCodeAt(0));
      const data = new DataTransfer();
      data.items.add(new File([bytes], "pasted.png", { type: "image/png" }));
      element.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: data,
        }),
      );
    }, png);
    await expect(page.locator(".blog-block-content figure")).toHaveCount(2);
    await saved();
    const beforeDrop = await rows.first().getAttribute("data-row-id");
    await rows.first().evaluate((element, image) => {
      const bytes = Uint8Array.from(atob(image), (char) => char.charCodeAt(0));
      const data = new DataTransfer();
      data.items.add(new File([bytes], "dropped.png", { type: "image/png" }));
      const box = element.getBoundingClientRect();
      element.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: data,
          clientY: box.top + 1,
        }),
      );
    }, png);
    await expect(page.locator(".blog-block-content figure")).toHaveCount(3);
    await saved();
    const afterDrop = await readPost();
    expect(afterDrop.blocks[0].type).toBe("image");
    expect(afterDrop.blocks[2].id).toBe(beforeDrop);

    await page
      .getByRole("button", { name: "Đọc bài viết", exact: true })
      .click();
    await expect(page.locator(".blog-prose strong")).toHaveText(
      "Kiến thức mới",
    );
    await expect(
      page.locator('.blog-prose a[href="https://react.dev"]'),
    ).toBeVisible();
    await page.reload();
    await page.locator(".blog-nav").click();
    await page.getByRole("button", { name: new RegExp(`^${title}`) }).click();
    await expect(page.locator(".blog-prose strong")).toHaveText(
      "Kiến thức mới",
    );
    await expect(page.locator(".blog-prose img")).toHaveCount(3);
    await page.getByRole("button", { name: "Chỉnh sửa", exact: true }).click();
    await expect(page.locator(".tiptap strong")).toHaveText("Kiến thức mới");

    // A failed save must retain edits; retry must persist the latest snapshot.
    await page.route("**/api/library", async (route) => {
      if (route.request().method() === "POST")
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Offline test" }),
        });
      else await route.continue();
    });
    await fields.last().fill("Giữ lại khi mất kết nối");
    await expect(
      page.getByRole("button", { name: "Thử lưu lại", exact: true }),
    ).toBeVisible();
    await expect(fields.last()).toHaveText("Giữ lại khi mất kết nối");
    await page.unroute("**/api/library");
    await page
      .getByRole("button", { name: "Thử lưu lại", exact: true })
      .click();
    await saved();
    expect((await readPost()).blocks.at(-1).text).toBe(
      "Giữ lại khi mất kết nối",
    );
    await page
      .getByRole("button", { name: "Đóng thông báo", exact: true })
      .click();

    await page.setViewportSize({ width: 390, height: 844 });
    await titleField.fill(longTitle);
    expect(
      await titleField.evaluate(
        (field) =>
          field.clientHeight >
            parseFloat(getComputedStyle(field).lineHeight) * 2 &&
          field.scrollHeight <= field.clientHeight + 1 &&
          field.scrollWidth <= field.clientWidth,
      ),
    ).toBe(true);
    await fields.last().scrollIntoViewIfNeeded();
    await selectAll(fields.last());
    await expect(
      page.getByRole("toolbar", { name: "Định dạng văn bản" }),
    ).toBeVisible();
    await page.screenshot({
      path: path.resolve("test-results/blog-editor-mobile.png"),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.locator(".blog-editor").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.resolve("test-results/blog-editor-desktop.png"),
      fullPage: true,
    });
    expect(errors).toEqual([]);
    console.log(
      "PASS: browser — formatting, links, split/merge, slash commands, reorder, image picker/paste/drop, autosave/reload, failed-save retry, mobile layout.",
    );
  } catch (error) {
    await page.screenshot({
      path: path.resolve("test-results/blog-editor-failure.png"),
      fullPage: true,
    });
    throw error;
  } finally {
    await browser.close();
  }
}
