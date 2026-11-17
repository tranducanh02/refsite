// Run: npx tsx tests/blog-api.integration.ts
// Starts an isolated local server; never reads or modifies the user's library.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, cp, symlink } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";

async function main() {
  const root = path.resolve("test-results");
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(path.join(root, "blog-api-"));
  try {
    await run(directory);
  } finally {
    assert(path.resolve(directory).startsWith(root + path.sep));
    await rm(directory, { recursive: true, force: true });
  }
}

async function run(directory: string) {
  const fixture = path.join(directory, "app");
  await mkdir(fixture);
  for (const file of [
    "src",
    "package.json",
    "tsconfig.json",
    "next.config.ts",
  ]) {
    await cp(path.resolve(file), path.join(fixture, file), { recursive: true });
  }
  await symlink(
    path.resolve("node_modules"),
    path.join(fixture, "node_modules"),
    "junction",
  );
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    NEXT_PUBLIC_SUPABASE_URL: "",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
    REFSITE_ALLOW_LOCAL: "true",
    REFSITE_DATA_DIR: path.join(directory, "data"),
  };
  const cli = path.resolve("node_modules/next/dist/bin/next");
  // NEXT_PUBLIC values are inlined at build time. Build a fixture with no .env files
  // so neither requests nor generated pages can contact the configured account.
  const build = spawn(process.execPath, [cli, "build", "--webpack"], {
    cwd: fixture,
    env: environment,
    windowsHide: true,
    stdio: "pipe",
  });
  let buildLogs = "";
  build.stdout.on("data", (data) => {
    buildLogs += data;
  });
  build.stderr.on("data", (data) => {
    buildLogs += data;
  });
  const [buildCode] = await once(build, "exit");
  assert.equal(buildCode, 0, buildLogs);
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const address = probe.address();
  assert(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(
    process.execPath,
    [cli, "start", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: fixture,
      windowsHide: true,
      stdio: "pipe",
      env: environment,
    },
  );
  let logs = "";
  server.stdout.on("data", (data) => {
    logs += data;
  });
  server.stderr.on("data", (data) => {
    logs += data;
  });
  const exited = once(server, "exit");
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (server.exitCode !== null)
        throw new Error(`Test server stopped: ${logs}`);
      try {
        if ((await fetch(`${origin}/api/library`)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert(ready, "Isolated server must start");
    const read = async () =>
      (await (await fetch(`${origin}/api/library`)).json()).library;
    const mutate = (
      action: unknown,
      revision: number,
      requestOrigin = origin,
    ) =>
      fetch(`${origin}/api/library`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: requestOrigin },
        body: JSON.stringify({ action, revision }),
      });
    const initial = await read();
    assert.deepEqual(initial.posts, []);
    const action = {
      type: "save-post",
      id: "integration-post",
      baseVersion: null,
      post: {
        title: "Bài kiểm tra riêng",
        tags: ["Kiến thức"],
        blocks: [
          { id: "heading", type: "h2", text: "Nội dung" },
          {
            id: "paragraph",
            type: "paragraph",
            text: "Tiếng Việt và <script> được giữ là văn bản.",
          },
          {
            id: "image",
            type: "image",
            text: "Ảnh kiểm thử",
            src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ3sAAAAASUVORK5CYII=",
          },
        ],
      },
    };
    assert.equal(
      (await mutate(action, 0, "https://another.example")).status,
      403,
    );
    assert.equal((await mutate(action, 0)).status, 200);
    const created = await read();
    assert.equal(created.posts[0].title, action.post.title);
    assert.equal(created.posts[0].blocks[2].src, action.post.blocks[2].src);
    assert.equal(
      (
        await mutate(
          {
            ...action,
            baseVersion: 0,
            post: { ...action.post, title: "Đã sửa" },
          },
          1,
        )
      ).status,
      200,
    );
    assert.equal((await mutate({ ...action, baseVersion: 0 }, 1)).status, 409);
    assert.equal((await mutate({ ...action, baseVersion: 0 }, 2)).status, 400);
    assert.equal((await read()).posts[0].title, "Đã sửa");
    assert.equal(
      (await mutate({ type: "trash-post", id: action.id }, 2)).status,
      200,
    );
    assert((await read()).posts[0].deletedAt);
    assert.equal(
      (await mutate({ type: "restore-post", id: action.id }, 3)).status,
      200,
    );
    const restored = await read();
    assert.equal(restored.posts[0].deletedAt, null);
    assert.equal(restored.posts[0].blocks.length, 3);
    assert.equal(
      (await mutate({ type: "import", library: created }, 4)).status,
      200,
    );
    assert.equal((await read()).posts.length, 1);
    const page = await fetch(origin);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /RefSite/);
    console.log(
      "PASS: production API — create, image persistence, edit, stale saves, trash, restore, import, same-origin protection, page response.",
    );
  } finally {
    server.kill();
    await exited;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
