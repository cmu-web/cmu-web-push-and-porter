// Builds the theme into custom/, the folder a Forgejo admin copies into
// Forgejo's custom path:
//   * the theme CSS, with the Kilt's design tokens (its :root block) from the
//     installed Kilt (@cmu-web/kilt in package.json)
//   * the header and footer templates
//   * Scotty as the default avatar
//   * Forgejo's English locale with its labels in Title Case, from the pinned
//     Forgejo version's source (a custom locale file replaces Forgejo's whole
//     file, so it's rebuilt for every Forgejo version)
//
// A new Kilt is an npm upgrade (Dependabot proposes each release) and a
// rebuild; a new Forgejo is a one-line change here and a rebuild:
//   npm run build
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
export const KILT = require("@cmu-web/kilt/package.json").version;
export const FORGEJO = "17.0.1";
const FORGEJO_SRC = `https://codeberg.org/forgejo/forgejo/raw/tag/v${FORGEJO}`;
const root = join(dirname(new URL(import.meta.url).pathname), "..");

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.text();
}
function write(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  console.log("wrote", path);
}

// The theme CSS and templates
const cms = readFileSync(require.resolve("@cmu-web/kilt/css/cmu-cms.css"), "utf8");
const tokens = cms.match(/^:root \{\n[\s\S]*?\n\}/m);
if (!tokens) throw new Error("No :root block in cmu-cms.css");
const fill = (text) =>
  text
    .replaceAll("@KILT_VERSION@", KILT)
    .replaceAll("@KILT_TOKENS@", `/* From the Web Kilt ${KILT}'s cmu-cms.css */\n${tokens[0]}`);

write(
  join(root, "custom/public/assets/css/theme-push-and-porter.css"),
  fill(readFileSync(join(root, "src/theme-push-and-porter.css"), "utf8")),
);
const templates = join(root, "src/templates/custom");
for (const name of readdirSync(templates, { recursive: true }))
  if (name.endsWith(".tmpl"))
    write(
      join(root, "custom/templates/custom", name),
      fill(readFileSync(join(templates, name), "utf8")),
    );

// Scotty, for deleted users and anyone without a generated avatar
mkdirSync(join(root, "custom/public/assets/img"), { recursive: true });
copyFileSync(
  join(root, "src/img/avatar_default.png"),
  join(root, "custom/public/assets/img/avatar_default.png"),
);
console.log("wrote", join(root, "custom/public/assets/img/avatar_default.png"));

// Labels in Title Case: change only the listed keys, and stop if one is gone
const labels = JSON.parse(readFileSync(join(root, "src/locale/title-case.json"), "utf8"));
for (const [file, changes] of Object.entries(labels)) {
  if (file.startsWith("_")) continue;
  let text = await get(`${FORGEJO_SRC}/options/${file}`);
  if (file.endsWith(".json")) {
    const data = JSON.parse(text);
    for (const [key, value] of Object.entries(changes)) {
      if (!(key in data)) throw new Error(`${file}: no key ${key} in Forgejo ${FORGEJO}`);
      data[key] = value;
    }
    text = JSON.stringify(data, null, 2) + "\n";
  } else {
    text = "\n" + text;
    for (const [dotted, value] of Object.entries(changes)) {
      const at = dotted.indexOf(".");
      const section = dotted.slice(0, at);
      const key = dotted.slice(at + 1);
      const start = text.indexOf(`\n[${section}]\n`);
      if (start < 0) throw new Error(`${file}: no section [${section}] in Forgejo ${FORGEJO}`);
      const next = text.indexOf("\n[", start + 1);
      const end = next < 0 ? text.length : next;
      const body = text.slice(start, end);
      const line = new RegExp(`\\n${key.replace(/[.]/g, "\\.")} = [^\\n]*`);
      if (!line.test(body)) throw new Error(`${file}: no key ${dotted} in Forgejo ${FORGEJO}`);
      text = text.slice(0, start) + body.replace(line, `\n${key} = ${value}`) + text.slice(end);
    }
    text = text.slice(1);
  }
  write(join(root, "custom/options", file), text);
}
