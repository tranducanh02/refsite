import test from "node:test";
import assert from "node:assert/strict";
import { isPublicAddress, parseMetadata } from "../src/lib/metadata";

test("metadata fetch only permits public unicast IPs", () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "172.16.0.1",
    "0.0.0.0",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "224.0.0.1",
  ])
    assert.equal(isPublicAddress(ip), false, ip);
  assert(isPublicAddress("8.8.8.8"));
  assert(isPublicAddress("2606:4700:4700::1111"));
});
test("metadata parses Open Graph, resolves relative images and decodes entities", () => {
  const result = parseMetadata(
    '<title>Fallback</title><meta property="og:title" content="Design &amp; Dev"><meta name="description" content="A library"><meta property="og:image" content="/cover.png">',
    "https://example.com/page",
  );
  assert.deepEqual(result, {
    title: "Design & Dev",
    description: "A library",
    cover: "https://example.com/cover.png",
  });
});
test("metadata is optional and rejects executable image URLs", () => {
  assert.deepEqual(
    parseMetadata(
      '<meta property="og:image" content="javascript:alert(1)">',
      "https://example.com",
    ),
    { title: "example.com", description: "", cover: "" },
  );
});
