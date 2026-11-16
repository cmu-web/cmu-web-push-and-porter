// Builds the theme into custom/, the folder a Forgejo admin copies into
// Forgejo's custom path. The Kilt's design tokens (its :root block) and the
// subresource integrity hashes come from the pinned Kilt release on jsDelivr,
// so a new Kilt is a one-line change here and a rebuild.
//
//   node scripts/build.mjs
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const KILT = "0.6.9";
const CDN = `https://cdn.jsdelivr.net/gh/cmu-web/cmu-web-kilt@${KILT}/css`;
const root = join(dirname(new URL(import.meta.url).pathname), "..");

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.text();
}
const sri = (text) => "sha384-" + createHash("sha384").update(text).digest("base64");

const cms = await get(`${CDN}/cmu-cms.css`);
const app = await get(`${CDN}/cmu-app.css`);
const tokens = cms.match(/^:root \{\n[\s\S]*?\n\}/m);
if (!tokens) throw new Error("No :root block in cmu-cms.css");

const fill = (text) =>
  text
    .replaceAll("@KILT_VERSION@", KILT)
    .replaceAll("@KILT_TOKENS@", `/* From the Web Kilt ${KILT}'s cmu-cms.css */\n${tokens[0]}`)
    .replaceAll("@KILT_CMS_SRI@", sri(cms))
    .replaceAll("@KILT_APP_SRI@", sri(app));

const out = join(root, "custom/public/assets/css/theme-hamerschlag.css");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, fill(readFileSync(join(root, "src/theme-hamerschlag.css"), "utf8")));
console.log("wrote", out);

const from = join(root, "src/templates/custom");
for (const name of readdirSync(from)) {
  const to = join(root, "custom/templates/custom", name);
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, fill(readFileSync(join(from, name), "utf8")));
  console.log("wrote", to);
}
