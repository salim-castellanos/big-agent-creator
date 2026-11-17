import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { phrase, type Lang } from "./copy";

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
  const named = namedModel(meta.model);
  const model = named || (legacy === "fast" || legacy === "strong" ? "grok-4.5" : "auto");
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
export const PORT_CLOSED = "The container is running, but this machine is not listening on port 3000. Start publishes it again.";

export const PLATFORM_RULES = [
  "You help finish an agent on this canvas. Answer in the same language as the question.",
  "Name the card and what to set. Do not write files. When one change should be saved, end with a proposal fence: ```proposal {\"kind\":\"tool\",\"name\":\"lookup\",\"description\":\"Find\",\"calls\":\"mcp:knowledge\",\"effect\":\"read\"} ```",
  "Allowed kinds: tool, skill, channel, schedule, mcp, host, subagent, hook, scope, instructions. scope is {\"kind\":\"scope\",\"scope\":\"what to refuse\"}. instructions is {\"kind\":\"instructions\",\"body\":\"...\"}. Never put a secret value in the fence.",
  "Do not invent a secret value. Do not read or repeat a .env value.",
  "CURSOR_API_KEY calls the model when an arrow reaches Agent.",
  "AGENT_SDK_BEARER_TOKEN locks the agent address. Empty is fine on this machine. A tunnel or Cloud Run should set it.",
  "A trigger whose arrow does not reach Agent answers in code and does not call the model.",
  "Cloud Run is the first cloud and it does not deploy yet.",
].join(" ");

export type Proposal =
  | { kind: "scope"; scope: string }
  | { kind: "instructions"; body: string }
  | { kind: Kind; name: string; description: string; body: string; calls: string; route: string; repo: string; effect: Effect; url: string; secret: string };

const PROPOSAL_FENCE = /```proposal\s*([\s\S]*?)```/i;

export function readProposal(text: string): Proposal | null {
  const match = text.match(PROPOSAL_FENCE);
  if (!match) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(match[1]);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if ("value" in row || "secretValue" in row || "token" in row || "password" in row) return null;
  if (row.kind === "scope") {
    const scope = String(row.scope || "").trim();
    return scope ? { kind: "scope", scope: scope.slice(0, 2000) } : null;
  }
  if (row.kind === "instructions") {
    const body = String(row.body || "").trim();
    return body ? { kind: "instructions", body: body.slice(0, 8000) } : null;
  }
  if (!LIBRARY_KINDS.includes(row.kind as Kind)) return null;
  const name = String(row.name || "").trim();
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(name)) return null;
  const secret = String(row.secret || "");
  if (secret && !/^[A-Z][A-Z0-9_]*$/.test(secret)) return null;
  return {
    kind: row.kind as Kind,
    name,
    description: String(row.description || "").slice(0, 400),
    body: String(row.body || "").slice(0, 4000),
    calls: String(row.calls || "").slice(0, 200),
    route: String(row.route || "").slice(0, 120),
    repo: String(row.repo || "").slice(0, 80),
    effect: effectOf(row.effect),
    url: String(row.url || "").slice(0, 300),
    secret,
  };
}

export function replyWithoutProposal(text: string): string {
  return text.replace(PROPOSAL_FENCE, "").trim();
}

export function proposalLabel(proposal: Proposal): string {
  if (proposal.kind === "scope") return "Update limits.";
  if (proposal.kind === "instructions") return "Update the agent instructions.";
  return `Save ${proposal.kind} ${proposal.name}.`;
}

export function applyProposal(root: string, proposal: Proposal): void {
  if (proposal.kind === "scope") {
    saveScope(root, proposal.scope);
    return;
  }
  if (proposal.kind === "instructions") {
    const body = proposal.body.endsWith("\n") ? proposal.body : `${proposal.body}\n`;
    saveInstructions(root, body);
    return;
  }
  saveItem(root, {
    kind: proposal.kind,
    name: proposal.name,
    description: proposal.description,
    body: proposal.body,
    calls: proposal.calls,
    route: proposal.route,
    repo: proposal.repo,
    effect: proposal.effect,
    url: proposal.url,
    secret: proposal.secret,
  });
}

export function languageChoice(saved: string | undefined, computer: string | undefined): Lang {
  if (saved === "en" || saved === "es") return saved;
  return (computer || "").toLowerCase().startsWith("es") ? "es" : "en";
}

let computerLocaleCache: string | undefined;

export function computerLocale(): string {
  if (computerLocaleCache !== undefined) return computerLocaleCache;
  computerLocaleCache = readComputerLocale();
  return computerLocaleCache;
}

function readComputerLocale(): string {
  try {
    if (process.platform === "win32") {
      const out = execFileSync("reg", ["query", "HKCU\\Control Panel\\International", "/v", "LocaleName"], { encoding: "utf8", windowsHide: true, timeout: 3000 });
      const match = out.match(/LocaleName\s+REG_SZ\s+(\S+)/);
      if (match) return match[1];
    }
  } catch {
    // The editor language is the fallback when the machine locale cannot be read.
  }
  return Intl.DateTimeFormat().resolvedOptions().locale || "en";
}

export function chatHandoff(project: Project, lang: Lang = "en"): string {
  const cards = [project.think ? `agent:${project.name}` : "", project.limits ? "limits" : "", ...project.items.map((item) => `${item.kind}:${item.name}`)].filter(Boolean);
  const missing = cardNeeds(project).flatMap((row) => row.missing).map((line) => phrase(lang, line));
  if (lang === "es") {
    return [
      "Ayudas a terminar este agente en la carpeta abierta. El lienzo se actualiza cuando cambian los archivos.",
      "Cuando la persona pida un cambio, edita los archivos del agente. No inventes un valor de secreto. No leas ni repitas un valor de .env.",
      "CURSOR_API_KEY llama al modelo cuando una flecha llega al Agente. AGENT_SDK_BEARER_TOKEN puede quedar vacío en esta máquina.",
      `Tarjetas: ${cards.join(", ")}`,
      missing.length ? `Falta:\n${missing.join("\n")}` : "Las tarjetas tienen la configuración mínima.",
      "La persona escribirá la pregunta después de esto.",
    ].join("\n\n");
  }
  return [
    "You help finish this agent in the open folder. The canvas reloads when files change.",
    "When the person asks for a change, edit the agent files. Do not invent a secret value. Do not read or repeat a .env value.",
    "CURSOR_API_KEY calls the model when an arrow reaches Agent. AGENT_SDK_BEARER_TOKEN can stay empty on this machine.",
    `Cards: ${cards.join(", ")}`,
    missing.length ? `Missing:\n${missing.join("\n")}` : "The cards have the minimum configuration.",
    "The person will type the question after this.",
  ].join("\n\n");
}

export function assistantContext(project: Project, question: string): string {
  const cards = [project.think ? `agent:${project.name}` : "", project.limits ? "limits" : "", ...project.items.map((item) => `${item.kind}:${item.name}`)].filter(Boolean);
  const missing = cardNeeds(project).flatMap((row) => row.missing);
  return [
    PLATFORM_RULES,
    `Cards: ${cards.join(", ")}`,
    missing.length ? `Missing:\n${missing.join("\n")}` : "The cards have the minimum configuration.",
    `Question: ${question.trim().slice(0, 2000)}`,
  ].join("\n\n");
}

export function lmGate(input: { hasApi: boolean; modelCount: number }): { ok: boolean; reason: string } {
  if (!input.hasApi) return { ok: false, reason: "This editor has no language model for extensions." };
  if (input.modelCount < 1) return { ok: false, reason: "No language model is available. Sign in to one in the editor." };
  return { ok: true, reason: "Write a question. Sending uses the model you picked." };
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
  const mcpNames = new Set(project.items.filter((item) => item.kind === "mcp" || item.kind === "host").map((item) => item.name));
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
      const target = mcpTarget(item.calls);
      if (target && !mcpNames.has(target.server)) out.push({ id, message: `No MCP named ${target.server} is on this canvas.` });
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

function mcpTarget(calls: string): { server: string; tool: string } | null {
  if (!calls.startsWith("mcp:")) return null;
  const rest = calls.slice(4).trim();
  const cut = rest.search(/[:/]/);
  if (cut === -1) return rest ? { server: rest, tool: "" } : null;
  const server = rest.slice(0, cut).trim();
  const tool = rest.slice(cut + 1).trim();
  return server ? { server, tool } : null;
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

/** Models the canvas may write. Auto is the absence of an id; the SDK then uses grok-4.7 with high effort. */
export const NAMED_MODELS = ["grok-4.7", "grok-4.5", "composer-2.5"] as const;

export function namedModel(value: unknown): string {
  return typeof value === "string" && (NAMED_MODELS as readonly string[]).includes(value) ? value : "";
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
  const model = namedModel(settings.model) || "auto";
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

export function webhookNeedsLocal(hook: string): boolean {
  try {
    return !new URL(hook).hostname.endsWith(".run.app");
  } catch {
    return true;
  }
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

export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    out[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return out;
}

export function envState(env: Record<string, string>, names: string[]): { name: string; present: boolean }[] {
  return names.map((name) => ({ name, present: Boolean(env[name]?.trim()) }));
}

function readEnv(root: string): Record<string, string> {
  const file = path.join(root, ".env");
  if (!fs.existsSync(file)) return {};
  return parseEnv(fs.readFileSync(file, "utf8"));
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
    id: "clock-desk",
    title: "Clock desk",
    summary: "The Telegram desk, plus one public clock. Ask the time in a city. The answer comes from time.now.",
    level: "MCP",
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

export function imageName(projectName: string): string {
  const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return `bigagent-${slug || "agent"}`;
}

export function parseImageId(text: string): string | null {
  const match = text.match(/sha256:[a-f0-9]{64}/);
  return match ? match[0] : null;
}

export function composeImageId(text: string): string | null {
  try {
    const body = JSON.parse(text) as unknown;
    const rows = Array.isArray(body) ? body : [body];
    const found = rows.flatMap((row) => {
      if (!row || typeof row !== "object" || !("ID" in row) || typeof row.ID !== "string") return [];
      const id = parseImageId(row.ID);
      if (!id) return [];
      const repo = "Repository" in row && typeof row.Repository === "string" ? row.Repository : "";
      const name = "ContainerName" in row && typeof row.ContainerName === "string" ? row.ContainerName : "";
      return [{ id, repo, name }];
    });
    const agent = found.find((row) => row.repo !== "sha256" && /-agent-\d+$/.test(row.name));
    if (agent) return agent.id;
    const named = found.find((row) => row.repo !== "sha256" && row.repo !== "");
    return named?.id ?? found[0]?.id ?? null;
  } catch {
    return parseImageId(text);
  }
}

export function readImagePin(root: string): string | null {
  const file = path.join(root, ".bigagent", "image.json");
  if (!fs.existsSync(file)) return null;
  try {
    const body = JSON.parse(fs.readFileSync(file, "utf8")) as { id?: unknown };
    return typeof body.id === "string" ? parseImageId(body.id) : null;
  } catch {
    return null;
  }
}

export function writeImagePin(root: string, id: string): void {
  const pin = parseImageId(id);
  if (!pin || pin !== id.trim()) throw new Error("The image id has to be a sha256 digest.");
  fs.mkdirSync(path.join(root, ".bigagent"), { recursive: true });
  fs.writeFileSync(path.join(root, ".bigagent", "image.json"), `${JSON.stringify({ id: pin })}\n`, "utf8");
}

export type GcpExposure = "internet" | "internal";

export type GcpEnv = { name: string; value: string };

export type GcpLink = {
  project: string;
  region: string;
  exposure: GcpExposure;
  minInstances: number;
  maxInstances: number;
  concurrency: number;
  cpu: string;
  memory: string;
  cpuAlways: boolean;
  timeout: number;
  env: GcpEnv[];
  url?: string;
  saved?: boolean;
};

export const GCP_CPUS = ["1", "2", "4"];
export const GCP_MEMORY = ["512Mi", "1Gi", "2Gi", "4Gi", "8Gi"];

export type CloudRunPlan = {
  service: string;
  project: string;
  region: string;
  image: string;
  ingress: "all" | "internal";
  allowUnauthenticated: boolean;
  minInstances: number;
  maxInstances: number;
  concurrency: number;
  cpu: string;
  memory: string;
  cpuAlways: boolean;
  timeout: number;
  secrets: string[];
  env: GcpEnv[];
  warning: string;
};

const PUBLIC_CHANNELS = new Set(["telegram", "whatsapp", "slack", "github", "gitlab", "bitbucket", "webhook"]);

export function hasPublicChannel(project: Project): boolean {
  return project.items.some((item) => item.kind === "channel" && PUBLIC_CHANNELS.has(item.description || ""));
}

export function defaultGcpLink(): GcpLink {
  return {
    project: "",
    region: "us-central1",
    exposure: "internet",
    minInstances: 0,
    maxInstances: 4,
    concurrency: 4,
    cpu: "1",
    memory: "1Gi",
    cpuAlways: true,
    timeout: 300,
    env: [],
    url: "",
    saved: false,
  };
}

function wholeNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isInteger(number) ? number : null;
}

export function readGcpLink(root: string): GcpLink {
  const file = path.join(root, ".bigagent", "gcp.json");
  const fallback = defaultGcpLink();
  if (!fs.existsSync(file)) return fallback;
  try {
    const body = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<GcpLink>;
    const minInstances = wholeNumber(body.minInstances);
    const maxInstances = wholeNumber(body.maxInstances);
    const concurrency = wholeNumber(body.concurrency);
    const timeout = wholeNumber(body.timeout);
    const env = Array.isArray(body.env)
      ? body.env.flatMap((row) => {
          if (!row || typeof row !== "object") return [];
          const name = "name" in row && typeof row.name === "string" ? row.name.trim() : "";
          const value = "value" in row && typeof row.value === "string" ? row.value : "";
          return name ? [{ name, value }] : [];
        }).slice(0, 20)
      : [];
    return {
      project: typeof body.project === "string" ? body.project.trim() : "",
      region: typeof body.region === "string" && body.region.trim() ? body.region.trim() : "us-central1",
      exposure: body.exposure === "internal" ? "internal" : "internet",
      minInstances: minInstances !== null && minInstances >= 0 && minInstances <= 20 ? minInstances : fallback.minInstances,
      maxInstances: maxInstances !== null && maxInstances >= 1 && maxInstances <= 100 ? maxInstances : fallback.maxInstances,
      concurrency: concurrency !== null && concurrency >= 1 && concurrency <= 80 ? concurrency : fallback.concurrency,
      cpu: typeof body.cpu === "string" && GCP_CPUS.includes(body.cpu) ? body.cpu : fallback.cpu,
      memory: typeof body.memory === "string" && GCP_MEMORY.includes(body.memory) ? body.memory : fallback.memory,
      cpuAlways: body.cpuAlways !== false,
      timeout: timeout !== null && timeout >= 15 && timeout <= 3600 ? timeout : fallback.timeout,
      env,
      url: typeof body.url === "string" && /^https:\/\/[a-z0-9.-]+\.run\.app$/i.test(body.url.trim()) ? body.url.trim() : "",
      saved: true,
    };
  } catch {
    return fallback;
  }
}

export function writeGcpLink(root: string, link: GcpLink): void {
  fs.mkdirSync(path.join(root, ".bigagent"), { recursive: true });
  const previous = fs.existsSync(path.join(root, ".bigagent", "gcp.json")) ? readGcpLink(root) : defaultGcpLink();
  const url = link.url || previous.url || "";
  const saved = {
    project: link.project.trim(),
    region: link.region.trim() || "us-central1",
    exposure: link.exposure === "internal" ? "internal" : "internet",
    minInstances: link.minInstances,
    maxInstances: link.maxInstances,
    concurrency: link.concurrency,
    cpu: link.cpu,
    memory: link.memory,
    cpuAlways: link.cpuAlways !== false,
    timeout: link.timeout,
    env: link.env.map((row) => ({ name: row.name, value: row.value })),
    url,
  };
  fs.writeFileSync(path.join(root, ".bigagent", "gcp.json"), `${JSON.stringify(saved)}\n`, "utf8");
}

export function parseGcpLink(raw: {
  project?: unknown;
  region?: unknown;
  exposure?: unknown;
  minInstances?: unknown;
  maxInstances?: unknown;
  concurrency?: unknown;
  cpu?: unknown;
  memory?: unknown;
  cpuAlways?: unknown;
  timeout?: unknown;
  env?: unknown;
}): { link: GcpLink } | { error: string } {
  const minInstances = wholeNumber(raw.minInstances);
  const maxInstances = wholeNumber(raw.maxInstances);
  const concurrency = wholeNumber(raw.concurrency);
  const timeout = wholeNumber(raw.timeout);
  const cpu = typeof raw.cpu === "string" ? raw.cpu : "";
  const memory = typeof raw.memory === "string" ? raw.memory : "";
  if (minInstances === null || minInstances < 0 || minInstances > 20) return { error: "Min instances must be a whole number from 0 to 20." };
  if (maxInstances === null || maxInstances < 1 || maxInstances > 100) return { error: "Max instances must be a whole number from 1 to 100." };
  if (minInstances > maxInstances) return { error: "Min instances cannot be higher than max instances." };
  if (concurrency === null || concurrency < 1 || concurrency > 80) return { error: "Concurrency must be a whole number from 1 to 80." };
  if (!GCP_CPUS.includes(cpu)) return { error: "Pick a CPU size of 1, 2, or 4." };
  if (!GCP_MEMORY.includes(memory)) return { error: "Pick a memory size the form offers." };
  if (timeout === null || timeout < 15 || timeout > 3600) return { error: "Timeout must be a whole number of seconds from 15 to 3600." };
  if (!Array.isArray(raw.env)) return { error: "Plain environment variables are missing." };
  if (raw.env.length > 20) return { error: "Keep plain environment variables to 20." };
  const env: GcpEnv[] = [];
  for (const row of raw.env) {
    if (!row || typeof row !== "object") return { error: "An environment name must look like PLAIN_NAME." };
    const name = "name" in row && typeof row.name === "string" ? row.name.trim() : "";
    const value = "value" in row && typeof row.value === "string" ? row.value : "";
    if (!name && !value) continue;
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) return { error: "An environment name must look like PLAIN_NAME." };
    if (name === "BIGAGENT_ADMIT_LOCAL") return { error: "BIGAGENT_ADMIT_LOCAL is only for the local machine." };
    if (/[,\n\r]/.test(value)) return { error: "An environment value cannot contain a comma or a line break." };
    env.push({ name, value });
  }
  return {
    link: {
      project: typeof raw.project === "string" ? raw.project.trim() : "",
      region: typeof raw.region === "string" ? raw.region.trim() : "",
      exposure: raw.exposure === "internal" ? "internal" : "internet",
      minInstances,
      maxInstances,
      concurrency,
      cpu,
      memory,
      cpuAlways: raw.cpuAlways !== false && raw.cpuAlways !== "false",
      timeout,
      env,
      saved: true,
    },
  };
}

export type SecretSyncReady = { name: string; value: string; source: "environment" | "local" };

export function secretSyncPlan(
  names: string[],
  overrides: { name: string; value: string }[],
  local: Record<string, string>,
): { ready: SecretSyncReady[]; missing: string[] } {
  const typed = new Map<string, string>();
  for (const row of overrides) {
    if (row && typeof row.name === "string") typed.set(row.name, typeof row.value === "string" ? row.value : "");
  }
  const ready: SecretSyncReady[] = [];
  const missing: string[] = [];
  for (const name of names) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) continue;
    const override = (typed.get(name) ?? "").trim();
    if (override) {
      ready.push({ name, value: override, source: "environment" });
      continue;
    }
    const stored = (local[name] ?? "").trim();
    if (stored) {
      ready.push({ name, value: stored, source: "local" });
      continue;
    }
    missing.push(name);
  }
  return { ready, missing };
}

export type GcpCheck = { ok: boolean; text: string };

export function gcpChecks(input: {
  imageId: string | null;
  project: string;
  region: string;
  secrets: { name: string; configured: boolean }[];
}): GcpCheck[] {
  const imageId = input.imageId ? parseImageId(input.imageId) : null;
  const short = imageId ? `sha256:${imageId.slice("sha256:".length, "sha256:".length + 12)}` : "";
  const project = input.project.trim();
  const region = input.region.trim();
  const projectOk = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project);
  const regionOk = /^[a-z]+-[a-z0-9]+\d$/.test(region);
  const empty = input.secrets.filter((row) => !row.configured).map((row) => row.name);
  return [
    imageId
      ? { ok: true, text: `Image ${short} is the one Deploy will publish.` }
      : { ok: false, text: "No local image yet. Build it here, then deploy." },
    projectOk
      ? { ok: true, text: `GCP project ${project} is set.` }
      : { ok: false, text: "The GCP project id is missing or not a project id." },
    regionOk
      ? { ok: true, text: `Region ${region} is set.` }
      : { ok: false, text: "The region should look like us-central1." },
    empty.length
      ? { ok: false, text: `${empty.join(", ")} has no local value. Sync skips it.` }
      : { ok: true, text: "Every secret name has a local value." },
  ];
}

export type GcpPreview = {
  state: "need-image" | "ready" | "published";
  service: string;
  image: string;
  target: string;
  url: string;
  summary: string;
};

export function gcpPreview(input: {
  agentName: string;
  imageId: string | null;
  project: string;
  region: string;
  url?: string;
}): GcpPreview {
  const service = imageName(input.agentName);
  const imageId = input.imageId ? parseImageId(input.imageId) : null;
  const image = imageId ? `sha256:${imageId.slice("sha256:".length, "sha256:".length + 12)}` : "";
  const project = input.project.trim();
  const region = input.region.trim();
  const tag = imageId ? imageId.slice("sha256:".length, "sha256:".length + 12) : "";
  const projectOk = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project);
  const target = imageId && projectOk && region ? `${region}-docker.pkg.dev/${project}/bigagent/${service}:${tag}` : "";
  const url = input.url && /^https:\/\/[a-z0-9.-]+\.run\.app$/i.test(input.url) ? input.url : "";
  if (!imageId) {
    return { state: "need-image", service, image: "", target: "", url: "", summary: "Build the image on Local first. Deploy publishes that id." };
  }
  if (url) return { state: "published", service, image, target, url, summary: `Cloud Run is ready at ${url}.` };
  if (!projectOk) return { state: "ready", service, image, target: "", url: "", summary: "The local image is ready. Set the GCP project, then deploy." };
  return { state: "ready", service, image, target, url: "", summary: "Deploy publishes this local image. It does not build another one." };
}

export function shortImage(imageId: string): string {
  const id = parseImageId(imageId);
  if (!id) return "";
  return `sha256:${id.slice("sha256:".length, "sha256:".length + 12)}`;
}

export function cloudRunImageMatch(localId: string, remoteImage: string, knownDigest = ""): "same" | "other" | "unknown" {
  const local = parseImageId(localId);
  const remote = remoteImage.trim().toLowerCase();
  if (!local || !remote) return "unknown";
  if (remote.includes(local)) return "same";
  const short = local.slice("sha256:".length, "sha256:".length + 12);
  const tagged = remote.match(/:([a-f0-9]{12})(?:@|$)/);
  if (tagged) return tagged[1] === short ? "same" : "other";
  const remoteDigest = remote.match(/sha256:[a-f0-9]{64}/)?.[0] || "";
  const pinned = knownDigest.trim().toLowerCase().match(/sha256:[a-f0-9]{64}/)?.[0] || "";
  if (remoteDigest && pinned) return remoteDigest === pinned ? "same" : "other";
  return "unknown";
}

export type DescribeFailure = "missing" | "auth" | "denied" | "failed";

/** What a failed `gcloud run services describe` means for the person at the screen. */
export function cloudRunDescribeFailure(text: string): DescribeFailure {
  if (/Cannot find service|NOT_FOUND|\bnot found\b/i.test(text)) return "missing";
  if (/UNAUTHENTICATED|Reauthentication failed|do not currently have an active account|Please log in|gcloud auth login/i.test(text)) return "auth";
  if (/PERMISSION_DENIED|does not have permission|\bforbidden\b/i.test(text)) return "denied";
  return "failed";
}

export function serviceMissing(text: string): boolean {
  return cloudRunDescribeFailure(text) === "missing";
}

export function parseTrafficRevision(raw: string): { url: string; revision: string } | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      status?: { url?: unknown; traffic?: { revisionName?: unknown; percent?: unknown }[] };
      url?: unknown;
      traffic?: { revisionName?: unknown; percent?: unknown }[];
    };
    const status = parsed.status && typeof parsed.status === "object" ? parsed.status : parsed;
    const traffic = Array.isArray(status.traffic) ? status.traffic : [];
    const ranked = [...traffic].sort((left, right) => {
      const rightPercent = typeof right.percent === "number" ? right.percent : 0;
      const leftPercent = typeof left.percent === "number" ? left.percent : 0;
      return rightPercent - leftPercent;
    });
    const revision = ranked.map((row) => (typeof row.revisionName === "string" ? row.revisionName : "")).find(Boolean) || "";
    const url = typeof status.url === "string" ? status.url : "";
    if (!revision && !url) return null;
    return { url, revision };
  } catch {
    return null;
  }
}

export type ServiceRelease = { url: string; revision: string; ready: string; created: string; image: string };

export function parseServiceRelease(raw: string): ServiceRelease | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      spec?: { template?: { spec?: { containers?: { image?: unknown }[] } } };
      status?: { url?: unknown; latestReadyRevisionName?: unknown; latestCreatedRevisionName?: unknown; traffic?: { revisionName?: unknown; percent?: unknown }[] };
    };
    const status = parsed.status && typeof parsed.status === "object" ? parsed.status : {};
    const traffic = Array.isArray(status.traffic) ? status.traffic : [];
    const ranked = [...traffic].sort((left, right) => {
      const rightPercent = typeof right.percent === "number" ? right.percent : 0;
      const leftPercent = typeof left.percent === "number" ? left.percent : 0;
      return rightPercent - leftPercent;
    });
    const revision = ranked.map((row) => (typeof row.revisionName === "string" ? row.revisionName : "")).find(Boolean) || "";
    const containers = parsed.spec?.template?.spec?.containers;
    const image = Array.isArray(containers) && typeof containers[0]?.image === "string" ? containers[0].image : "";
    const url = typeof status.url === "string" ? status.url : "";
    const ready = typeof status.latestReadyRevisionName === "string" ? status.latestReadyRevisionName : "";
    const created = typeof status.latestCreatedRevisionName === "string" ? status.latestCreatedRevisionName : "";
    if (!revision && !url && !image) return null;
    return { url, revision, ready, created, image };
  } catch {
    return null;
  }
}

export function releasedImage(release: ServiceRelease): string {
  if (!release.revision || !release.image) return "";
  if (release.created && release.revision !== release.created) return "";
  if (release.ready && release.revision !== release.ready) return "";
  return release.image;
}

export function cloudRunPlan(input: {
  agentName: string;
  project: string;
  region: string;
  imageId: string;
  exposure: GcpExposure;
  hasPublicChannel: boolean;
  secretNames: string[];
  minInstances?: number;
  maxInstances?: number;
  concurrency?: number;
  cpu?: string;
  memory?: string;
  cpuAlways?: boolean;
  timeout?: number;
  env?: GcpEnv[];
}): { plan: CloudRunPlan } | { error: string } {
  const project = input.project.trim();
  const region = input.region.trim();
  const imageId = parseImageId(input.imageId);
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project)) return { error: "The GCP project id is missing or not a project id." };
  if (!/^[a-z]+-[a-z0-9]+\d$/.test(region)) return { error: "The region should look like us-central1." };
  if (!imageId) return { error: "Build the image on Local first. Deploy publishes that id." };
  const internet = input.exposure !== "internal";
  const parsed = parseGcpLink({
    project,
    region,
    exposure: input.exposure,
    minInstances: input.minInstances ?? (internet && input.hasPublicChannel ? 1 : 0),
    maxInstances: input.maxInstances ?? 4,
    concurrency: input.concurrency ?? 4,
    cpu: input.cpu ?? "1",
    memory: input.memory ?? "1Gi",
    cpuAlways: input.cpuAlways !== false,
    timeout: input.timeout ?? 300,
    env: input.env ?? [],
  });
  if ("error" in parsed) return parsed;
  const service = imageName(input.agentName);
  const tag = imageId.slice("sha256:".length, "sha256:".length + 12);
  const secrets = [...new Set(input.secretNames.filter((name) => /^[A-Z][A-Z0-9_]*$/.test(name)))];
  const clash = parsed.link.env.find((row) => secrets.includes(row.name));
  if (clash) return { error: `${clash.name} is a secret. Create it in Secret Manager. Do not put the value here.` };
  const cold = internet && input.hasPublicChannel && parsed.link.minInstances === 0
    ? "A public chat can miss the first webhook while Cloud Run starts. Set min instances to 1 to stay awake."
    : "";
  const closed = !internet && input.hasPublicChannel
    ? "A chat channel needs the public internet. Internal only accepts calls from this GCP project."
    : "";
  return {
    plan: {
      service,
      project,
      region,
      image: `${region}-docker.pkg.dev/${project}/bigagent/${service}:${tag}`,
      ingress: internet ? "all" : "internal",
      allowUnauthenticated: internet,
      minInstances: parsed.link.minInstances,
      maxInstances: parsed.link.maxInstances,
      concurrency: parsed.link.concurrency,
      cpu: parsed.link.cpu,
      memory: parsed.link.memory,
      cpuAlways: parsed.link.cpuAlways,
      timeout: parsed.link.timeout,
      secrets,
      env: parsed.link.env,
      warning: closed || cold,
    },
  };
}

export function pickGcloud(whereOutput: string): string {
  return whereOutput.split(/\r?\n/).map((line) => line.trim()).find((line) => path.isAbsolute(line) && /gcloud\.cmd$/i.test(line)) || "";
}

export function windowsShell(command: string, args: string[], logFile: string): string {
  const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return `"${[quote(command), ...args.map(quote)].join(" ")} > ${quote(logFile)} 2>&1"`;
}

export function readCommandLog(bytes: Buffer): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return bytes.toString("utf16le").replace(/^\uFEFF/, "");
  if (bytes.length >= 4 && bytes[1] === 0 && bytes[3] === 0) return bytes.toString("utf16le");
  return bytes.toString("utf8");
}

export function commandFailure(text: string): string {
  const lines = text.replace(/\r/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean);
  const useful = lines.filter((line) => !line.startsWith("$ ") && !/^[0-9a-f]{12}: /.test(line) && !/^exit \d+$/.test(line) && !/^The push refers/.test(line) && !/^The command printed nothing/.test(line));
  const error = [...useful].reverse().find((line) => /error|denied|not found|invalid|permission|failed|forbidden|python|gcloud\.py/i.test(line));
  return (error || useful.at(-1) || "").slice(0, 500);
}

export type LogEntry = {
  timestamp?: string;
  textPayload?: string;
  httpRequest?: { status?: number; requestUrl?: string; latency?: string };
};

export function parseLogEntries(raw: string): LogEntry[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const entry = row as LogEntry;
      return [{
        timestamp: typeof entry.timestamp === "string" ? entry.timestamp : "",
        textPayload: typeof entry.textPayload === "string" ? entry.textPayload : "",
        httpRequest: entry.httpRequest && typeof entry.httpRequest === "object"
          ? {
              status: typeof entry.httpRequest.status === "number" ? entry.httpRequest.status : undefined,
              requestUrl: typeof entry.httpRequest.requestUrl === "string" ? entry.httpRequest.requestUrl : "",
              latency: typeof entry.httpRequest.latency === "string" ? entry.httpRequest.latency : "",
            }
          : undefined,
      }];
    });
  } catch {
    return [];
  }
}

function latencyMs(value?: string): number {
  const match = String(value || "").match(/([\d.]+)\s*(ms|s)?/i);
  if (!match) return 0;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return 0;
  return /ms/i.test(match[2] || "") ? amount : amount * 1000;
}

function stamp(value?: string): number {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

export type MonitorFacts = {
  calls: number;
  accepted: number;
  rejected: number;
  interrupted: number;
  prepMs: number;
  acceptMedianMs: number;
  acceptP95Ms: number;
  acceptSlowMs: number;
  replyMedianMs: number;
  replySlowMs: number;
  modelMedianMs: number;
  waitingMs: number;
};

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

function percentile(values: number[], ratio: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(ratio * sorted.length) - 1));
  return sorted[index];
}

function prepIn(text: string): number[] {
  return (text.match(/(?:durationMs|totalMs):\s*(\d+)/g) || []).map((item) => Number(item.replace(/\D/g, ""))).filter((value) => value > 0);
}

export function monitorFacts(entries: LogEntry[], now = Date.now()): MonitorFacts {
  const hooks = entries.filter((entry) => /\/v1\/channels\//.test(entry.httpRequest?.requestUrl || ""));
  const accepted = hooks.filter((entry) => (entry.httpRequest?.status ?? 0) > 0 && (entry.httpRequest?.status ?? 0) < 400);
  const times = accepted.map((entry) => latencyMs(entry.httpRequest?.latency)).sort((left, right) => left - right);
  const interrupts = entries
    .filter((entry) => /turn interrupted/i.test(entry.textPayload || ""))
    .map((entry) => stamp(entry.timestamp))
    .filter((value) => value > 0)
    .sort((left, right) => left - right);
  let interrupted = 0;
  let previous = 0;
  for (const value of interrupts) {
    if (value - previous > 3000) interrupted += 1;
    previous = value;
  }
  const sorted = [...entries].sort((left, right) => String(left.timestamp || "").localeCompare(String(right.timestamp || "")));
  const notes = sorted.flatMap((entry) => entry.textPayload ? [{ at: stamp(entry.timestamp), text: entry.textPayload }] : []);
  const orderedHooks = sorted.filter((entry) => /\/v1\/channels\//.test(entry.httpRequest?.requestUrl || ""));
  const replies: number[] = [];
  const models: number[] = [];
  orderedHooks.forEach((hook, index, rows) => {
    const start = stamp(hook.timestamp);
    const end = stamp(rows[index + 1]?.timestamp) || Number.POSITIVE_INFINITY;
    const between = notes.filter((item) => item.at >= start && item.at < end);
    const reply = between.map((item) => item.text.match(/replied in (\d+)ms/i)).find(Boolean);
    const prep = between.flatMap((item) => prepIn(item.text));
    const rules = prep.length ? Math.max(...prep) : 0;
    if (reply) {
      const waited = Number(reply[1]);
      replies.push(waited);
      if (rules > 0 && waited >= rules) models.push(waited - rules);
    }
  });
  const loosePrep = notes.flatMap((item) => prepIn(item.text));
  const lastHook = orderedHooks.at(-1);
  const lastAt = stamp(lastHook?.timestamp);
  const repliedAfter = lastAt > 0 && notes.some((item) => item.at >= lastAt && /replied in \d+ms/i.test(item.text));
  const waitingMs = lastAt > 0 && !repliedAfter ? Math.max(0, now - lastAt) : 0;
  return {
    calls: hooks.length,
    accepted: accepted.length,
    rejected: hooks.length - accepted.length,
    interrupted,
    prepMs: loosePrep.length ? Math.max(...loosePrep) : 0,
    acceptMedianMs: times.length ? median(times) : 0,
    acceptP95Ms: percentile(times, 0.95),
    acceptSlowMs: times.length ? times[times.length - 1] : 0,
    replyMedianMs: median(replies),
    replySlowMs: replies.length ? Math.max(...replies) : 0,
    modelMedianMs: median(models),
    waitingMs,
  };
}

export type StageSlice = { label: string; at: number; channel: string; acceptMs: number; prepMs: number; modelMs: number; openMs: number };

function channelOf(text: string): string {
  const match = text.match(/\[(telegram|whatsapp|slack)\]/i);
  return match ? match[1].toLowerCase() : "";
}

function sliceOf(start: number, endAt: number, total: number, prepMs: number, acceptMs: number, closed: boolean, channel: string): StageSlice {
  const accept = Math.min(Math.max(0, acceptMs), total);
  const prepare = Math.min(Math.max(0, prepMs), Math.max(0, total - accept));
  const rest = Math.max(0, total - accept - prepare);
  return {
    label: channel || "msg",
    at: start,
    channel,
    acceptMs: accept,
    prepMs: prepare,
    modelMs: closed ? rest : 0,
    openMs: closed ? 0 : rest,
  };
}

export function interactionStages(entries: LogEntry[], now = Date.now()): StageSlice[] {
  const sorted = [...entries].sort((left, right) => String(left.timestamp || "").localeCompare(String(right.timestamp || "")));
  const notes = sorted.flatMap((entry) => entry.textPayload ? [{ at: stamp(entry.timestamp), text: entry.textPayload }] : []);
  const hooks = sorted.filter((entry) => /\/v1\/channels\//.test(entry.httpRequest?.requestUrl || ""));
  const starts = notes.filter((item) => /turn started/i.test(item.text));
  if (starts.length) {
    return starts.map((start, index, rows) => {
      const next = rows[index + 1]?.at ?? Number.POSITIVE_INFINITY;
      const reply = notes.find((item) => item.at >= start.at && item.at < next && /replied in \d+ms/i.test(item.text));
      const endAt = reply ? reply.at : Number.isFinite(next) ? next : now;
      const total = Math.max(0, endAt - start.at);
      const prep = notes.filter((item) => item.at >= start.at && item.at <= endAt).flatMap((item) => prepIn(item.text));
      const hook = [...hooks].reverse().find((item) => {
        const at = stamp(item.timestamp);
        return at > 0 && at <= start.at && start.at - at < 120000;
      });
      return sliceOf(start.at, endAt, total, prep.length ? Math.max(...prep) : 0, latencyMs(hook?.httpRequest?.latency), Boolean(reply), channelOf(start.text));
    });
  }
  return hooks.map((hook, index, rows) => {
    const start = stamp(hook.timestamp);
    const end = stamp(rows[index + 1]?.timestamp) || Number.POSITIVE_INFINITY;
    const between = notes.filter((item) => item.at >= start && item.at < end);
    const reply = between.map((item) => item.text.match(/replied in (\d+)ms/i)).find(Boolean);
    const prep = between.flatMap((item) => prepIn(item.text));
    const prepMs = prep.length ? Math.max(...prep) : 0;
    const acceptMs = Math.max(0, Math.round(latencyMs(hook.httpRequest?.latency)));
    const closed = reply ? Number(reply[1]) : 0;
    const total = closed > 0 ? closed : Math.max(0, (Number.isFinite(end) ? end : now) - start);
    const accept = Math.min(acceptMs, total);
    const prepare = Math.min(prepMs, Math.max(0, total - accept));
    const rest = Math.max(0, total - accept - prepare);
    return sliceOf(start, end, total, prepare, accept, closed > 0, "");
  });
}

export function monitorFreshness(range: string, from = 0, now = Date.now()): string {
  if (range === "15m" || range === "1h" || range === "6h") return range;
  if (range === "24h") return "1d";
  if (range === "custom" && from > 0 && from <= now) {
    const minutes = Math.max(1, Math.ceil((now - from) / 60000));
    if (minutes > 7 * 1440) return "7d";
    if (minutes >= 1440) return `${Math.ceil(minutes / 1440)}d`;
    if (minutes >= 60) return `${Math.ceil(minutes / 60)}h`;
    return `${minutes}m`;
  }
  return "6h";
}

export function monitorFilter(service: string, region: string): string {
  return `resource.type="cloud_run_revision" AND resource.labels.service_name="${service}" AND resource.labels.location="${region}" AND (httpRequest.requestUrl:"/v1/channels/" OR textPayload:"replied in" OR textPayload:"durationMs" OR textPayload:"totalMs" OR textPayload:"turn failed" OR textPayload:"turn started")`;
}

export function channelBars(entries: LogEntry[]): { ms: number; ok: boolean; label: string; kind: "accept"; at: number }[] {
  const sorted = [...entries].sort((left, right) => String(left.timestamp || "").localeCompare(String(right.timestamp || "")));
  const hooks = sorted.filter((entry) => /\/v1\/channels\//.test(entry.httpRequest?.requestUrl || ""));
  return hooks.map((entry) => ({
    ms: latencyMs(entry.httpRequest?.latency),
    ok: (entry.httpRequest?.status ?? 0) > 0 && (entry.httpRequest?.status ?? 0) < 400,
    label: (entry.timestamp || "").slice(11, 19),
    kind: "accept" as const,
    at: stamp(entry.timestamp),
  }));
}

export function agentSignal(entries: LogEntry[], now = Date.now()): { headline: string; webhook: string; turn: string; advice: string; kind: "ok" | "error" } {
  const sorted = [...entries].sort((left, right) => String(left.timestamp || "").localeCompare(String(right.timestamp || "")));
  const texts = sorted.flatMap((entry) => entry.textPayload ? [{ at: entry.timestamp || "", text: entry.textPayload }] : []);
  const hooks = sorted.filter((entry) => /\/v1\/channels\//.test(entry.httpRequest?.requestUrl || ""));
  const lastHook = hooks.at(-1);
  if (texts.some((row) => /Permission denied on secret/i.test(row.text)) && !lastHook) {
    return {
      headline: "The revision is not ready. It cannot read a secret.",
      webhook: "No channel call in this window.",
      turn: "No turn.",
      advice: "Grant Secret Accessor, then deploy again.",
      kind: "error",
    };
  }
  if (!lastHook) {
    return {
      headline: "No channel call in this window.",
      webhook: "No webhook.",
      turn: "No turn.",
      advice: "Send one message, then update again.",
      kind: "ok",
    };
  }
  const status = lastHook.httpRequest?.status ?? 0;
  const when = (lastHook.timestamp || "").slice(0, 19);
  const webhook = `Last webhook ${status} at ${when}.`;
  if (status === 401 || status === 403) {
    return {
      headline: "The channel rejected the call.",
      webhook,
      turn: "No turn.",
      advice: "The channel secret does not match. Fix it in Secrets, then register the webhook again.",
      kind: "error",
    };
  }
  const hookAt = lastHook.timestamp || "";
  const after = texts.filter((row) => row.at >= hookAt);
  if (after.some((row) => /sendMessage failed/i.test(row.text))) {
    return {
      headline: "The reply did not reach the chat.",
      webhook,
      turn: "The chat rejected the reply.",
      advice: "The turn finished and the send failed. Read the log below.",
      kind: "error",
    };
  }
  const failed = [...after].reverse().find((row) => /turn failed:/i.test(row.text));
  if (failed && /interrupted/i.test(failed.text)) {
    return {
      headline: "The reply was not sent. A later message cancelled the turn.",
      webhook,
      turn: "Turn interrupted.",
      advice: "Send one message and wait. This is not a CPU or memory change.",
      kind: "error",
    };
  }
  if (failed) {
    return {
      headline: "The turn failed before a reply.",
      webhook,
      turn: "Turn failed.",
      advice: "Read the log below. It must not contain a secret value.",
      kind: "error",
    };
  }
  const facts = monitorFacts(entries, now);
  const prep = facts.prepMs ? `Loading rules took up to ${Math.round(facts.prepMs / 1000)}s.` : "No cancelled turn in this window.";
  if (facts.interrupted > 0) {
    return {
      headline: facts.interrupted === 1 ? "1 turn was cancelled before a reply." : `${facts.interrupted} turns were cancelled before a reply.`,
      webhook,
      turn: prep,
      advice: "The other calls were accepted. The chart is webhook time, not the wait in the chat. Send one message and wait.",
      kind: "error",
    };
  }
  if (!texts.some((row) => /replied in \d+ms/i.test(row.text))) {
    const waited = Math.max(1, Math.round(facts.waitingMs / 1000));
    const accept = Math.max(0, Math.round(facts.acceptMedianMs));
    return {
      headline: facts.waitingMs > 0
        ? `The person has been waiting ${waited}s. Accepting the webhook took ${accept}ms. That is not the reply.`
        : "The person is still waiting. These numbers are how fast the webhook was accepted, not the reply.",
      webhook,
      turn: prep,
      advice: "Update again. The wait grows until the reply is logged. Rule loading, when it appears, is the slow stage. A second message cancels the turn.",
      kind: "ok",
    };
  }
  return {
    headline: "The last call was accepted. No failed turn in this window.",
    webhook,
    turn: "No failed turn after that call.",
    advice: "If the chat is still empty, update again in a minute. The turn may still be running.",
    kind: "ok",
  };
}

export function cloudRunRuntimeAccount(projectNumber: string): string {
  return /^\d+$/.test(projectNumber) ? `${projectNumber}-compute@developer.gserviceaccount.com` : "";
}

export function secretAccessorArgs(project: string, secret: string, account: string): string[] {
  return [
    "secrets", "add-iam-policy-binding", secret,
    "--project", project,
    "--member", `serviceAccount:${account}`,
    "--role", "roles/secretmanager.secretAccessor",
    "--quiet",
  ];
}

export function cloudRunArgs(plan: CloudRunPlan): string[] {
  const args = [
    "run", "deploy", plan.service,
    "--project", plan.project,
    "--region", plan.region,
    "--image", plan.image,
    "--ingress", plan.ingress,
    "--port", "3000",
    "--min-instances", String(plan.minInstances),
    "--max-instances", String(plan.maxInstances),
    "--update-annotations", `run.googleapis.com/minScale=${plan.minInstances},run.googleapis.com/maxScale=${plan.maxInstances}`,
    "--concurrency", String(plan.concurrency),
    "--cpu", plan.cpu,
    "--memory", plan.memory,
    plan.cpuAlways ? "--no-cpu-throttling" : "--cpu-throttling",
    "--timeout", String(plan.timeout),
    plan.allowUnauthenticated ? "--allow-unauthenticated" : "--no-allow-unauthenticated",
  ];
  if (plan.secrets.length) args.push("--set-secrets", plan.secrets.map((name) => `${name}=${name}:latest`).join(","));
  if (plan.env.length) args.push("--set-env-vars", plan.env.map((row) => `${row.name}=${row.value}`).join(","));
  return args;
}

export function portHolder(log: string, owners: string): string {
  if (!/port is already allocated|address already in use/i.test(log)) return "";
  const name = owners.split(/\n/).map((line) => line.trim()).find((line) => /:3000->/.test(line))?.split(/\s+/)[0];
  return name
    ? `Port 3000 is already used by ${name}. Stop that container, then Start again.`
    : "Port 3000 is already used on this machine. Stop the other agent, then Start again.";
}

export function shipArgs(task: "start" | "rebuild", hasPin: boolean, republish: boolean): string[] {
  if (task === "rebuild" || !hasPin) return ["compose", "up", "--build", "-d", "--force-recreate"];
  return republish ? ["compose", "up", "-d", "--force-recreate"] : ["compose", "up", "-d"];
}

export function writeDocker(root: string, force = true): void {
  const write = (file: string, body: string) => {
    if (!force && fs.existsSync(file)) return;
    if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === body) return;
    fs.writeFileSync(file, body, "utf8");
  };
  const name = isProject(root) ? imageName(loadProject(root).name) : "bigagent-agent";
  write(path.join(root, ".dockerignore"), ".env\n.env.*\n!.env.example\n.git\nnode_modules\nout\ndist\ncoverage\n.cursor\nevals\n*.vsix\n");
  write(path.join(root, "Dockerfile"), dockerFile());
  write(path.join(root, "compose.yaml"), composeFile(name, readImagePin(root) || ""));
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
    if (!/git init --quiet \/srv\/agent\/bot/.test(docker)) {
      out.push({
        id: "docker-git",
        message: "Dockerfile does not make /srv/agent/bot its own git root. The runtime then walks the whole image, including node_modules, before it answers. Save again so the generator writes that git init.",
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
  return `FROM node:22.23.5-slim
RUN apt-get update \\
 && apt-get install -y --no-install-recommends git \\
 && rm -rf /var/lib/apt/lists/*
WORKDIR /srv/agent
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force && rm -rf /root/.npm
COPY . .
# The harness walks up to the nearest git root. Without one it walks the
# whole image, including node_modules, on every turn. bot/ is that root.
# node_modules stays beside it, outside the walk.
RUN mkdir -p /srv/agent/bot /var/lib/agent-sdk \\
 && git init --quiet /srv/agent/bot \\
 && chown -R node:node /srv/agent/bot /var/lib/agent-sdk \\
 && printf '%s\\n' \\
    '#!/bin/sh' \\
    'set -e' \\
    'mkdir -p /var/lib/agent-sdk /home/node' \\
    'if [ "$(id -u)" = "0" ]; then' \\
    '  chown -R node:node /var/lib/agent-sdk /home/node' \\
    '  export HOME=/home/node' \\
    '  exec setpriv --reuid=node --regid=node --init-groups -- "$0"' \\
    'fi' \\
    'if [ -n "$AGENT_SDK_BEARER_TOKEN" ] && [ "$BIGAGENT_ADMIT_LOCAL" != "1" ]; then' \\
    '  exec ./node_modules/.bin/agent-sdk serve --dir /srv/agent --host 0.0.0.0 --port 3000 --state-root /var/lib/agent-sdk --mode single --bearer-token "$AGENT_SDK_BEARER_TOKEN"' \\
    'fi' \\
    'exec ./node_modules/.bin/agent-sdk serve --dir /srv/agent --host 0.0.0.0 --port 3000 --state-root /var/lib/agent-sdk --mode single --allow-anonymous' \\
    > /usr/local/bin/agent-start \\
 && chmod 755 /usr/local/bin/agent-start
ENV NODE_ENV=production
EXPOSE 3000
# Compose mounts a root-owned volume on /var/lib/agent-sdk. The script gives
# that directory to node, points HOME at /home/node, and only then starts
# serve. The rules cache must not try to write under /root. A bearer locks the API.
# BIGAGENT_ADMIT_LOCAL=1 admits this machine.
CMD ["/usr/local/bin/agent-start"]
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
    "export default defineChannel<{ chatId: string; startedAt: string }>({",
    "  auth: [publicEndpoint()],",
    '  state: { chatId: "", startedAt: "" },',
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
    '        console.log("[telegram] turn started");',
    model
      ? "        waitUntil(send(text, {"
      : `        const reply = ${directReply(item.body)};`,
    model ? "          continuationToken: `telegram:${chatId}`," : "        waitUntil(replyTelegram(String(chatId), String(reply).slice(0, 4000)));",
    ...(model
      ? ["          state: { chatId: String(chatId), startedAt: String(Date.now()) },", "          title: `Telegram ${chatId}`,", "        }));"]
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
    "      const waited = Math.max(0, Date.now() - Number(channel.state.startedAt || Date.now()));",
    "      console.log(`[telegram] replied in ${waited}ms`);",
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
    if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === body) return;
    fs.writeFileSync(file, body, "utf8");
  };
  const model =
    project.model === "auto"
      ? ""
      : `  model: {\n    id: ${q(project.model)},\n    params: [\n      { id: "effort", value: ${q(project.effort)} },\n      { id: "fast", value: ${q(project.fast ? "true" : "false")} },\n    ],\n  },\n`;
  const harness = project.harness ? `  tools: ${JSON.stringify(project.harness)},\n` : "";
  const turns = project.maxRunningTurns ? `  concurrency: { maxRunningTurns: ${project.maxRunningTurns} },\n` : "";
  const reminders = project.reminders ? `  builtinTools: { reminders: true },\n` : "";
  const egress = [...new Set([
    ...project.egress,
    ...project.items.flatMap((item) => {
      if ((item.kind !== "mcp" && item.kind !== "host") || !item.url) return [];
      try { return [new URL(item.url).hostname]; } catch { return []; }
    }),
  ])];
  const hosting =
    egress.length || project.secrets.length
      ? `  hosting: { secretNames: ${JSON.stringify(project.secrets.map((row) => row.name))}, egressDomains: ${JSON.stringify(egress)} },\n`
      : "";
  const narrow = `  local: { workspaceDir: "/srv/agent/bot" },\n`;
  write(
    "bot/agent.ts",
    `import { defineAgent } from "@grok/agent-sdk";\n\n// ${MARK}\nexport default defineAgent({\n  name: ${q(project.name)},\n${narrow}${model}${harness}${turns}${reminders}${hosting}});\n`,
  );
  write(".cursorignore", "node_modules\n.git\nout\ndist\n");
  write("bot/instructions.md", `<!-- ${MARK} -->\n${project.instructions.endsWith("\n") ? project.instructions : `${project.instructions}\n`}`);
  const wired = flowLinks(project, readLayout(root));
  let telegram = false;
  let whatsapp = false;
  for (const item of project.items) {
    if (item.kind === "tool") {
      const effect = item.effect === "irreversible" || item.effect === "idempotent" || item.effect === "write" ? item.effect === "irreversible" ? "write" : item.effect : "read";
      const approval = item.effect === "irreversible" ? `  needsApproval: true,\n` : "";
      const mcp = mcpTarget(item.calls || "");
      const written = item.body.trim();
      const placeholder = !written || /^return input;?$/.test(written);
      const generated = Boolean(mcp?.tool && placeholder);
      const body = generated
        ? `  const result = await ctx.host.mcp.callTool(${q(mcp!.server)}, ${q(mcp!.tool)}, input);\n  const part = result.content.find((item) => item.type === "text");\n  const text = part && "text" in part && typeof part.text === "string" ? part.text : "";\n  return { ok: result.isError !== true, text };`
        : written ? written.replace(/\n$/, "") : "  return input;";
      const signature = generated ? "input, ctx" : "input";
      write(
        `bot/tools/${item.name}.ts`,
        `import { defineTool } from "@grok/agent-sdk/tools";\nimport * as z from "zod/v4";\n\n// ${MARK}\nexport default defineTool({\n  description: ${q(item.description)},\n  execution: ${q(executionOf(item.execution))},\n  effect: ${q(effect)},\n${approval}  inputSchema: ${zodShape(item.parameters)},\n  async execute(${signature}) {\n${body}\n  },\n});\n`,
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
  const dockerPath = path.join(root, "Dockerfile");
  const dockerNow = fs.existsSync(dockerPath) ? fs.readFileSync(dockerPath, "utf8") : "";
  if (!dockerNow || /serve --dir \/srv\/agent|"--dir", "\/srv\/agent"/.test(dockerNow)) {
    const next = dockerFile();
    if (next !== dockerNow) fs.writeFileSync(dockerPath, next, "utf8");
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

function composeFile(name: string, pin: string): string {
  const source = pin ? `image: ${name}@${pin}` : `build: .\n    image: ${name}`;
  return `services:
  agent:
    ${source}
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

export function mergeLogs(previous: string, snapshot: string): string {
  if (!snapshot.trim()) return previous;
  return snapshot.slice(-8000);
}

export function consoleCommand(command: string, args: string[], platform = process.platform): string {
  const bin = command === "gcloud" && platform === "win32" ? "gcloud.cmd" : command;
  return formatCommand(bin, args);
}

export function pushProgress(log: string): { done: number; pending: number; detail: string } {
  const layers = new Map<string, string>();
  for (const line of log.split("\n")) {
    const match = line.match(/^([0-9a-f]{12}):\s*(.*)$/);
    if (match) layers.set(match[1], match[2].trim() || "Preparing");
  }
  let done = 0;
  const pending: string[] = [];
  for (const [id, status] of layers) {
    if (/already exists|pushed|mounted/i.test(status)) done += 1;
    else pending.push(`${id}: ${status}`);
  }
  return { done, pending: pending.length, detail: pending.slice(0, 2).join(", ") };
}

export function consoleAppend(previous: string, chunk: string): string {
  const layer = (line: string) => line.match(/^([0-9a-f]{12}): /)?.[1] || "";
  let open = previous.endsWith("\r");
  let text = open ? previous.slice(0, -1) : previous;
  const pieces = chunk.split("\r");
  pieces.forEach((piece, pieceIndex) => {
    let replace = open || pieceIndex > 0;
    if (piece.length === 0) return;
    piece.split("\n").forEach((line, lineIndex) => {
      const rows = text.length ? text.split("\n") : [];
      if (lineIndex === 0 && replace) {
        const current = rows[rows.length - 1] || "";
        const nextId = layer(line);
        const currentId = layer(current);
        if (rows.length === 0) rows.push(line);
        else if (nextId && currentId && nextId !== currentId) rows.push(line);
        else if (/^\$ /.test(current) || /\b(error|denied|forbidden)\b/i.test(current)) rows.push(line);
        else rows[rows.length - 1] = line;
      } else if (line.length || lineIndex > 0) {
        rows.push(line);
      }
      text = rows.join("\n");
      replace = false;
    });
    open = pieceIndex < pieces.length - 1;
  });
  const lines = text.split("\n");
  const last = new Map<string, number>();
  lines.forEach((line, index) => {
    const id = layer(line);
    if (id) last.set(id, index);
  });
  const folded = lines.filter((line, index) => {
    const id = layer(line);
    if (id) return last.get(id) === index;
    return line.trim().length > 0 || index === lines.length - 1;
  }).join("\n");
  return folded + (open ? "\r" : "");
}

export function formatCommand(command: string, args: string[]): string {
  const shown = [command, ...args].map((part) => {
    if (part === "") return '""';
    return /[\s"$`\\]/.test(part) ? `"${part.replace(/"/g, '\\"')}"` : part;
  });
  return `$ ${shown.join(" ")}`;
}

export function scrubLogs(text: string, names: string[]): string {
  let out = text;
  for (const name of names) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) continue;
    out = out.replace(new RegExp(`${name}=\\S+`, "g"), `${name}=•••`);
  }
  return out.replace(/\d{6,}:[A-Za-z0-9_-]{20,}/g, "•••");
}

export function redactValues(text: string, values: string[]): string {
  let out = text;
  const secrets = [...values].filter((value) => value.trim().length >= 4).sort((left, right) => right.length - left.length);
  for (const value of secrets) out = out.split(value).join("•••");
  return scrubLogs(out, []);
}

export function composePortClosed(text: string): boolean {
  if (!composeIsRunning(text)) return false;
  if (/127\.0\.0\.1:3000->3000|0\.0\.0\.0:3000->3000|\[::\]:3000->3000/.test(text)) return false;
  if (/"PublishedPort"\s*:\s*3000/.test(text)) return false;
  return /"PublishedPort"\s*:\s*0/.test(text) || /"Ports"\s*:\s*"3000\/tcp"/.test(text);
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

export function runSignals(logs: string): { errors: number; lastError: string; spanMs: number | null } {
  const lines = logs.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const errors = lines.filter((line) => logLevel(line) === "error");
  const stamps = lines.map((line) => logStamp(line)).filter((time): time is number => time != null);
  const spanMs = stamps.length >= 2 ? Math.max(...stamps) - Math.min(...stamps) : null;
  const last = errors.length ? errors[errors.length - 1] : "";
  const lastError = last.replace(/^\d{4}-\d{2}-\d{2}T\S+\s*/, "").slice(0, 180);
  return { errors: errors.length, lastError, spanMs };
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

