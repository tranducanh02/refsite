import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import ipaddr from "ipaddr.js";
import { load } from "cheerio";

export function isPublicAddress(address: string) {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}
export async function fetchPublicHtml(
  input: string,
  redirects = 0,
): Promise<{ html: string; url: string }> {
  const url = new URL(input);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port))
  )
    throw new Error("Chỉ đọc được trang web công khai qua HTTP/HTTPS.");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = await Promise.race([
    lookup(hostname, { all: true }),
    new Promise<never>((_, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Website phản hồi quá chậm.")),
        5000,
      );
      timer.unref();
    }),
  ]);
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
    throw new Error("Không lấy metadata từ địa chỉ nội bộ.");
  const pinned = addresses[0];
  const result = await new Promise<{ html: string; location?: string }>(
    (resolve, reject) => {
      const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(
        url,
        {
          method: "GET",
          family: pinned.family,
          // Pin the validated DNS address: redirects are independently resolved and checked.
          lookup: (_hostname, options, callback) => {
            if (options.all)
              callback(null, [
                { address: pinned.address, family: pinned.family },
              ]);
            else callback(null, pinned.address, pinned.family);
          },
          headers: {
            "User-Agent": "RefSite/1.0 (+personal bookmark metadata)",
            Accept: "text/html,application/xhtml+xml",
            "Accept-Encoding": "identity",
          },
        },
        (response) => {
          if (
            [301, 302, 303, 307, 308].includes(response.statusCode ?? 0) &&
            response.headers.location
          ) {
            response.resume();
            resolve({ html: "", location: response.headers.location });
            return;
          }
          if (!response.statusCode || response.statusCode >= 400) {
            response.resume();
            reject(
              new Error(
                "Website không cho phép đọc tự động. Bạn vẫn có thể nhập thông tin thủ công.",
              ),
            );
            return;
          }
          if (
            !/text\/html|application\/xhtml\+xml/i.test(
              response.headers["content-type"] ?? "",
            )
          ) {
            response.resume();
            reject(
              new Error(
                "Link này không phải trang HTML. Hãy nhập thông tin thủ công.",
              ),
            );
            return;
          }
          const chunks: Buffer[] = [];
          let length = 0;
          response.on("data", (chunk: Buffer) => {
            length += chunk.length;
            if (length > 1_500_000) {
              request.destroy(
                new Error("Trang quá lớn để lấy thông tin tự động."),
              );
              return;
            }
            chunks.push(chunk);
          });
          response.on("end", () =>
            resolve({ html: Buffer.concat(chunks).toString("utf8") }),
          );
          response.on("error", reject);
        },
      );
      const timer = setTimeout(
        () =>
          request.destroy(
            new Error("Website phản hồi quá chậm. Bạn có thể lưu link trước."),
          ),
        8000,
      );
      request.on("close", () => clearTimeout(timer));
      request.on("error", reject);
      request.end();
    },
  );
  if (result.location) {
    if (redirects >= 3) throw new Error("Website chuyển hướng quá nhiều lần.");
    return fetchPublicHtml(
      new URL(result.location, url).toString(),
      redirects + 1,
    );
  }
  return { html: result.html, url: url.toString() };
}
export function parseMetadata(html: string, baseUrl: string) {
  const $ = load(html);
  const meta = (key: string) =>
    $(`meta[property="${key}"], meta[name="${key}"]`)
      .first()
      .attr("content")
      ?.trim();
  const title = (
    meta("og:title") ||
    meta("twitter:title") ||
    $("title").first().text() ||
    new URL(baseUrl).hostname
  )
    .trim()
    .slice(0, 200);
  const description = (
    meta("og:description") ||
    meta("description") ||
    meta("twitter:description") ||
    ""
  ).slice(0, 2000);
  let cover = "";
  try {
    const candidate =
      meta("og:image:secure_url") || meta("og:image") || meta("twitter:image");
    if (candidate) {
      const image = new URL(candidate, baseUrl);
      if (["https:", "http:"].includes(image.protocol))
        cover = image.toString().slice(0, 4096);
    }
  } catch {
    /* Invalid image metadata is optional. */
  }
  return { title, description, cover };
}
