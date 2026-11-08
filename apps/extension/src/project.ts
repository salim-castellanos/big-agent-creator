import fs from "node:fs";
import path from "node:path";

export type Kind = "tool" | "skill" | "mcp" | "channel" | "schedule" | "subagent" | "hook" | "host";

export type Effect = "read" | "write" | "idempotent" | "irreversible";

export type Execution = "server" | "agent";

export type Transport = "http" | "stdio" | "account";

export type Param = { name: string; type: "string" | "number" | "boolean"; required: boolean; description: string };

export type Item = {
  kind: Kind;
  name: string;
  description: string;
  body: string;
  effect?: Effect;
  verify?: boolean;
  url?: string;
  parameters?: Param[];
  route?: string;
  secret?: string;
  calls?: string;
  execution?: Execution;
  transport?: Transport;
  advertise?: boolean;
  command?: string;
  repo?: string;
};

export type SecretRow = { name: string; configured: boolean };

/** What a person must fill in before that channel can be finished. A new channel is added here and in the flow simulation. */
export const CHANNEL_NEEDS: Record<string, { secrets: string[]; repo: "" | "repos" | "projects" }> = {
  telegram: { secrets: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET"], repo: "" },
  whatsapp: { secrets: ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET", "WHATSAPP_APP_ID"], repo: "" },
  slack: { secrets: ["SLACK_BOT_TOKEN", "SLACK_APP_TOKEN"], repo: "" },
  github: { secrets: ["GITHUB_WEBHOOK_SECRET", "GITHUB_TOKEN"], repo: "repos" },
  gitlab: { secrets: ["GITLAB_WEBHOOK_SECRET", "GITLAB_TOKEN"], repo: "projects" },
  bitbucket: { secrets: ["BITBUCKET_WEBHOOK_SECRET", "BITBUCKET_TOKEN"], repo: "repos" },
};

export const LIBRARY_KINDS: Kind[] = ["channel", "schedule", "tool", "skill", "mcp", "host", "subagent", "hook"];

export const TRIGGER_TYPES = ["telegram", "whatsapp", "webhook", "slack", "github", "gitlab", "bitbucket", "cron"] as const;

export function validRepo(value: string | undefined): boolean {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test((value || "").trim());
}

export function flowGaps(project: Project): Finding[] {
  const names = new Set(project.secrets.map((row) => row.name));
  const out: Finding[] = [];
  for (const item of project.items) {
    if (item.kind !== "channel") continue;
    const need = CHANNEL_NEEDS[item.description];
    if (!need) continue;
    if (need.repo && !validRepo(item.repo)) {
      out.push({ id: `${item.kind}:${item.name}`, message: `Set the repository on ${item.name} as owner/name, then Save.` });
    }
    for (const secret of need.secrets) {
      if (!names.has(secret)) out.push({ id: `secret:${secret}`, message: `${secret} is not on the Secrets page. Save the ${item.description} trigger.` });
    }
  }
  return out;
}

export type Project = {
  root: string;
  name: string;
  instructions: string;
  scope: string;
  model: string;
  effort: "low" | "medium" | "high";
  fast: boolean;
  sandbox: boolean;
  maxRunningTurns: number | null;
  harness: string[] | null;
  reminders: boolean;
  egress: string[];
  think: boolean;
  limits: boolean;
  items: Item[];
  secrets: SecretRow[];
};

const SAFE = /^[a-z0-9][a-z0-9-]{0,40}$/;

function marker(root: string): string {
  return path.join(root, ".bigagent", "project.json");
}

export function isProject(root: string): boolean {
  return fs.existsSync(marker(root));
}

export type Piece = { id: string; label: string };

export type Scan = { found: Piece[]; missing: Piece[] };

const PIECES: { id: string; label: string; present: (root: string) => boolean }[] = [
  { id: "instructions", label: "instructions.md", present: (root) => fs.existsSync(path.join(root, "instructions.md")) },
  { id: "tools", label: "tools/", present: (root) => fs.existsSync(path.join(root, "tools")) },
  { id: "skills", label: "skills/", present: (root) => fs.existsSync(path.join(root, "skills")) },
  { id: "mcp", label: "mcp-connections/", present: (root) => fs.existsSync(path.join(root, "mcp-connections")) },
  { id: "channels", label: "channels/", present: (root) => fs.existsSync(path.join(root, "channels")) },
  { id: "marker", label: ".bigagent/project.json", present: (root) => fs.existsSync(marker(root)) },
  { id: "docker", label: "Dockerfile + compose.yaml", present: (root) => fs.existsSync(path.join(root, "Dockerfile")) && fs.existsSync(path.join(root, "compose.yaml")) },
  { id: "env", label: ".env.example", present: (root) => fs.existsSync(path.join(root, ".env.example")) },
];

export function scanWorkspace(root: string): Scan {
  const found: Piece[] = [];
  const missing: Piece[] = [];
  for (const piece of PIECES) {
    const row = { id: piece.id, label: piece.label };
    if (piece.present(root)) found.push(row);
    else missing.push(row);
  }
  return { found, missing };
}

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}

export function slug(value: string): string {
  const cleaned = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  if (!SAFE.test(cleaned)) throw new Error("Use a short name: letters, numbers, and hyphens.");
  return cleaned;
}

export const GUIDE_URL = "https://github.com/salim-castellanos/big-agent-creator/blob/main/docs/start.md";
export const GUIDE_URL_ES = "https://github.com/salim-castellanos/big-agent-creator/blob/main/docs/start.es.md";

function writeStartFiles(root: string): void {
  const start = path.join(root, "START.md");
  if (!fs.existsSync(start)) {
    fs.writeFileSync(
      start,
      `# Start here

1. Open BigAgentCreator from the activity bar.
2. Hello world: Examples, then Hello. Or stay here. The Agent card is the prompt.
3. Secrets: set CURSOR_API_KEY.
4. Ship, Start. Open http://127.0.0.1:3000/playground and type hi.
5. To edit, select a card. The panel on the right is that card. Save.
6. A trigger calls the model only when its arrow reaches Agent.
7. Help, in the canvas header, is this same path. English | Español changes the labels only.
8. WhatsApp: add a Trigger of type whatsapp, set the four WHATSAPP_ names in Secrets, Start, then Connect.

Guide: ${GUIDE_URL}
Español: ${GUIDE_URL_ES}
`,
      "utf8",
    );
  }
  const agents = path.join(root, "AGENTS.md");
  if (!fs.existsSync(agents)) {
    fs.writeFileSync(
      agents,
      `# This folder

Before editing, read START.md. Secret values stay in .env and never in the chat. The designer rewrites bot/ from the files you change.

When the person describes an agent in one sentence, write these files. Do not invent a database.

Sentence: starts from a WhatsApp message, answers from a knowledge base, and stores the question when nothing was found.

channels/desk.json
{"type":"whatsapp","description":"A WhatsApp message","verify":true,"route":"/","secret":"WHATSAPP_VERIFY_TOKEN"}

mcp-connections/knowledge.json
{"url":"http://127.0.0.1:7000/knowledge","description":"The knowledge base","transport":"http"}

tools/lookup.json
{"description":"Find a passage in the knowledge base","effect":"read","calls":"mcp:knowledge","procedure":"return input;"}

tools/save-gap.json
{"description":"Store a question the knowledge base could not answer","effect":"write","calls":"http://127.0.0.1:7000/gaps","procedure":"return input;"}

skills/when-empty.md
When: the lookup found nothing

Tell the person you stored the question, and call save-gap with it.

instructions.md
Answer only from a passage lookup returns. If lookup returns nothing, call save-gap and say you stored the question.

If .bigagent/layout.json has links, add channel:desk to agent, and agent to tool:lookup, tool:save-gap, skill:when-empty, and mcp:knowledge. If links is null, leave it null.

Then say the next clicks: Secrets (CURSOR_API_KEY and the WHATSAPP_ names), Ship Start, Connect, Check number, Send a test.

Guide: ${GUIDE_URL}
`,
      "utf8",
    );
  }
}

export function initWorkspace(root: string, name: string): Project {
  slug(name);
  fs.mkdirSync(path.join(root, "tools"), { recursive: true });
  fs.mkdirSync(path.join(root, "skills"), { recursive: true });
  fs.mkdirSync(path.join(root, "mcp-connections"), { recursive: true });
  fs.mkdirSync(path.join(root, "channels"), { recursive: true });
  fs.mkdirSync(path.join(root, "schedules"), { recursive: true });
  fs.mkdirSync(path.join(root, "subagents"), { recursive: true });
  fs.mkdirSync(path.join(root, "hooks"), { recursive: true });
  fs.mkdirSync(path.join(root, "host-connections"), { recursive: true });
  const instructions = path.join(root, "instructions.md");
  if (!fs.existsSync(instructions)) {
    fs.writeFileSync(
      instructions,
      `# ${name.trim()}\n\nYou help the user. Answer only from the knowledge you were given. If it is outside that scope, say so.\n`,
      "utf8",
    );
  }
  if (!fs.existsSync(marker(root))) {
    writeJson(marker(root), { name: name.trim(), secretNames: ["CURSOR_API_KEY", "AGENT_SDK_BEARER_TOKEN"] });
  }
  if (!fs.existsSync(path.join(root, ".env.example"))) {
    fs.writeFileSync(path.join(root, ".env.example"), "CURSOR_API_KEY=\nAGENT_SDK_BEARER_TOKEN=\n", "utf8");
  }
  const ignore = path.join(root, ".gitignore");
  const prev = fs.existsSync(ignore) ? fs.readFileSync(ignore, "utf8") : "";
  if (!prev.includes(".env")) fs.writeFileSync(ignore, `${prev}\n.env\n`.trim() + "\n", "utf8");
  writeStartFiles(root);
  writeDocker(root, false);
  emitSdk(root);
  return loadProject(root);
}

export function createProject(root: string, name: string): Project {
  return initWorkspace(root, name);
}

const HARNESS = ["read", "grep", "glob", "ls", "edit", "delete", "shell", "task"];

export function loadProject(root: string): Project {
  const meta = readJson<{
    name?: string;
    secretNames?: string[];
    scope?: string;
    think?: boolean;
    limits?: boolean;
    model?: string;
    effort?: string;
    fast?: boolean;
    sandbox?: boolean;
    maxRunningTurns?: number;
    harness?: string[] | null;
    reminders?: boolean;
    egress?: string[];
  }>(marker(root), {});
  const instructions = fs.existsSync(path.join(root, "instructions.md"))
    ? fs.readFileSync(path.join(root, "instructions.md"), "utf8")
    : "";
  const items: Item[] = [
    ...readTools(root),
    ...readSkills(root),
    ...readMcp(root, "mcp-connections", "mcp"),
    ...readMcp(root, "host-connections", "host"),
    ...readChannels(root),
    ...readSchedules(root),
    ...readSubagents(root),
    ...readHooks(root),
  ];
  const env = readEnv(root);
  const secrets = (meta.secretNames ?? []).map((name) => ({ name, configured: Boolean(env[name]) }));
  const known = new Set(secrets.map((row) => row.name));
  for (const name of owedSecretNames(items)) {
    if (known.has(name)) continue;
    secrets.push({ name, configured: Boolean(env[name]) });
    known.add(name);
  }
  const legacy = meta.model === "fast" || meta.model === "strong" || meta.model === "auto" ? meta.model : "";
  const model = meta.model === "grok-4.5" || meta.model === "composer-2.5" ? meta.model : legacy === "fast" || legacy === "strong" ? "grok-4.5" : "auto";
  const effort = meta.effort === "low" || meta.effort === "medium" || meta.effort === "high" ? meta.effort : legacy === "fast" ? "low" : "high";
  const fast = typeof meta.fast === "boolean" ? meta.fast : legacy !== "strong";
  const harness = Array.isArray(meta.harness) ? meta.harness.filter((name) => HARNESS.includes(name)) : null;
  const egress = Array.isArray(meta.egress) ? meta.egress.map((name) => String(name)).filter(Boolean).slice(0, 40) : [];
  const maxRunningTurns = typeof meta.maxRunningTurns === "number" && meta.maxRunningTurns > 0 ? Math.min(200, Math.round(meta.maxRunningTurns)) : null;
  return {
    root,
    name: meta.name || path.basename(root),
    instructions,
    scope: meta.scope || "",
    think: meta.think !== false,
    limits: meta.limits !== false,
    model,
    effort,
    fast,
    sandbox: Boolean(meta.sandbox),
    maxRunningTurns,
    harness,
    reminders: Boolean(meta.reminders),
    egress,
    items,
    secrets,
  };
}

export type Finding = { id: string; message: string };

export type CardNeed = { id: string; missing: string[]; fields: string[] };

function fieldFor(message: string): string | undefined {
  if (message.startsWith("Write what this agent")) return "scope";
  if (message.startsWith("Sandbox is recorded")) return "sandbox";
  if (message.includes("does not say what it calls") || message.includes("No MCP named")) return "calls";
  if (message.includes("when it loads") || message.includes("when to delegate")) return "when";
  if (message.includes("has no URL")) return "url";
  if (message.includes("has no command")) return "command";
  if (message.includes("cron expression")) return "route-cron";
  if (message.includes("has no endpoint")) return "route";
  if (message.includes("no secret name")) return "secret";
  if (message.includes("does not name an event")) return "field";
  return undefined;
}

/** What is still empty on each card. The canvas color, the hover, and Simulate flow read this. */
export function cardNeeds(project: Project): CardNeed[] {
  const byId = new Map<string, CardNeed>();
  const add = (id: string, message: string, field?: string) => {
    const row = byId.get(id) ?? { id, missing: [], fields: [] };
    if (!row.missing.includes(message)) row.missing.push(message);
    if (field && !row.fields.includes(field)) row.fields.push(field);
    byId.set(id, row);
  };
  for (const finding of review(project)) {
    const id = finding.id === "sandbox" ? "agent" : finding.id;
    if (id === "scope" || id === "agent" || id.includes(":")) add(id, finding.message, fieldFor(finding.message));
  }
  const configured = new Map(project.secrets.map((row) => [row.name, row.configured]));
  for (const item of project.items) {
    const id = `${item.kind}:${item.name}`;
    if (item.kind === "channel") {
      const need = CHANNEL_NEEDS[item.description];
      if (need?.repo && !validRepo(item.repo)) add(id, `Set the repository on ${item.name} as owner/name, then Save.`, `repo-${item.description}`);
      for (const secret of need?.secrets ?? []) {
        if (!configured.get(secret)) add(id, `${secret} is empty. Set it in Secrets.`, `secret:${secret}`);
      }
      if (item.secret?.trim() && !configured.get(item.secret)) add(id, `${item.secret} is empty. Set it in Secrets.`, "secret");
    }
    if ((item.kind === "tool" || item.kind === "mcp" || item.kind === "host") && item.secret?.trim() && !configured.get(item.secret)) {
      add(id, `${item.secret} is empty. Set it in Secrets.`, "secret");
    }
  }
  if (project.think && !configured.get("CURSOR_API_KEY")) add("agent", "CURSOR_API_KEY is empty. Set it in Secrets.", "secret:CURSOR_API_KEY");
  return [...byId.values()];
}

export type FlowReport = {
  ready: boolean;
  secrets: string[];
  cards: { id: string; missing: string[] }[];
  folder: string[];
};

const SECRET_GAP = /^([A-Z][A-Z0-9_]*) is empty\. Set it in Secrets\.$/;

/** Secrets the person must set, cards that are still unfinished, and folder problems serve would refuse. */
export function flowReport(project: Project): FlowReport {
  const secrets: string[] = [];
  const cards: FlowReport["cards"] = [];
  for (const row of cardNeeds(project)) {
    const missing: string[] = [];
    for (const line of row.missing) {
      const match = line.match(SECRET_GAP);
      if (match) secrets.push(match[1]);
      else missing.push(line);
    }
    if (missing.length) cards.push({ id: row.id, missing });
  }
  const folder = deliveryCheck(project.root).map((finding) => finding.message);
  const unique = [...new Set(secrets)];
  return { ready: unique.length === 0 && cards.length === 0 && folder.length === 0, secrets: unique, cards, folder };
}

export function simulateFlow(project: Project): { ready: boolean; lines: string[] } {
  const report = flowReport(project);
  return {
    ready: report.ready,
    lines: [
      ...report.secrets.map((name) => `${name} is empty. Set it in Secrets.`),
      ...report.cards.flatMap((row) => row.missing),
      ...report.folder,
    ],
  };
}

function owedSecretNames(items: Item[]): string[] {
  const names: string[] = [];
  for (const item of items) {
    if (item.kind === "channel") {
      for (const secret of CHANNEL_NEEDS[item.description]?.secrets ?? []) names.push(secret);
      if (item.secret?.trim()) names.push(item.secret);
    }
    if ((item.kind === "tool" || item.kind === "mcp" || item.kind === "host") && item.secret?.trim()) names.push(item.secret);
  }
  names.push("CURSOR_API_KEY");
  return names;
}

export function dockerProblem(text: string): "missing" | "down" | "" {
  if (/not recognized as an internal or external command|ENOENT|Could not start Docker/i.test(text)) return "missing";
  if (/did not answer in time|dockerDesktopLinuxEngine|Cannot connect to the Docker daemon|error during connect|cannot find the file specified/i.test(text)) return "down";
  return "";
}

export const DOCKER_MISSING = "Docker is not installed, or this machine cannot run it. Install Docker, leave it running, then come back to Ship.";
export const DOCKER_DOWN = "Docker Desktop is not running. Open it, wait until it is ready, then Start.";
export const DOCKER_SILENT = "Docker did not answer. Open it, wait until it is ready, then Refresh.";

export function lmGate(input: { hasApi: boolean; modelCount: number; replied: boolean }): { ok: boolean; reason: string } {
  if (!input.hasApi) return { ok: false, reason: "This editor has no language model for extensions. The chat stays off." };
  if (input.modelCount < 1) return { ok: false, reason: "No language model is available. Sign in to one in the editor, then test again." };
  if (!input.replied) return { ok: false, reason: "The editor model did not answer. Test again." };
  return { ok: true, reason: "The editor model answered. You can ask about this canvas." };
}

export function review(project: Project): Finding[] {
  const out: Finding[] = [];
    if (project.limits && !project.scope.trim()) out.push({ id: "scope", message: "Write what this agent must refuse." });
    if (project.sandbox) {
      out.push({
        id: "sandbox",
        message: "Sandbox is recorded, but this local image cannot run it. The generator leaves it off so the chat still answers. Enabling it here fails every turn and Telegram stays silent.",
      });
    }
  const mcpNames = new Set(project.items.filter((item) => item.kind === "mcp").map((item) => item.name));
  for (const item of project.items) {
    const id = `${item.kind}:${item.name}`;
    if (item.kind === "channel") {
      const type = item.description || "webhook";
      const packed = ["telegram", "whatsapp", "slack", "github", "gitlab", "bitbucket"].includes(type);
      if (!packed && !item.route?.trim()) {
        out.push({ id, message: type === "cron" ? "This schedule has no cron expression." : "This hook has no endpoint." });
      }
      if (type !== "cron" && item.verify && !item.secret?.trim()) {
        out.push({ id, message: "Signature is on, but no secret name is bound." });
      }
    }
    if (item.kind === "tool" && !item.calls?.trim()) out.push({ id, message: "This tool does not say what it calls." });
    if (item.kind === "tool" && item.calls?.startsWith("mcp:")) {
      const target = item.calls.slice(4).trim();
      if (target && !mcpNames.has(target)) out.push({ id, message: `No MCP named ${target} is on this canvas.` });
    }
    if (item.kind === "skill" && !item.description.trim()) out.push({ id, message: "This skill does not say when it loads." });
    if (item.kind === "schedule" && !item.route?.trim()) out.push({ id, message: "This schedule has no cron expression." });
    if (item.kind === "subagent" && !item.description.trim()) out.push({ id, message: "This subagent does not say when to delegate." });
    if (item.kind === "hook" && !item.description.trim()) out.push({ id, message: "This hook does not name an event." });
    if (item.kind === "host" || item.kind === "mcp") {
      const transport = item.transport || "http";
      if (transport === "http" && !item.url?.trim()) out.push({ id, message: "This server has no URL." });
      if (transport === "stdio" && !item.command?.trim()) out.push({ id, message: "This server has no command." });
    }
  }
  return out;
}

function effectOf(value: unknown): Effect {
  if (value === "write" || value === "idempotent" || value === "irreversible") return value;
  return "read";
}

function executionOf(value: unknown): Execution {
  return value === "agent" ? "agent" : "server";
}

function transportOf(value: unknown): Transport {
  return value === "stdio" || value === "account" ? value : "http";
}

export function cleanParams(value: unknown): Param[] {
  if (!Array.isArray(value)) return [];
  const out: Param[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const name = String(rec.name || "").trim();
    if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(name)) continue;
    out.push({
      name,
      type: rec.type === "number" || rec.type === "boolean" ? rec.type : "string",
      required: Boolean(rec.required),
      description: String(rec.description || "").slice(0, 200),
    });
    if (out.length === 12) break;
  }
  return out;
}

function splitSkill(text: string): { when: string; body: string } {
  const match = text.match(/^When:\s*(.*)\r?\n\r?\n?([\s\S]*)$/);
  if (!match) return { when: "", body: text };
  return { when: match[1].trim(), body: match[2] };
}

function joinSkill(when: string, body: string): string {
  const rest = body.replace(/^\uFEFF/, "");
  if (!when.trim()) return rest.endsWith("\n") ? rest : `${rest}\n`;
  const prose = rest.replace(/^\s+/, "");
  return `When: ${when.trim()}\n\n${prose.endsWith("\n") ? prose : `${prose}\n`}`;
}

function readTools(root: string): Item[] {
  return files(root, "tools", ".json").map((name) => {
    const data = readJson<{ description?: string; effect?: string; parameters?: unknown; calls?: string; secret?: string; execution?: string; procedure?: string }>(path.join(root, "tools", `${name}.json`), {});
    return {
      kind: "tool",
      name,
      description: data.description || "",
      body: data.procedure || "",
      effect: effectOf(data.effect),
      parameters: cleanParams(data.parameters),
      calls: data.calls || "",
      secret: data.secret || "",
      execution: executionOf(data.execution),
    };
  });
}

function readSkills(root: string): Item[] {
  return files(root, "skills", ".md").map((name) => {
    const skill = splitSkill(fs.readFileSync(path.join(root, "skills", `${name}.md`), "utf8"));
    return { kind: "skill", name, description: skill.when, body: skill.body };
  });
}

function readMcp(root: string, folder: string, kind: "mcp" | "host"): Item[] {
  return files(root, folder, ".json").map((name) => {
    const data = readJson<{ url?: string; description?: string; secret?: string; transport?: string; command?: string; advertise?: boolean }>(path.join(root, folder, `${name}.json`), {});
    return {
      kind,
      name,
      description: data.description || "",
      body: "",
      url: data.url || "",
      secret: data.secret || "",
      transport: transportOf(data.transport),
      command: data.command || "",
      advertise: Boolean(data.advertise),
    };
  });
}

function readSchedules(root: string): Item[] {
  return files(root, "schedules", ".json").map((name) => {
    const data = readJson<{ cron?: string; description?: string }>(path.join(root, "schedules", `${name}.json`), {});
    return { kind: "schedule", name, description: data.description || "", body: "", route: data.cron || "" };
  });
}

function readSubagents(root: string): Item[] {
  return files(root, "subagents", ".md").map((name) => {
    const skill = splitSkill(fs.readFileSync(path.join(root, "subagents", `${name}.md`), "utf8"));
    return { kind: "subagent", name, description: skill.when, body: skill.body };
  });
}

function readHooks(root: string): Item[] {
  return files(root, "hooks", ".json").map((name) => {
    const data = readJson<{ event?: string; procedure?: string }>(path.join(root, "hooks", `${name}.json`), {});
    return { kind: "hook", name, description: data.event || "", body: data.procedure || "" };
  });
}

function readChannels(root: string): Item[] {
  return files(root, "channels", ".json").map((name) => {
    const data = readJson<{ type?: string; description?: string; verify?: boolean; route?: string; secret?: string; repo?: string }>(path.join(root, "channels", `${name}.json`), {});
    return { kind: "channel", name, description: data.type || "webhook", body: data.description || "", verify: Boolean(data.verify), route: data.route || "", secret: data.secret || "", repo: data.repo || "" };
  });
}

function files(root: string, folder: string, ext: string): string[] {
  const dir = path.join(root, folder);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(ext))
    .map((file) => file.slice(0, -ext.length))
    .sort();
}

export function saveInstructions(root: string, text: string): void {
  fs.writeFileSync(path.join(root, "instructions.md"), text, "utf8");
  emitSdk(root);
}

export function setCanvasNode(root: string, node: "think" | "limits", present: boolean): void {
  const meta = readJson<Record<string, unknown>>(marker(root), {});
  writeJson(marker(root), { ...meta, [node]: present });
  emitSdk(root);
}

export function reachesNode(links: Link[], from: string, target: string): boolean {
  const next = new Map<string, string[]>();
  for (const link of links) {
    const list = next.get(link.from) || [];
    list.push(link.to);
    next.set(link.from, list);
  }
  const seen = new Set<string>();
  const pending = [from];
  while (pending.length) {
    const current = pending.pop() as string;
    if (current === target) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const step of next.get(current) || []) pending.push(step);
  }
  return false;
}

export function saveScope(root: string, scope: string): void {
  const meta = readJson<Record<string, unknown>>(marker(root), {});
  writeJson(marker(root), { ...meta, scope: scope.slice(0, 2000) });
  emitSdk(root);
}

export function saveModel(root: string, model: string): void {
  saveAgentSettings(root, { model });
}

export type AgentSettings = {
  model?: string;
  effort?: string;
  fast?: boolean;
  sandbox?: boolean;
  maxRunningTurns?: number | null;
  harness?: string[] | null;
  reminders?: boolean;
  egress?: string[];
};

export function saveAgentSettings(root: string, settings: AgentSettings): void {
  const meta = readJson<Record<string, unknown>>(marker(root), {});
  const model = settings.model === "grok-4.5" || settings.model === "composer-2.5" ? settings.model : "auto";
  const effort = settings.effort === "low" || settings.effort === "medium" || settings.effort === "high" ? settings.effort : meta.effort;
  const next: Record<string, unknown> = { ...meta, model };
  if (effort) next.effort = effort;
  if (typeof settings.fast === "boolean") next.fast = settings.fast;
  if (typeof settings.sandbox === "boolean") next.sandbox = settings.sandbox;
  if (typeof settings.reminders === "boolean") next.reminders = settings.reminders;
  if (settings.maxRunningTurns === null) delete next.maxRunningTurns;
  else if (typeof settings.maxRunningTurns === "number") next.maxRunningTurns = Math.min(200, Math.max(1, Math.round(settings.maxRunningTurns)));
  if (settings.harness === null) next.harness = null;
  else if (Array.isArray(settings.harness)) next.harness = settings.harness.filter((name) => HARNESS.includes(name));
  if (Array.isArray(settings.egress)) next.egress = settings.egress.map((name) => name.trim()).filter(Boolean).slice(0, 40);
  writeJson(marker(root), next);
  emitSdk(root);
}

function rememberSecrets(root: string, names: string[]): void {
  const meta = readJson<{ secretNames?: string[] }>(marker(root), {});
  const set = new Set(meta.secretNames ?? []);
  for (const name of names) if (/^[A-Z][A-Z0-9_]*$/.test(name)) set.add(name);
  writeJson(marker(root), { ...meta, secretNames: [...set] });
}

export function saveItem(root: string, item: Item): void {
  const name = slug(item.name);
  if (item.kind === "tool") {
    writeJson(path.join(root, "tools", `${name}.json`), {
      description: item.description,
      effect: effectOf(item.effect),
      execution: executionOf(item.execution),
      procedure: item.body || "",
      parameters: cleanParams(item.parameters),
      calls: item.calls || "",
      secret: item.secret || "",
    });
  }
  if (item.kind === "skill") {
    fs.mkdirSync(path.join(root, "skills"), { recursive: true });
    fs.writeFileSync(path.join(root, "skills", `${name}.md`), joinSkill(item.description, item.body), "utf8");
  }
  if (item.kind === "subagent") {
    fs.mkdirSync(path.join(root, "subagents"), { recursive: true });
    fs.writeFileSync(path.join(root, "subagents", `${name}.md`), joinSkill(item.description, item.body), "utf8");
  }
  if (item.kind === "mcp" || item.kind === "host") {
    const folder = item.kind === "host" ? "host-connections" : "mcp-connections";
    writeJson(path.join(root, folder, `${name}.json`), {
      url: item.url || "",
      description: item.description,
      secret: item.secret || "",
      transport: transportOf(item.transport),
      command: item.command || "",
      advertise: Boolean(item.advertise),
    });
  }
  if (item.kind === "channel") {
    writeJson(path.join(root, "channels", `${name}.json`), {
      type: item.description || "webhook",
      description: item.body,
      verify: Boolean(item.verify),
      route: item.route || "",
      secret: item.secret || "",
      repo: item.repo || "",
    });
    const need = CHANNEL_NEEDS[item.description || ""];
    if (need) rememberSecrets(root, [...need.secrets, item.secret || ""]);
  }
  if (item.kind === "schedule") {
    writeJson(path.join(root, "schedules", `${name}.json`), { cron: item.route || "", description: item.description || item.body || "" });
  }
  if (item.kind === "hook") {
    writeJson(path.join(root, "hooks", `${name}.json`), { event: item.description || "turn.completed", procedure: item.body || "" });
  }
  if (item.secret) rememberSecrets(root, [item.secret]);
  emitSdk(root);
}

function itemFile(root: string, kind: Kind, name: string): string {
  const safe = slug(name);
  if (kind === "tool") return path.join(root, "tools", `${safe}.json`);
  if (kind === "skill") return path.join(root, "skills", `${safe}.md`);
  if (kind === "subagent") return path.join(root, "subagents", `${safe}.md`);
  if (kind === "mcp") return path.join(root, "mcp-connections", `${safe}.json`);
  if (kind === "host") return path.join(root, "host-connections", `${safe}.json`);
  if (kind === "schedule") return path.join(root, "schedules", `${safe}.json`);
  if (kind === "hook") return path.join(root, "hooks", `${safe}.json`);
  return path.join(root, "channels", `${safe}.json`);
}

export function deleteItem(root: string, kind: Kind, name: string): void {
  fs.rmSync(itemFile(root, kind, name), { force: true });
  emitSdk(root);
}

export function secretValue(root: string, name: string): string {
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) return "";
  return readEnv(root)[name] ?? "";
}

/** Telegram's secret_token is 1–256 chars of letters, digits, "_" and "-". The message never includes the value. */
export function telegramReach(root: string): Finding[] {
  const project = loadProject(root);
  if (!project.items.some((item) => item.kind === "channel" && item.description === "telegram")) return [];
  const secret = secretValue(root, "TELEGRAM_WEBHOOK_SECRET").trim();
  const token = secretValue(root, "TELEGRAM_BOT_TOKEN").trim();
  const out: Finding[] = [];
  if (!secret) {
    out.push({ id: "telegram-secret", message: "TELEGRAM_WEBHOOK_SECRET is empty. In Secrets, set a word of letters, numbers, _ and -, then Register webhook." });
  } else if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
    out.push({
      id: "telegram-secret",
      message: "TELEGRAM_WEBHOOK_SECRET has a character Telegram rejects. Use only letters, numbers, _ and -. The BotFather token, which contains a colon, stays in TELEGRAM_BOT_TOKEN.",
    });
  }
  if (!token) {
    out.push({ id: "telegram-token", message: "TELEGRAM_BOT_TOKEN is empty. Paste the BotFather token in Secrets." });
  } else if (!/^\d+:\S+$/.test(token)) {
    out.push({ id: "telegram-token", message: "TELEGRAM_BOT_TOKEN should be the BotFather value, which looks like 123456:ABC. It is a different field from TELEGRAM_WEBHOOK_SECRET." });
  }
  return out;
}

/** WhatsApp Cloud API. The verify token is the word Meta echoes. The phone number id is digits. The token is the long Meta value. Messages never include the value. */
export function whatsappReach(root: string): Finding[] {
  const project = loadProject(root);
  if (!project.items.some((item) => item.kind === "channel" && item.description === "whatsapp")) return [];
  const token = secretValue(root, "WHATSAPP_TOKEN").trim();
  const phone = secretValue(root, "WHATSAPP_PHONE_NUMBER_ID").trim();
  const verify = secretValue(root, "WHATSAPP_VERIFY_TOKEN").trim();
  const out: Finding[] = [];
  if (!token) out.push({ id: "whatsapp-token", message: "WHATSAPP_TOKEN is empty. Paste the token from Meta, WhatsApp, API Setup." });
  else if (/\s/.test(token) || token.length < 20) out.push({ id: "whatsapp-token", message: "WHATSAPP_TOKEN should be the long token from Meta, with no spaces." });
  if (!phone) out.push({ id: "whatsapp-phone", message: "WHATSAPP_PHONE_NUMBER_ID is empty. Copy the phone number ID from Meta, API Setup." });
  else if (!/^\d+$/.test(phone)) out.push({ id: "whatsapp-phone", message: "WHATSAPP_PHONE_NUMBER_ID should be digits only. It is not the phone number people dial." });
  if (!verify) out.push({ id: "whatsapp-verify", message: "WHATSAPP_VERIFY_TOKEN is empty. Invent a word of letters, numbers, _ and -, then use that same word in Meta." });
  else if (!/^[A-Za-z0-9_-]{1,256}$/.test(verify)) out.push({ id: "whatsapp-verify", message: "WHATSAPP_VERIFY_TOKEN may only use letters, numbers, _ and -." });
  return out;
}

export function whatsappCheckTarget(token: string, phoneId: string): { endpoint: string; authorization: string } | { error: string } {
  const phone = phoneId.trim();
  const value = token.trim();
  if (!/^\d+$/.test(phone)) return { error: "WHATSAPP_PHONE_NUMBER_ID should be digits only. It is not the phone number people dial." };
  if (/\s/.test(value) || value.length < 20) return { error: "WHATSAPP_TOKEN should be the long token from Meta, with no spaces." };
  return { endpoint: `https://graph.facebook.com/v21.0/${phone}?fields=display_phone_number`, authorization: `Bearer ${value}` };
}

export function whatsappSendTarget(token: string, phoneId: string, to: string): { endpoint: string; authorization: string; body: string } | { error: string } {
  const check = whatsappCheckTarget(token, phoneId);
  if ("error" in check) return check;
  const digits = to.trim().replace(/^\+/, "").replace(/[\s-]/g, "");
  if (!/^\d{8,15}$/.test(digits)) return { error: "The test number should be the country code and the number, digits only." };
  return {
    endpoint: `https://graph.facebook.com/v21.0/${phoneId.trim()}/messages`,
    authorization: check.authorization,
    body: JSON.stringify({ messaging_product: "whatsapp", to: digits, type: "text", text: { body: "hello" } }),
  };
}

const PACK_SECRET = /^[A-Za-z0-9_-]{1,256}$/;

export function slackReach(root: string): Finding[] {
  const project = loadProject(root);
  if (!project.items.some((item) => item.kind === "channel" && item.description === "slack")) return [];
  const bot = secretValue(root, "SLACK_BOT_TOKEN").trim();
  const app = secretValue(root, "SLACK_APP_TOKEN").trim();
  const out: Finding[] = [];
  if (!bot.startsWith("xoxb-")) out.push({ id: "slack-bot", message: "SLACK_BOT_TOKEN should be the bot token from Slack, the one that starts with xoxb-." });
  if (!app.startsWith("xapp-")) out.push({ id: "slack-app", message: "SLACK_APP_TOKEN should be the app-level token from Slack, the one that starts with xapp-." });
  return out;
}

export function slackCheckTarget(token: string): { endpoint: string; authorization: string } | { error: string } {
  const value = token.trim();
  if (!value.startsWith("xoxb-")) return { error: "SLACK_BOT_TOKEN should be the bot token from Slack, the one that starts with xoxb-." };
  return { endpoint: "https://slack.com/api/auth.test", authorization: `Bearer ${value}` };
}

export function hookSecretReach(root: string, type: "github" | "gitlab" | "bitbucket"): Finding[] {
  const project = loadProject(root);
  if (!project.items.some((item) => item.kind === "channel" && item.description === type)) return [];
  const name = type === "github" ? "GITHUB_WEBHOOK_SECRET" : type === "gitlab" ? "GITLAB_WEBHOOK_SECRET" : "BITBUCKET_WEBHOOK_SECRET";
  const secret = secretValue(root, name).trim();
  if (!secret) return [{ id: `${type}-secret`, message: `${name} is empty. Invent a word of letters, numbers, _ and -, and use that same word as the webhook secret.` }];
  if (!PACK_SECRET.test(secret)) return [{ id: `${type}-secret`, message: `${name} may only use letters, numbers, _ and -.` }];
  return [];
}

/** https origin, or the same origin already ending in /v1/channels/<name>/. */
export function publicChannelUrl(base: string, channel = "telegram"): string | undefined {
  let url: URL;
  try {
    url = new URL(base.trim());
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" || !url.hostname) return undefined;
  const path = url.pathname.replace(/\/+$/, "");
  const suffix = `/v1/channels/${channel}`;
  if (path !== "" && path !== suffix) return undefined;
  return `${url.origin}${suffix}/`;
}

export function telegramSetWebhookTarget(
  token: string,
  secret: string,
  publicBase: string,
): { endpoint: string; body: string; hook: string } | { error: string } {
  const hook = publicChannelUrl(publicBase);
  if (!hook) return { error: "The public address must be the https tunnel, for example https://name.trycloudflare.com." };
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret.trim())) {
    return { error: "TELEGRAM_WEBHOOK_SECRET must be letters, numbers, _ and - only. Change it in Secrets, then Register again." };
  }
  if (!/^\d+:\S+$/.test(token.trim())) {
    return { error: "TELEGRAM_BOT_TOKEN is missing the BotFather shape 123456:ABC. Set it in Secrets, then Register again." };
  }
  return {
    endpoint: `https://api.telegram.org/bot${token.trim()}/setWebhook`,
    body: JSON.stringify({ url: hook, secret_token: secret.trim() }),
    hook,
  };
}

function readEnv(root: string): Record<string, string> {
  const file = path.join(root, ".env");
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    out[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return out;
}

export function setSecret(root: string, name: string, value: string): void {
  const key = name.trim();
  if (!/^[A-Z][A-Z0-9_]*$/.test(key)) throw new Error("Secret names look like CURSOR_API_KEY.");
  const meta = readJson<{ name?: string; secretNames?: string[] }>(marker(root), {});
  const names = new Set(meta.secretNames ?? []);
  names.add(key);
  writeJson(marker(root), { ...meta, secretNames: [...names] });
  const env = readEnv(root);
  env[key] = value;
  const body = Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  fs.writeFileSync(path.join(root, ".env"), `${body}\n`, "utf8");
}

export type ExampleInfo = { id: string; title: string; summary: string; level: string };

export const EXAMPLES: ExampleInfo[] = [
  {
    id: "hello",
    title: "Hello",
    summary: "Type hi in the playground and get hello. No Telegram. This is the first run.",
    level: "Hello",
  },
  {
    id: "telegram-desk",
    title: "Telegram desk",
    summary: "One chat in, one answer back. Hours, and a refusal for refunds. The deploy that was tried end to end.",
    level: "Next",
  },
  {
    id: "support-desk",
    title: "Support desk",
    summary: "An inbox webhook and a Monday schedule. Lookup, then a case, then a person. The image starts; the knowledge servers are not in this compose file.",
    level: "Bigger",
  },
  {
    id: "change-gate",
    title: "Change gate",
    summary: "A pull request review across the canvas. Telegram is the path you can talk to. The other entries are the tour.",
    level: "Full canvas",
  },
];

const SKIP_ALWAYS = new Set(["node_modules", ".git", ".keep"]);

export function keepPath(root: string): string {
  return path.join(root, ".keep", "original");
}

export function workspaceKept(root: string): boolean {
  return fs.existsSync(keepPath(root));
}

/** First save only. Loading an example will not replace this copy. */
export function keepWorkspace(root: string): { dir: string; fresh: boolean } {
  const dir = keepPath(root);
  if (fs.existsSync(dir)) return { dir, fresh: false };
  copyTree(root, dir, SKIP_ALWAYS);
  return { dir, fresh: true };
}

export function restoreWorkspace(root: string): void {
  const dir = keepPath(root);
  if (!fs.existsSync(dir)) throw new Error("Nothing is kept yet. Keep this folder before loading an example.");
  const saved = new Set(relativeFiles(dir));
  removeUnsaved(root, saved);
  copyTree(dir, root, SKIP_ALWAYS);
}

export function loadExample(source: string, dest: string): { files: number; keptEnv: boolean; keptFresh: boolean } {
  if (!fs.existsSync(source)) throw new Error("That example is not in this extension.");
  const kept = keepWorkspace(dest);
  const keptEnv = fs.existsSync(path.join(dest, ".env"));
  clearExceptKept(dest);
  const files = copyTree(source, dest, new Set([...SKIP_ALWAYS, ".env"]));
  if (isProject(dest)) {
    writeDocker(dest, true);
    emitSdk(dest);
  }
  return { files, keptEnv, keptFresh: kept.fresh };
}

function copyTree(source: string, dest: string, skip: Set<string>): number {
  let count = 0;
  const walk = (from: string, to: string) => {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const src = path.join(from, entry.name);
      const dst = path.join(to, entry.name);
      if (entry.isDirectory()) walk(src, dst);
      else {
        fs.copyFileSync(src, dst);
        count += 1;
      }
    }
  };
  walk(source, dest);
  return count;
}

function relativeFiles(dir: string, base = dir, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_ALWAYS.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    const rel = path.relative(base, abs);
    if (entry.isDirectory()) relativeFiles(abs, base, out);
    else out.push(rel);
  }
  return out;
}

function clearExceptKept(root: string): void {
  if (!fs.existsSync(root)) return;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (SKIP_ALWAYS.has(entry.name) || entry.name === ".env") continue;
    fs.rmSync(path.join(root, entry.name), { recursive: true, force: true });
  }
}

function removeUnsaved(root: string, saved: Set<string>): void {
  const drop = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_ALWAYS.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) drop(abs);
      else if (!saved.has(path.relative(root, abs))) fs.rmSync(abs, { force: true });
    }
  };
  drop(root);
}

export function writeDocker(root: string, force = true): void {
  const write = (file: string, body: string) => {
    if (force || !fs.existsSync(file)) fs.writeFileSync(file, body, "utf8");
  };
  write(path.join(root, ".dockerignore"), ".env\n.env.*\n!.env.example\n.git\nnode_modules\n");
  write(path.join(root, "Dockerfile"), dockerFile());
  write(path.join(root, "compose.yaml"), composeFile());
  if (isProject(root)) ensurePackageJson(root, loadProject(root).name);
}

/** What agent-sdk serve would refuse in this folder. Design notes stay in review(). */
export function deliveryCheck(root: string): Finding[] {
  const out: Finding[] = [];
  const pkgPath = path.join(root, "package.json");
  if (!fs.existsSync(pkgPath)) {
    out.push({
      id: "package",
      message: 'package.json is missing. agent-sdk serve will refuse bot/*.ts: Node tries to require() an ES module in a cycle.',
    });
  } else {
    let pkg: { type?: string; dependencies?: Record<string, string> } = {};
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as typeof pkg;
    } catch {
      out.push({ id: "package", message: "package.json is not valid JSON, so the image cannot install the agent." });
    }
    if (pkg.type !== "module") {
      out.push({
        id: "package-type",
        message: 'package.json must set "type": "module". Without it, agent-sdk serve refuses bot/*.ts with: Cannot require() ES Module in a cycle.',
      });
    }
    const deps = pkg.dependencies ?? {};
    if (!deps["@grok/agent-sdk"]) {
      out.push({ id: "sdk-dep", message: "package.json is missing @grok/agent-sdk. The image installs that package before serve." });
    }
    if (!deps.zod) out.push({ id: "zod-dep", message: 'package.json is missing zod. Generated files import "zod/v4".' });
  }

  const dockerPath = path.join(root, "Dockerfile");
  if (!fs.existsSync(dockerPath)) {
    out.push({ id: "docker", message: "Dockerfile is missing. Saving the canvas, or Rewrite local Docker files, writes it." });
  } else {
    const docker = fs.readFileSync(dockerPath, "utf8");
    if (!/npm install/.test(docker)) {
      out.push({
        id: "docker-install",
        message: "Dockerfile never runs npm install. The image then has no local package, and serve refuses the TypeScript modules.",
      });
    }
    if (!/--mode["\s,]+single/.test(docker)) {
      out.push({
        id: "docker-mode",
        message: "Dockerfile serve command is missing --mode single. The public channel route is POST /v1/channels/<name>/ only in that mode.",
      });
    }
    const agentSource = path.join(root, "bot", "agent.ts");
    if (fs.existsSync(agentSource) && /sandbox:\s*true/.test(fs.readFileSync(agentSource, "utf8"))) {
      out.push({
        id: "sandbox-image",
        message: "bot/agent.ts enables the local sandbox. This image cannot run it, so the turn fails and Telegram stays silent. Save again so the generator leaves it off.",
      });
    }
    if (!docker.includes("--allow-anonymous") && !docker.includes("--bearer-token")) {
      out.push({
        id: "docker-auth",
        message: "Dockerfile keeps the loopback-only auth. Through Docker the playground then returns 401: No auth policy admitted this request. Admit this machine with --allow-anonymous when no bearer is set.",
      });
    }
    if (/^[A-Z][A-Z0-9_]+=\S/m.test(docker)) {
      out.push({ id: "docker-secret", message: "Dockerfile contains an environment assignment. Secret values stay in .env, not in the image." });
    }
  }

  const ignorePath = path.join(root, ".dockerignore");
  const ignore = fs.existsSync(ignorePath) ? fs.readFileSync(ignorePath, "utf8") : "";
  const ignored = ignore.split(/\r?\n/).map((line) => line.replace(/^\uFEFF/, "").trim());
  if (!ignored.includes(".env")) {
    out.push({ id: "dockerignore", message: ".dockerignore must exclude .env so secret values are not copied into the image." });
  }

  for (const file of walkGenerated(path.join(root, "bot"))) {
    const body = fs.readFileSync(file, "utf8");
    if (!body.includes(MARK)) continue;
    if (/from\s+["']zod["']/.test(body)) {
      const rel = path.relative(root, file).replace(/\\/g, "/");
      out.push({ id: `zod:${rel}`, message: `${rel} imports "zod". Generated files use import * as z from "zod/v4".` });
    }
  }
  return out;
}

function walkGenerated(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkGenerated(full, out);
    else if (entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

function dockerFile(): string {
  return `FROM node:22.13
WORKDIR /srv/agent
COPY . .
RUN npm install --omit=dev && npm install -g @grok/agent-sdk
EXPOSE 3000
# Docker is not loopback inside the container, so localDevStrict returns 401.
# BIGAGENT_ADMIT_LOCAL=1 admits this machine. Otherwise a bearer locks the API.
CMD ["sh", "-c", "if [ -n \\"$AGENT_SDK_BEARER_TOKEN\\" ] && [ \\"$BIGAGENT_ADMIT_LOCAL\\" != \\"1\\" ]; then exec agent-sdk serve --dir /srv/agent --host 0.0.0.0 --port 3000 --state-root /var/lib/agent-sdk --mode single --bearer-token \\"$AGENT_SDK_BEARER_TOKEN\\"; else exec agent-sdk serve --dir /srv/agent --host 0.0.0.0 --port 3000 --state-root /var/lib/agent-sdk --mode single --allow-anonymous; fi"]
`;
}

const MARK = "@bigagent generated";

function q(value: string): string {
  return JSON.stringify(value);
}

function zodShape(params: Param[] | undefined): string {
  const fields = (params || []).map((param) => {
    const base = param.type === "number" ? "z.number()" : param.type === "boolean" ? "z.boolean()" : "z.string()";
    return `    ${param.name}: ${param.required ? base : `${base}.optional()`}`;
  });
  return fields.length ? `z.object({\n${fields.join(",\n")}\n  })` : "z.object({})";
}

function connectionSource(item: Item): string {
  const transport = transportOf(item.transport);
  const lines = [`import { defineConnection } from "@grok/agent-sdk/connections";`, ``, `// ${MARK}`, `export default defineConnection({`];
  if (transport === "account") {
    lines.push(`  cursorAccount: true,`, `  advertiseTools: true,`);
  } else if (transport === "stdio") {
    lines.push(`  command: ${q(item.command || "node")},`);
    if (item.secret) lines.push(`  env: { TOKEN: "\${${item.secret}}" },`);
  } else {
    lines.push(`  url: ${q(item.url || "")},`);
    if (item.secret) lines.push(`  headers: { authorization: "Bearer \${${item.secret}}" },`);
    if (item.advertise) lines.push(`  advertiseTools: true,`);
  }
  lines.push(`});`, ``);
  return lines.join("\n");
}

function accountScope(kind: "repos" | "projects", repo: string | undefined): string {
  if (!validRepo(repo)) return "";
  return `  cursorAccount: { ${kind}: [${q(repo!.trim())}] },`;
}

function packChannel(item: Item): string | undefined {
  const event = item.route || "";
  if (item.description === "slack") {
    return `import { slackChannel } from "@grok/agent-sdk/channels/slack";\n\n// ${MARK}\n// Socket mode. Secrets: SLACK_BOT_TOKEN (xoxb-) and SLACK_APP_TOKEN (xapp-).\nexport default slackChannel();\n`;
  }
  if (item.description === "github") {
    const name = event === "issues" ? "issues" : event === "push" ? "push" : "pull_request";
    const hook =
      name === "pull_request"
        ? "  onPullRequest: (ctx) => ({ auth: defaultGitHubAuth(ctx) }),"
        : `  onEvent: (ctx, event) => (event.eventName === ${q(name)} ? { auth: defaultGitHubAuth(ctx) } : null),`;
    return [
      'import { defaultGitHubAuth, githubChannel } from "@grok/agent-sdk/channels/github";',
      "",
      `// ${MARK}`,
      "export default githubChannel({",
      `  botName: ${q(item.name)},`,
      accountScope("repos", item.repo),
      '  credentials: { webhookSecret: { secretName: "GITHUB_WEBHOOK_SECRET" } },',
      hook,
      "});",
      "",
    ].join("\n");
  }
  if (item.description === "gitlab") {
    const hook = event === "note" ? "  onNote: (ctx) => ({ auth: defaultGitLabAuth(ctx) })," : "  onMergeRequest: (ctx) => ({ auth: defaultGitLabAuth(ctx) }),";
    return [
      'import { defaultGitLabAuth, gitlabChannel } from "@grok/agent-sdk/channels/gitlab";',
      "",
      `// ${MARK}`,
      "export default gitlabChannel({",
      accountScope("projects", item.repo),
      '  webhookSecret: { secretName: "GITLAB_WEBHOOK_SECRET" },',
      hook,
      "});",
      "",
    ].join("\n");
  }
  if (item.description === "bitbucket") {
    return [
      'import { bitbucketChannel, defaultBitbucketAuth } from "@grok/agent-sdk/channels/bitbucket";',
      "",
      `// ${MARK}`,
      "export default bitbucketChannel({",
      accountScope("repos", item.repo),
      '  webhookSecret: { secretName: "BITBUCKET_WEBHOOK_SECRET" },',
      "  onPullRequest: (ctx) => ({ auth: defaultBitbucketAuth(ctx) }),",
      "});",
      "",
    ].join("\n");
  }
  return undefined;
}

function telegramLibrary(): string {
  return [
    `// ${MARK}`,
    "export async function replyTelegram(chatId: string, text: string): Promise<void> {",
    "  const token = process.env.TELEGRAM_BOT_TOKEN;",
    "  if (!token || !chatId || !text) return;",
    "  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {",
    "    method: \"POST\",",
    "    headers: { \"content-type\": \"application/json\" },",
    "    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000) }),",
    "    signal: AbortSignal.timeout(8000),",
    "  });",
    "  if (!response.ok) console.error(`[telegram] sendMessage failed: ${response.status}`);",
    "}",
    "",
  ].join("\n");
}

function directReply(body: string): string {
  const line = body.trim();
  if (!line || /[\n;{}]/.test(line)) return "text";
  return line;
}

function channelSource(item: Item, model: boolean): string {
  if (item.description === "telegram") return telegramChannel(item, model);
  if (item.description === "whatsapp") return whatsappChannel(item, model);
  const packed = packChannel(item);
  if (packed) return packed;
  const route = item.route && item.route.startsWith("/") ? item.route : `/${item.name}`;
  const handler = model
    ? `handler: async (_request, { send, waitUntil, body }) => {\n        waitUntil(send(body.text));\n        return new Response(null, { status: 202 });\n      },`
    : `handler: async (_request, { body }) => {\n        const text = body.text;\n        const reply = ${directReply(item.body)};\n        return new Response(JSON.stringify({ text: String(reply) }), { status: 200, headers: { "content-type": "application/json" } });\n      },`;
  return `import { defineChannel, POST } from "@grok/agent-sdk/channels";\nimport * as z from "zod/v4";\n\n// ${MARK}\n// Preset: ${item.description || "webhook"}. Signature secret: ${item.secret || "none"}. ${model ? "Calls the model." : "Answers in code."}\nexport default defineChannel({\n  routes: [\n    POST(${q(route)}, {\n      description: ${q(item.body || item.name)},\n      bodySchema: z.object({ text: z.string() }),\n      ${handler}\n    }),\n  ],\n});\n`;
}

function telegramChannel(item: Item, model: boolean): string {
  const route = item.route && item.route.startsWith("/") ? item.route : "/";
  const secret = /^[A-Z][A-Z0-9_]*$/.test(item.secret || "") ? item.secret : "TELEGRAM_WEBHOOK_SECRET";
  const check =
    item.verify === false
      ? ""
      : `        const got = request.headers.get("x-telegram-bot-api-secret-token");\n        if (got !== process.env.${secret}) return new Response(null, { status: 401 });\n`;
  return [
    'import { defineChannel, POST, publicEndpoint } from "@grok/agent-sdk/channels";',
    'import * as z from "zod/v4";',
    'import { replyTelegram } from "../lib/telegram.js";',
    "",
    `// ${MARK}`,
    "type TelegramUpdate = { message?: { text?: string; chat?: { id?: number } } };",
    "",
    "export default defineChannel<{ chatId: string }>({",
    "  auth: [publicEndpoint()],",
    '  state: { chatId: "" },',
    "  routes: [",
    `    POST(${q(route)}, {`,
    `      description: ${q(item.body || "A Telegram message")},`,
    "      bodySchema: z.unknown(),",
    `      handler: async (request, { ${model ? "send, waitUntil, body" : "waitUntil, body"} }) => {`,
    check.trimEnd(),
    "        const update = body as TelegramUpdate;",
    "        const text = update.message?.text?.trim();",
    "        const chatId = update.message?.chat?.id;",
    '        if (!text || typeof chatId !== "number") return new Response(null, { status: 200 });',
    model
      ? "        waitUntil(send(text, {"
      : `        const reply = ${directReply(item.body)};`,
    model ? "          continuationToken: `telegram:${chatId}`," : "        waitUntil(replyTelegram(String(chatId), String(reply).slice(0, 4000)));",
    ...(model
      ? ["          state: { chatId: String(chatId) },", "          title: `Telegram ${chatId}`,", "        }));"]
      : []),
    "        return new Response(null, { status: 200 });",
    "      },",
    "    }),",
    "  ],",
    "  events: {",
    '    async "turn.failed"(event) {',
    "      const detail = String(event.data.message || \"The turn failed before a reply.\").slice(0, 300);",
    "      console.error(`[telegram] turn failed: ${detail}`);",
    "    },",
    '    async "message.completed"(event, channel) {',
    '      if (event.data.finishReason === "tool_call" || !event.data.text) return;',
    "      await replyTelegram(channel.state.chatId, event.data.text);",
    "    },",
    "  },",
    "});",
    "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function whatsappLibrary(): string {
  return [
    `// ${MARK}`,
    "export async function replyWhatsApp(to: string, text: string): Promise<void> {",
    "  const token = process.env.WHATSAPP_TOKEN;",
    "  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;",
    "  if (!token || !phoneId || !to || !text) return;",
    "  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {",
    "    method: \"POST\",",
    "    headers: { authorization: `Bearer ${token}`, \"content-type\": \"application/json\" },",
    "    body: JSON.stringify({ messaging_product: \"whatsapp\", to, type: \"text\", text: { body: text.slice(0, 4000) } }),",
    "    signal: AbortSignal.timeout(8000),",
    "  });",
    "  if (!response.ok) console.error(`[whatsapp] send failed: ${response.status}`);",
    "}",
    "",
  ].join("\n");
}

function whatsappChannel(item: Item, model: boolean): string {
  const route = item.route && item.route.startsWith("/") ? item.route : "/";
  return [
    'import { createHmac, timingSafeEqual } from "node:crypto";',
    'import { defineChannel, GET, POST, publicEndpoint } from "@grok/agent-sdk/channels";',
    'import * as z from "zod/v4";',
    'import { replyWhatsApp } from "../lib/whatsapp.js";',
    "",
    `// ${MARK}`,
    "type WaMessage = { from?: string; type?: string; text?: { body?: string } };",
    "type WaBody = { entry?: Array<{ changes?: Array<{ value?: { messages?: WaMessage[] } }> }> };",
    "",
    "async function signed(request: Request): Promise<boolean> {",
    "  const secret = process.env.WHATSAPP_APP_SECRET;",
    "  if (!secret) return true;",
    "  const got = request.headers.get(\"x-hub-signature-256\") || \"\";",
    "  const raw = await request.clone().text();",
    "  const hex = createHmac(\"sha256\", secret).update(raw).digest(\"hex\");",
    "  const a = Buffer.from(got);",
    "  const b = Buffer.from(`sha256=${hex}`);",
    "  return a.length === b.length && timingSafeEqual(a, b);",
    "}",
    "",
    "export default defineChannel<{ from: string }>({",
    "  auth: [publicEndpoint()],",
    '  state: { from: "" },',
    "  routes: [",
    `    GET(${q(route)}, {`,
    "      querySchema: z.object({",
    '        "hub.mode": z.string().optional(),',
    '        "hub.verify_token": z.string().optional(),',
    '        "hub.challenge": z.string().optional(),',
    "      }),",
    "      handler: async (_request, { query }) => {",
    '        const mode = query["hub.mode"];',
    '        const token = query["hub.verify_token"];',
    '        const challenge = query["hub.challenge"];',
    "        if (mode === \"subscribe\" && token && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {",
    "          return new Response(challenge, { status: 200 });",
    "        }",
    "        return new Response(null, { status: 403 });",
    "      },",
    "    }),",
    `    POST(${q(route)}, {`,
    `      description: ${q(item.body || "A WhatsApp message")},`,
    "      bodySchema: z.unknown(),",
    `      handler: async (request, { ${model ? "send, waitUntil, body" : "waitUntil, body"} }) => {`,
    "        if (!(await signed(request))) return new Response(null, { status: 401 });",
    "        const payload = body as WaBody;",
    "        const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];",
    "        const text = message?.type === \"text\" ? message.text?.body?.trim() : \"\";",
    "        const from = message?.from;",
    "        if (!text || !from) return new Response(null, { status: 200 });",
    model ? "        waitUntil(send(text, {" : `        const reply = ${directReply(item.body)};`,
    model ? "          continuationToken: `whatsapp:${from}`," : "        waitUntil(replyWhatsApp(from, String(reply).slice(0, 4000)));",
    ...(model ? ["          state: { from },", "          title: `WhatsApp ${from}`,", "        }));"] : []),
    "        return new Response(null, { status: 200 });",
    "      },",
    "    }),",
    "  ],",
    "  events: {",
    '    async "turn.failed"(event) {',
    "      const detail = String(event.data.message || \"The turn failed before a reply.\").slice(0, 300);",
    "      console.error(`[whatsapp] turn failed: ${detail}`);",
    "    },",
    '    async "message.completed"(event, channel) {',
    '      if (event.data.finishReason === "tool_call" || !event.data.text) return;',
    "      await replyWhatsApp(channel.state.from, event.data.text);",
    "    },",
    "  },",
    "});",
    "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function ensurePackageJson(root: string, displayName: string): void {
  const file = path.join(root, "package.json");
  const current = readJson<Record<string, unknown>>(file, {});
  const dependencies = {
    ...(typeof current.dependencies === "object" && current.dependencies ? current.dependencies : {}),
    "@grok/agent-sdk": "^0.6.0",
    zod: "^4.6.5",
  };
  const devDependencies = {
    ...(typeof current.devDependencies === "object" && current.devDependencies ? current.devDependencies : {}),
    "@types/node": "^22.14.0",
    typescript: "6.0.3",
  };
  let name = typeof current.name === "string" ? current.name : "";
  const reserved = name === "v1" || name === "playground" || name === "docs";
  if (!/^[a-z0-9][a-z0-9_-]{0,40}$/.test(name) || reserved) {
    try {
      name = slug(displayName);
    } catch {
      name = "agent";
    }
  }
  if (name === "v1" || name === "playground" || name === "docs") name = `${name}-agent`;
  writeJson(file, { ...current, name, private: true, type: "module", dependencies, devDependencies });
  const tsconfig = path.join(root, "tsconfig.json");
  if (!fs.existsSync(tsconfig)) {
    fs.writeFileSync(
      tsconfig,
      `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["bot/**/*", "evals/**/*"]
}
`,
      "utf8",
    );
  }
}

export function emitSdk(root: string): void {
  if (!isProject(root)) return;
  const project = loadProject(root);
  ensurePackageJson(root, project.name);
  const keep = new Set<string>();
  const write = (rel: string, body: string) => {
    keep.add(rel);
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body, "utf8");
  };
  const model =
    project.model === "auto"
      ? ""
      : `  model: {\n    id: ${q(project.model)},\n    params: [\n      { id: "effort", value: ${q(project.effort)} },\n      { id: "fast", value: ${q(project.fast ? "true" : "false")} },\n    ],\n  },\n`;
  const harness = project.harness ? `  tools: ${JSON.stringify(project.harness)},\n` : "";
  const turns = project.maxRunningTurns ? `  concurrency: { maxRunningTurns: ${project.maxRunningTurns} },\n` : "";
  const reminders = project.reminders ? `  builtinTools: { reminders: true },\n` : "";
  const hosting =
    project.egress.length || project.secrets.length
      ? `  hosting: { secretNames: ${JSON.stringify(project.secrets.map((row) => row.name))}, egressDomains: ${JSON.stringify(project.egress)} },\n`
      : "";
  write(
    "bot/agent.ts",
    `import { defineAgent } from "@grok/agent-sdk";\n\n// ${MARK}\nexport default defineAgent({\n  name: ${q(project.name)},\n${model}${harness}${turns}${reminders}${hosting}});\n`,
  );
  write("bot/instructions.md", `<!-- ${MARK} -->\n${project.instructions.endsWith("\n") ? project.instructions : `${project.instructions}\n`}`);
  const wired = flowLinks(project, readLayout(root));
  let telegram = false;
  let whatsapp = false;
  for (const item of project.items) {
    if (item.kind === "tool") {
      const effect = item.effect === "irreversible" || item.effect === "idempotent" || item.effect === "write" ? item.effect === "irreversible" ? "write" : item.effect : "read";
      const approval = item.effect === "irreversible" ? `  needsApproval: true,\n` : "";
      const body = item.body.trim() ? item.body.replace(/\n$/, "") : "  return input;";
      write(
        `bot/tools/${item.name}.ts`,
        `import { defineTool } from "@grok/agent-sdk/tools";\nimport * as z from "zod/v4";\n\n// ${MARK}\nexport default defineTool({\n  description: ${q(item.description)},\n  execution: ${q(executionOf(item.execution))},\n  effect: ${q(effect)},\n${approval}  inputSchema: ${zodShape(item.parameters)},\n  async execute(input) {\n${body}\n  },\n});\n`,
      );
    }
    if (item.kind === "skill") {
      write(`bot/skills/${item.name}.md`, `---\ndescription: ${q(item.description)}\n---\n\n<!-- ${MARK} -->\n${item.body.endsWith("\n") ? item.body : `${item.body}\n`}`);
    }
    if (item.kind === "mcp") write(`bot/mcp-connections/${item.name}.ts`, connectionSource(item));
    if (item.kind === "host") write(`bot/host-connections/${item.name}.ts`, connectionSource(item));
    if (item.kind === "schedule") {
      write(`bot/schedules/${item.name}.md`, `---\ncron: ${q(item.route || "0 9 * * 1")}\n---\n\n<!-- ${MARK} -->\n${item.description || item.body}\n`);
    }
    if (item.kind === "subagent") {
      write(
        `bot/subagents/${item.name}/agent.ts`,
        `import { defineAgent } from "@grok/agent-sdk";\n\n// ${MARK}\nexport default defineAgent({\n  name: ${q(item.name)},\n  description: ${q(item.description)},\n});\n`,
      );
      write(`bot/subagents/${item.name}/instructions.md`, `<!-- ${MARK} -->\n${item.body.endsWith("\n") ? item.body : `${item.body}\n`}`);
    }
    if (item.kind === "hook") {
      const event = item.description || "turn.completed";
      const body = item.body.trim() ? item.body.replace(/\n$/, "") : "  return;";
      write(
        `bot/hooks/${item.name}.ts`,
        `import { defineHook } from "@grok/agent-sdk/hooks";\n\n// ${MARK}\nexport default defineHook({\n  events: {\n    async ${q(event)}() {\n${body}\n    },\n  },\n});\n`,
      );
    }
    if (item.kind === "channel") {
      if (item.description === "cron") {
        write(`bot/schedules/${item.name}.md`, `---\ncron: ${q(item.route || "")}\n---\n\n<!-- ${MARK} -->\n${item.body || ""}\n`);
        continue;
      }
      if (item.description === "telegram") telegram = true;
      if (item.description === "whatsapp") whatsapp = true;
      const model = project.think && reachesNode(wired, `${item.kind}:${item.name}`, "agent");
      write(`bot/channels/${item.name}.ts`, channelSource(item, model));
    }
  }
  if (telegram) write("bot/lib/telegram.ts", telegramLibrary());
  if (whatsapp) write("bot/lib/whatsapp.ts", whatsappLibrary());
  const roots = ["bot/tools", "bot/skills", "bot/mcp-connections", "bot/host-connections", "bot/schedules", "bot/hooks", "bot/channels", "bot/lib"];
  for (const rel of roots) {
    const dir = path.join(root, rel);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      if (!fs.statSync(file).isFile()) continue;
      const key = `${rel}/${name}`.replace(/\\/g, "/");
      if (keep.has(key)) continue;
      if (fs.readFileSync(file, "utf8").includes(MARK)) fs.rmSync(file, { force: true });
    }
  }
  const sub = path.join(root, "bot", "subagents");
  if (fs.existsSync(sub)) {
    for (const name of fs.readdirSync(sub)) {
      const agent = `bot/subagents/${name}/agent.ts`;
      const file = path.join(root, agent);
      if (!fs.existsSync(file) || keep.has(agent)) continue;
      if (fs.readFileSync(file, "utf8").includes(MARK)) {
        fs.rmSync(path.join(root, "bot", "subagents", name), { recursive: true, force: true });
      }
    }
  }
}

export type Look = "soft" | "clear" | "contrast";

export type Link = { from: string; to: string };

export type Layout = {
  positions: Record<string, { x: number; y: number }>;
  zoom: number;
  pan: { x: number; y: number };
  look: Look;
  links?: Link[];
};

function layoutFile(root: string): string {
  return path.join(root, ".bigagent", "layout.json");
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, number));
}

export function readLayout(root: string): Layout {
  const raw = readJson<Partial<Layout>>(layoutFile(root), {});
  const positions: Layout["positions"] = {};
  if (raw.positions && typeof raw.positions === "object") {
    for (const [id, point] of Object.entries(raw.positions)) {
      if (!point || typeof point !== "object") continue;
      const spot = point as { x?: unknown; y?: unknown };
      if (typeof spot.x !== "number" || typeof spot.y !== "number") continue;
      positions[id] = { x: clamp(spot.x, 0, -200, 4000), y: clamp(spot.y, 0, -200, 4000) };
    }
  }
  const links = Array.isArray(raw.links)
    ? raw.links.flatMap((link) => {
        if (!link || typeof link !== "object") return [];
        const from = String((link as Link).from || "");
        const to = String((link as Link).to || "");
        if (!from || !to || from === to) return [];
        return [{ from, to }];
      }).slice(0, 80)
    : undefined;
  return {
    positions,
    zoom: clamp(raw.zoom, 1, 0.4, 1.8),
    pan: { x: clamp(raw.pan?.x, 24, -2000, 2000), y: clamp(raw.pan?.y, 16, -2000, 2000) },
    look: raw.look === "soft" || raw.look === "contrast" ? raw.look : "clear",
    links,
  };
}

export function flowLinks(project: Project, layout: Layout): Link[] {
  if (layout.links) return layout.links.filter((link) => (link.to === "scope" || link.from === "scope" ? project.limits : true) && (link.to === "agent" || link.from === "agent" ? project.think : true));
  const links: Link[] = [];
  const door = project.limits ? "scope" : project.think ? "agent" : "";
  for (const item of project.items) {
    if ((item.kind === "channel" || item.kind === "schedule") && door) links.push({ from: `${item.kind}:${item.name}`, to: door });
  }
  if (project.limits && project.think) links.push({ from: "scope", to: "agent" });
  if (project.think) {
    for (const item of project.items) {
      if (item.kind === "tool" || item.kind === "skill" || item.kind === "mcp" || item.kind === "subagent" || item.kind === "hook") {
        links.push({ from: "agent", to: `${item.kind}:${item.name}` });
      }
    }
  }
  return links;
}

export function executionSteps(ids: string[], links: Link[]): Record<string, number> {
  const known = new Set(ids);
  const next = new Map<string, string[]>();
  const prev = new Map<string, string[]>();
  const live = new Set<string>();
  const seen = new Set<string>();
  for (const link of links) {
    if (!known.has(link.from) || !known.has(link.to) || link.from === link.to) continue;
    const key = `${link.from}\0${link.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    live.add(link.from);
    live.add(link.to);
    next.set(link.from, [...(next.get(link.from) ?? []), link.to]);
    prev.set(link.to, [...(prev.get(link.to) ?? []), link.from]);
  }
  const color = new Map<string, number>();
  const stack: string[] = [];
  const cyclic = new Set<string>();
  const walk = (id: string) => {
    color.set(id, 1);
    stack.push(id);
    for (const to of next.get(id) ?? []) {
      const state = color.get(to) ?? 0;
      if (state === 1) {
        const at = stack.indexOf(to);
        for (let index = at; index < stack.length; index += 1) cyclic.add(stack[index]);
      } else if (state === 0) walk(to);
    }
    stack.pop();
    color.set(id, 2);
  };
  for (const id of live) if (!color.has(id)) walk(id);
  const blocked = new Set(cyclic);
  const queue = [...cyclic];
  while (queue.length) {
    const id = queue.pop() as string;
    for (const to of next.get(id) ?? []) {
      if (blocked.has(to)) continue;
      blocked.add(to);
      queue.push(to);
    }
  }
  const rank = new Map<string, number>();
  const rankOf = (id: string): number => {
    const cached = rank.get(id);
    if (cached) return cached;
    const preds = (prev.get(id) ?? []).filter((item) => !blocked.has(item));
    const value = preds.length ? Math.max(...preds.map(rankOf)) + 1 : 1;
    rank.set(id, value);
    return value;
  };
  const steps: Record<string, number> = {};
  for (const id of live) if (!blocked.has(id)) steps[id] = rankOf(id);
  return steps;
}

export function toggleLink(project: Project, layout: Layout, from: string, to: string): Link[] {
  const current = flowLinks(project, layout);
  const same = (link: Link) => link.from === from && link.to === to;
  return current.some(same) ? current.filter((link) => !same(link)) : [...current, { from, to }];
}

export function linksExcept(links: Link[], id: string): Link[] {
  return links.filter((link) => link.from !== id && link.to !== id);
}

export function positionsDiffer(left: Layout["positions"], right: Layout["positions"]): boolean {
  const ids = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const id of ids) {
    if (left[id]?.x !== right[id]?.x || left[id]?.y !== right[id]?.y) return true;
  }
  return false;
}

export function nextCopyName(taken: Set<string>, source: string): string {
  const base = slug(source);
  for (let index = 2; index < 40; index += 1) {
    const candidate = slug(`${base}-${index}`);
    if (!taken.has(candidate)) return candidate;
  }
  return slug(`${base}-copy`);
}

export type FolderShot = {
  instructions: string;
  meta: string;
  files: { rel: string; body: string }[];
  positions: Layout["positions"];
  links: Link[] | null;
};

const SNAP_DIRS = ["tools", "skills", "mcp-connections", "channels", "schedules", "subagents", "hooks", "host-connections"];

export function captureFolder(root: string): FolderShot {
  const instructionsFile = path.join(root, "instructions.md");
  const layout = readLayout(root);
  const files: FolderShot["files"] = [];
  for (const dir of SNAP_DIRS) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) continue;
    for (const name of fs.readdirSync(abs)) {
      const file = path.join(abs, name);
      if (!fs.statSync(file).isFile()) continue;
      files.push({ rel: `${dir}/${name}`, body: fs.readFileSync(file, "utf8") });
    }
  }
  files.sort((left, right) => left.rel.localeCompare(right.rel));
  return {
    instructions: fs.existsSync(instructionsFile) ? fs.readFileSync(instructionsFile, "utf8") : "",
    meta: fs.existsSync(marker(root)) ? fs.readFileSync(marker(root), "utf8") : "{}",
    files,
    positions: Object.fromEntries(Object.entries(layout.positions).map(([id, point]) => [id, { x: point.x, y: point.y }])),
    links: layout.links ? layout.links.map((link) => ({ from: link.from, to: link.to })) : null,
  };
}

export function restoreFolder(root: string, shot: FolderShot): void {
  fs.writeFileSync(path.join(root, "instructions.md"), shot.instructions, "utf8");
  fs.mkdirSync(path.dirname(marker(root)), { recursive: true });
  fs.writeFileSync(marker(root), shot.meta, "utf8");
  const keep = new Set(shot.files.map((file) => file.rel));
  for (const dir of SNAP_DIRS) {
    const abs = path.join(root, dir);
    fs.mkdirSync(abs, { recursive: true });
    for (const name of fs.readdirSync(abs)) {
      const rel = `${dir}/${name}`;
      const file = path.join(abs, name);
      if (!fs.statSync(file).isFile()) continue;
      if (!keep.has(rel)) fs.rmSync(file, { force: true });
    }
  }
  for (const file of shot.files) {
    if (file.rel.split("/").some((part) => !part || part === "." || part === "..")) continue;
    const abs = path.join(root, file.rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, file.body, "utf8");
  }
  const view = readLayout(root);
  writeLayout(root, { positions: shot.positions, zoom: view.zoom, pan: view.pan, look: view.look, links: shot.links ?? [] });
  if (shot.links === null) {
    const raw = readJson<Record<string, unknown>>(layoutFile(root), {});
    delete raw.links;
    writeJson(layoutFile(root), raw);
  }
  emitSdk(root);
}

export function arrange(project: Project, saved: Layout): Layout {
  const positions = { ...saved.positions };
  const put = (id: string, x: number, y: number) => {
    if (!positions[id]) positions[id] = { x, y };
  };
  project.items.filter((item) => item.kind === "channel").forEach((item, index) => put(`channel:${item.name}`, 36, 36 + index * 124));
  project.items.filter((item) => item.kind === "schedule").forEach((item, index) => put(`schedule:${item.name}`, 36, 220 + index * 124));
  if (project.limits) put("scope", 300, 80);
  if (project.think) put("agent", 560, 68);
  project.items.filter((item) => item.kind === "tool").forEach((item, index) => put(`tool:${item.name}`, 840, 24 + index * 124));
  project.items.filter((item) => item.kind === "skill").forEach((item, index) => put(`skill:${item.name}`, 300, 300 + index * 124));
  project.items.filter((item) => item.kind === "subagent").forEach((item, index) => put(`subagent:${item.name}`, 560, 300 + index * 124));
  project.items.filter((item) => item.kind === "hook").forEach((item, index) => put(`hook:${item.name}`, 560, 480 + index * 124));
  project.items.filter((item) => item.kind === "mcp").forEach((item, index) => put(`mcp:${item.name}`, 1120, 24 + index * 124));
  project.items.filter((item) => item.kind === "host").forEach((item, index) => put(`host:${item.name}`, 1120, 300 + index * 124));
  return { ...saved, positions };
}

export function writeLayout(root: string, layout: Layout): void {
  const current = readLayout(root);
  const positions: Layout["positions"] = {};
  for (const [id, point] of Object.entries(layout.positions || {})) {
    if (!/^[a-z0-9:-]{1,80}$/i.test(id) || !point) continue;
    positions[id] = { x: clamp(point.x, 0, -200, 4000), y: clamp(point.y, 0, -200, 4000) };
  }
  const links = layout.links === undefined ? current.links : layout.links.slice(0, 80);
  writeJson(layoutFile(root), {
    positions,
    zoom: clamp(layout.zoom, current.zoom, 0.4, 1.8),
    pan: { x: clamp(layout.pan?.x, current.pan.x, -2000, 2000), y: clamp(layout.pan?.y, current.pan.y, -2000, 2000) },
    look: layout.look === "soft" || layout.look === "contrast" ? layout.look : "clear",
    ...(links ? { links } : {}),
  });
}

function composeFile(): string {
  return `services:
  agent:
    build: .
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      BIGAGENT_ADMIT_LOCAL: "1"
    env_file:
      - .env
    volumes:
      - agent-state:/var/lib/agent-sdk
volumes:
  agent-state:
`;
}

export type StudioFile = { id: string; title: string; detail: string; path: string; present: boolean };

export type EvalSuite = { file: string; cases: string[] };

export type Studio = { evals: EvalSuite[]; files: StudioFile[] };

export function scrubLogs(text: string, names: string[]): string {
  let out = text;
  for (const name of names) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) continue;
    out = out.replace(new RegExp(`${name}=\\S+`, "g"), `${name}=•••`);
  }
  return out.replace(/\d{6,}:[A-Za-z0-9_-]{20,}/g, "•••");
}

export function composeIsRunning(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const blobs: unknown[] = [];
  try {
    blobs.push(JSON.parse(trimmed));
  } catch {
    for (const line of trimmed.split(/\n+/)) {
      const piece = line.trim();
      if (!piece) continue;
      try {
        blobs.push(JSON.parse(piece));
      } catch {
        /* compose also prints plain status lines */
      }
    }
  }
  const rows = blobs.flatMap((blob) => (Array.isArray(blob) ? blob : [blob]));
  return rows.some((row) => {
    if (!row || typeof row !== "object") return false;
    const record = row as Record<string, unknown>;
    const state = String(record.State ?? record.state ?? record.Status ?? record.status ?? "").toLowerCase();
    return state === "running" || state.startsWith("up ");
  });
}

export function logLevel(line: string): "error" | "warn" | "info" {
  if (/\b(error|failed|failure|exception|panic)\b/i.test(line)) return "error";
  if (/\bwarn(?:ing)?\b/i.test(line)) return "warn";
  return "info";
}

export function logStamp(line: string): number | null {
  const match = line.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/);
  if (!match) return null;
  const time = Date.parse(match[0]);
  return Number.isNaN(time) ? null : time;
}

export function safeRelative(value: string): string | undefined {
  const rel = value.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!rel || rel.split("/").some((part) => !part || part === "." || part === "..")) return undefined;
  return rel;
}

function walkEvals(dir: string, rel: string, out: EvalSuite[]): void {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    const next = `${rel}${name}`;
    if (fs.statSync(file).isDirectory()) walkEvals(file, `${next}/`, out);
    else if (name.endsWith(".eval.ts")) {
      const text = fs.readFileSync(file, "utf8");
      const cases = [...text.matchAll(/id:\s*"([^"]+)"/g)].map((match) => match[1]);
      out.push({ file: next, cases });
    }
  }
}

const STUDIO: { id: string; title: string; detail: string; path: string }[] = [
  { id: "lib", title: "Shared code", detail: "Imports the agent can reuse. The SDK does not discover this folder.", path: "bot/lib/index.ts" },
  { id: "seed", title: "Session seed", detail: "Files copied into every session workspace before a turn.", path: "bot/sandbox/workspace/policy.md" },
  { id: "artifacts", title: "Artifacts", detail: "Durable records. With the tool on, the model can tag one.", path: "bot/artifacts.ts" },
  { id: "reminders", title: "Reminders", detail: "A named handler that wakes one conversation later.", path: "bot/reminders/recheck.ts" },
  { id: "extensions", title: "Extensions", detail: "A TypeScript mount. Its contributions are prefixed when it loads.", path: "bot/extensions" },
];

export function readStudio(root: string): Studio {
  const evals: EvalSuite[] = [];
  walkEvals(path.join(root, "evals"), "", evals);
  const files = STUDIO.map((piece) => ({ ...piece, present: fs.existsSync(path.join(root, piece.path)) }));
  return { evals, files };
}

function studioBody(id: string): string | undefined {
  if (id === "lib") {
    return `// Shared imports. Agent SDK does not discover bot/lib.\nexport function cite(document: string, passage: string): string {\n  return \`\${passage}\\n\\nSource: \${document}\`;\n}\n`;
  }
  if (id === "seed") return "Answer only from a retrieved passage. Cite the document. Do not invent a policy.\n";
  if (id === "artifacts") {
    return `import * as z from "zod/v4";\nimport { defineArtifacts } from "@grok/agent-sdk/artifacts";\n\nexport default defineArtifacts({\n  kinds: {\n    case: {\n      description: "A support case this agent opened or escalated.",\n      schema: z.object({ summary: z.string(), caseId: z.string().optional() }),\n    },\n  },\n  agentTool: true,\n});\n`;
  }
  if (id === "reminders") {
    return `import { defineReminder } from "@grok/agent-sdk/reminders";\n\nexport default defineReminder({\n  async run({ args, followup }) {\n    await followup({ message: \`Look again at case \${String(args.caseId)}. Act only if it is still waiting.\` });\n    return { action: "delivered" };\n  },\n});\n`;
  }
  return undefined;
}

export function ensureStudioFile(root: string, id: string): string | undefined {
  const piece = STUDIO.find((item) => item.id === id);
  if (!piece) return undefined;
  const rel = piece.path;
  if (id === "extensions") {
    fs.mkdirSync(path.join(root, rel), { recursive: true });
    return rel;
  }
  const body = studioBody(id);
  if (!body) return undefined;
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body, "utf8");
  }
  return rel;
}

export function writeEvalCase(root: string, name: string, prompt: string, check: string): string {
  const id = slug(name);
  const file = path.join(root, "evals", `${id}.eval.ts`);
  if (fs.existsSync(file)) throw new Error("That case already has a file.");
  const config = path.join(root, "evals", "evals.config.ts");
  if (!fs.existsSync(config)) {
    fs.mkdirSync(path.dirname(config), { recursive: true });
    fs.writeFileSync(
      config,
      `import { defineEvalConfig } from "@grok/agent-sdk/evals";\n\nexport default defineEvalConfig({\n  maxConcurrency: 3,\n});\n`,
      "utf8",
    );
  }
  const lookup = `        t.calledTool("lookup-passage");\n`;
  const extra = check === "no-escalate" ? `        t.notCalledTool("escalate");\n` : "";
  fs.writeFileSync(
    file,
    `import { defineEval } from "@grok/agent-sdk/evals";\n\nexport default defineEval({\n  cases: [\n    {\n      id: ${JSON.stringify(id)},\n      async test(t) {\n        await t.send(${JSON.stringify(prompt)});\n${lookup}${extra}        t.succeeded();\n      },\n    },\n  ],\n});\n`,
    "utf8",
  );
  return `evals/${id}.eval.ts`;
}

