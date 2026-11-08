import * as vscode from "vscode";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { designerHtml, libraryHtml, type ShipStatus, type Ui } from "./designer";
import { phrase, t } from "./copy";
import {
  arrange,
  captureFolder,
  deleteItem,
  emitSdk,
  ensureStudioFile,
  flowLinks,
  GUIDE_URL,
  GUIDE_URL_ES,
  initWorkspace,
  linksExcept,
  nextCopyName,
  positionsDiffer,
  readStudio,
  restoreFolder,
  restoreWorkspace,
  toggleLink,
  isProject,
  EXAMPLES,
  keepWorkspace,
  loadExample,
  loadProject,
  readLayout,
  scanWorkspace,
  cardNeeds,
  composeIsRunning,
  composePortClosed,
  PORT_CLOSED,
  DOCKER_DOWN,
  DOCKER_MISSING,
  DOCKER_SILENT,
  dockerProblem,
  lmGate,
  scrubLogs,
  secretValue,
  slackCheckTarget,
  telegramSetWebhookTarget,
  whatsappCheckTarget,
  whatsappSendTarget,
  safeRelative,
  saveAgentSettings,
  saveInstructions,
  saveItem,
  saveScope,
  writeEvalCase,
  writeLayout,
  setCanvasNode,
  setSecret,
  slug,
  writeDocker,
  type FolderShot,
  type Item,
  type Kind,
} from "./project";

const UI = "bigagent.ui";

function folder(): string | undefined {
  return vscode.workspace.workspaceFolders?.find((item) => item.uri.scheme === "file")?.uri.fsPath;
}

function freshName(root: string, kind: Kind): string {
  const project = loadProject(root);
  const base = kind === "channel" ? "hook" : kind === "schedule" ? "schedule" : kind === "tool" ? "action" : kind === "skill" ? "guide" : kind === "subagent" ? "helper" : kind === "hook" ? "audit" : kind === "host" ? "host" : "server";
  const taken = new Set(project.items.filter((item) => item.kind === kind).map((item) => item.name));
  if (!taken.has(base)) return base;
  for (let index = 2; index < 40; index += 1) {
    const candidate = `${base}-${index}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

function isExtensionRoot(root: string): boolean {
  const file = path.join(root, "package.json");
  if (!fs.existsSync(file)) return false;
  try {
    return (JSON.parse(fs.readFileSync(file, "utf8")) as { name?: string }).name === "bigagentcreator";
  } catch {
    return false;
  }
}

function readUi(context: vscode.ExtensionContext): Ui {
  const saved = context.workspaceState.get<Partial<Ui>>(UI);
  return {
    mode: saved?.mode ?? "flow",
    selected: saved?.selected ?? "agent",
    notice: "",
    libraryOpen: saved?.libraryOpen !== false,
    inspectorOpen: saved?.inspectorOpen !== false,
    libraryWidth: saved?.libraryWidth ?? 240,
    inspectorWidth: saved?.inspectorWidth ?? 300,
    lang: saved?.lang === "es" ? "es" : saved?.lang === "en" ? "en" : vscode.env.language.toLowerCase().startsWith("es") ? "es" : "en",
  };
}

async function writeUi(context: vscode.ExtensionContext, ui: Ui): Promise<void> {
  await context.workspaceState.update(UI, ui);
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new Home(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("bigagent.home", provider),
    vscode.commands.registerCommand("bigagent.open", () => provider.openDesigner()),
  );
}

class Home implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private panel?: vscode.WebviewPanel;

  private holdNotice = "";
  private helpOpen = false;
  private watcher?: vscode.FileSystemWatcher;
  private watchTimer?: ReturnType<typeof setTimeout>;
  private watchedRoot = "";
  private past: FolderShot[] = [];
  private future: FolderShot[] = [];
  private clip?: Item;
  private pulseAt = 0;
  private ship: ShipStatus = { docker: "unknown", running: false, failed: false, phase: "idle", summary: "Stopped. Start builds the image and runs it here.", logs: "", publicUrl: "", stats: { cpu: "—", memory: "—", healthMs: null } };
  private lm: { ok: boolean; reason: string } = { ok: false, reason: "Test the editor model before asking." };
  private lmModel: vscode.LanguageModelChat | undefined;
  private ask: { role: "you" | "guide"; text: string }[] = [];
  private askOpen = false;
  private secretFocus = "";
  private shipProc?: ChildProcess;
  private tunnelProc?: ChildProcess;
  private shipGen = 0;

  constructor(private readonly context: vscode.ExtensionContext) {
    context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.past = [];
        this.future = [];
        this.clip = undefined;
        this.render("");
      }),
    );
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.onDidReceiveMessage((message) => this.onMessage(message));
    this.openDesigner();
  }

  openDesigner(): void {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel("bigagent.designer", "BigAgentCreator", vscode.ViewColumn.Active, {
        enableScripts: true,
        retainContextWhenHidden: true,
      });
      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this.watcher?.dispose();
        this.watcher = undefined;
        this.watchedRoot = "";
      });
      this.panel.webview.onDidReceiveMessage((message) => this.onMessage(message));
      void vscode.commands.executeCommand("workbench.action.closeSidebar");
    } else {
      this.panel.reveal(vscode.ViewColumn.Active);
    }
    this.render("");
  }

  private follow(root: string): void {
    if (root === this.watchedRoot) return;
    this.watcher?.dispose();
    this.watchedRoot = root;
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(
        vscode.Uri.file(root),
        "{instructions.md,tools/**,skills/**,mcp-connections/**,channels/**,.bigagent/**,Dockerfile,compose.yaml,.dockerignore,.env,.env.example}",
      ),
    );
    const kick = (uri: vscode.Uri) => {
      if (uri.fsPath.endsWith(`${path.sep}layout.json`)) return;
      const envFile = uri.fsPath.endsWith(`${path.sep}.env`) || uri.fsPath.endsWith(`${path.sep}.env.example`);
      if (this.watchTimer) clearTimeout(this.watchTimer);
      this.watchTimer = setTimeout(() => {
        if (!envFile && isProject(root)) emitSdk(root);
        this.render();
      }, 200);
    };
    watcher.onDidChange(kick);
    watcher.onDidCreate(kick);
    watcher.onDidDelete(kick);
    this.watcher = watcher;
  }

  private remember(root: string): void {
    this.past.push(captureFolder(root));
    if (this.past.length > 40) this.past.shift();
    this.future = [];
  }

  private saved(): void {
    this.pulseAt = Date.now();
    this.panel?.webview.postMessage({ type: "saved" });
  }

  private placeCopy(root: string, item: Item): string {
    const taken = new Set(loadProject(root).items.filter((entry) => entry.kind === item.kind).map((entry) => entry.name));
    const name = nextCopyName(taken, item.name);
    const before = loadProject(root);
    const layout = readLayout(root);
    const links = layout.links ?? flowLinks(before, layout);
    saveItem(root, { ...item, name });
    const from = layout.positions[`${item.kind}:${item.name}`] || { x: 80, y: 80 };
    let x = Math.min(3960, from.x + 36);
    let y = Math.min(3960, from.y + 36);
    const spots = Object.values(layout.positions);
    while (spots.some((point) => Math.abs(point.x - x) < 12 && Math.abs(point.y - y) < 12)) {
      x = Math.min(3960, x + 36);
      y = Math.min(3960, y + 36);
    }
    layout.positions[`${item.kind}:${name}`] = { x, y };
    writeLayout(root, { ...layout, links });
    return `${item.kind}:${name}`;
  }

  private docker(root: string, args: string[], onChunk?: (text: string) => void, track = false, timeoutMs = 20000): Promise<number> {
    return new Promise((resolve) => {
      let settled = false;
      let child: ChildProcess | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (code: number) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        resolve(code);
      };
      try {
        child = spawn("docker", args, { cwd: root, windowsHide: true, shell: process.platform === "win32" });
      } catch (error) {
        onChunk?.(error instanceof Error ? `${error.message}\n` : "Could not start Docker.\n");
        finish(1);
        return;
      }
      if (track) this.shipProc = child;
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          onChunk?.("Docker did not answer in time.\n");
          if (child?.pid && process.platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true });
          else child?.kill();
          finish(1);
        }, timeoutMs);
      }
      const take = (chunk: Buffer) => onChunk?.(chunk.toString("utf8"));
      child.stdout?.on("data", take);
      child.stderr?.on("data", take);
      child.on("error", (error) => {
        onChunk?.(`${error.message}\n`);
        finish(1);
      });
      child.on("close", (code) => finish(code ?? 1));
    });
  }

  private shipNote(gen: number, text: string): void {
    if (gen !== this.shipGen) return;
    const line = text.endsWith("\n") ? text : `${text}\n`;
    this.ship = { ...this.ship, logs: (this.ship.logs + line).slice(-12000) };
    const spoken = phrase(readUi(this.context).lang, line.replace(/\n$/, ""));
    this.panel?.webview.postMessage({ type: "ship-log", text: `${spoken}\n` });
  }

  private daemonDown(text: string): boolean {
    return /dockerDesktopLinuxEngine|Cannot connect to the Docker daemon|error during connect|cannot find the file specified/i.test(text);
  }

  private async refreshShip(root: string): Promise<void> {
    const gen = this.shipGen;
    const wasStart = this.ship.phase === "building" || this.ship.phase === "rebuilding";
    try {
    if (this.ship.phase === "idle" || this.ship.phase === "checking") {
      this.ship = { ...this.ship, phase: "checking", summary: "Checking Docker on this machine.", logs: `${this.ship.logs}Checking Docker on this machine.\n`.slice(-12000) };
      this.render();
    }
    const names = loadProject(root).secrets.map((row) => row.name);
    let info = "";
    const infoCode = await this.docker(root, ["info", "--format", "{{.ServerVersion}}"], (text) => {
      info += text;
      this.shipNote(gen, scrubLogs(text, names));
    }, false, 12000);
    if (gen !== this.shipGen) return;
    if (infoCode !== 0 || this.daemonDown(info)) {
      const problem = dockerProblem(info);
      const missing = problem === "missing";
      this.ship = {
        docker: "down",
        running: false,
        failed: false,
        phase: "idle",
        dockerWhy: missing ? "missing" : "down",
        summary: missing ? DOCKER_MISSING : /did not answer in time/i.test(info) ? DOCKER_SILENT : DOCKER_DOWN,
        logs: scrubLogs(this.ship.logs, names).slice(-8000),
        publicUrl: this.ship.publicUrl,
        stats: { cpu: "—", memory: "—", healthMs: null },
      };
      this.render();
      return;
    }
    let ps = "";
    this.shipNote(gen, "Docker answered. Checking the container.");
    const psCode = await this.docker(root, ["compose", "ps", "--format", "json"], (text) => {
      ps += text;
    }, false, 12000);
    if (gen !== this.shipGen) return;
    if (psCode !== 0 || this.daemonDown(ps)) {
      this.ship = {
        docker: "down",
        running: false,
        failed: false,
        phase: "idle",
        dockerWhy: "down",
        summary: DOCKER_DOWN,
        logs: scrubLogs(ps || info, names).slice(-8000),
        publicUrl: this.ship.publicUrl,
        stats: { cpu: "—", memory: "—", healthMs: null },
      };
      this.render();
      return;
    }
    let logs = "";
    this.shipNote(gen, "Reading the container log.");
    await this.docker(root, ["compose", "logs", "--tail", "200", "-t", "--no-color"], (text) => {
      logs += text;
    }, false, 12000);
    if (gen !== this.shipGen) return;
    const clean = scrubLogs(logs, names);
    const portClosed = composePortClosed(ps);
    const running = composeIsRunning(ps) && !portClosed;
    const failed = portClosed || (wasStart && !running);
    const stats = running ? await this.localStats(root) : { cpu: "—", memory: "—", healthMs: null };
    if (gen !== this.shipGen) return;
    this.ship = {
      docker: "ready",
      running,
      failed,
      phase: "idle",
      summary: running ? "Listening on http://127.0.0.1:3000." : portClosed ? PORT_CLOSED : failed ? "The container is not running. Read the log." : "Stopped. Start builds the image and runs it here.",
      republish: portClosed,
      logs: clean.slice(-8000),
      publicUrl: this.ship.publicUrl,
      stats,
    };
    this.render();
    } catch (error) {
      if (gen !== this.shipGen) return;
      const message = error instanceof Error ? error.message : "The check stopped.";
      this.ship = { ...this.ship, phase: "idle", failed: true, running: false, summary: message, logs: `${this.ship.logs}${message}\n`.slice(-8000) };
      this.render();
    }
  }

  private async localStats(root: string): Promise<{ cpu: string; memory: string; healthMs: number | null }> {
    const stats = { cpu: "—", memory: "—", healthMs: null as number | null };
    let ids = "";
    const idCode = await this.docker(root, ["compose", "ps", "-q"], (text) => {
      ids += text;
    }, false, 8000);
    const cid = idCode === 0 ? ids.trim().split(/\s+/)[0] : "";
    if (cid) {
      let line = "";
      const code = await this.docker(root, ["stats", "--no-stream", "--format", "{{.CPUPerc}}|{{.MemUsage}}", cid], (text) => {
        line += text;
      }, false, 8000);
      const [cpu, memory] = line.trim().split("|");
      if (code === 0 && cpu && memory) {
        stats.cpu = cpu;
        stats.memory = memory;
      }
    }
    const started = Date.now();
    try {
      const response = await fetch("http://127.0.0.1:3000/playground", { signal: AbortSignal.timeout(2000) });
      if (response.ok) stats.healthMs = Date.now() - started;
    } catch {
      stats.healthMs = null;
    }
    return stats;
  }

  private async compose(root: string, args: string[], phase: "building" | "stopping" | "rebuilding"): Promise<void> {
    const gen = ++this.shipGen;
    this.shipProc?.kill();
    const names = loadProject(root).secrets.map((row) => row.name);
    this.ship = {
      ...this.ship,
      phase,
      summary: phase === "rebuilding" ? "Rebuilding the image and recreating the container so it reads the current secrets." : phase === "building" ? "Building the local image. The log shows each step." : "Stopping the local agent.",
      logs: phase === "building" ? "Building the local image. The log shows each step.\n" : phase === "rebuilding" ? "Rebuilding the image and recreating the container so it reads the current secrets.\n" : "Stopping the local agent.\n",
    };
    this.render();
    const code = await this.docker(
      root,
      args,
      (text) => {
        if (gen !== this.shipGen) return;
        const clean = scrubLogs(text, names);
        this.ship = { ...this.ship, logs: (this.ship.logs + clean).slice(-12000) };
        this.panel?.webview.postMessage({ type: "ship-log", text: clean });
      },
      true,
      0,
    );
    if (gen !== this.shipGen) return;
    if (code !== 0 || this.daemonDown(this.ship.logs)) {
      const why = dockerProblem(this.ship.logs);
      const down = why === "down" || this.daemonDown(this.ship.logs);
      const missing = why === "missing";
      this.ship = {
        ...this.ship,
        docker: missing || down ? "down" : this.ship.docker,
        dockerWhy: missing ? "missing" : down ? "down" : this.ship.dockerWhy,
        running: false,
        failed: !missing && !down,
        phase: "idle",
        summary: missing
          ? DOCKER_MISSING
          : down
            ? DOCKER_DOWN
            : phase === "building"
              ? "The build stopped. Read the log."
              : phase === "rebuilding"
                ? "Rebuild did not finish. Read the log."
                : "Stop did not finish. Read the log.",
      };
      this.render();
      return;
    }
    await this.refreshShip(root);
  }

  private async openTunnel(): Promise<void> {
    const gen = ++this.shipGen;
    this.tunnelProc?.kill();
    this.ship = { ...this.ship, phase: "tunnel", summary: "Opening a Cloudflare tunnel to port 3000." };
    this.render();
    let child: ChildProcess;
    try {
      child = spawn("cloudflared", ["tunnel", "--url", "http://127.0.0.1:3000"], { windowsHide: true, shell: process.platform === "win32" });
    } catch (error) {
      this.ship = {
        ...this.ship,
        phase: "idle",
        summary: `Cloudflare Tunnel is not available. Install it with winget install --id Cloudflare.cloudflared, or paste an https address you already have. ${error instanceof Error ? error.message : ""}`.trim(),
      };
      this.render();
      return;
    }
    this.tunnelProc = child;
    let buffer = "";
    const found = new Promise<string>((resolve) => {
      const take = (chunk: Buffer) => {
        buffer += chunk.toString("utf8");
        const match = buffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if (match) resolve(match[0]);
      };
      child.stdout?.on("data", take);
      child.stderr?.on("data", take);
      child.on("error", (error) => {
        buffer += error.message;
        resolve("");
      });
      child.on("exit", () => resolve(""));
    });
    const url = await Promise.race([found, new Promise<string>((resolve) => setTimeout(() => resolve(""), 25000))]);
    if (gen !== this.shipGen) return;
    if (!url) {
      child.kill();
      const missing = /not recognized|ENOENT|not found/i.test(buffer);
      this.ship = {
        ...this.ship,
        phase: "idle",
        summary: missing
          ? "Cloudflare Tunnel is not installed. Run winget install --id Cloudflare.cloudflared, or paste an https address you already have."
          : "The tunnel did not return an address. Paste an https address you already have, then Register webhook.",
      };
      this.render();
      return;
    }
    this.ship = { ...this.ship, phase: "idle", publicUrl: url, summary: `Tunnel ready at ${url}. Register webhook next. Leave this session open.` };
    this.render();
  }

  private async registerWebhook(root: string, publicBase: string): Promise<void> {
    const gen = ++this.shipGen;
    const names = loadProject(root).secrets.map((row) => row.name);
    const target = telegramSetWebhookTarget(secretValue(root, "TELEGRAM_BOT_TOKEN"), secretValue(root, "TELEGRAM_WEBHOOK_SECRET"), publicBase);
    if ("error" in target) {
      this.ship = { ...this.ship, phase: "idle", publicUrl: publicBase.trim(), summary: target.error };
      this.render();
      return;
    }
    this.ship = { ...this.ship, phase: "webhook", publicUrl: publicBase.trim(), summary: "Restarting the agent so it reads the current secrets." };
    this.render();
    let restart = "";
    const code = await this.docker(root, ["compose", "up", "-d", "--force-recreate"], (text) => {
      restart += text;
    });
    if (gen !== this.shipGen) return;
    if (code !== 0 || this.daemonDown(restart)) {
      this.ship = {
        ...this.ship,
        phase: "idle",
        docker: this.daemonDown(restart) ? "down" : this.ship.docker,
        summary: this.daemonDown(restart) ? "Docker Desktop is not running. Open it, then Register webhook again." : "The agent did not restart. Read the log, then Register webhook again.",
        logs: scrubLogs(restart, names).slice(-8000),
      };
      this.render();
      return;
    }
    const healthy = await this.waitForHealth();
    if (gen !== this.shipGen) return;
    if (!healthy) {
      this.ship = { ...this.ship, phase: "idle", running: false, summary: "The agent did not answer on port 3000 after restart. Start it, then Register webhook again." };
      this.render();
      return;
    }
    this.ship = { ...this.ship, summary: "Telling Telegram the public address." };
    this.render();
    let summary = "Telegram did not answer. Register webhook again.";
    try {
      const response = await fetch(target.endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: target.body });
      const payload = (await response.json()) as { ok?: boolean; description?: string };
      summary = payload.ok
        ? "Webhook registered. Open the bot in Telegram and ask what its hours are."
        : `Telegram refused the webhook: ${payload.description || response.status}.`;
    } catch {
      summary = "Could not reach Telegram. Check the network, then Register webhook again.";
    }
    if (gen !== this.shipGen) return;
    this.ship = { ...this.ship, phase: "idle", running: true, docker: "ready", summary: scrubLogs(summary, names) };
    this.render();
  }

  private async checkWhatsApp(root: string): Promise<void> {
    const names = loadProject(root).secrets.map((row) => row.name);
    const target = whatsappCheckTarget(secretValue(root, "WHATSAPP_TOKEN"), secretValue(root, "WHATSAPP_PHONE_NUMBER_ID"));
    if ("error" in target) {
      this.ship = { ...this.ship, phase: "idle", summary: target.error };
      this.render();
      return;
    }
    this.ship = { ...this.ship, phase: "checking", summary: "Asking Meta whether this token matches the phone number ID." };
    this.render();
    let summary = "Could not reach Meta. Check the network, then try again.";
    try {
      const response = await fetch(target.endpoint, { headers: { authorization: target.authorization } });
      summary = response.ok ? "WhatsApp answered for this phone number ID." : `Meta refused the check (${response.status}). The token and the phone number ID have to belong to the same app.`;
    } catch {
      summary = "Could not reach Meta. Check the network, then try again.";
    }
    this.ship = { ...this.ship, phase: "idle", summary: scrubLogs(summary, names) };
    this.render();
  }

  private async sendWhatsAppTest(root: string, to: string): Promise<void> {
    const names = loadProject(root).secrets.map((row) => row.name);
    const target = whatsappSendTarget(secretValue(root, "WHATSAPP_TOKEN"), secretValue(root, "WHATSAPP_PHONE_NUMBER_ID"), to);
    if ("error" in target) {
      this.ship = { ...this.ship, phase: "idle", summary: target.error };
      this.render();
      return;
    }
    this.ship = { ...this.ship, phase: "checking", summary: "Sending hello through WhatsApp." };
    this.render();
    let summary = "Could not reach Meta. Check the network, then try again.";
    try {
      const response = await fetch(target.endpoint, { method: "POST", headers: { authorization: target.authorization, "content-type": "application/json" }, body: target.body });
      summary = response.ok ? "Sent hello. Open WhatsApp on that number." : `Meta refused the message (${response.status}). The number needs the country code, and the token has to be allowed to send.`;
    } catch {
      summary = "Could not reach Meta. Check the network, then try again.";
    }
    this.ship = { ...this.ship, phase: "idle", summary: scrubLogs(summary, names) };
    this.render();
  }

  private async checkSlack(root: string): Promise<void> {
    const names = loadProject(root).secrets.map((row) => row.name);
    const target = slackCheckTarget(secretValue(root, "SLACK_BOT_TOKEN"));
    if ("error" in target) {
      this.ship = { ...this.ship, phase: "idle", summary: target.error };
      this.render();
      return;
    }
    this.ship = { ...this.ship, phase: "checking", summary: "Asking Slack who this bot is." };
    this.render();
    let summary = "Could not reach Slack. Check the network, then try again.";
    try {
      const response = await fetch(target.endpoint, { headers: { authorization: target.authorization } });
      const payload = (await response.json()) as { ok?: boolean };
      summary = payload.ok ? "Slack answered for this bot token." : "Slack refused the token.";
    } catch {
      summary = "Could not reach Slack. Check the network, then try again.";
    }
    this.ship = { ...this.ship, phase: "idle", summary: scrubLogs(summary, names) };
    this.render();
  }

  private async waitForHealth(): Promise<boolean> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        const response = await fetch("http://127.0.0.1:3000/v1/health");
        if (response.ok) return true;
      } catch {
        // The process is still coming back.
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return false;
  }

  private examplesRoot(): string {
    const packaged = path.join(this.context.extensionPath, "templates");
    if (fs.existsSync(path.join(packaged, "telegram-desk", ".bigagent", "project.json"))) return packaged;
    return path.join(this.context.extensionPath, "..", "..", "examples");
  }

  private followLogs(root: string): void {
    const existing = vscode.window.terminals.find((term) => term.name === "BigAgentCreator");
    const term = existing ?? vscode.window.createTerminal({ name: "BigAgentCreator", cwd: root });
    term.show();
    term.sendText("docker compose logs -f --tail 100");
  }

  private async probeLm(): Promise<void> {
    this.askOpen = true;
    const select = vscode.lm?.selectChatModels;
    if (!select) {
      this.lmModel = undefined;
      this.lm = lmGate({ hasApi: false, modelCount: 0, replied: false });
      this.render();
      return;
    }
    try {
      const models = await select({});
      this.lmModel = models[0];
      if (!models.length) {
        this.lm = lmGate({ hasApi: true, modelCount: 0, replied: false });
        this.render();
        return;
      }
      const text = await this.askModel("Reply with the single word ready.", models[0]);
      this.lm = lmGate({ hasApi: true, modelCount: models.length, replied: text.trim().length > 0 });
    } catch {
      this.lmModel = undefined;
      this.lm = { ok: false, reason: "The editor model did not answer. Test again." };
    }
    this.render();
  }

  private async askLm(root: string, question: string): Promise<void> {
    const text = question.trim().slice(0, 2000);
    if (!text || !this.lm.ok || !this.lmModel) return;
    this.askOpen = true;
    this.ask = [...this.ask, { role: "you", text }].slice(-12);
    const project = loadProject(root);
    const missing = cardNeeds(project).flatMap((row) => row.missing);
    const cards = [project.think ? project.name : "", ...project.items.map((item) => `${item.kind}:${item.name}`)].filter(Boolean);
    const prompt = [
      "You help finish an agent designed on a canvas. Answer in the same language as the question. Name the card and what to set. Do not invent a secret value.",
      `Cards: ${cards.join(", ")}`,
      missing.length ? `Missing:\n${missing.join("\n")}` : "The cards have the minimum configuration.",
      `Question: ${text}`,
    ].join("\n\n");
    try {
      const answer = (await this.askModel(prompt, this.lmModel)).trim();
      this.ask = [...this.ask, { role: "guide", text: answer || "The editor model returned an empty answer." }].slice(-12);
    } catch {
      this.lmModel = undefined;
      this.lm = { ok: false, reason: "The editor model did not answer. Test again." };
    }
    this.render();
  }

  private async askModel(prompt: string, model: vscode.LanguageModelChat): Promise<string> {
    const token = new vscode.CancellationTokenSource();
    const timer = setTimeout(() => token.cancel(), 20000);
    try {
      const response = await model.sendRequest([vscode.LanguageModelChatMessage.User(prompt)], {}, token.token);
      let text = "";
      for await (const chunk of response.text) {
        text += chunk;
        if (text.length > 4000) break;
      }
      return text;
    } finally {
      clearTimeout(timer);
      token.dispose();
    }
  }

  private render(notice?: string, saved = false): void {
    if (notice !== undefined) this.holdNotice = notice;
    if (saved) this.pulseAt = Date.now();
    const root = folder();
    if (root && this.panel) this.follow(root);
    const savedUi = readUi(this.context);
    const lang = savedUi.lang === "es" ? "es" : "en";
    const ui = { ...savedUi, notice: phrase(lang, this.holdNotice), helpOpen: this.helpOpen, askOpen: this.askOpen, lm: this.lm, ask: this.ask, secretFocus: this.secretFocus };
    this.helpOpen = false;
    const project = root && isProject(root) ? loadProject(root) : null;
    const scan = root ? scanWorkspace(root) : undefined;
    const suggested = root ? path.basename(root) : "";
    const layout = project ? arrange(project, readLayout(project.root)) : undefined;
    const home = project ? arrange(project, { positions: {}, zoom: 1, pan: { x: 24, y: 16 }, look: "clear" }) : undefined;
    const studio = project ? readStudio(project.root) : undefined;
    const pulse = saved || Date.now() - this.pulseAt < 700;
    if (this.view) {
      this.view.title = t(lang, "designer");
      this.view.webview.html = libraryHtml(project, ui, Boolean(root));
    }
    if (this.panel) this.panel.webview.html = designerHtml(project, ui, Boolean(root), scan, suggested, layout, home, pulse, studio, this.ship);
  }

  private async onMessage(message: {
    type?: string;
    name?: string;
    kind?: Kind | "think" | "limits";
    detail?: string;
    x?: number;
    y?: number;
    from?: string;
    to?: string;
    mode?: Ui["mode"];
    id?: string;
    libraryOpen?: boolean;
    inspectorOpen?: boolean;
    libraryWidth?: number;
    inspectorWidth?: number;
    focus?: boolean;
    positions?: Record<string, { x: number; y: number }>;
    zoom?: number;
    pan?: { x: number; y: number };
    look?: "soft" | "clear" | "contrast";
    text?: string;
    description?: string;
    body?: string;
    effect?: string;
    execution?: string;
    transport?: string;
    command?: string;
    advertise?: boolean;
    effort?: string;
    fast?: boolean;
    sandbox?: boolean;
    reminders?: boolean;
    harness?: string[] | null;
    maxRunningTurns?: number | null;
    egress?: string[];
    verify?: boolean;
    url?: string;
    phone?: string;
    route?: string;
    repo?: string;
    secret?: string;
    calls?: string;
    check?: string;
    create?: string;
    task?: string;
    path?: string;
    model?: string;
    parameters?: { name: string; type: string; required: boolean; description: string }[];
    value?: string;
    lang?: "en" | "es";
    helpOpen?: boolean;
  }): Promise<void> {
    const root = folder();
    const ui = readUi(this.context);
    try {
      if (message.type === "open") {
        this.openDesigner();
        return;
      }
      if (message.type === "lang" && (message.lang === "en" || message.lang === "es")) {
        this.helpOpen = Boolean(message.helpOpen);
        await writeUi(this.context, { ...ui, lang: message.lang });
        this.render();
        return;
      }
      if ((message.type === "undo" || message.type === "redo") && root && isProject(root)) {
        const stack = message.type === "undo" ? this.past : this.future;
        const other = message.type === "undo" ? this.future : this.past;
        const shot = stack.pop();
        if (!shot) {
          this.panel?.webview.postMessage({ type: "hint", text: phrase(ui.lang, message.type === "undo" ? "Nothing to undo" : "Nothing to redo") });
          return;
        }
        other.push(captureFolder(root));
        restoreFolder(root, shot);
        this.render("", true);
        return;
      }
      if (message.type === "open-file" && root && message.path) {
        const rel = safeRelative(message.path);
        if (!rel) return;
        const created = message.create ? ensureStudioFile(root, message.create) : undefined;
        const target = created || rel;
        const abs = path.join(root, target);
        const uri = vscode.Uri.file(abs);
        if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
          if (!fs.existsSync(abs)) fs.mkdirSync(abs, { recursive: true });
          await vscode.commands.executeCommand("revealInExplorer", uri);
        } else {
          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preview: false });
        }
        this.render("");
        return;
      }
      if (message.type === "eval-add" && root && isProject(root) && message.name) {
        const rel = writeEvalCase(root, message.name, message.text || "", message.check || "lookup");
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(root, rel)));
        await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.Beside, preview: false });
        this.render("", true);
        return;
      }
      if (message.type === "task" && root) {
        const existing = vscode.window.terminals.find((term) => term.name === "BigAgentCreator");
        const term = existing ?? vscode.window.createTerminal({ name: "BigAgentCreator", cwd: root });
        term.show();
        term.sendText(message.task === "eval" ? "agent-sdk eval --dir ." : "agent-sdk validate --dir .");
        return;
      }
      if (message.type === "drop" && root && isProject(root) && (message.kind === "think" || message.kind === "limits")) {
        const project = loadProject(root);
        const present = message.kind === "think" ? project.think : project.limits;
        if (present) {
          this.panel?.webview.postMessage({ type: "hint", text: message.kind === "think" ? "This folder already has Agent. Delegate with a Subagent." : "Limits is already on the canvas." });
          return;
        }
        this.remember(root);
        setCanvasNode(root, message.kind, true);
        const layout = readLayout(root);
        const id = message.kind === "think" ? "agent" : "scope";
        layout.positions[id] = { x: Math.min(4000, Math.max(0, Math.round(message.x || 48))), y: Math.min(4000, Math.max(0, Math.round(message.y || 48))) };
        writeLayout(root, layout);
        await writeUi(this.context, { ...ui, selected: id, notice: "" });
        this.render("", true);
        return;
      }
      if (message.type === "drop" && root && isProject(root) && message.kind) {
        this.remember(root);
        const before = loadProject(root);
        const layout = readLayout(root);
        const links = layout.links ?? flowLinks(before, layout);
        const name = freshName(root, message.kind as Kind);
        saveItem(root, {
          kind: message.kind,
          name,
          description: message.kind === "channel" ? "webhook" : "",
          body: "",
          effect: "read",
          verify: message.kind === "channel",
          url: "",
        });
        layout.positions[`${message.kind}:${name}`] = {
          x: Math.min(4000, Math.max(0, Math.round(message.x || 48))),
          y: Math.min(4000, Math.max(0, Math.round(message.y || 48))),
        };
        writeLayout(root, { ...layout, links });
        await writeUi(this.context, { ...ui, selected: `${message.kind}:${name}`, notice: "" });
        this.render("", true);
        return;
      }
      if (message.type === "link" && root && isProject(root) && message.from && message.to) {
        this.remember(root);
        const project = loadProject(root);
        const layout = readLayout(root);
        writeLayout(root, { ...layout, links: toggleLink(project, layout, message.from, message.to) });
        this.render("", true);
        return;
      }
      if (message.type === "layout" && root && isProject(root)) {
        const current = readLayout(root);
        const incoming = message.positions || {};
        if (positionsDiffer(current.positions, incoming)) this.remember(root);
        writeLayout(root, {
          positions: incoming,
          zoom: message.zoom ?? 1,
          pan: message.pan || { x: 24, y: 16 },
          look: message.look === "soft" || message.look === "contrast" ? message.look : "clear",
        });
        this.saved();
        return;
      }
      if (message.type === "chrome") {
        const width = (value: number | undefined, current: number) =>
          typeof value === "number" ? Math.min(480, Math.max(200, Math.round(value))) : current;
        await writeUi(this.context, {
          ...ui,
          notice: "",
          libraryOpen: typeof message.libraryOpen === "boolean" ? message.libraryOpen : ui.libraryOpen,
          inspectorOpen: typeof message.inspectorOpen === "boolean" ? message.inspectorOpen : ui.inspectorOpen,
          libraryWidth: width(message.libraryWidth, ui.libraryWidth),
          inspectorWidth: width(message.inspectorWidth, ui.inspectorWidth),
        });
        if (message.focus) {
          this.openDesigner();
          void vscode.commands.executeCommand("workbench.action.closeSidebar");
        } else this.render();
        return;
      }
      if (message.type === "open-guide") {
        await vscode.env.openExternal(vscode.Uri.parse(ui.lang === "es" ? GUIDE_URL_ES : GUIDE_URL));
        return;
      }
      if (message.type === "create" && root) {
        if (isExtensionRoot(root)) {
          this.render("Open the agent folder. This one is the extension.");
          return;
        }
        initWorkspace(root, message.name || "agent");
        await writeUi(this.context, { ...ui, mode: "flow", selected: "agent", notice: "" });
        this.render("", true);
        return;
      }
      if (message.type === "create-example" && root && message.id && EXAMPLES.some((example) => example.id === message.id)) {
        if (isExtensionRoot(root)) {
          this.render("Open the agent folder. This one is the extension.");
          return;
        }
        try {
          const loaded = loadExample(path.join(this.examplesRoot(), message.id), root);
          const card = EXAMPLES.find((example) => example.id === message.id);
          const kept = loaded.keptFresh ? "This folder was kept in .keep/original." : ".keep/original was already there and was not replaced.";
          const env = loaded.keptEnv ? " Your .env stayed." : "";
          await writeUi(this.context, { ...ui, mode: "flow", selected: "agent", notice: "" });
          this.render(`Loaded ${card?.title || message.id}. ${kept}${env}`, true);
        } catch (error) {
          this.render(error instanceof Error ? error.message : "That example is not in this extension.");
        }
        return;
      }
      if (message.type === "ask-open") {
        this.askOpen = !this.askOpen;
        this.render();
        return;
      }
      if (message.type === "lm-test") {
        await this.probeLm();
        return;
      }
      if (message.type === "lm-ask" && root && isProject(root)) {
        await this.askLm(root, String(message.text || ""));
        return;
      }
      if (message.type === "repair" && root && isProject(root)) {
        this.remember(root);
        initWorkspace(root, loadProject(root).name);
        this.render("", true);
        return;
      }
      if (message.type === "mode" && message.mode === "examples" && root) {
        await writeUi(this.context, { ...ui, mode: "examples", notice: "" });
        this.render("");
        return;
      }
      if (message.type === "keep-folder" && root) {
        const kept = keepWorkspace(root);
        this.render(kept.fresh ? "Kept this folder in .keep/original." : "This folder was already kept. Restore brings that copy back.");
        return;
      }
      if (message.type === "restore-folder" && root) {
        restoreWorkspace(root);
        await writeUi(this.context, { ...ui, mode: "flow", selected: "agent", notice: "" });
        this.render("Restored the kept folder.", true);
        return;
      }
      if (message.type === "load-example" && root && message.id && EXAMPLES.some((example) => example.id === message.id)) {
        if (isExtensionRoot(root)) {
          this.render("Open the agent folder. This one is the extension.");
          return;
        }
        const source = path.join(this.examplesRoot(), message.id);
        const loaded = loadExample(source, root);
        const card = EXAMPLES.find((example) => example.id === message.id);
        const kept = loaded.keptFresh ? "This folder was kept in .keep/original." : ".keep/original was already there and was not replaced.";
        const env = loaded.keptEnv ? " Your .env stayed." : "";
        await writeUi(this.context, { ...ui, mode: "flow", selected: "agent", notice: "" });
        this.render(`Loaded ${card?.title || message.id}. ${kept}${env}`, true);
        return;
      }
      if (!root || !isProject(root)) return;
      if (message.type === "open-secret" && message.name) {
        this.secretFocus = String(message.name);
        await writeUi(this.context, { ...ui, mode: "secrets", notice: "" });
        this.render();
        return;
      }
      if (message.type === "mode" && message.mode) {
        await writeUi(this.context, { ...ui, mode: message.mode, notice: "" });
        this.render("");
        if (message.mode === "deploy" || message.mode === "connect") void this.refreshShip(root);
        return;
      }
      if (message.type === "select" && message.id) {
        await writeUi(this.context, { ...ui, mode: "flow", selected: message.id, notice: "" });
        if (!this.panel) this.openDesigner();
        else {
          this.panel.reveal(vscode.ViewColumn.Active);
          this.render("");
        }
        return;
      }
      if (message.type === "ship") {
        if (message.task === "refresh") {
          this.shipGen += 1;
          this.shipProc?.kill();
          this.ship = { ...this.ship, phase: "idle" };
          await this.refreshShip(root);
        }
        else if (message.task === "follow") this.followLogs(root);
        else if (message.task === "playground") await vscode.env.openExternal(vscode.Uri.parse("http://127.0.0.1:3000/playground"));
        else if (message.task === "start") await this.compose(root, this.ship.republish ? ["compose", "up", "--build", "-d", "--force-recreate"] : ["compose", "up", "--build", "-d"], "building");
        else if (message.task === "rebuild") await this.compose(root, ["compose", "up", "--build", "-d", "--force-recreate"], "rebuilding");
        else if (message.task === "stop") await this.compose(root, ["compose", "down"], "stopping");
        else if (message.task === "tunnel") await this.openTunnel();
        else if (message.task === "webhook") await this.registerWebhook(root, message.url || this.ship.publicUrl);
        else if (message.task === "whatsapp-check") await this.checkWhatsApp(root);
        else if (message.task === "whatsapp-send") await this.sendWhatsAppTest(root, message.phone || "");
        else if (message.task === "slack-check") await this.checkSlack(root);
        return;
      }
      if (message.type === "instructions") {
        this.remember(root);
        saveInstructions(root, message.text || "");
        saveAgentSettings(root, {
          model: message.model || "auto",
          effort: message.effort,
          fast: message.fast,
          sandbox: message.sandbox,
          reminders: message.reminders,
          harness: message.harness,
          maxRunningTurns: message.maxRunningTurns,
          egress: message.egress,
        });
        this.render("", true);
        return;
      }
      if (message.type === "scope") {
        this.remember(root);
        saveScope(root, message.text || "");
        await writeUi(this.context, { ...ui, selected: "scope", notice: "" });
        this.render("", true);
        return;
      }
      if (message.type === "add" && message.kind && message.name) {
        this.remember(root);
        const name = slug(message.name);
        saveItem(root, {
          kind: message.kind,
          name,
          description: message.kind === "skill" ? message.detail || "" : message.kind === "channel" ? "webhook" : message.kind === "mcp" ? "" : message.detail || "",
          body: message.kind === "channel" ? message.detail || "" : "",
          url: message.kind === "mcp" ? message.detail || "" : "",
          effect: "read",
          verify: message.kind === "channel",
        });
        await writeUi(this.context, { ...ui, selected: `${message.kind}:${name}`, notice: "" });
        this.render("", true);
        return;
      }
      if (message.type === "copy" && message.id) {
        const [kind, name] = message.id.split(":") as [Kind, string];
        const item = loadProject(root).items.find((entry) => entry.kind === kind && entry.name === name);
        if (!item) return;
        this.clip = { ...item, parameters: item.parameters?.map((row) => ({ ...row })) };
        this.panel?.webview.postMessage({ type: "hint", text: "Copied" });
        return;
      }
      if ((message.type === "duplicate" || message.type === "paste") && (message.type === "paste" || message.id)) {
        const source =
          message.type === "paste"
            ? this.clip
            : loadProject(root).items.find((entry) => `${entry.kind}:${entry.name}` === message.id);
        if (!source) {
          this.panel?.webview.postMessage({ type: "hint", text: message.type === "paste" ? "Copy a component first" : "Select a component" });
          return;
        }
        this.remember(root);
        const id = this.placeCopy(root, source);
        await writeUi(this.context, { ...ui, selected: id, notice: "" });
        this.render("", true);
        return;
      }
      if (message.type === "save" && message.id) {
        this.remember(root);
        const [kind, name] = message.id.split(":") as [Kind, string];
        const current = loadProject(root).items.find((item) => item.kind === kind && item.name === name);
        saveItem(root, {
          kind,
          name,
          description: message.description || "",
          body: message.body ?? current?.body ?? "",
          effect: message.effect === "write" || message.effect === "irreversible" || message.effect === "idempotent" ? message.effect : current?.effect || "read",
          execution: message.execution === "agent" ? "agent" : current?.execution || "server",
          transport: message.transport === "stdio" || message.transport === "account" ? message.transport : current?.transport || "http",
          command: message.command ?? current?.command ?? "",
          advertise: Boolean(message.advertise),
          verify: Boolean(message.verify),
          url: message.url ?? current?.url ?? "",
          route: message.route ?? current?.route ?? "",
          repo: message.repo ?? current?.repo ?? "",
          secret: message.secret ?? current?.secret ?? "",
          calls: message.calls ?? current?.calls ?? "",
          parameters: message.parameters ?? current?.parameters ?? [],
        });
        this.render("", true);
        return;
      }
      if ((message.id === "scope" || message.id === "agent") && message.type === "delete") {
        this.remember(root);
        setCanvasNode(root, message.id === "agent" ? "think" : "limits", false);
        const layout = readLayout(root);
        writeLayout(root, { ...layout, links: linksExcept(layout.links ?? flowLinks(loadProject(root), layout), message.id) });
        await writeUi(this.context, { ...ui, selected: message.id === "agent" ? "" : "agent", notice: "" });
        this.render("", true);
        return;
      }
      if (message.type === "delete" && message.id?.includes(":")) {
        this.remember(root);
        const [kind, name] = message.id.split(":") as [Kind, string];
        const before = loadProject(root);
        const layout = readLayout(root);
        const links = linksExcept(layout.links ?? flowLinks(before, layout), message.id);
        deleteItem(root, kind, name);
        const positions = { ...layout.positions };
        delete positions[message.id];
        writeLayout(root, { ...layout, positions, links });
        await writeUi(this.context, { ...ui, selected: "agent", notice: "" });
        this.render("", true);
        return;
      }
      if (message.type === "secret") {
        setSecret(root, message.name || "", message.value || "");
        if (this.secretFocus === String(message.name || "")) this.secretFocus = "";
        this.holdNotice = "Saved. Rebuild in Ship so the running agent reads it. The value stays in .env, not in the image.";
        this.render("", true);
        return;
      }
      if (message.type === "docker") {
        writeDocker(root);
        this.render("", true);
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "Could not write the folder.";
      const file = path.join(root || "", ".bigagent", "errors.json");
      if (root && isProject(root)) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const prior = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as unknown) : [];
        const rows = Array.isArray(prior) ? prior : [];
        rows.push({ at: new Date().toISOString(), message: text.slice(0, 500) });
        fs.writeFileSync(file, JSON.stringify(rows.slice(-100), null, 2), "utf8");
      }
      this.render(text);
    }
  }
}

export function deactivate(): void {}
