import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, "..", "..", "..", "examples");
const dest = path.resolve(here, "..", "templates");
const ids = ["hello", "telegram-desk", "support-desk", "change-gate"];
const skip = new Set(["node_modules", ".git", ".env", ".keep"]);

function copy(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    if (skip.has(name)) continue;
    const src = path.join(from, name);
    const dst = path.join(to, name);
    if (fs.statSync(src).isDirectory()) copy(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

fs.rmSync(dest, { recursive: true, force: true });
for (const id of ids) copy(path.join(source, id), path.join(dest, id));
