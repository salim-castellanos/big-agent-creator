import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  composePortClosed,
  deliveryCheck,
  envState,
  simulateFlow,
  loadExample,
  loadProject,
  parseEnv,
  redactValues,
  setSecret,
} from "../src/project.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const product = path.resolve(here, "..", "..", "..");
const bankFile = path.join(product, ".live", ".env");
const workspace = path.join(product, ".live", "workspace");
const example = path.join(product, "examples", "telegram-desk");
const needed = ["CURSOR_API_KEY", "TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET"];
const route = "http://127.0.0.1:3000/v1/channels/telegram/";

function valuesOf(env: Record<string, string>): string[] {
  return Object.values(env).map((value) => value.trim()).filter((value) => value.length >= 4);
}

function say(text: string, values: string[]): void {
  const clean = redactValues(text, values);
  if (values.some((value) => value.length >= 4 && clean.includes(value))) {
    console.log("withheld");
    return;
  }
  process.stdout.write(clean.endsWith("\n") ? clean : `${clean}\n`);
}

function docker(args: string[], values: string[], timeoutMs: number): Promise<{ code: number; text: string }> {
  return new Promise((resolve) => {
    let text = "";
    let settled = false;
    const finish = (code: number) => {
      if (settled) return;
      settled = true;
      resolve({ code, text });
    };
    const child = spawn("docker", args, { cwd: workspace, windowsHide: true });
    const timer = timeoutMs > 0 ? setTimeout(() => {
      say("Docker did not answer in time.", values);
      if (child.pid && process.platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true });
      else child.kill();
      finish(1);
    }, timeoutMs) : undefined;
    const take = (chunk: Buffer) => {
      text += chunk.toString("utf8");
    };
    child.stdout?.on("data", take);
    child.stderr?.on("data", take);
    child.on("error", (error) => {
      text += `${error.message}\n`;
      if (timer) clearTimeout(timer);
      finish(1);
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      finish(code ?? 1);
    });
  });
}

async function main(): Promise<number> {
  if (!fs.existsSync(bankFile)) {
    console.log(".live/.env is missing.");
    return 2;
  }
  const bank = parseEnv(fs.readFileSync(bankFile, "utf8"));
  const values = valuesOf(bank);
  for (const row of envState(bank, ["CURSOR_API_KEY", "AGENT_SDK_BEARER_TOKEN", "TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET", "WEBHOOK_SECRET", "CASES_TOKEN", "REVIEW_TOKEN", "PAGER_TOKEN", "GITHUB_WEBHOOK_SECRET", "GITHUB_TOKEN"])) {
    console.log(`${row.name} ${row.present ? "present" : "empty"}`);
  }
  const missing = needed.filter((name) => !bank[name]?.trim());
  if (missing.length) {
    console.log(`telegram desk needs ${missing.join(", ")}`);
    return 2;
  }

  fs.rmSync(workspace, { recursive: true, force: true });
  fs.mkdirSync(workspace, { recursive: true });
  const loaded = loadExample(example, workspace);
  console.log(`loaded telegram-desk files=${loaded.files}`);
  const asked = loadProject(workspace).secrets.map((row) => row.name);
  for (const name of asked) {
    const value = bank[name]?.trim();
    if (value) setSecret(workspace, name, value);
  }
  const report = simulateFlow(loadProject(workspace));
  console.log(report.ready ? "flow: ready" : "flow: incomplete");
  for (const line of report.lines) say(line, values);
  const blocked = deliveryCheck(workspace);
  if (blocked.length) {
    for (const finding of blocked) say(finding.message, values);
    return 1;
  }
  console.log("delivery: ok");

  const owners = await docker(["ps", "--format", "{{.Names}} {{.Ports}}"], values, 20000);
  say(owners.text, values);
  if (owners.code !== 0) return 1;
  const taken = owners.text.split(/\n/).map((line) => line.trim()).filter((line) => /:3000->/.test(line) && !line.startsWith("workspace-"));
  if (taken.length) {
    console.log("port 3000 is used by another container. Stop that agent, then run this again.");
    for (const line of taken) say(line, values);
    return 1;
  }

  const up = await docker(["compose", "up", "--build", "-d"], values, 360000);
  say(up.text.slice(-4000), values);
  if (up.code !== 0) return 1;
  const ps = await docker(["compose", "ps", "--format", "json"], values, 20000);
  say(ps.text, values);
  if (ps.code !== 0 || composePortClosed(ps.text)) {
    console.log(composePortClosed(ps.text) ? "port 3000 is not published" : "compose ps failed");
    return 1;
  }

  let health = 0;
  for (let attempt = 0; attempt < 40 && health !== 200; attempt += 1) {
    health = await fetch("http://127.0.0.1:3000/v1/health").then((response) => response.status).catch(() => 0);
    if (health !== 200) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  const playground = await fetch("http://127.0.0.1:3000/playground").then((response) => response.status).catch(() => 0);
  console.log(`playground: ${playground}`);
  console.log(`health: ${health}`);

  const token = bank.TELEGRAM_BOT_TOKEN.trim();
  const telegram = await fetch(`https://api.telegram.org/bot${token}/getMe`).then((response) => response.status).catch(() => 0);
  console.log(telegram === 200 ? "telegram: ok" : `telegram: ${telegram}`);

  const secret = bank.TELEGRAM_WEBHOOK_SECRET.trim();
  const post = (header: string) => fetch(route, {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": header },
    body: "{}",
  }).then((response) => response.status).catch(() => 0);
  const rejected = await post("wrong-secret");
  const accepted = await post(secret);
  console.log(`webhook wrong secret: ${rejected}`);
  console.log(`webhook right secret: ${accepted}`);

  const logs = await docker(["compose", "logs", "--tail", "80", "--no-color"], values, 20000);
  say(logs.text, values);
  const leaked = values.some((value) => logs.text.includes(value));
  console.log(leaked ? "secrets-in-log: yes" : "secrets-in-log: no");

  const ok = playground === 200 && health === 200 && telegram === 200 && rejected === 401 && accepted === 200 && !leaked;
  console.log(ok ? "live: ok" : "live: failed");
  return ok ? 0 : 1;
}

main().then((code) => process.exit(code)).catch(() => {
  console.log("live run stopped");
  process.exit(1);
});
