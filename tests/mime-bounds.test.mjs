import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "mime-bounds-"));
const entry = join(dir, "entry.ts");
writeFileSync(entry, `
import { mimePreflightReason } from "${process.cwd()}/src/lib/email/mime-preflight";
import { htmlToReadableText } from "${process.cwd()}/src/lib/email/reply-content-utils";
import PostalMime from "${process.cwd()}/node_modules/postal-mime/src/postal-mime.js";
const enc = new TextEncoder();
const hdr = "From: a@b.example\\r\\nTo: c@d.example\\r\\nSubject: x\\r\\n";
const cases = {
	blank: enc.encode(hdr + "\\r\\n" + "\\r\\n".repeat(512 * 1024)),
	nested: enc.encode(hdr + "Content-Type: message/rfc822\\r\\n\\r\\n".repeat(5000)),
	parts: enc.encode(hdr + 'Content-Type: multipart/mixed; boundary="b"\\r\\n\\r\\n' + "--b\\r\\nContent-Type: text/plain\\r\\n\\r\\nx\\r\\n".repeat(20000)),
	headers: enc.encode("X-Pad: " + "a".repeat(200 * 1024) + "\\r\\n\\r\\nbody"),
};
const out = {};
for (const [name, raw] of Object.entries(cases)) out[name] = mimePreflightReason(raw);
out.ok = mimePreflightReason(enc.encode(hdr + "\\r\\nhello\\r\\n"));
const t = Date.now();
htmlToReadableText("<style>".repeat(40000) + "<p>hi</p>");
out.htmlMs = Date.now() - t;
out.htmlText = htmlToReadableText("<style>a{}</style><p>Hi &amp; bye</p>").trim();
console.log(JSON.stringify(out));
`);
const bundle = join(dir, "entry.mjs");
await build({ entryPoints: [entry], bundle: true, outfile: bundle, platform: "node", format: "esm", alias: { "@": join(process.cwd(), "src") }, logLevel: "silent" });

test("hostile MIME is rejected cheaply inside a 128 MB heap", () => {
	const out = JSON.parse(execFileSync(process.execPath, ["--max-old-space-size=128", bundle], { encoding: "utf8" }));
	assert.match(out.blank, /empty lines/);
	assert.match(out.nested, /nested/);
	assert.match(out.parts, /too many MIME parts/);
	assert.match(out.headers, /header block/);
	assert.equal(out.ok, null);
	assert.ok(out.htmlMs < 1000, `html strip took ${out.htmlMs}ms`);
	assert.equal(out.htmlText, "Hi & bye");
});
