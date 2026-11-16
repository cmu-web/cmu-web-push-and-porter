// Fills a local Forgejo (dev/run.sh up) with made-up people and projects, to
// look at the theme. Never point it at a real Forgejo.
//
//   node dev/seed.mjs http://127.0.0.1:3700 cmu-web-forgejo-dev
import { execFileSync } from "node:child_process";

const [base, container] = process.argv.slice(2);
if (!base?.startsWith("http://127.0.0.1:") || !container) {
  console.error("usage: node dev/seed.mjs http://127.0.0.1:PORT CONTAINER");
  process.exit(2);
}
const PASSWORD = "Plaid-Demo-2026";
const people = [
  { username: "ac00", full_name: "Andrew Carnegie", admin: true },
  { username: "mm00", full_name: "Margaret Morrison" },
  { username: "am00", full_name: "Andrew Mellon" },
];

// The first person is made with Forgejo's command line, as the admin
const cli = (...args) =>
  execFileSync("docker", ["exec", container, "forgejo", ...args], { encoding: "utf8" });
try {
  cli(
    "admin", "user", "create", "--admin", "--username", "ac00", "--password", PASSWORD,
    "--email", "ac00@example.com", "--must-change-password=false",
  );
} catch (e) {
  if (!String(e.stderr).includes("already exists")) throw e;
}

async function api(user, method, path, body) {
  const res = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: {
      authorization: "Basic " + Buffer.from(`${user}:${PASSWORD}`).toString("base64"),
      "content-type": "application/json",
    },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok && res.status !== 409 && res.status !== 422)
    throw new Error(`${method} ${path}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}
const b64 = (s) => Buffer.from(s).toString("base64");

for (const p of people.slice(1))
  await api("ac00", "POST", "/admin/users", {
    username: p.username,
    full_name: p.full_name,
    email: `${p.username}@example.com`,
    password: PASSWORD,
    must_change_password: false,
  });
for (const p of people)
  await api(p.username, "PATCH", "/user/settings", { full_name: p.full_name });

// Andrew Carnegie's course notes: files, labels, issues and a pull request
await api("ac00", "POST", "/user/repos", {
  name: "course-notes",
  description: "Notes and handouts for 99-101, Computing at Carnegie Mellon.",
  auto_init: true,
  readme: "Default",
  default_branch: "main",
});
const files = {
  "README.md": `# Course Notes

Notes and handouts for 99-101, Computing at Carnegie Mellon, taught by
Andrew Carnegie.

## Build the Handouts

\`\`\`sh
python3 build.py handouts/
\`\`\`

| Week | Topic | Handout |
| --- | --- | --- |
| 1 | Accounts and Andrew IDs | \`handouts/week-01.md\` |
| 2 | Email and Calendar | \`handouts/week-02.md\` |
| 3 | Files and Backups | \`handouts/week-03.md\` |

> [!NOTE]
> Handouts for weeks four through 14 are still in drafts.
`,
  "build.py": `"""Builds the handouts into one PDF per week."""

import pathlib
import sys


def weeks(folder: pathlib.Path) -> list[pathlib.Path]:
    """The handouts in a folder, in week order."""
    return sorted(folder.glob("week-*.md"))


def main() -> int:
    folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "handouts")
    for week in weeks(folder):
        print(f"Building {week.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
`,
  "handouts/week-01.md": "# Week 1: Accounts and Andrew IDs\n\nSign in with your Andrew ID.\n",
  "handouts/week-02.md": "# Week 2: Email and Calendar\n\nSet up your email and calendar.\n",
  "handouts/week-03.md": "# Week 3: Files and Backups\n\nKeep a copy of your work.\n",
};
for (const [path, content] of Object.entries(files)) {
  const existing = await fetch(`${base}/api/v1/repos/ac00/course-notes/contents/${path}`).then(
    (r) => (r.ok ? r.json() : null),
  );
  await api("ac00", existing ? "PUT" : "POST", `/repos/ac00/course-notes/contents/${path}`, {
    content: b64(content),
    message: existing ? `docs: update ${path}` : `docs: add ${path}`,
    sha: existing?.sha,
    author: { name: "Andrew Carnegie", email: "ac00@example.com" },
  });
}
const labels = [
  ["bug", "c41230"],
  ["handout", "043673"],
  ["help wanted", "00853e"],
];
for (const [name, color] of labels)
  await api("ac00", "POST", "/repos/ac00/course-notes/labels", { name, color: "#" + color });
const ids = Object.fromEntries(
  (await api("ac00", "GET", "/repos/ac00/course-notes/labels")).map((l) => [l.name, l.id]),
);
const existingIssues = await api("ac00", "GET", "/repos/ac00/course-notes/issues?state=all&type=issues");
if (!existingIssues.length) {
  const issue = await api("mm00", "POST", "/repos/ac00/course-notes/issues", {
    title: "Week 2 handout points to the old calendar",
    body: "The steps in `handouts/week-02.md` still show the old calendar. Could we update the screenshots and the link?",
  });
  await api("ac00", "POST", `/repos/ac00/course-notes/issues/${issue.number}/labels`, {
    labels: [ids.bug, ids.handout],
  });
  await api("ac00", "POST", `/repos/ac00/course-notes/issues/${issue.number}/comments`, {
    body: "Good catch. I'll fix it before Monday's class.",
  });
  await api("am00", "POST", `/repos/ac00/course-notes/issues/${issue.number}/comments`, {
    body: "Week 3 has the same problem in its last step.",
  });
  await api("am00", "POST", "/repos/ac00/course-notes/issues", {
    title: "Add a handout on printing",
    body: "Students ask about printing every fall. A short handout would help.",
    labels: [ids["help wanted"], ids.handout],
  });
  const closed = await api("mm00", "POST", "/repos/ac00/course-notes/issues", {
    title: "Typo in the README",
    body: "\"Andrw\" in the first line.",
  });
  await api("ac00", "PATCH", `/repos/ac00/course-notes/issues/${closed.number}`, { state: "closed" });

}

// A pull request from a branch
const pulls = await api("ac00", "GET", "/repos/ac00/course-notes/pulls?state=all");
if (!pulls.length) {
  await api("ac00", "PUT", "/repos/ac00/course-notes/contents/handouts/week-02.md", {
    content: b64(
      "# Week 2: Email and Calendar\n\nSet up your email and the new calendar.\n\n1. Sign in with your Andrew ID.\n2. Open the calendar.\n3. Add your class schedule.\n",
    ),
    message: "docs: point week 2 at the new calendar",
    sha: (await api("ac00", "GET", "/repos/ac00/course-notes/contents/handouts/week-02.md")).sha,
    branch: "main",
    new_branch: "new-calendar",
    author: { name: "Andrew Carnegie", email: "ac00@example.com" },
  });
  await api("ac00", "POST", "/repos/ac00/course-notes/pulls", {
    head: "new-calendar",
    base: "main",
    title: "Point week 2 at the new calendar",
    body: `Fixes #1.\n\n* New steps for the calendar\n* Screenshots to follow`,
    labels: [ids.handout],
  });
}

// Margaret Morrison's smaller project, for the explore page
await api("mm00", "POST", "/user/repos", {
  name: "campus-walks",
  description: "Walking routes between campus buildings, as GeoJSON.",
  auto_init: true,
  readme: "Default",
  default_branch: "main",
});
await api("am00", "POST", "/user/repos", {
  name: "reading-list",
  description: "Books for the first-year seminar.",
  auto_init: true,
  readme: "Default",
  default_branch: "main",
});
console.log("seeded: ac00, mm00, am00 (password " + PASSWORD + ")");
