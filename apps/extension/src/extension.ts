import * as vscode from "vscode";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { designerHtml, libraryHtml, shipFace, type ShipStatus, type Ui } from "./designer";
import { phrase, t } from "./copy";
import {
  arrange,
  captureFolder,
  deleteItem,
  deliveryCheck,
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
  applyProposal,
  assistantContext,
  chatHandoff,
  cloudRunArgs,
  cloudRunPlan,
  cloudRunRuntimeAccount,
  secretAccessorArgs,
  composeImageId,
  gcpChecks,
  gcpPreview,
  shortImage,
  cloudRunImageMatch,
  serviceMissing,
  parseServiceRelease,
  releasedImage,
  secretSyncPlan,
  hasPublicChannel,
  parseGcpLink,
  redactValues,
  readGcpLink,
  writeGcpLink,
  computerLocale,
  languageChoice,
  proposalLabel,
  readProposal,
  replyWithoutProposal,
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
  webhookNeedsLocal,
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
  imageName,
  parseImageId,
  portHolder,
  consoleCommand,
  consoleAppend,
  pushProgress,
  windowsShell,
  pickGcloud,
  agentSignal,
  channelBars,
  monitorFacts,
  monitorFilter,
  parseLogEntries,
  commandFailure,
  readCommandLog,
  formatCommand,
  readImagePin,
  shipArgs,
  writeDocker,
  writeImagePin,
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
    lang: languageChoice(saved?.lang, computerLocale()),
    shipTarget: saved?.shipTarget === "gcp" || saved?.shipTarget === "aws" || saved?.shipTarget === "azure" ? saved.shipTarget : "local",
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
  private lm: { ok: boolean; reason: string; models: { id: string; name: string }[]; modelId: string } = { ok: true, reason: "Write a question. Sending uses the model you picked.", models: [], modelId: "" };
  private lmModel: vscode.LanguageModelChat | undefined;
  private ask: { role: "you" | "guide"; text: string; proposal?: import("./project").Proposal; applied?: boolean }[] = [];
  private askOpen = false;
  private secretFocus = "";
  private shipProc?: ChildProcess;
  private logProc?: ChildProcess;
  private statsTimer?: ReturnType<typeof setInterval>;
  private tunnelProc?: ChildProcess;
  private shipGen = 0;
  private gcpNote = "";
  private gcpVerdict: { text: string; step: "current" | "other" | "unknown"; image: string } | null = null;
  private gcpTrail: string[] = [];
  private gcloudExe = "";

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
        this.stopLogFollow();
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

  private showConsole(text: string): void {
    this.shipNote(this.shipGen, text);
  }

  private noteChannel(channel: string, line: string): void {
    const lang = readUi(this.context).lang === "es" ? "es" : "en";
    const spoken = phrase(lang, line);
    const prev = this.ship.channelLogs?.[channel] || "";
    const text = `${prev}${prev && !prev.endsWith("\n") ? "\n" : ""}${spoken}\n`.slice(-8000);
    this.ship = { ...this.ship, summary: spoken, channelLogs: { ...(this.ship.channelLogs || {}), [channel]: text } };
    this.panel?.webview.postMessage({ type: "connect-log", channel, text, status: spoken });
  }

  private docker(root: string, args: string[], onChunk?: (text: string) => void, track = false, timeoutMs = 20000, visible = false, redact: (text: string) => string = (text) => text): Promise<number> {
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
      if (visible) this.showConsole(redact(formatCommand("docker", args)));
      try {
        child = spawn("docker", args, { cwd: root, windowsHide: true, shell: process.platform === "win32" });
      } catch (error) {
        const message = error instanceof Error ? `${error.message}\n` : "Could not start Docker.\n";
        onChunk?.(message);
        if (visible) this.showConsole(redact(message));
        finish(1);
        return;
      }
      if (track) this.shipProc = child;
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          onChunk?.("Docker did not answer in time.\n");
          if (visible) this.showConsole("Docker did not answer in time.\n");
          if (child?.pid && process.platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true });
          else child?.kill();
          finish(1);
        }, timeoutMs);
      }
      const take = (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        onChunk?.(text);
        if (visible) this.showConsole(redact(text));
      };
      child.stdout?.on("data", take);
      child.stderr?.on("data", take);
      child.on("error", (error) => {
        const message = `${error.message}\n`;
        onChunk?.(message);
        if (visible) this.showConsole(redact(message));
        finish(1);
      });
      child.on("close", (code) => {
        const exit = code ?? 1;
        if (visible && exit !== 0) this.showConsole(`exit ${exit}`);
        finish(exit);
      });
    });
  }

  private shipNote(gen: number, text: string): void {
    if (gen !== this.shipGen) return;
    const lang = readUi(this.context).lang === "es" ? "es" : "en";
    const folded = consoleAppend(this.ship.logs, text).slice(-20000);
    const open = folded.endsWith("\r");
    const body = open ? folded.slice(0, -1) : folded;
    const spoken = body.split("\n").map((line) => /^[0-9a-f]{12}: /.test(line) || line.startsWith("$ ") ? line : phrase(lang, line)).join("\n");
    this.ship = { ...this.ship, logs: spoken + (open ? "\r" : "") };
    this.panel?.webview.postMessage({ type: "ship-log", text: spoken, replace: true });
  }

  private daemonDown(text: string): boolean {
    return /dockerDesktopLinuxEngine|Cannot connect to the Docker daemon|error during connect|cannot find the file specified/i.test(text);
  }

  private paintShip(includeLogs = true): void {
    const lang = readUi(this.context).lang === "es" ? "es" : "en";
    const root = folder();
    const pin = root && isProject(root) ? readImagePin(root) : null;
    if (pin) this.ship = { ...this.ship, image: pin };
    const blocked = root && isProject(root) ? deliveryCheck(root).length > 0 : false;
    const face = shipFace(this.ship, lang, blocked);
    const logs = includeLogs ? this.ship.logs.split(/\n/).map((line) => phrase(lang, line)).join("\n") : undefined;
    this.panel?.webview.postMessage(includeLogs ? { type: "ship-face", face, logs } : { type: "ship-face", face });
  }

  private stopLogFollow(): void {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = undefined;
    }
    const proc = this.logProc;
    this.logProc = undefined;
    if (!proc) return;
    if (process.platform === "win32" && proc.pid) spawn("taskkill", ["/pid", String(proc.pid), "/t", "/f"], { windowsHide: true });
    else proc.kill();
  }

  private startLogFollow(root: string, tail: "0" | "200"): void {
    this.stopLogFollow();
    const gen = this.shipGen;
    const names = loadProject(root).secrets.map((row) => row.name);
    this.showConsole(formatCommand("docker", ["compose", "logs", "-f", "--tail", tail, "--no-color"]));
    const child = spawn("docker", ["compose", "logs", "-f", "--tail", tail, "--no-color"], { cwd: root, windowsHide: true, shell: process.platform === "win32" });
    this.logProc = child;
    const take = (chunk: Buffer) => {
      if (gen !== this.shipGen || this.logProc !== child) return;
      const clean = scrubLogs(chunk.toString("utf8"), names);
      if (!clean.trim() && !clean.includes("\r")) return;
      this.shipNote(gen, clean);
    };
    child.stdout?.on("data", take);
    child.stderr?.on("data", take);
    child.on("close", () => {
      if (this.logProc === child) this.logProc = undefined;
    });
    this.statsTimer = setInterval(() => {
      if (gen !== this.shipGen || !this.ship.running) return;
      void this.localStats(root).then((stats) => {
        if (gen !== this.shipGen) return;
        this.ship = { ...this.ship, stats };
        if (readUi(this.context).mode === "deploy") this.paintShip(false);
      });
    }, 8000);
  }

  private showShip(): void {
    if (readUi(this.context).mode === "deploy") this.paintShip();
    else this.render();
  }

  private async refreshShip(root: string): Promise<void> {
    this.stopLogFollow();
    const gen = this.shipGen;
    const wasStart = this.ship.phase === "building" || this.ship.phase === "rebuilding";
    try {
    if (this.ship.phase === "idle" || this.ship.phase === "checking") {
      this.ship = { ...this.ship, phase: "checking", summary: "Checking Docker on this machine.", logs: `${this.ship.logs}Checking Docker on this machine.\n`.slice(-12000) };
      this.showShip();
    }
    const names = loadProject(root).secrets.map((row) => row.name);
    const scrub = (text: string) => scrubLogs(text, names);
    let info = "";
    const infoCode = await this.docker(root, ["info", "--format", "{{.ServerVersion}}"], (text) => {
      info += text;
    }, false, 12000, true, scrub);
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
      this.showShip();
      return;
    }
    let ps = "";
    const psCode = await this.docker(root, ["compose", "ps", "--format", "json"], (text) => {
      ps += text;
    }, false, 12000, true, scrub);
    if (gen !== this.shipGen) return;
    if (psCode !== 0 || this.daemonDown(ps)) {
      this.ship = {
        docker: "down",
        running: false,
        failed: false,
        phase: "idle",
        dockerWhy: "down",
        summary: DOCKER_DOWN,
        logs: this.ship.logs,
        publicUrl: this.ship.publicUrl,
        stats: { cpu: "—", memory: "—", healthMs: null },
      };
      this.showShip();
      return;
    }
    let logs = "";
    await this.docker(root, ["compose", "logs", "--tail", "200", "-t", "--no-color"], (text) => {
      logs += text;
    }, false, 12000, true, scrub);
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
      logs: this.ship.logs,
      publicUrl: this.ship.publicUrl,
      stats,
    };
    this.showShip();
    const found = await this.localImageId(root);
    if (gen === this.shipGen && found) this.publishGcpFace(root, found);
    if (this.ship.running) this.startLogFollow(root, clean.trim() ? "0" : "200");
    else this.stopLogFollow();
    } catch (error) {
      if (gen !== this.shipGen) return;
      const message = error instanceof Error ? error.message : "The check stopped.";
      this.ship = { ...this.ship, phase: "idle", failed: true, running: false, summary: message, logs: `${this.ship.logs}${message}\n`.slice(-8000) };
      this.showShip();
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
    this.stopLogFollow();
    this.shipProc?.kill();
    const names = loadProject(root).secrets.map((row) => row.name);
    this.ship = {
      ...this.ship,
      phase,
      summary: phase === "rebuilding" ? "Rebuilding the image and recreating the container so it reads the current secrets." : phase === "building" ? "Building the local image. The log shows each step." : "Stopping the local agent.",
      logs: phase === "building" ? "Building the local image. The log shows each step.\n" : phase === "rebuilding" ? "Rebuilding the image and recreating the container so it reads the current secrets.\n" : "Stopping the local agent.\n",
    };
    this.showShip();
    const code = await this.docker(root, args, undefined, true, 0, true, (text) => scrubLogs(text, names));
    if (gen !== this.shipGen) return;
    if (code !== 0 || this.daemonDown(this.ship.logs)) {
      const why = dockerProblem(this.ship.logs);
      const down = why === "down" || this.daemonDown(this.ship.logs);
      const missing = why === "missing";
      let owners = "";
      if (/port is already allocated|address already in use/i.test(this.ship.logs)) {
        await this.docker(root, ["ps", "--format", "{{.Names}} {{.Ports}}"], (text) => {
          owners += text;
        }, false, 12000, true, (text) => scrubLogs(text, names));
      }
      const taken = portHolder(this.ship.logs, owners);
      this.ship = {
        ...this.ship,
        docker: missing || down ? "down" : this.ship.docker,
        dockerWhy: missing ? "missing" : down ? "down" : this.ship.dockerWhy,
        running: false,
        failed: !missing && !down,
        phase: "idle",
        summary: taken
          ? taken
          : missing
          ? DOCKER_MISSING
          : down
            ? DOCKER_DOWN
            : phase === "building"
              ? "The build stopped. Read the log."
              : phase === "rebuilding"
                ? "Rebuild did not finish. Read the log."
                : "Stop did not finish. Read the log.",
      };
      this.showShip();
      return;
    }
    if (args.includes("--build")) await this.rememberImage(root);
    await this.refreshShip(root);
  }

  private async localImageId(root: string): Promise<string | null> {
    let listed = "";
    const listedCode = await this.docker(root, ["compose", "images", "--format", "json"], (text) => {
      listed += text;
    }, false, 12000);
    const fromCompose = listedCode === 0 ? composeImageId(listed) : null;
    if (fromCompose) {
      writeImagePin(root, fromCompose);
      return fromCompose;
    }
    const pinned = readImagePin(root);
    if (pinned) return pinned;
    let text = "";
    const named = imageName(loadProject(root).name);
    const code = await this.docker(root, ["image", "inspect", "--format", "{{.Id}}", named], (chunk) => {
      text += chunk;
    }, false, 12000);
    const id = parseImageId(text);
    if (code !== 0 || !id) return null;
    writeImagePin(root, id);
    return id;
  }

  private publishGcpFace(root: string, imageId: string): void {
    const lang = readUi(this.context).lang === "es" ? "es" : "en";
    const project = loadProject(root);
    const link = readGcpLink(root);
    const preview = gcpPreview({ agentName: project.name, imageId, project: link.project, region: link.region, url: link.url });
    const label = preview.state === "published" ? t(lang, "gcp_published") : preview.state === "need-image" ? t(lang, "gcp_need_image") : t(lang, "gcp_ready");
    const checks = gcpChecks({
      imageId,
      project: link.project,
      region: link.region,
      secrets: project.secrets.map((row) => ({ name: row.name, configured: row.configured })),
    }).map((row) => ({ ok: row.ok, text: phrase(lang, row.text) }));
    this.panel?.webview.postMessage({
      type: "gcp-image",
      image: preview.image,
      target: preview.target,
      summary: phrase(lang, preview.summary),
      label,
      checks,
    });
  }

  private async rememberImage(root: string): Promise<void> {
    const name = imageName(loadProject(root).name);
    let text = "";
    const code = await this.docker(root, ["image", "inspect", "--format", "{{.Id}}", name], (chunk) => {
      text += chunk;
    }, false, 12000, true);
    const id = parseImageId(text);
    if (code !== 0 || !id) return;
    writeImagePin(root, id);
    writeDocker(root, true);
    this.ship = { ...this.ship, image: id };
  }

  private async openTunnel(): Promise<void> {
    const gen = ++this.shipGen;
    this.tunnelProc?.kill();
    this.ship = { ...this.ship, phase: "tunnel", summary: "Opening a Cloudflare tunnel to port 3000." };
    this.render();
    let child: ChildProcess;
    try {
      this.showConsole(formatCommand("cloudflared", ["tunnel", "--url", "http://127.0.0.1:3000"]));
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
        const text = chunk.toString("utf8");
        buffer += text;
        this.showConsole(text);
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
      this.noteChannel("telegram", target.error);
      this.ship = { ...this.ship, phase: "idle", publicUrl: publicBase.trim(), summary: target.error };
      this.render();
      return;
    }
    if (webhookNeedsLocal(target.hook)) {
      if (!this.ship.running) {
        const summary = "Start the local agent first. This address calls this machine.";
        this.noteChannel("telegram", summary);
        this.ship = { ...this.ship, phase: "idle", publicUrl: publicBase.trim(), summary };
        this.render();
        return;
      }
    this.ship = { ...this.ship, phase: "webhook", publicUrl: publicBase.trim(), summary: "Restarting the agent so it reads the current secrets." };
    this.render();
    let restart = "";
    const code = await this.docker(root, ["compose", "up", "-d", "--force-recreate"], (text) => {
      restart += text;
    }, false, 0, true, (text) => scrubLogs(text, names));
    if (gen !== this.shipGen) return;
    if (code !== 0 || this.daemonDown(restart)) {
      this.ship = {
        ...this.ship,
        phase: "idle",
        docker: this.daemonDown(restart) ? "down" : this.ship.docker,
        summary: this.daemonDown(restart) ? "Docker Desktop is not running. Open it, then Register webhook again." : "The agent did not restart. Read the log, then Register webhook again.",
        logs: this.ship.logs,
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
    }
    this.ship = { ...this.ship, phase: "webhook", publicUrl: publicBase.trim(), summary: `Telling Telegram to call ${target.hook}.` };
    this.noteChannel("telegram", `Telling Telegram to call ${target.hook}.`);
    this.render();
    let summary = "Telegram did not answer. Register webhook again.";
    try {
      const response = await fetch(target.endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: target.body });
      const payload = (await response.json()) as { ok?: boolean; description?: string };
      summary = payload.ok
        ? `Webhook registered. Telegram will call ${target.hook}.`
        : `Telegram refused the webhook: ${payload.description || response.status}.`;
    } catch {
      summary = "Could not reach Telegram. Check the network, then Register webhook again.";
    }
    this.noteChannel("telegram", summary);
    if (gen !== this.shipGen) return;
    this.ship = { ...this.ship, phase: "idle", running: webhookNeedsLocal(target.hook) ? true : this.ship.running, docker: webhookNeedsLocal(target.hook) ? "ready" : this.ship.docker, summary: scrubLogs(summary, names) };
    this.render();
  }

  private async checkWhatsApp(root: string): Promise<void> {
    const names = loadProject(root).secrets.map((row) => row.name);
    const target = whatsappCheckTarget(secretValue(root, "WHATSAPP_TOKEN"), secretValue(root, "WHATSAPP_PHONE_NUMBER_ID"));
    if ("error" in target) {
      this.noteChannel("whatsapp", target.error);
      this.ship = { ...this.ship, phase: "idle", summary: target.error };
      this.render();
      return;
    }
    this.noteChannel("whatsapp", "Asking Meta whether this token matches the phone number ID.");
    this.ship = { ...this.ship, phase: "checking", summary: "Asking Meta whether this token matches the phone number ID." };
    this.render();
    let summary = "Could not reach Meta. Check the network, then try again.";
    try {
      const response = await fetch(target.endpoint, { headers: { authorization: target.authorization } });
      summary = response.ok ? "WhatsApp answered for this phone number ID." : `Meta refused the check (${response.status}). The token and the phone number ID have to belong to the same app.`;
    } catch {
      summary = "Could not reach Meta. Check the network, then try again.";
    }
    this.noteChannel("whatsapp", summary);
    this.ship = { ...this.ship, phase: "idle", summary: scrubLogs(summary, names) };
    this.render();
  }

  private async sendWhatsAppTest(root: string, to: string): Promise<void> {
    const names = loadProject(root).secrets.map((row) => row.name);
    const target = whatsappSendTarget(secretValue(root, "WHATSAPP_TOKEN"), secretValue(root, "WHATSAPP_PHONE_NUMBER_ID"), to);
    if ("error" in target) {
      this.noteChannel("whatsapp", target.error);
      this.ship = { ...this.ship, phase: "idle", summary: target.error };
      this.render();
      return;
    }
    this.noteChannel("whatsapp", "Sending hello through WhatsApp.");
    this.ship = { ...this.ship, phase: "checking", summary: "Sending hello through WhatsApp." };
    this.render();
    let summary = "Could not reach Meta. Check the network, then try again.";
    try {
      const response = await fetch(target.endpoint, { method: "POST", headers: { authorization: target.authorization, "content-type": "application/json" }, body: target.body });
      summary = response.ok ? "Sent hello. Open WhatsApp on that number." : `Meta refused the message (${response.status}). The number needs the country code, and the token has to be allowed to send.`;
    } catch {
      summary = "Could not reach Meta. Check the network, then try again.";
    }
    this.noteChannel("whatsapp", summary);
    this.ship = { ...this.ship, phase: "idle", summary: scrubLogs(summary, names) };
    this.render();
  }

  private async checkSlack(root: string): Promise<void> {
    const names = loadProject(root).secrets.map((row) => row.name);
    const target = slackCheckTarget(secretValue(root, "SLACK_BOT_TOKEN"));
    if ("error" in target) {
      this.noteChannel("slack", target.error);
      this.ship = { ...this.ship, phase: "idle", summary: target.error };
      this.render();
      return;
    }
    this.noteChannel("slack", "Asking Slack who this bot is.");
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
    this.noteChannel("slack", summary);
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
    const term = this.editorTerminal(root);
    this.showConsole(formatCommand("docker", ["compose", "logs", "-f", "--tail", "100"]));
    term.sendText("docker compose logs -f --tail 100");
  }

  private editorTerminal(root: string): vscode.Terminal {
    const existing = vscode.window.terminals.find((term) => term.name === "BigAgentCreator" && !term.exitStatus);
    const term = existing ?? vscode.window.createTerminal({
      name: "BigAgentCreator",
      cwd: root,
      shellPath: process.platform === "win32" ? "powershell.exe" : undefined,
    });
    term.show();
    return term;
  }

  private cli(root: string, command: string, args: string[], onChunk: (text: string) => void, timeoutMs = 0, redact: (text: string) => string = (text) => text): Promise<number> {
    return new Promise((resolve) => {
      void (async () => {
      let settled = false;
      const finish = (code: number) => {
        if (settled) return;
        settled = true;
        resolve(code);
      };
      const shown = consoleCommand(command, args);
      this.showConsole(redact(shown));
      let captured = "";
      let child: ChildProcess;
      const bin = command === "gcloud" && process.platform === "win32" ? await this.gcloudExecutable() : command;
      if (command === "gcloud" && process.platform === "win32" && !bin) {
        const message = "Google Cloud CLI is not installed.\n";
        onChunk(message);
        this.showConsole(message);
        finish(1);
        return;
      }
      const logFile = process.platform === "win32" && command === "gcloud" ? path.join(os.tmpdir(), `bigagent-gcloud-${process.pid}-${Date.now()}.log`) : "";
      const cliEnv = { ...process.env, CLOUDSDK_CORE_DISABLE_PROMPTS: "1", PYTHONIOENCODING: "utf-8", CLOUDSDK_ENCODING: "utf-8" };
      try {
        child = logFile
          ? spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", windowsShell(bin, args, logFile)], {
              cwd: root,
              windowsHide: true,
              shell: false,
              windowsVerbatimArguments: true,
              env: cliEnv,
            })
          : spawn(bin, args, {
              cwd: root,
              windowsHide: true,
              shell: process.platform === "win32",
              env: cliEnv,
            });
      } catch (error) {
        const message = error instanceof Error ? `${error.message}\n` : "Could not start the command.\n";
        onChunk(message);
        this.showConsole(redact(message));
        finish(1);
        return;
      }
      const timer = timeoutMs > 0 ? setTimeout(() => {
        const message = "The command did not answer in time.\n";
        onChunk(message);
        this.showConsole(message);
        if (child.pid && process.platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true });
        else child.kill();
        finish(1);
      }, timeoutMs) : undefined;
      const take = (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        captured += text;
        onChunk(text);
        this.showConsole(redact(text));
      };
      child.stdout?.on("data", take);
      child.stderr?.on("data", take);
      child.on("error", (error) => {
        const message = `${error.message}\n`;
        onChunk(message);
        this.showConsole(redact(message));
        if (timer) clearTimeout(timer);
        finish(1);
      });
      const pump = () => {
        if (!logFile || !fs.existsSync(logFile)) return;
        const next = readCommandLog(fs.readFileSync(logFile));
        if (next.length <= captured.length) return;
        const text = next.slice(captured.length);
        captured = next;
        onChunk(text);
        this.showConsole(redact(text));
      };
      const pumpTimer = logFile ? setInterval(pump, 1000) : undefined;
      child.on("close", (code) => {
        if (timer) clearTimeout(timer);
        if (pumpTimer) clearInterval(pumpTimer);
        pump();
        if (logFile) fs.rmSync(logFile, { force: true });
        const exit = code ?? 1;
        if (exit !== 0 && !captured.trim()) this.showConsole("The command printed nothing.");
        if (exit !== 0) this.showConsole(`exit ${exit}`);
        if (/\(y\/N\)|Would you like to enable/i.test(captured)) this.showConsole(`gcloud asked a question. Copy this command into a terminal and answer there: ${shown}`);
        finish(exit);
      });
      })();
    });
  }

  private gcloudExecutable(): Promise<string> {
    if (this.gcloudExe) return Promise.resolve(this.gcloudExe);
    return new Promise((resolve) => {
      let out = "";
      let child: ChildProcess;
      try {
        child = spawn("where.exe", ["gcloud.cmd"], { windowsHide: true });
      } catch {
        resolve("");
        return;
      }
      const timer = setTimeout(() => {
        child.kill();
        resolve("");
      }, 8000);
      child.stdout?.on("data", (chunk: Buffer) => { out += chunk.toString("utf8"); });
      child.on("error", () => {
        clearTimeout(timer);
        resolve("");
      });
      child.on("close", () => {
        clearTimeout(timer);
        const found = pickGcloud(out);
        if (found) this.gcloudExe = found;
        resolve(found);
      });
    });
  }

  private async googleAccount(root: string): Promise<{ email: string } | { error: string }> {
    let out = "";
    const code = await this.cli(root, "gcloud", ["auth", "list", "--filter=status:ACTIVE", "--format=value(account)"], (text) => {
      out += text;
    }, 20000);
    if (/not recognized|ENOENT|Google Cloud CLI is not installed/i.test(out)) return { error: "Google Cloud CLI is not installed." };
    if (code !== 0) {
      const reason = commandFailure(out) || out.trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean).at(-1) || "It printed nothing.";
      return { error: `Google Cloud CLI failed. ${reason}` };
    }
    const email = out.trim().split(/\s+/).find((part) => part.includes("@")) || "";
    if (!email) return { error: "No active Google account. Run gcloud auth login, then check again." };
    return { email };
  }

  private gcpStatus(text: string, kind: "ok" | "error" | "working" = "ok", url = "", step: "" | "push" | "publish" | "working" | "current" | "other" | "unknown" = "", image = ""): void {
    const lang = readUi(this.context).lang === "es" ? "es" : "en";
    this.gcpNote = phrase(lang, text);
    if (this.gcpNote) this.gcpTrail = [...this.gcpTrail, this.gcpNote].slice(-8);
    if ((step === "current" || step === "other" || step === "unknown") && this.gcpNote) this.gcpVerdict = { text: this.gcpNote, step, image };
    const face = step || (kind === "working" ? "working" : "");
    this.panel?.webview.postMessage({ type: "gcp-status", text: this.gcpNote, kind, url, step: face, image, trail: this.gcpTrail });
  }

  private missingLine(missing: string[]): string {
    if (missing.length === 1) return `Could not sync ${missing[0]}. It has no local value.`;
    if (missing.length > 1) return `Could not sync ${missing.join(", ")}. They have no local value.`;
    return "";
  }

  private syncSummary(synced: number, failed: string[], missing: string[]): string {
    const skip = this.missingLine(missing);
    const tail = skip ? ` ${skip}` : "";
    if (synced === 0) return `Secret Manager did not accept ${failed.join(", ")}.${tail}`;
    if (failed.length) return `Synced ${synced} to Secret Manager. ${failed.join(", ")} failed.${tail}`;
    return `Synced ${synced} to Secret Manager.${tail}`;
  }

  private async syncGcpSecrets(root: string, projectId: string, overrides: { name: string; value: string }[], only = ""): Promise<void> {
    const project = projectId.trim();
    if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project)) {
      this.gcpStatus("The GCP project id is missing or not a project id.", "error");
      return;
    }
    const loaded = loadProject(root);
    const known = loaded.secrets.map((row) => row.name);
    const names = only ? known.filter((name) => name === only) : known;
    const local: Record<string, string> = {};
    for (const name of names) local[name] = secretValue(root, name);
    const plan = secretSyncPlan(names, overrides, local);
    if (!plan.ready.length) {
      this.gcpStatus(plan.missing.length ? this.missingLine(plan.missing) : "This agent has no secret names yet.", "error");
      return;
    }
    this.gcpStatus("Syncing secrets to Secret Manager.", "working");
    const account = await this.googleAccount(root);
    if ("error" in account) {
      this.gcpStatus(account.error, "error");
      return;
    }
    const values = plan.ready.map((row) => row.value);
    const hide = (text: string) => {
      let hidden = text;
      for (const value of [...values].filter((value) => value.length >= 4).sort((left, right) => right.length - left.length)) {
        hidden = hidden.split(value).join("•••");
      }
      return redactValues(scrubLogs(hidden, names), values);
    };
    this.showConsole(`Google account ${account.email}`);
    const enabled = await this.cli(root, "gcloud", ["services", "enable", "secretmanager.googleapis.com", "--project", project, "--quiet"], () => {}, 0, hide);
    if (enabled !== 0) {
      this.gcpStatus("Could not enable the Google API. The command is in the log. Copy it into a terminal if gcloud needs an answer.", "error");
      return;
    }
    const failed: string[] = [];
    const done: string[] = [];
    let synced = 0;
    for (const row of plan.ready) {
      let described = "";
      const exists = await this.cli(root, "gcloud", ["secrets", "describe", row.name, "--project", project, "--format=value(name)"], (text) => {
        described += text;
      }, 30000, hide);
      if (exists !== 0) {
        if (!/NOT_FOUND|not found/i.test(described)) {
          failed.push(row.name);
          continue;
        }
        const created = await this.cli(root, "gcloud", ["secrets", "create", row.name, "--replication-policy=automatic", "--project", project, "--quiet"], () => {}, 60000, hide);
        if (created !== 0) {
          failed.push(row.name);
          continue;
        }
      }
      const file = path.join(os.tmpdir(), `bigagent-secret-${process.pid}-${Date.now()}-${synced}`).replace(/\\/g, "/");
      try {
        fs.writeFileSync(file, row.value, { mode: 0o600 });
        const added = await this.cli(root, "gcloud", ["secrets", "versions", "add", row.name, `--data-file=${file}`, "--project", project, "--quiet"], () => {}, 60000, hide);
        if (added !== 0) failed.push(row.name);
        else {
          synced += 1;
          done.push(row.name);
        }
      } finally {
        fs.rmSync(file, { force: true });
      }
    }
    if (done.length) this.panel?.webview.postMessage({ type: "gcp-secrets-cleared", names: done });
    const summary = this.syncSummary(synced, failed, plan.missing);
    this.gcpStatus(summary, synced > 0 && failed.length === 0 && plan.missing.length === 0 ? "ok" : "error");
  }

  private async deployGcp(root: string, link: import("./project").GcpLink): Promise<void> {
    const project = loadProject(root);
    const names = project.secrets.filter((row) => row.configured).map((row) => row.name);
    this.gcpStatus("Checking the local image.", "working");
    const imageId = await this.localImageId(root);
    const built = cloudRunPlan({
      agentName: project.name,
      project: link.project,
      region: link.region,
      imageId: imageId || "",
      exposure: link.exposure,
      hasPublicChannel: hasPublicChannel(project),
      secretNames: names,
      minInstances: link.minInstances,
      maxInstances: link.maxInstances,
      concurrency: link.concurrency,
      cpu: link.cpu,
      memory: link.memory,
      timeout: link.timeout,
      env: link.env,
    });
    if ("error" in built) {
      this.gcpStatus(built.error, "error");
      return;
    }
    const values = link.env.map((row) => row.value);
    const hide = (text: string) => redactValues(scrubLogs(text, names), values);
    const short = shortImage(imageId || "");
    this.gcpStatus("Checking the Google account.", "working");
    const account = await this.googleAccount(root);
    if ("error" in account) {
      this.gcpStatus(account.error, "error");
      return;
    }
    this.showConsole(`Google account ${account.email}`);
    if (built.plan.warning) this.showConsole(built.plan.warning);
    this.gcpStatus("Checking whether Cloud Run already runs this image.", "working");
    const live = await this.liveRevision(root, built.plan.project, built.plan.region, built.plan.service);
    const match = live.image ? await this.matchServing(root, built.plan.project, built.plan.region, built.plan.service, imageId || "", live.image) : "unknown";
    const skipPush = match === "same";
    if (skipPush) this.gcpStatus(`This image ${short} is already on Cloud Run. Applying the service settings.`, "working", live.url, "publish", short);
    else if (match === "other") this.gcpStatus(`Cloud Run is serving another image. Publishing ${short}.`, "working", "", "push", short);
    else if (live.failed) this.gcpStatus("Could not read the image Cloud Run is serving. Continuing.", "working", "", "unknown", short);
    if (!skipPush) {
    this.gcpStatus("Enabling Artifact Registry, Cloud Run, and Secret Manager.", "working");
    const enabled = await this.cli(root, "gcloud", ["services", "enable", "artifactregistry.googleapis.com", "run.googleapis.com", "secretmanager.googleapis.com", "--project", built.plan.project, "--quiet"], () => {}, 0, hide);
    if (enabled !== 0) {
      this.gcpStatus("Could not enable the Google API. The command is in the log. Copy it into a terminal if gcloud needs an answer.", "error");
      return;
    }
    const gcloud = (args: string[], timeout = 0) => this.cli(root, "gcloud", args, () => {}, timeout, hide);
    this.gcpStatus("Checking the Artifact Registry repository.", "working");
    const repo = await gcloud(["artifacts", "repositories", "describe", "bigagent", "--project", built.plan.project, "--location", built.plan.region], 30000);
    if (repo !== 0) {
      const created = await gcloud(["artifacts", "repositories", "create", "bigagent", "--repository-format=docker", "--location", built.plan.region, "--project", built.plan.project, "--quiet"], 90000);
      if (created !== 0) {
        this.gcpStatus("Could not create the Artifact Registry repository bigagent.", "error");
        return;
      }
    }
    this.gcpStatus("Letting Docker sign in to Artifact Registry.", "working");
    const dockerAuth = await gcloud(["auth", "configure-docker", `${built.plan.region}-docker.pkg.dev`, "--quiet"], 30000);
    if (dockerAuth !== 0) {
      this.gcpStatus("Could not let Docker push to Artifact Registry.", "error");
      return;
    }
    this.gcpStatus("Tagging the local image.", "working");
    const tagged = await this.cli(root, "docker", ["tag", imageId || "", built.plan.image], () => {}, 20000, hide);
    if (tagged !== 0) {
      this.gcpStatus("The local image was not found. Start it on Local once, then deploy.", "error");
      return;
    }
    this.gcpStatus("Pushing the image. This can take several minutes.", "working", "", "push");
    let lastByte = Date.now();
    const pushTimer = setInterval(() => {
      const progress = pushProgress(this.ship.logs);
      const ago = Math.max(0, Math.round((Date.now() - lastByte) / 1000));
      const quiet = ago >= 20;
      const detail = progress.detail ? ` ${progress.detail}` : "";
      if (progress.done > 0 && progress.pending === 0) {
        this.gcpStatus(quiet ? `Pushing the image. Every layer is in the registry. Docker has been quiet for ${ago}s.` : "Pushing the image. Every layer is in the registry. Waiting for Docker to finish.", "working", "", "push");
      } else if (progress.pending > 0) {
        this.gcpStatus(quiet ? `Pushing the image. ${progress.done} layers are already in the registry. ${progress.pending} have not moved for ${ago}s.${detail}` : `Pushing the image. ${progress.done} layers are already in the registry. ${progress.pending} are still going.${detail}`, "working", "", "push");
      } else this.gcpStatus(`Still pushing the image. The last update was ${ago}s ago.`, "working", "", "push");
    }, 10000);
    let pushed = 1;
    try {
      pushed = await this.cli(root, "docker", ["push", built.plan.image], () => {
        lastByte = Date.now();
      }, 0, hide);
    } finally {
      clearInterval(pushTimer);
    }
    if (pushed !== 0) {
      this.gcpStatus("The image did not upload. Check the Google account and the project.", "error");
      return;
    }
    }
    await this.allowSecretRead(root, built.plan.project, built.plan.secrets);
    this.gcpStatus("Publishing the Cloud Run service.", "working", "", "publish");
    let output = "";
    const deployed = await this.cli(root, "gcloud", cloudRunArgs(built.plan), (text) => {
      output += text;
    }, 0, hide);
    if (deployed !== 0) {
      const reason = commandFailure(hide(output));
      if (reason && !this.ship.logs.includes(reason.slice(0, 80))) this.showConsole(reason);
      this.gcpStatus(reason ? `Cloud Run did not accept the service. ${reason}` : "Cloud Run printed nothing. The command is in the log.", "error");
      return;
    }
    const url = output.match(/https:\/\/[a-z0-9.-]+\.run\.app/i)?.[0] || live.url || "";
    if (url) writeGcpLink(root, { ...link, url });
    this.publishGcpFace(root, imageId || "");
    this.gcpStatus(url ? `Cloud Run is up to date with image ${short}. Live at ${url}.` : `Cloud Run is up to date with image ${short}.`, "ok", url, "current", short);
  }

  private async liveRevision(root: string, projectId: string, region: string, service: string): Promise<{ image: string; url: string; missing: boolean; failed: boolean }> {
    let raw = "";
    const code = await this.cli(root, "gcloud", ["run", "services", "describe", service, "--project", projectId, "--region", region, "--format", "json(status.url,status.traffic,status.latestReadyRevisionName,status.latestCreatedRevisionName,spec.template.spec.containers[0].image)"], (text) => {
      raw += text;
    }, 30000);
    if (code !== 0) return { image: "", url: "", missing: serviceMissing(raw), failed: !serviceMissing(raw) };
    const release = parseServiceRelease(raw);
    if (!release) return { image: "", url: "", missing: false, failed: true };
    if (!release.revision) return { image: "", url: release.url, missing: true, failed: false };
    const tagged = releasedImage(release);
    if (tagged) return { image: tagged, url: release.url, missing: false, failed: false };
    let image = "";
    const rev = await this.cli(root, "gcloud", ["run", "revisions", "describe", release.revision, "--project", projectId, "--region", region, "--format", "value(spec.containers[0].image)"], (text) => {
      image += text;
    }, 30000);
    if (rev !== 0) return { image: "", url: release.url, missing: false, failed: true };
    return { image: image.trim(), url: release.url, missing: false, failed: false };
  }

  private async matchServing(root: string, projectId: string, region: string, service: string, imageId: string, remoteImage: string): Promise<"same" | "other" | "unknown"> {
    const direct = cloudRunImageMatch(imageId, remoteImage);
    if (direct !== "unknown") return direct;
    if (!/sha256:[a-f0-9]{64}/i.test(remoteImage)) return "unknown";
    const tag = shortImage(imageId).slice("sha256:".length);
    if (!tag) return "unknown";
    let pinned = "";
    const ref = `${region}-docker.pkg.dev/${projectId}/bigagent/${service}:${tag}`;
    const code = await this.cli(root, "gcloud", ["artifacts", "docker", "images", "describe", ref, "--format", "value(image_summary.digest)"], (text) => {
      pinned += text;
    }, 30000);
    if (code !== 0) return "unknown";
    return cloudRunImageMatch(imageId, remoteImage, pinned);
  }

  private async showLiveImage(root: string, link: import("./project").GcpLink): Promise<void> {
    this.gcpStatus("Checking whether Cloud Run already runs this image.", "working");
    const imageId = await this.localImageId(root);
    if (!imageId) {
      this.gcpStatus("No local image yet. Build it here, then deploy.", "error");
      return;
    }
    const short = shortImage(imageId);
    const live = await this.liveRevision(root, link.project, link.region, imageName(loadProject(root).name));
    this.publishGcpFace(root, imageId);
    if (live.failed) {
      this.gcpStatus("Could not read the image Cloud Run is serving.", "error", "", "unknown", short);
      return;
    }
    if (live.missing || !live.image) {
      this.gcpStatus("Cloud Run has no service yet.", "ok", live.url, "other", short);
      return;
    }
    if (live.url) writeGcpLink(root, { ...link, url: live.url });
    const match = await this.matchServing(root, link.project, link.region, imageName(loadProject(root).name), imageId, live.image);
    if (match === "same") this.gcpStatus(live.url ? `Cloud Run is up to date with image ${short}. Live at ${live.url}.` : `Cloud Run is up to date with image ${short}.`, "ok", live.url, "current", short);
    else if (match === "other") this.gcpStatus(`Cloud Run is serving another image. This one is ${short}.`, "ok", live.url, "other", short);
    else this.gcpStatus("Could not read the image Cloud Run is serving.", "error", live.url, "unknown", short);
  }

  private async readServiceLogs(root: string, projectId: string, region: string): Promise<void> {
    const service = imageName(loadProject(root).name);
    const place = region || "us-central1";
    this.gcpStatus("Reading the Cloud Run log.", "working");
    let raw = "";
    const code = await this.cli(root, "gcloud", [
      "logging", "read",
      monitorFilter(service, place),
      "--project", projectId,
      "--limit", "80",
      "--freshness", "6h",
      "--order", "desc",
      "--format", "json",
    ], (text) => { raw += text; }, 45000, () => "");
    const lang = readUi(this.context).lang === "es" ? "es" : "en";
    if (code !== 0) {
      this.gcpStatus("Could not read the Cloud Run log.", "error");
      return;
    }
    const entries = parseLogEntries(raw);
    const signal = agentSignal(entries);
    const facts = monitorFacts(entries);
    const bars = channelBars(entries);
    const measure = "latency";
    const say = (line: string) => phrase(lang, line);
    this.panel?.webview.postMessage({
      type: "gcp-signal",
      kind: signal.kind,
      headline: say(signal.headline),
      webhook: say(signal.webhook),
      turn: say(signal.turn),
      advice: say(signal.advice),
      bars,
      measure,
      facts,
    });
    this.panel?.webview.postMessage({ type: "gcp-status", text: "", kind: "ok", face: false });
  }

  private async allowSecretRead(root: string, projectId: string, secrets: string[]): Promise<void> {
    if (!secrets.length) return;
    this.gcpStatus("Allowing Cloud Run to read its secrets.", "working");
    let number = "";
    const described = await this.cli(root, "gcloud", ["projects", "describe", projectId, "--format=value(projectNumber)"], (text) => {
      number += text;
    }, 30000);
    const account = cloudRunRuntimeAccount(number.trim().split(/\s+/).find((part) => /^\d+$/.test(part)) || "");
    if (described !== 0 || !account) {
      this.showConsole("Could not find the Cloud Run service account. Continuing in case access was granted already.");
      return;
    }
    for (const secret of secrets) {
      this.gcpStatus(`Allowing Cloud Run to read ${secret}.`, "working");
      const granted = await this.cli(root, "gcloud", secretAccessorArgs(projectId, secret, account), () => {}, 60000);
      if (granted !== 0) this.showConsole(`Could not grant ${secret} to the Cloud Run account. Continuing in case it was granted already.`);
    }
  }

  private async openEditorChat(root: string): Promise<void> {
    const lang = readUi(this.context).lang === "es" ? "es" : "en";
    const query = chatHandoff(loadProject(root), lang);
    const commands = await vscode.commands.getCommands(true);
    const command = ["workbench.action.chat.open", "workbench.action.chat.newChat", "composer.newAgentChat", "aichat.newchataction"].find((name) => commands.includes(name));
    if (!command) {
      this.render("This editor did not open its chat.");
      return;
    }
    await vscode.commands.executeCommand(command, { query, isPartialQuery: true, mode: "agent" });
  }

  private async loadModels(): Promise<void> {
    const select = vscode.lm?.selectChatModels;
    if (!select) {
      this.lmModel = undefined;
      this.lm = { ...lmGate({ hasApi: false, modelCount: 0 }), models: [], modelId: "" };
      return;
    }
    try {
      const found = await select({});
      const models = found.map((model) => ({ id: model.id, name: model.name || model.id }));
      const modelId = models.some((model) => model.id === this.lm.modelId) ? this.lm.modelId : models[0]?.id || "";
      this.lmModel = found.find((model) => model.id === modelId);
      const gate = lmGate({ hasApi: true, modelCount: models.length });
      this.lm = { ...gate, models, modelId };
    } catch {
      this.lmModel = undefined;
      this.lm = { ...lmGate({ hasApi: true, modelCount: 0 }), models: [], modelId: "" };
    }
  }

  private async askLm(root: string, question: string): Promise<void> {
    const text = question.trim().slice(0, 2000);
    if (!text) return;
    this.askOpen = true;
    if (!this.lmModel) await this.loadModels();
    this.ask = [...this.ask, { role: "you", text }].slice(-12);
    if (!this.lmModel) {
      this.ask = [...this.ask, { role: "guide", text: this.lm.reason }].slice(-12);
      this.render();
      return;
    }
    const prompt = assistantContext(loadProject(root), text);
    try {
      const answer = (await this.askModel(prompt, this.lmModel)).trim();
      const proposal = readProposal(answer);
      const shown = replyWithoutProposal(answer);
      this.ask = [...this.ask, { role: "guide", text: shown || (proposal ? proposalLabel(proposal) : "The editor model returned an empty answer."), proposal: proposal ?? undefined }].slice(-12);
    } catch {
      this.ask = [...this.ask, { role: "guide", text: "The model did not answer. Check that you are signed in, then send again." }].slice(-12);
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
    const ui = { ...savedUi, notice: phrase(lang, this.holdNotice), helpOpen: this.helpOpen, askOpen: this.askOpen, lm: this.lm, ask: this.ask, secretFocus: this.secretFocus, gcpNote: this.gcpNote, gcpVerdict: this.gcpVerdict || undefined, gcpTrail: this.gcpTrail };
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
    const pin = root && isProject(root) ? readImagePin(root) : null;
    const ship = { ...this.ship, image: this.ship.image || pin || "" };
    if (this.panel) this.panel.webview.html = designerHtml(project, ui, Boolean(root), scan, suggested, layout, home, pulse, studio, ship);
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
    project?: string;
    region?: string;
    exposure?: string;
    target?: "local" | "gcp" | "aws" | "azure";
    minInstances?: number;
    maxInstances?: number;
    concurrency?: number;
    cpu?: string;
    memory?: string;
    timeout?: number;
    env?: { name?: string; value?: string }[];
    secretOverrides?: { name?: string; value?: string }[];
    only?: string;
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
        const term = this.editorTerminal(root);
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
      if (message.type === "open-chat" && root && isProject(root)) {
        await this.openEditorChat(root);
        return;
      }
      if (message.type === "ship-target" && (message.target === "local" || message.target === "gcp" || message.target === "aws" || message.target === "azure")) {
        await writeUi(this.context, { ...ui, shipTarget: message.target });
        return;
      }
      if (message.type === "gcp-sync" && root && isProject(root)) {
        await writeUi(this.context, { ...ui, shipTarget: "gcp" });
        const overrides = Array.isArray(message.secretOverrides)
          ? message.secretOverrides.flatMap((row: { name?: unknown; value?: unknown }) => {
              if (!row || typeof row.name !== "string") return [];
              return [{ name: row.name, value: typeof row.value === "string" ? row.value : "" }];
            })
          : [];
        await this.syncGcpSecrets(root, String(message.project || ""), overrides, typeof message.only === "string" ? message.only : "");
        return;
      }
      if (message.type === "gcp-logs" && root && isProject(root)) {
        await writeUi(this.context, { ...ui, shipTarget: "gcp" });
        await this.readServiceLogs(root, String(message.project || ""), String(message.region || ""));
        return;
      }
      if (message.type === "gcp-build" && root && isProject(root)) {
        await writeUi(this.context, { ...ui, shipTarget: "gcp" });
        this.gcpStatus("Building the local image. The log shows each step.", "working");
        await this.compose(root, ["compose", "up", "--build", "-d", "--force-recreate"], "building");
        return;
      }
      if ((message.type === "gcp-check" || message.type === "gcp-deploy" || message.type === "gcp-live") && root && isProject(root)) {
        await writeUi(this.context, { ...ui, shipTarget: "gcp" });
        const parsed = parseGcpLink({
          project: message.project,
          region: message.region,
          exposure: message.exposure,
          minInstances: message.minInstances,
          maxInstances: message.maxInstances,
          concurrency: message.concurrency,
          cpu: message.cpu,
          memory: message.memory,
          timeout: message.timeout,
          env: Array.isArray(message.env) ? message.env : [],
        });
        if ("error" in parsed) {
          this.gcpStatus(parsed.error, "error");
          return;
        }
        const names = loadProject(root).secrets.filter((row) => row.configured).map((row) => row.name);
        const clash = parsed.link.env.find((row) => names.includes(row.name));
        if (clash) {
          this.gcpStatus(`${clash.name} is a secret. Create it in Secret Manager. Do not put the value here.`, "error");
          return;
        }
        writeGcpLink(root, parsed.link);
        if (message.type === "gcp-check") {
          this.gcpStatus("Checking the Google account.", "working");
          const account = await this.googleAccount(root);
          this.gcpStatus("error" in account ? account.error : `Signed in to Google as ${account.email}.`, "error" in account ? "error" : "ok");
          return;
        }
        if (message.type === "gcp-live") {
          await this.showLiveImage(root, parsed.link);
          return;
        }
        await this.deployGcp(root, parsed.link);
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
      if (message.type === "apply-proposal") {
        const index = Number(message.index);
        const line = this.ask[index];
        if (!line?.proposal || line.applied) return;
        applyProposal(root, line.proposal);
        this.ask[index] = { ...line, applied: true };
        this.ask = [...this.ask, { role: "guide", text: "Saved on the canvas." }];
        this.render("", true);
        return;
      }
      if (message.type === "dismiss-proposal") {
        const index = Number(message.index);
        const line = this.ask[index];
        if (!line?.proposal || line.applied) return;
        this.ask[index] = { ...line, applied: true };
        this.render();
        return;
      }
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
      if (message.type === "ship" && message.task === "clear-log") {
        this.ship = { ...this.ship, logs: "" };
        this.panel?.webview.postMessage({ type: "ship-log", text: "", replace: true });
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
        else if (message.task === "start") await this.compose(root, shipArgs("start", Boolean(readImagePin(root)), Boolean(this.ship.republish)), "building");
        else if (message.task === "rebuild") await this.compose(root, shipArgs("rebuild", true, true), "rebuilding");
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
        this.saved();
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
