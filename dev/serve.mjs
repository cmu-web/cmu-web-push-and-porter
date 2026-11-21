// Serves the built service description (docs/_site) at / and the local demo
// Forgejo at /demo/, as nginx does on the server: the /demo/ prefix comes off
// before Forgejo sees the request. Local only.
//
//   node dev/serve.mjs [PORT] [FORGEJO_PORT]    # http://127.0.0.1:3710/
import { createReadStream, statSync } from "node:fs";
import { createServer, request } from "node:http";
import { extname, join, normalize } from "node:path";

const port = Number(process.argv[2] || 3710);
const forgejo = Number(process.argv[3] || 3700);
const root = join(new URL("..", import.meta.url).pathname, "docs/_site");
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".json": "application/json", ".xml": "application/xml", ".txt": "text/plain" };

createServer((req, res) => {
  if (req.url === "/demo") {
    res.writeHead(301, { location: "/demo/" }).end();
    return;
  }
  if (req.url.startsWith("/demo/")) {
    const up = request(
      { host: "127.0.0.1", port: forgejo, method: req.method, path: req.url.slice(5), headers: { ...req.headers, host: `127.0.0.1:${port}` } },
      (r) => {
        res.writeHead(r.statusCode, r.headers);
        r.pipe(res);
      },
    );
    up.on("error", () => res.writeHead(502).end("Forgejo isn't running: dev/run.sh up\n"));
    req.pipe(up);
    return;
  }
  let path = normalize(decodeURIComponent(req.url.split("?")[0]));
  if (path.endsWith("/")) path += "index.html";
  const file = join(root, path);
  try {
    if (!file.startsWith(root) || !statSync(file).isFile()) throw 0;
    res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found\n");
  }
}).listen(port, "127.0.0.1", () => console.log(`site and demo on http://127.0.0.1:${port}/ (demo at /demo/)`));
