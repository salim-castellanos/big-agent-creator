import { exampleText, phrase, studioText, t, type CopyKey, type Lang } from "./copy";
import { cardNeeds, CHANNEL_NEEDS, deliveryCheck, EXAMPLES, executionSteps, flowLinks, flowReport, defaultGcpLink, GCP_CPUS, GCP_MEMORY, gcpChecks, gcpPreview, GUIDE_URL, readImagePin, GUIDE_URL_ES, hasPublicChannel, hookSecretReach, LIBRARY_KINDS, proposalLabel, publicChannelUrl, readGcpLink, review, runSignals, slackReach, telegramReach, TRIGGER_TYPES, whatsappReach, type CardNeed, type Item, type Kind, type Layout, type Project, type Proposal, type Scan, type Studio } from "./project";

export type ShipStats = { cpu: string; memory: string; healthMs: number | null };

export type ShipStatus = {
  docker: "unknown" | "down" | "ready";
  running: boolean;
  failed?: boolean;
  phase: "idle" | "building" | "stopping" | "checking" | "rebuilding" | "tunnel" | "webhook";
  summary: string;
  logs: string;
  channelLogs?: Record<string, string>;
  publicUrl: string;
  stats?: ShipStats;
  dockerWhy?: "missing" | "down";
  republish?: boolean;
  image?: string;
};

export type ShipFace = {
  state: "busy" | "down" | "failed" | "running" | "stopped";
  label: string;
  summary: string;
  summaryKind: "working" | "error" | "plain";
  cpu: string;
  memory: string;
  health: string;
  errors: string;
  window: string;
  lastError: string;
  ariaBusy: boolean;
  startDisabled: boolean;
  startText: string;
  playgroundDisabled: boolean;
  rebuildDisabled: boolean;
  stopDisabled: boolean;
  refreshDisabled: boolean;
  playgroundLine: string;
  image: string;
};

export function shipFace(local: ShipStatus, lang: Lang, startBlocked: boolean): ShipFace {
  const busy = local.phase !== "idle";
  const acting = local.phase === "building" || local.phase === "rebuilding" || local.phase === "stopping";
  const state = busy ? "busy" : local.docker === "down" ? "down" : local.failed ? "failed" : local.running ? "running" : "stopped";
  const label =
    local.phase === "building" ? t(lang, "building")
    : local.phase === "rebuilding" ? t(lang, "rebuilding")
    : local.phase === "stopping" ? t(lang, "stopping")
    : local.phase === "checking" ? t(lang, "checking")
    : local.phase === "tunnel" ? t(lang, "opening_tunnel")
    : local.phase === "webhook" ? t(lang, "registering")
    : local.docker === "down" && local.dockerWhy === "missing" ? t(lang, "docker_missing")
    : local.docker === "down" ? t(lang, "docker_off")
    : local.failed ? t(lang, "failed")
    : local.running ? t(lang, "running")
    : t(lang, "stopped");
  const meters = local.stats ?? { cpu: "—", memory: "—", healthMs: null as number | null };
  const signals = runSignals(local.logs);
  const span = signals.spanMs == null ? "—" : signals.spanMs < 1000 ? `${signals.spanMs} ms` : `${Math.round(signals.spanMs / 1000)} s`;
  return {
    state,
    label,
    summary: phrase(lang, local.summary),
    summaryKind: busy ? "working" : state === "failed" || state === "down" ? "error" : "plain",
    cpu: meters.cpu,
    memory: meters.memory,
    health: meters.healthMs == null ? "—" : `${meters.healthMs} ms`,
    errors: String(signals.errors),
    window: span,
    lastError: signals.lastError ? phrase(lang, signals.lastError) : "—",
    ariaBusy: busy,
    startDisabled: acting || local.running || startBlocked,
    startText: acting || local.running ? label : t(lang, "start"),
    playgroundDisabled: !(local.running && !acting),
    rebuildDisabled: acting || startBlocked,
    stopDisabled: !(local.running || acting),
    refreshDisabled: acting,
    playgroundLine: local.running ? t(lang, "playground_ready") : t(lang, "playground_after"),
    image: local.image ? `sha256:${local.image.replace(/^sha256:/, "").slice(0, 12)}` : "",
  };
}

export type Ui = {
  mode: "flow" | "prove" | "platform" | "secrets" | "connect" | "deploy" | "examples";
  selected: string;
  notice: string;
  libraryOpen: boolean;
  inspectorOpen: boolean;
  libraryWidth: number;
  inspectorWidth: number;
  lang?: Lang;
  shipTarget?: "local" | "gcp" | "aws" | "azure";
  gcpNote?: string;
  gcpVerdict?: { text: string; step: "current" | "other" | "unknown"; image: string };
  gcpTrail?: string[];
  helpOpen?: boolean;
  secretFocus?: string;
  askOpen?: boolean;
  lm?: { ok: boolean; reason: string; models?: { id: string; name: string }[]; modelId?: string };
  ask?: { role: "you" | "guide"; text: string; proposal?: Proposal; applied?: boolean }[];
};

function langOf(ui: { lang?: Lang }): Lang {
  return ui.lang === "es" ? "es" : "en";
}

function kindLabel(lang: Lang, kind: string): string {
  return t(lang, `kind_${kind}` as CopyKey);
}

function purpose(lang: Lang, kind: string): string {
  return t(lang, `purpose_${kind}` as CopyKey);
}

function icon(name: Kind | "agent" | "limits"): string {
  const body: Record<string, string> = {
    channel: `<circle cx="8" cy="8" r="2.2"/><path d="M8 2.8v2M8 11.2v2M2.8 8h2M11.2 8h2"/>`,
    schedule: `<circle cx="8" cy="8" r="5"/><path d="M8 5.2V8l2 1.4"/>`,
    tool: `<path d="M4 11.5 L7.2 8.2 M6.2 4.2h2.2v2.2M9.2 7.2l3 3a1.4 1.4 0 0 1-2 2l-3-3"/>`,
    skill: `<path d="M3.5 3.5h6.2A2.3 2.3 0 0 1 12 5.8V13H5.8A2.3 2.3 0 0 0 3.5 15.3z"/><path d="M3.5 3.5v11.8"/>`,
    mcp: `<path d="M6 2.8v2.4M10 2.8v2.4M4.8 5.2h6.4v2.6a3.2 3.2 0 0 1-6.4 0zM8 11.2v2"/>`,
    host: `<rect x="3" y="3.2" width="10" height="7.2" rx="1.2"/><path d="M6 12.8h4M8 10.4v2.4"/>`,
    subagent: `<circle cx="5.2" cy="5.4" r="1.6"/><circle cx="10.8" cy="5.4" r="1.6"/><path d="M2.6 12.6c.5-1.8 1.5-2.6 2.6-2.6s2.1.8 2.6 2.6M8.2 12.6c.5-1.8 1.5-2.6 2.6-2.6s2.1.8 2.6 2.6"/>`,
    hook: `<path d="M6 3.2v4.2a2.2 2.2 0 1 0 4.4 0V6.2"/><path d="M10.4 3.2v1.6"/>`,
    agent: `<circle cx="8" cy="5.6" r="2"/><path d="M4.2 13.2c.7-2.3 2-3.4 3.8-3.4s3.1 1.1 3.8 3.4"/>`,
    limits: `<path d="M8 2.4 12.6 4.2v3.8c0 2.6-1.8 4.2-4.6 5.4C5.2 12.2 3.4 10.6 3.4 8V4.2z"/>`,
  };
  return `<svg class="ico" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body[name]}</svg>`;
}

const KINDS: Kind[] = LIBRARY_KINDS;

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function shell(body: string, script: string, lang: Lang = "en"): string {
  return `<!doctype html><html lang="${lang}" data-lang="${lang}"><head><meta charset="utf-8" />
<style>
  html, body { height: 100%; margin: 0; }
  body { display: flex; flex-direction: column; font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); }
  button, input, textarea, select { font: inherit; color: inherit; }
  button { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 0; border-radius: 4px; padding: 6px 10px; cursor: pointer; }
  button:disabled { opacity: .45; cursor: not-allowed; }
  button.primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  button.quiet { background: transparent; padding: 4px 8px; }
  button.on { outline: 1px solid var(--vscode-focusBorder); }
  h2 { margin: 0; font-size: 16px; font-weight: 600; }
  h3 { margin: 0; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; opacity: .62; }
  .hint { opacity: .72; font-size: 12px; line-height: 1.45; }
  label { display: block; margin: 14px 0 0; font-size: 12px; }
  textarea, input, select { display: block; width: 100%; margin-top: 6px; box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground, inherit); border: 1px solid var(--vscode-input-border, transparent); border-radius: 4px; padding: 8px; }
  textarea { min-height: 220px; resize: vertical; line-height: 1.45; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
  .banner { margin: 0; padding: 8px 16px; background: var(--vscode-textBlockQuote-background, rgba(128,128,128,.12)); }
  code { font-family: var(--vscode-editor-font-family, monospace); }
</style>
${body}
<script>${script}</script>
</body></html>`;
}

function pill(item: Item, lang: Lang): string {
  if (item.kind === "tool") {
    const effect = item.effect || "read";
    const label = effect === "irreversible" ? t(lang, "needs_person") : effect === "write" ? t(lang, "writes") : t(lang, "reads");
    const inputs = item.parameters?.length ? t(lang, item.parameters.length === 1 ? "one_input" : "n_inputs", { n: item.parameters.length }) : "";
    return `<span class="pill ${effect}">${label}</span>${inputs ? `<span class="pill">${inputs}</span>` : ""}`;
  }
  if (item.kind === "channel") return `<span class="pill">${item.verify ? t(lang, "signed") : t(lang, "open")}</span>`;
  if (item.kind === "skill") return item.description ? `<em>${esc(item.description)}</em>` : "";
  if (item.kind === "mcp") return item.url ? `<em>${esc(item.url)}</em>` : "";
  return "";
}

function stepBadge(steps: Record<string, number>, counts: Map<number, number>, id: string, lang: Lang): string {
  const step = steps[id];
  if (!step) return "";
  const parallel = (counts.get(step) || 0) > 1;
  const title = parallel
    ? t(lang, "step_parallel", { n: step })
    : step === 1
      ? t(lang, "step_first")
      : t(lang, "step_wait", { n: step });
  return `<span class="stepno${parallel ? " parallel" : ""}" title="${esc(title)}">${step}</span>`;
}

function nodeButton(item: Item, selected: string, at?: { x: number; y: number }, home?: { x: number; y: number }, gap = false, badge = "", lang: Lang = "en", hint = ""): string {
  const id = `${item.kind}:${item.name}`;
  const blurb = (item.kind === "channel" ? item.route || t(lang, "no_endpoint") : item.kind === "tool" ? item.calls || t(lang, "no_calls") : item.kind === "skill" || item.kind === "mcp" ? "" : item.description || item.body).replace(/\s+/g, " ").trim().slice(0, 72);
  const place = at ? ` style="left:${at.x}px;top:${at.y}px" data-home-x="${home?.x ?? at.x}" data-home-y="${home?.y ?? at.y}"` : "";
  return `<button type="button" class="node ${item.kind}${id === selected ? " on" : ""}${gap ? " gap" : ""}" data-id="${esc(id)}" title="${esc(hint)}"${place}>
    ${badge}<span class="mark">${icon(item.kind)}</span>
    <span class="copy"><span class="k">${kindLabel(lang, item.kind)}</span><strong>${esc(item.name)}</strong>${pill(item, lang)}${gap ? `<span class="pill gap">${t(lang, "incomplete")}</span>` : ""}${blurb ? `<em>${esc(blurb)}</em>` : ""}</span>
  </button>`;
}

function group(step: string, title: string, hint: string, items: Item[], selected: string): string {
  const cards = items.map((item) => nodeButton(item, selected)).join("");
  return `<section><header class="step"><span>${step}</span><h3>${title}</h3></header><p class="hint">${hint}</p>${cards || `<p class="ghost">Nothing here yet. Add it from the library.</p>`}</section>`;
}

function secretList(lang: Lang, type: string): string {
  const need = CHANNEL_NEEDS[type];
  if (!need) return "";
  return `<ul class="secrets">${need.secrets.map((name) => `<li><strong>${name}</strong><span>${t(lang, "secret_after_save")}</span></li>`).join("")}</ul>`;
}

function paintNeeds(html: string, fields: string[]): string {
  if (!fields.length) return html;
  let out = html;
  for (const field of fields) {
    if (field.startsWith("secret:")) {
      const name = field.slice("secret:".length);
      out = out.replace(`<li><strong>${name}</strong>`, `<li class="need"><strong>${name}</strong>`);
    } else out = out.replace(`id="${field}"`, `id="${field}" data-need="1"`);
  }
  return out.replace(/<label([^>]*)>([\s\S]*?)<\/label>/g, (full, attrs: string, inner: string) => {
    if (!inner.includes('data-need="1"')) return full;
    if (/class="/.test(attrs)) return `<label${attrs.replace('class="', 'class="need ')}>${inner}</label>`;
    return `<label class="need"${attrs}>${inner}</label>`;
  });
}

function secretNamesIn(row: CardNeed): string[] {
  const names = row.fields.filter((field) => field.startsWith("secret:")).map((field) => field.slice("secret:".length));
  for (const line of row.missing) {
    const match = line.match(/^([A-Z][A-Z0-9_]*) is empty\. Set it in Secrets\.$/);
    if (match) names.push(match[1]);
  }
  return [...new Set(names)];
}

function needBanner(needs: CardNeed[], selected: string, lang: Lang): string {
  const row = needs.find((item) => item.id === selected);
  if (!row) return "";
  const names = secretNamesIn(row);
  const jumps = names.map((name) => `<button type="button" class="primary" data-set-secret="${esc(name)}">${esc(t(lang, "set_secret", { name }))}</button>`).join("");
  return `<ul class="needlist">${row.missing.map((line) => `<li>${esc(phrase(lang, line))}</li>`).join("")}</ul>${jumps ? `<div class="row">${jumps}</div>` : ""}`;
}

function inspector(project: Project, selected: string, lang: Lang): string {
  if (selected === "agent") {
    const harness = project.harness;
    const tools = ["read", "grep", "glob", "ls", "edit", "delete", "shell", "task"];
    const boxes = tools
      .map((name) => `<label class="check"><input class="harness" type="checkbox" value="${name}" ${!harness || harness.includes(name) ? "checked" : ""} /> ${name}</label>`)
      .join("");
    return `<p class="eyebrow">${kindLabel(lang, "agent")}</p><h2>${esc(project.name)}</h2><p class="path">bot/agent.ts · instructions.md</p>
      <p class="hint">${t(lang, "agent_hint")}</p>
      <label>${t(lang, "model")}<select id="model"><option value="auto" ${project.model === "auto" ? "selected" : ""}>Auto</option><option value="grok-4.5" ${project.model === "grok-4.5" ? "selected" : ""}>Grok 4.5</option><option value="composer-2.5" ${project.model === "composer-2.5" ? "selected" : ""}>Composer 2.5</option></select></label>
      <label>${t(lang, "effort")}<select id="effort"><option value="low" ${project.effort === "low" ? "selected" : ""}>${t(lang, "low")}</option><option value="medium" ${project.effort === "medium" ? "selected" : ""}>${t(lang, "medium")}</option><option value="high" ${project.effort === "high" ? "selected" : ""}>${t(lang, "high")}</option></select></label>
      <label class="check"><input id="fast" type="checkbox" ${project.fast ? "checked" : ""} /> ${t(lang, "fast")}</label>
      <p class="hint">${t(lang, "auto_hint")}</p>
      <label class="check"><input id="sandbox" type="checkbox" ${project.sandbox ? "checked" : ""} /> ${t(lang, "sandbox")}</label>
      <label class="check"><input id="limit-tools" type="checkbox" ${harness ? "checked" : ""} /> ${t(lang, "limit_tools")}</label>
      <div id="harness">${boxes}</div>
      <p class="hint">${t(lang, "harness_hint")}</p>
      <label class="check"><input id="reminders" type="checkbox" ${project.reminders ? "checked" : ""} /> ${t(lang, "reminders")}</label>
      <label>${t(lang, "max_turns")}<input id="turns" value="${project.maxRunningTurns ?? ""}" placeholder="${esc(t(lang, "no_cap"))}" /></label>
      <label>${t(lang, "egress")}<textarea id="egress">${esc(project.egress.join("\n"))}</textarea></label>
      <label>${t(lang, "instructions")}<textarea id="instructions">${esc(project.instructions)}</textarea></label>
      <div class="row savebar"><button type="button" id="save-agent" class="primary">${t(lang, "save")}</button></div>`;
  }
  if (selected === "scope") {
    return `<p class="eyebrow">${kindLabel(lang, "limits")}</p><h2>${t(lang, "scope_name")}</h2><p class="path">.bigagent/project.json</p>
      <p class="hint">${t(lang, "limits_hint")}</p>
      <label>${t(lang, "refusal")}<textarea id="scope">${esc(project.scope)}</textarea></label>
      <div class="row savebar"><button type="button" id="save-scope" class="primary">${t(lang, "save")}</button></div>`;
  }
  const [kind, name] = selected.split(":") as [Kind, string];
  const item = project.items.find((entry) => entry.kind === kind && entry.name === name);
  if (!item) return `<p class="hint">${t(lang, "select_node")}</p>`;
  const head = `<p class="eyebrow">${kindLabel(lang, kind)}</p><h2>${esc(item.name)}</h2>`;
  const foot = `<div class="row savebar"><button type="button" id="save-item" class="primary">${t(lang, "save")}</button><button type="button" id="delete-item">${t(lang, "delete")}</button></div>
    <p class="hint">${t(lang, "delete_hint")}</p>`;
  if (kind === "tool") {
    const effect = item.effect || "read";
    const params = (item.parameters || [])
      .map(
        (param) => `<div class="param">
          <input name="pname" value="${esc(param.name)}" placeholder="${esc(t(lang, "ph_name"))}" />
          <select name="ptype">${["string", "number", "boolean"].map((type) => `<option ${param.type === type ? "selected" : ""}>${type}</option>`).join("")}</select>
          <label class="check"><input name="preq" type="checkbox" ${param.required ? "checked" : ""} /> ${t(lang, "required")}</label>
          <input name="pdesc" value="${esc(param.description)}" placeholder="${esc(t(lang, "ph_means"))}" />
          <button type="button" class="quiet drop-param">${t(lang, "remove")}</button>
        </div>`,
      )
      .join("");
    return `${head}<p class="path">tools/${esc(item.name)}.json</p>
      <label>${t(lang, "what_it_does")}<textarea id="field">${esc(item.description)}</textarea></label>
      <label>${t(lang, "calls_mcp")}<select id="call-mcp"><option value="">${t(lang, "http_instead")}</option>${project.items.filter((entry) => entry.kind === "mcp").map((entry) => `<option value="mcp:${esc(entry.name)}" ${item.calls === `mcp:${entry.name}` ? "selected" : ""}>${esc(entry.name)}</option>`).join("")}</select></label>
      <label>${t(lang, "or_http")}<input id="calls" value="${esc(item.calls && !item.calls.startsWith("mcp:") ? item.calls : "")}" placeholder="POST /search" /></label>
      <label>${t(lang, "secret_name")}<input id="secret" value="${esc(item.secret || "")}" placeholder="${esc(t(lang, "secret_if"))}" /></label>
      <label>${t(lang, "effect")}<select id="effect"><option value="read" ${effect === "read" ? "selected" : ""}>${t(lang, "reads")}</option><option value="write" ${effect === "write" ? "selected" : ""}>${t(lang, "writes")}</option><option value="idempotent" ${effect === "idempotent" ? "selected" : ""}>${t(lang, "idempotent")}</option><option value="irreversible" ${effect === "irreversible" ? "selected" : ""}>${t(lang, "needs_person")}</option></select></label>
      <label>${t(lang, "runs")}<select id="execution"><option value="server" ${item.execution !== "agent" ? "selected" : ""}>${t(lang, "on_server")}</option><option value="agent" ${item.execution === "agent" ? "selected" : ""}>${t(lang, "beside")}</option></select></label>
      <p class="hint">${t(lang, "effect_hint")}</p>
      <label>${t(lang, "procedure")}<textarea id="procedure" placeholder="return input;">${esc(item.body)}</textarea></label>
      <div id="params">${params}</div>
      <button type="button" id="add-param">${t(lang, "add_parameter")}</button>${foot}`;
  }
  if (kind === "skill") {
    return `${head}<p class="path">skills/${esc(item.name)}.md</p>
      <label>${t(lang, "load_when")}<input id="when" value="${esc(item.description)}" placeholder="${esc(t(lang, "load_when_ph"))}" /></label>
      <label>${t(lang, "procedure")}<textarea id="field">${esc(item.body)}</textarea></label>${foot}`;
  }
  if (kind === "mcp" || kind === "host") {
    const transport = item.transport || "http";
    const where = kind === "host" ? "bot/host-connections" : "bot/mcp-connections";
    return `${head}<p class="path">${where}/${esc(item.name)}.ts</p>
      <p class="hint">${kind === "host" ? t(lang, "host_hint") : t(lang, "mcp_hint")}</p>
      <label>${t(lang, "transport")}<select id="transport"><option value="http" ${transport === "http" ? "selected" : ""}>${t(lang, "http")}</option><option value="stdio" ${transport === "stdio" ? "selected" : ""}>${t(lang, "local_process")}</option><option value="account" ${transport === "account" ? "selected" : ""}>${t(lang, "cursor_account")}</option></select></label>
      <label>${t(lang, "server_url")}<input id="url" value="${esc(item.url || "")}" placeholder="https://mcp.example.com/mcp" /></label>
      <label>${t(lang, "command")}<input id="command" value="${esc(item.command || "")}" placeholder="node" /></label>
      <label>${t(lang, "secret_name")}<input id="secret" value="${esc(item.secret || "")}" placeholder="MCP_TOKEN" /></label>
      <label class="check"><input id="advertise" type="checkbox" ${item.advertise ? "checked" : ""} /> ${t(lang, "advertise")}</label>
      <label>${t(lang, "what_for")}<textarea id="field">${esc(item.description)}</textarea></label>${foot}`;
  }
  if (kind === "schedule") {
    return `${head}<p class="path">bot/schedules/${esc(item.name)}.md</p>
      <p class="hint">${t(lang, "schedule_hint")}</p>
      <div class="row"><button type="button" data-cron="0 * * * *">${t(lang, "every_hour")}</button><button type="button" data-cron="0 9 * * *">${t(lang, "every_day")}</button><button type="button" data-cron="0 9 * * 1">${t(lang, "monday")}</button></div>
      <label>${t(lang, "schedule")}<input id="route-cron" value="${esc(item.route || "")}" placeholder="0 9 * * 1" /></label>
      <label>${t(lang, "run_should")}<textarea id="field">${esc(item.description)}</textarea></label>${foot}`;
  }
  if (kind === "subagent") {
    return `${head}<p class="path">bot/subagents/${esc(item.name)}/</p>
      <p class="hint">${t(lang, "subagent_hint")}</p>
      <label>${t(lang, "delegate_when")}<input id="when" value="${esc(item.description)}" placeholder="${esc(t(lang, "delegate_ph"))}" /></label>
      <label>${t(lang, "instructions")}<textarea id="field">${esc(item.body)}</textarea></label>${foot}`;
  }
  if (kind === "hook") {
    const events = ["message.received", "turn.completed", "turn.failed", "actions.requested", "actions.completed", "action.result"];
    return `${head}<p class="path">bot/hooks/${esc(item.name)}.ts</p>
      <p class="hint">${t(lang, "hook_hint")}</p>
      <label>${t(lang, "event")}<select id="field">${events.map((event) => `<option ${item.description === event ? "selected" : ""}>${event}</option>`).join("")}</select></label>
      <label>${t(lang, "procedure")}<textarea id="procedure">${esc(item.body)}</textarea></label>${foot}`;
  }
  const type = item.description || "webhook";
  const types = TRIGGER_TYPES
    .map((option) => `<option value="${option}" ${type === option ? "selected" : ""}>${option}</option>`)
    .join("");
  const show = (name: string) => (type === name ? "" : " hidden");
  return `${head}<p class="path">channels/${esc(item.name)}.json</p>
    <label>${t(lang, "type")}<select id="field">${types}</select></label>
    <div class="assist" data-for="webhook"${show("webhook")}>
      <label>${t(lang, "endpoint")}<input id="route" value="${esc(type === "webhook" ? item.route || "" : "")}" placeholder="/hooks/inbox" /></label>
      <p class="hint">${t(lang, "hook_path")}</p>
      <label class="check"><input id="verify" type="checkbox" ${item.verify ? "checked" : ""} /> ${t(lang, "verify_sig")}</label>
      <label>${t(lang, "secret_name")}<input id="secret" value="${esc(item.secret || "")}" placeholder="WEBHOOK_SECRET" /></label>
    </div>
    <div class="assist" data-for="whatsapp"${show("whatsapp")}>
      <p class="hint">${t(lang, "whatsapp_hint")}</p>
      <label>${t(lang, "webhook_secret")}<input id="secret-whatsapp" value="${esc(item.secret || "WHATSAPP_VERIFY_TOKEN")}" placeholder="WHATSAPP_VERIFY_TOKEN" /></label>
      ${secretList(lang, "whatsapp")}
      <p class="hint">${t(lang, "whatsapp_token_hint")}</p>
    </div>
    <div class="assist" data-for="telegram"${show("telegram")}>
      <label>${t(lang, "endpoint")}<input id="route-telegram" value="${esc(type === "telegram" ? item.route || "/" : "/")}" placeholder="/" /></label>
      <p class="hint">${esc(t(lang, "telegram_hint", { name: item.name }))}</p>
      <label class="check"><input id="verify-telegram" type="checkbox" ${item.verify ? "checked" : ""} /> ${t(lang, "verify_token")}</label>
      <label>${t(lang, "webhook_secret")}<input id="secret-telegram" value="${esc(item.secret || "TELEGRAM_WEBHOOK_SECRET")}" placeholder="TELEGRAM_WEBHOOK_SECRET" /></label>
      ${secretList(lang, "telegram")}
      <p class="hint">${t(lang, "telegram_token_hint")}</p>
    </div>
    <div class="assist" data-for="cron"${show("cron")}>
      <p class="hint">${t(lang, "cron_hint")}</p>
      <div class="row"><button type="button" data-cron="0 * * * *">${t(lang, "every_hour")}</button><button type="button" data-cron="0 9 * * *">${t(lang, "every_day")}</button><button type="button" data-cron="0 9 * * 1">${t(lang, "monday")}</button></div>
      <label>${t(lang, "schedule")}<input id="route-cron" value="${esc(type === "cron" ? item.route || "" : "")}" placeholder="0 9 * * 1" /></label>
    </div>
    <div class="assist" data-for="slack"${show("slack")}>
      <label>${t(lang, "event")}<select id="route-slack">${["message", "app_mention"].map((event) => `<option ${item.route === event ? "selected" : ""}>${event}</option>`).join("")}</select></label>
      ${secretList(lang, "slack")}
      <p class="hint">${t(lang, "slack_hint")}</p>
    </div>
    <div class="assist" data-for="github"${show("github")}>
      <label>${t(lang, "repository")}<input id="repo-github" value="${esc(item.repo || "")}" placeholder="owner/repo" /></label>
      <label>${t(lang, "event")}<select id="route-github">${["pull_request", "push", "issues"].map((event) => `<option ${item.route === event ? "selected" : ""}>${event}</option>`).join("")}</select></label>
      <ul class="secrets">${CHANNEL_NEEDS.github.secrets.map((name) => `<li><strong>${name}</strong><span>${t(lang, "secret_after_save")}</span></li>`).join("")}</ul>
      <p class="hint">${t(lang, "github_hint")}</p>
    </div>
    <div class="assist" data-for="gitlab"${show("gitlab")}>
      <label>${t(lang, "repository")}<input id="repo-gitlab" value="${esc(item.repo || "")}" placeholder="group/project" /></label>
      <label>${t(lang, "event")}<select id="route-gitlab">${["merge_request", "push", "note"].map((event) => `<option ${item.route === event ? "selected" : ""}>${event}</option>`).join("")}</select></label>
      <ul class="secrets">${CHANNEL_NEEDS.gitlab.secrets.map((name) => `<li><strong>${name}</strong><span>${t(lang, "secret_after_save")}</span></li>`).join("")}</ul>
      <p class="hint">${t(lang, "gitlab_hint")}</p>
    </div>
    <div class="assist" data-for="bitbucket"${show("bitbucket")}>
      <label>${t(lang, "repository")}<input id="repo-bitbucket" value="${esc(item.repo || "")}" placeholder="workspace/repo" /></label>
      <label>${t(lang, "event")}<select id="route-bitbucket">${["pull_request", "push"].map((event) => `<option ${item.route === event ? "selected" : ""}>${event}</option>`).join("")}</select></label>
      <ul class="secrets">${CHANNEL_NEEDS.bitbucket.secrets.map((name) => `<li><strong>${name}</strong><span>${t(lang, "secret_after_save")}</span></li>`).join("")}</ul>
      <p class="hint">${t(lang, "bitbucket_hint")}</p>
    </div>
    <label>${t(lang, "note")}<textarea id="extra">${esc(item.body)}</textarea></label>${foot}`;
}

function palette(project: Project, ui: Ui): string {
  const lang = langOf(ui);
  const optional = (kind: "limits" | "think", on: boolean) => {
    const label = kind === "limits" ? kindLabel(lang, "limits") : kindLabel(lang, "agent");
    const blurb = kind === "limits" ? t(lang, "purpose_limits") : t(lang, "purpose_agent");
    return `<button type="button" class="chip ${kind}" draggable="${on ? "false" : "true"}" data-kind="${kind}" ${on ? "disabled" : ""} title="${on ? esc(t(lang, "already_on")) : esc(t(lang, "add_to_canvas"))}"><span class="mark">${icon(kind === "limits" ? "limits" : "agent")}</span><span class="copy"><span class="k">${label}</span><span class="hint">${blurb}</span></span></button>`;
  };
  const chips = KINDS.map(
    (kind) => `<button type="button" class="chip ${kind}" draggable="true" data-kind="${kind}"><span class="mark">${icon(kind)}</span><span class="copy"><span class="k">${kindLabel(lang, kind)}</span><span class="hint">${purpose(lang, kind)}</span></span></button>`,
  ).join("");
  const rows = [
    project.limits ? `<button type="button" class="item scope${ui.selected === "scope" ? " on" : ""}" data-id="scope">${kindLabel(lang, "limits")} · ${t(lang, "scope_name")}</button>` : "",
    project.think ? `<button type="button" class="item agent${ui.selected === "agent" ? " on" : ""}" data-id="agent">${kindLabel(lang, "agent")} · ${esc(project.name)}</button>` : "",
    ...project.items.map((item) => {
      const id = `${item.kind}:${item.name}`;
      return `<button type="button" class="item ${item.kind}${id === ui.selected ? " on" : ""}" data-id="${esc(id)}">${esc(kindLabel(lang, item.kind))} · ${esc(item.name)}</button>`;
    }),
  ]
    .filter(Boolean)
    .join("");
  return `<p class="hint">${t(lang, "palette_hint")}</p>
    <div class="chips">${optional("limits", project.limits)}${optional("think", project.think)}${chips}</div>
    <h3>${t(lang, "on_canvas")}</h3>
    ${rows || `<p class="hint">${t(lang, "none_yet")}</p>`}`;
}

function langSwitch(lang: Lang): string {
  return `<div class="langs" role="group" aria-label="${esc(t(lang, "language"))}"><button type="button" data-set-lang="en" class="${lang === "en" ? "on" : ""}">English</button><button type="button" data-set-lang="es" class="${lang === "es" ? "on" : ""}">Español</button></div>`;
}

export function libraryHtml(project: Project | null, ui: Ui, hasFolder: boolean): string {
  const lang = langOf(ui);
  const body = !hasFolder
    ? `<div class="pad">${langSwitch(lang)}<h2>${t(lang, "canvas")}</h2><p class="hint">${t(lang, "sidebar_closed")}</p></div>`
    : `<div class="pad">${langSwitch(lang)}<h2>${t(lang, "canvas")}</h2><p class="hint">${project ? t(lang, "sidebar_ready") : t(lang, "sidebar_empty")}</p>
        <button type="button" id="open" class="primary">${t(lang, "show_canvas")}</button>
        ${project ? `<div class="row"><button type="button" data-show="library">${t(lang, "show_library")}</button><button type="button" data-show="inspector">${t(lang, "show_properties")}</button></div>` : ""}</div>`;
  return shell(
    `<style>
      body { background: var(--vscode-sideBar-background); }
      .pad { padding: 14px; }
      .langs { display: flex; gap: 2px; width: fit-content; margin-bottom: 12px; padding: 2px; border-radius: 8px; background: color-mix(in srgb, var(--vscode-foreground) 8%, transparent); }
      .langs button { background: transparent; border-radius: 6px; }
      .langs button.on { background: var(--vscode-editor-background); outline: 0; }
    </style></head><body>${body}`,
    `const vscode = acquireVsCodeApi();
    document.getElementById("open")?.addEventListener("click", () => vscode.postMessage({ type: "open" }));
    for (const button of document.querySelectorAll("[data-show]")) {
      button.addEventListener("click", () => vscode.postMessage({ type: "chrome", [button.dataset.show + "Open"]: true, focus: true }));
    }
    for (const button of document.querySelectorAll("[data-set-lang]")) {
      button.addEventListener("click", () => {
        if (button.classList.contains("on")) return;
        vscode.postMessage({ type: "lang", lang: button.dataset.setLang });
      });
    }`,
    lang,
  );
}

function spot(layout: Layout, home: Layout, id: string): { at: { x: number; y: number }; origin: { x: number; y: number } } {
  return { at: layout.positions[id] || { x: 40, y: 40 }, origin: home.positions[id] || layout.positions[id] || { x: 40, y: 40 } };
}

export function designerHtml(project: Project | null, ui: Ui, hasFolder = true, scan?: Scan, suggestedName = "", layout?: Layout, home?: Layout, saved = false, studio?: Studio, ship?: ShipStatus): string {
  const lang = langOf(ui);
  const channels = project?.items.filter((item) => item.kind === "channel") ?? [];
  const tools = project?.items.filter((item) => item.kind === "tool") ?? [];
  const skills = project?.items.filter((item) => item.kind === "skill") ?? [];
  const mcps = project?.items.filter((item) => item.kind === "mcp") ?? [];
  const needs = project ? cardNeeds(project) : [];
  const gaps = new Set(needs.map((row) => row.id));
  const hintFor = (id: string, purposeKey: CopyKey) => {
    const missing = needs.filter((row) => row.id === id).flatMap((row) => row.missing);
    const purposeText = t(lang, purposeKey);
    return missing.length ? `${purposeText} ${missing.map((line) => phrase(lang, line)).join(" ")}` : purposeText;
  };
  const report = project ? flowReport(project) : { ready: true, secrets: [] as string[], cards: [] as { id: string; missing: string[] }[], folder: [] as string[] };
  const bearerOpen = Boolean(project?.secrets.some((secret) => secret.name === "AGENT_SDK_BEARER_TOKEN" && !secret.configured));
  const bearerWarn = bearerOpen ? `<div class="warn"><button type="button" class="attention" data-set-secret="AGENT_SDK_BEARER_TOKEN">${esc(t(lang, "set_secret", { name: "AGENT_SDK_BEARER_TOKEN" }))}</button><h3>${t(lang, "bearer_warn_h")}</h3><p>${t(lang, "bearer_why")}</p></div>` : "";
  const flowDialog = `<div id="flow-sim" class="result" role="dialog" aria-labelledby="flow-sim-title" hidden><header><strong id="flow-sim-title">${t(lang, "flow_check")}</strong><button type="button" id="flow-sim-close">${t(lang, "close")}</button></header><p class="verdict">${report.ready ? t(lang, "flow_ready") : t(lang, "flow_not_ready")}</p>${report.secrets.length ? `<h3>${t(lang, "still_secrets")}</h3><ul>${report.secrets.map((name) => `<li>${esc(phrase(lang, `${name} is empty. Set it in Secrets.`))} <button type="button" class="primary" data-set-secret="${esc(name)}">${esc(t(lang, "set_secret", { name }))}</button></li>`).join("")}</ul>` : ""}${report.cards.length ? `<h3>${t(lang, "still_cards")}</h3><ul>${report.cards.flatMap((row) => row.missing).map((line) => `<li>${esc(phrase(lang, line))}</li>`).join("")}</ul>` : ""}${report.folder.length ? `<h3>${t(lang, "still_folder")}</h3><ul>${report.folder.map((line) => `<li>${esc(phrase(lang, line))}</li>`).join("")}</ul>` : ""}${bearerWarn}</div>`;
  const nodeIds = project ? [...(project.limits ? ["scope"] : []), ...(project.think ? ["agent"] : []), ...project.items.map((item) => `${item.kind}:${item.name}`)] : [];
  const steps = project && layout ? executionSteps(nodeIds, flowLinks(project, layout)) : {};
  const stepCounts = new Map<number, number>();
  for (const step of Object.values(steps)) stepCounts.set(step, (stepCounts.get(step) || 0) + 1);
  const badge = (id: string) => stepBadge(steps, stepCounts, id, lang);
  const libraryWidth = Math.min(480, Math.max(200, ui.libraryWidth || 240));
  const inspectorWidth = Math.min(480, Math.max(200, ui.inspectorWidth || 300));
  const flow = project
    ? `<div class="stage">
        ${ui.libraryOpen !== false ? `<aside class="rail left" style="width:${libraryWidth}px"><header class="railhead"><h2>${t(lang, "library")}</h2><button type="button" class="hide" data-chrome="library">${t(lang, "hide")}</button></header><div class="sash" data-sash="library"></div><div class="railbody">${palette(project, ui)}</div></aside>` : `<button type="button" class="tab" data-chrome="library">${t(lang, "show_library")}</button>`}
        <div class="canvascol">
          <div class="leadrow">
            <p class="lead" id="lead">${t(lang, "lead")}</p>
            <div id="saved" class="saved" data-flash="${saved ? "1" : "0"}" title="${esc(t(lang, "saved_title"))}"><svg class="tick" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 8.5 L6.5 11.5 L12.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span id="saved-label">${t(lang, "saved")}</span></div>
          </div>
          <div class="board" id="board" data-look="${layout?.look || "clear"}" data-links="${esc(JSON.stringify(project && layout ? flowLinks(project, layout) : []))}" data-steps="${esc(JSON.stringify(steps))}">
            <div class="editbar">
              <button type="button" id="undo" title="${esc(t(lang, "undo_title"))}">${t(lang, "undo")}</button>
              <button type="button" id="redo" title="${esc(t(lang, "redo_title"))}">${t(lang, "redo")}</button>
              <button type="button" id="duplicate" title="${esc(ui.selected === "agent" ? t(lang, "duplicate_agent") : ui.selected === "scope" ? t(lang, "duplicate_limits") : t(lang, "duplicate_title"))}" ${ui.selected.includes(":") ? "" : "disabled"}>${t(lang, "duplicate")}</button>
              <button type="button" id="delete-node" title="${esc(ui.selected === "scope" || ui.selected === "agent" ? t(lang, "delete_card") : t(lang, "delete_title"))}" ${ui.selected.includes(":") || ui.selected === "scope" || ui.selected === "agent" ? "" : "disabled"}>${t(lang, "delete")}</button>
              <button type="button" id="simulate-flow">${t(lang, "simulate")}</button>
            </div>
            <div class="surface" id="surface" style="width:${Math.max(1200, ...Object.values(layout?.positions || { a: { x: 0 } }).map((point) => point.x + 280))}px;height:${Math.max(720, ...Object.values(layout?.positions || { a: { y: 0 } }).map((point) => point.y + 200))}px;transform:translate(${layout?.pan.x || 24}px,${layout?.pan.y || 16}px) scale(${layout?.zoom || 1})">
              <svg id="wires"></svg>
              ${channels.map((item) => nodeButton(item, ui.selected, spot(layout!, home!, `channel:${item.name}`).at, spot(layout!, home!, `channel:${item.name}`).origin, gaps.has(`channel:${item.name}`), badge(`channel:${item.name}`), lang, hintFor(`channel:${item.name}`, "purpose_channel"))).join("")}
              ${project.limits ? (() => { const place = spot(layout!, home!, "scope"); return `<button type="button" class="node scope ${ui.selected === "scope" ? "on" : ""}${gaps.has("scope") ? " gap" : ""}" data-id="scope" title="${esc(hintFor("scope", "purpose_limits"))}" style="left:${place.at.x}px;top:${place.at.y}px" data-home-x="${place.origin.x}" data-home-y="${place.origin.y}">${badge("scope")}<span class="mark">${icon("limits")}</span><span class="copy"><span class="k">${kindLabel(lang, "limits")}</span><strong>${t(lang, "scope_name")}</strong><em>${esc((project.scope || t(lang, "scope_fallback")).replace(/\s+/g, " ").slice(0, 90))}</em></span></button>`; })() : ""}
              ${project.think ? (() => { const place = spot(layout!, home!, "agent"); const model = project.model === "fast" ? t(lang, "fast_model") : project.model === "strong" ? t(lang, "strong_model") : t(lang, "auto_model"); return `<button type="button" class="node agent ${ui.selected === "agent" ? "on" : ""}${gaps.has("agent") ? " gap" : ""}" data-id="agent" title="${esc(hintFor("agent", "purpose_agent"))}" style="left:${place.at.x}px;top:${place.at.y}px" data-home-x="${place.origin.x}" data-home-y="${place.origin.y}">${badge("agent")}<span class="mark">${icon("agent")}</span><span class="copy"><span class="k">${kindLabel(lang, "agent")}</span><strong>${esc(project.name)}</strong><em>${model}</em></span></button>`; })() : ""}
              ${tools.map((item) => nodeButton(item, ui.selected, spot(layout!, home!, `tool:${item.name}`).at, spot(layout!, home!, `tool:${item.name}`).origin, gaps.has(`tool:${item.name}`), badge(`tool:${item.name}`), lang, hintFor(`tool:${item.name}`, "purpose_tool"))).join("")}
              ${skills.map((item) => nodeButton(item, ui.selected, spot(layout!, home!, `skill:${item.name}`).at, spot(layout!, home!, `skill:${item.name}`).origin, gaps.has(`skill:${item.name}`), badge(`skill:${item.name}`), lang, hintFor(`skill:${item.name}`, "purpose_skill"))).join("")}
              ${(project.items.filter((item) => item.kind === "schedule")).map((item) => nodeButton(item, ui.selected, spot(layout!, home!, `schedule:${item.name}`).at, spot(layout!, home!, `schedule:${item.name}`).origin, gaps.has(`schedule:${item.name}`), badge(`schedule:${item.name}`), lang, hintFor(`schedule:${item.name}`, "purpose_schedule"))).join("")}
              ${(project.items.filter((item) => item.kind === "subagent")).map((item) => nodeButton(item, ui.selected, spot(layout!, home!, `subagent:${item.name}`).at, spot(layout!, home!, `subagent:${item.name}`).origin, gaps.has(`subagent:${item.name}`), badge(`subagent:${item.name}`), lang, hintFor(`subagent:${item.name}`, "purpose_subagent"))).join("")}
              ${(project.items.filter((item) => item.kind === "hook")).map((item) => nodeButton(item, ui.selected, spot(layout!, home!, `hook:${item.name}`).at, spot(layout!, home!, `hook:${item.name}`).origin, gaps.has(`hook:${item.name}`), badge(`hook:${item.name}`), lang, hintFor(`hook:${item.name}`, "purpose_hook"))).join("")}
              ${mcps.map((item) => nodeButton(item, ui.selected, spot(layout!, home!, `mcp:${item.name}`).at, spot(layout!, home!, `mcp:${item.name}`).origin, gaps.has(`mcp:${item.name}`), badge(`mcp:${item.name}`), lang, hintFor(`mcp:${item.name}`, "purpose_mcp"))).join("")}
              ${(project.items.filter((item) => item.kind === "host")).map((item) => nodeButton(item, ui.selected, spot(layout!, home!, `host:${item.name}`).at, spot(layout!, home!, `host:${item.name}`).origin, gaps.has(`host:${item.name}`), badge(`host:${item.name}`), lang, hintFor(`host:${item.name}`, "purpose_host"))).join("")}
            </div>
            <div class="dock">
              <button type="button" id="zoom-out" title="${esc(t(lang, "zoom_out"))}">−</button>
              <button type="button" id="zoom-in" title="${esc(t(lang, "zoom_in"))}" aria-label="${esc(t(lang, "zoom_in"))}"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="6.5" cy="6.5" r="4" fill="none" stroke="currentColor"/><path d="M9.5 9.5 L13 13 M6.5 4.8 V8.2 M4.8 6.5 H8.2" stroke="currentColor" fill="none"/></svg></button>
              <button type="button" id="zoom-fit" title="${esc(t(lang, "fit_title"))}">${t(lang, "fit")}</button>
              <button type="button" id="connect" title="${esc(t(lang, "connect_two_title"))}">${t(lang, "connect_two")}</button>
              <span id="zoom-label">${Math.round((layout?.zoom || 1) * 100)}%</span>
              <button type="button" id="look-btn" title="${esc(t(lang, "look_title"))}">${t(lang, "look")}</button>
              <button type="button" id="reset-layout" title="${esc(t(lang, "reset_title"))}">${t(lang, "reset")}</button>
            </div>
            <div id="look-menu" class="look" hidden>
              <button type="button" data-look="soft">${t(lang, "look_soft")}</button>
              <button type="button" data-look="clear">${t(lang, "look_clear")}</button>
              <button type="button" data-look="contrast">${t(lang, "look_contrast")}</button>
            </div>
          </div>
        </div>
        ${ui.inspectorOpen !== false ? `<aside class="rail right" style="width:${inspectorWidth}px"><div class="sash" data-sash="inspector"></div><header class="railhead"><button type="button" class="hide" data-chrome="inspector">${t(lang, "hide")}</button><h2>${t(lang, "properties")}</h2></header><div class="railbody">${needBanner(needs, ui.selected, lang)}${paintNeeds(inspector(project, ui.selected, lang), needs.find((row) => row.id === ui.selected)?.fields ?? [])}</div></aside>` : `<button type="button" class="tab right" data-chrome="inspector">${t(lang, "show_properties")}</button>`}
      </div>${flowDialog}`
    : "";
  const secrets = project
    ? `<div class="sheet"><p class="kicker">${t(lang, "secrets_kicker")}</p><h2>${t(lang, "secrets")}</h2><p class="hint">${t(lang, "secrets_hint")}</p>
        <ul class="secrets">${project.secrets.map((secret) => `<li class="${ui.secretFocus === secret.name && !secret.configured ? "need" : ""}"><strong>${esc(secret.name)}</strong><span>${secret.configured ? t(lang, "set_locally") : t(lang, "empty")}</span></li>`).join("") || `<li class="hint">${t(lang, "no_names")}</li>`}</ul>
        ${ui.secretFocus ? `<p class="hint">${esc(t(lang, "set_this", { name: ui.secretFocus }))}</p>` : ""}
        <label>${t(lang, "name")}<input id="secret-name" value="${esc(ui.secretFocus || "")}" placeholder="CURSOR_API_KEY" /></label>
        <label>${t(lang, "value")}<input id="secret-value" type="password" autocomplete="off" /></label>
        <div class="row"><button type="button" id="save-secret" class="primary">${t(lang, "save_secret")}</button></div></div>`
    : "";
  const local = ship ?? { docker: "unknown" as const, running: false, phase: "idle" as const, summary: "Checking this machine.", logs: "", publicUrl: "" };
  const busy = local.phase !== "idle";
  const connectLocked = local.phase === "webhook" || local.phase === "tunnel";
  const delivery = project ? deliveryCheck(project.root) : [];
  const face = shipFace(local, lang, delivery.length > 0);
  const summaryInner = face.summaryKind === "working"
    ? `<div class="working" role="status"><span class="spin" aria-hidden="true"></span><span class="worktext">${esc(face.summary)}</span><span class="bar" aria-hidden="true"></span></div>`
    : face.summaryKind === "error"
      ? `<p class="ship-error" role="alert">${esc(face.summary)}</p>`
      : `<p>${esc(face.summary)}</p>`;
  const telegram = project?.items.some((item) => item.kind === "channel" && item.description === "telegram") ?? false;
  const whatsapp = project?.items.some((item) => item.kind === "channel" && item.description === "whatsapp") ?? false;
  const telegramProblems = project && telegram ? telegramReach(project.root) : [];
  const whatsappProblems = project && whatsapp ? whatsappReach(project.root) : [];
  const problems = project
    ? [
        ...delivery.map((finding) => phrase(lang, finding.message)),
        ...telegramProblems.map((finding) => phrase(lang, finding.message)),
        ...whatsappProblems.map((finding) => phrase(lang, finding.message)),
        ...review(project).map((finding) => phrase(lang, finding.message)),
        ...project.secrets.filter((secret) => !secret.configured && secret.name !== "AGENT_SDK_BEARER_TOKEN").map((secret) => phrase(lang, `${secret.name} is empty. Set it in Secrets.`)),
      ]
    : [];
  const gcpBase = project ? readGcpLink(project.root) : defaultGcpLink();
  const gcp = !gcpBase.saved && project && hasPublicChannel(project) && gcpBase.exposure !== "internal" ? { ...gcpBase, minInstances: 1 } : gcpBase;
  const gcpExposure = gcp.project ? gcp.exposure : project && hasPublicChannel(project) ? "internet" : "internal";
  const shipTarget = ui.shipTarget === "gcp" || ui.shipTarget === "aws" || ui.shipTarget === "azure" ? ui.shipTarget : "local";
  const optionList = (options: readonly string[], current: string) => options.map((option) => `<option value="${esc(option)}"${option === current ? " selected" : ""}>${esc(option)}</option>`).join("");
  const envRows = (gcp.env.length ? gcp.env : [{ name: "", value: "" }]).map((row) => `<div class="row" data-env-row><label>${t(lang, "name")}<input data-env-name value="${esc(row.name)}" placeholder="LOG_LEVEL" autocomplete="off" /></label><label>${t(lang, "value")}<input data-env-value value="${esc(row.value)}" autocomplete="off" /></label></div>`).join("");
  const secretRows = project?.secrets.length
    ? project.secrets.map((secret) => `<li class="gcp-secret"><strong>${esc(secret.name)}</strong><span>${secret.configured ? t(lang, "gcp_secret_ready") : t(lang, "gcp_secret_empty")}</span><label>${t(lang, "gcp_secret_for")}<input type="password" data-gcp-secret="${esc(secret.name)}" autocomplete="off" placeholder="${esc(t(lang, "gcp_secret_ph"))}" /></label><button type="button" data-sync-one="${esc(secret.name)}">${t(lang, "gcp_sync_one")}</button></li>`).join("")
    : `<li class="hint">${t(lang, "gcp_no_secrets")}</li>`;
  const pin = project ? readImagePin(project.root) : null;
  const preview = gcpPreview({ agentName: project?.name || "", imageId: pin, project: gcp.project, region: gcp.region, url: gcp.url });
  const checks = gcpChecks({ imageId: pin, project: gcp.project, region: gcp.region, secrets: project?.secrets.map((secret) => ({ name: secret.name, configured: secret.configured })) || [] });
  const checkList = checks.map((row) => `<li class="${row.ok ? "ok" : "miss"}">${esc(phrase(lang, row.text))}</li>`).join("");
  const held = ui.gcpVerdict;
  const gcpState = held?.step === "current" ? "current" : held?.step === "other" ? "other" : held?.step === "unknown" ? "failed" : preview.state === "published" ? "running" : "stopped";
  const gcpLabel = held?.step === "current" ? t(lang, "gcp_up_to_date") : held?.step === "other" ? t(lang, "gcp_other_image") : held?.step === "unknown" ? t(lang, "gcp_unknown") : preview.state === "published" ? t(lang, "gcp_published") : preview.state === "need-image" ? t(lang, "gcp_need_image") : t(lang, "gcp_ready");
  const verdictHtml = `<p id="gcp-verdict" class="verdict ${esc(held?.step || "")}"${held?.text ? "" : " hidden"}>${esc(held?.text || "")}</p>`;
  const trailHtml = `<ol id="gcp-trail">${(ui.gcpTrail || []).map((line) => `<li>${esc(line)}</li>`).join("")}</ol>`;
  const gcpTabs = `<div class="gcp-sub" role="tablist"><button type="button" class="on" data-gcp-tab="status" role="tab" aria-selected="true">${t(lang, "gcp_tab_status")}</button><button type="button" data-gcp-tab="place" role="tab" aria-selected="false">${t(lang, "gcp_tab_place")}</button><button type="button" data-gcp-tab="scale" role="tab" aria-selected="false">${t(lang, "gcp_tab_scale")}</button><button type="button" data-gcp-tab="secrets" role="tab" aria-selected="false">${t(lang, "gcp_tab_secrets")}</button><button type="button" data-gcp-tab="env" role="tab" aria-selected="false">${t(lang, "gcp_tab_env")}</button><button type="button" data-gcp-tab="monitor" role="tab" aria-selected="false">${t(lang, "gcp_tab_monitor")}</button></div>`;
  const gcpCard = `<div class="gcp-pane" data-gcp-pane="status"><div class="localbar" id="gcp-live"><header><span class="statusline" data-state="${gcpState}"><span data-gcp-label>${gcpLabel}</span></span><strong>${esc(project?.name || "")}</strong><span class="where">GCP</span></header>${verdictHtml}<p id="gcp-image" class="path"${preview.image ? "" : " hidden"}>${esc(t(lang, "image_pin"))} ${esc(preview.image)}</p><p id="gcp-service" class="path">${esc(t(lang, "gcp_publishes"))} ${esc(preview.service)}</p><p id="gcp-target" class="path"${preview.target ? "" : " hidden"}>${esc(preview.target)}</p><p id="gcp-summary">${esc(phrase(lang, preview.summary))}</p><ul id="gcp-checks" class="scan">${checkList}</ul><p id="gcp-clock" class="hint" hidden></p><p class="path"><a id="gcp-url" href="${esc(preview.url || "#")}"${preview.url ? "" : " hidden"}>${esc(preview.url)}</a></p><div class="row"><button type="button" id="gcp-build">${t(lang, "gcp_build")}</button><button type="button" id="gcp-deploy" class="primary">${t(lang, "gcp_deploy")}</button><button type="button" id="gcp-check">${t(lang, "gcp_check")}</button><button type="button" id="gcp-refresh">${t(lang, "gcp_live")}</button></div>${trailHtml}</div></div>`;
  const gcpForm = `<div id="gcp-form"><div class="gcp-pane" data-gcp-pane="place" hidden><label>${t(lang, "gcp_project")}<input id="gcp-project" value="${esc(gcp.project)}" placeholder="my-project" autocomplete="off" /></label><label>${t(lang, "gcp_region")}<input id="gcp-region" value="${esc(gcp.region)}" placeholder="us-central1" autocomplete="off" /></label><fieldset class="exposure"><label><input type="radio" name="gcp-exposure" value="internet"${gcpExposure === "internet" ? " checked" : ""} /> ${t(lang, "gcp_internet")}</label><p class="hint">${t(lang, "gcp_internet_h")}</p><label><input type="radio" name="gcp-exposure" value="internal"${gcpExposure === "internal" ? " checked" : ""} /> ${t(lang, "gcp_internal")}</label><p class="hint">${t(lang, "gcp_internal_h")}</p></fieldset></div><div class="gcp-pane" data-gcp-pane="scale" hidden><div class="scale"><label>${t(lang, "gcp_min")}<input id="gcp-min" type="number" min="0" max="20" step="1" value="${gcp.minInstances}" /></label><label>${t(lang, "gcp_max")}<input id="gcp-max" type="number" min="1" max="100" step="1" value="${gcp.maxInstances}" /></label><label>${t(lang, "gcp_concurrency")}<input id="gcp-concurrency" type="number" min="1" max="80" step="1" value="${gcp.concurrency}" /></label><label>${t(lang, "gcp_cpu")}<select id="gcp-cpu">${optionList(GCP_CPUS, gcp.cpu)}</select></label><label>${t(lang, "gcp_memory")}<select id="gcp-memory">${optionList(GCP_MEMORY, gcp.memory)}</select></label><label>${t(lang, "gcp_timeout")}<input id="gcp-timeout" type="number" min="15" max="3600" step="1" value="${gcp.timeout}" /></label></div><p class="hint">${t(lang, "gcp_scale_h")}</p></div><div class="gcp-pane" data-gcp-pane="secrets" hidden><div class="row"><h3>${t(lang, "gcp_secrets")}</h3><button type="button" id="gcp-sync">${t(lang, "gcp_sync")}</button></div><p class="hint">${t(lang, "gcp_secrets_h")}</p><ul class="secrets">${secretRows}</ul></div><div class="gcp-pane" data-gcp-pane="env" hidden><h3>${t(lang, "gcp_env")}</h3><p class="hint">${t(lang, "gcp_env_h")}</p><div id="gcp-env-list">${envRows}</div><div class="row"><button type="button" id="gcp-env-add">${t(lang, "gcp_env_add")}</button></div></div><div class="gcp-pane mon" data-gcp-pane="monitor" hidden><header class="mon-head"><div><p class="kicker">${t(lang, "gcp_tab_monitor")}</p><strong id="gcp-signal-headline" data-state="stopped">${esc(t(lang, "gcp_signal_empty"))}</strong></div><div class="mon-tools"><label>${t(lang, "gcp_every")}<select id="gcp-every" aria-label="${esc(t(lang, "gcp_every"))}"><option value="0">${t(lang, "gcp_every_off")}</option><option value="15">15 s</option><option value="30" selected>30 s</option><option value="60">60 s</option></select></label><button type="button" id="gcp-logs" class="primary">${t(lang, "gcp_logs")}</button></div></header><div id="gcp-meters"></div><figure class="chart-card"><figcaption>${t(lang, "gcp_chart_title")}</figcaption><div id="gcp-chart" class="chart"></div><p class="legend"><i class="ok"></i>${t(lang, "gcp_accepted")}<i class="miss"></i>${t(lang, "gcp_waiting")}<i class="bad"></i>${t(lang, "gcp_rejected")}</p></figure><div class="mon-read"><p id="gcp-signal-webhook"></p><p id="gcp-signal-turn"></p><p id="gcp-signal-advice"></p></div><p class="hint">${t(lang, "gcp_monitor_h")}</p><p class="path">${gcp.url ? `<a href="${esc(gcp.url)}">${esc(gcp.url)}</a>` : esc(t(lang, "gcp_no_url"))}</p><ul class="scan"><li>${esc(t(lang, "gcp_min"))} ${gcp.minInstances} · ${esc(t(lang, "gcp_max"))} ${gcp.maxInstances}</li><li>${esc(gcp.cpu)} CPU · ${esc(gcp.memory)} · ${gcp.timeout}s</li>${gcp.minInstances === 0 && gcpExposure === "internet" ? `<li class="miss">${esc(t(lang, "gcp_cold"))}</li>` : ""}</ul></div></div>`;
  const deploy = project
    ? `<div class="sheet fill ship">
        <div class="ship-tabs" role="tablist"><button type="button" class="${shipTarget === "local" ? "on" : ""}" data-target="local" role="tab" aria-selected="${shipTarget === "local"}">${t(lang, "local")}</button><button type="button" class="${shipTarget === "gcp" ? "on" : ""}" data-target="gcp" role="tab" aria-selected="${shipTarget === "gcp"}">GCP</button><button type="button" class="${shipTarget === "aws" ? "on" : ""}" data-target="aws" role="tab" aria-selected="${shipTarget === "aws"}">AWS</button><button type="button" class="${shipTarget === "azure" ? "on" : ""}" data-target="azure" role="tab" aria-selected="${shipTarget === "azure"}">Azure</button></div>
        <div class="ship-local" data-ship-panel="local"${shipTarget === "local" ? "" : " hidden"}>
        <div class="localbar" id="ship-live" ${face.ariaBusy ? `aria-busy="true"` : ""}><header><span class="statusline" data-state="${face.state}">${face.ariaBusy ? `<span class="spin" aria-hidden="true"></span>` : ""}<span data-status>${esc(face.label)}</span></span><strong data-agent>${esc(project.name)}</strong><span class="where">${t(lang, "local")}</span></header><p id="ship-image" class="path"${face.image ? "" : " hidden"}>${esc(t(lang, "image_pin"))} ${esc(face.image)}</p><div id="ship-summary">${summaryInner}</div><div class="meters"><span><em>${t(lang, "cpu")}</em><b id="meter-cpu">${esc(face.cpu)}</b></span><span><em>${t(lang, "memory")}</em><b id="meter-memory">${esc(face.memory)}</b></span><span><em>${t(lang, "health")}</em><b id="meter-health">${esc(face.health)}</b></span><span><em>${t(lang, "error_count")}</em><b id="meter-errors">${esc(face.errors)}</b></span><span><em>${t(lang, "window_span")}</em><b id="meter-window">${esc(face.window)}</b></span></div><p class="hint">${t(lang, "monitor_hint")}</p><p id="ship-last-error" class="hint"${face.lastError === "—" ? " hidden" : ""}>${esc(t(lang, "last_error"))}: ${esc(face.lastError)}</p><p class="path" id="ship-path">${esc(face.playgroundLine)} · http://127.0.0.1:3000/playground</p>
          <div class="row"><button type="button" id="ship-start" class="primary" ${face.startDisabled ? "disabled" : ""} title="${esc(face.summary)}">${esc(face.startText)}</button><button type="button" id="open-playground" ${face.playgroundDisabled ? "disabled" : ""}>${t(lang, "open_playground")}</button><button type="button" id="ship-rebuild" ${face.rebuildDisabled ? "disabled" : ""} title="${esc(t(lang, "rebuild_hint"))}">${t(lang, "rebuild")}</button><button type="button" id="ship-stop" ${face.stopDisabled ? "disabled" : ""}>${t(lang, "stop")}</button><button type="button" id="ship-refresh" ${face.refreshDisabled ? "disabled" : ""} title="${esc(t(lang, "refresh_does"))}">${t(lang, "refresh")}</button><button type="button" id="ship-logs">${t(lang, "follow_logs")}</button></div>
          ${delivery.length ? `<p class="hint">${t(lang, "start_off")}</p>` : ""}
          ${project.secrets.some((secret) => secret.name === "AGENT_SDK_BEARER_TOKEN" && !secret.configured) ? `<div class="bearer-note"><button type="button" class="attention" data-set-secret="AGENT_SDK_BEARER_TOKEN">${t(lang, "set_secret", { name: "AGENT_SDK_BEARER_TOKEN" })}</button><strong>AGENT_SDK_BEARER_TOKEN</strong><p>${t(lang, "bearer_why")}</p></div>` : ""}
        </div>
        <div class="ship-split"><button type="button" id="fold-status" aria-expanded="true" title="${esc(t(lang, "fold_status_title"))}">${t(lang, "fold_status")}</button><button type="button" id="fold-log" aria-expanded="true" title="${esc(t(lang, "fold_log_title"))}">${t(lang, "fold_log")}</button></div>
        <div class="logwrap">
          <div class="logbar">
            <input id="log-search" type="search" placeholder="${t(lang, "search_logs")}" aria-label="${t(lang, "search_logs")}" />
            <select id="log-level" aria-label="${t(lang, "log_level")}"><option value="all">${t(lang, "all_logs")}</option><option value="error">${t(lang, "errors")}</option><option value="warn">${t(lang, "warnings")}</option><option value="info">${t(lang, "info")}</option></select>
            <input id="log-from" type="datetime-local" aria-label="${t(lang, "log_from")}" />
            <input id="log-to" type="datetime-local" aria-label="${t(lang, "log_to")}" />
            <button type="button" data-clear-log>${t(lang, "clear_log")}</button>
          </div>
          <script type="application/json" id="log-seed">${JSON.stringify(local.logs.split(/\n/).map((line) => phrase(lang, line)).join("\n")).replace(/</g, "\\u003c")}</script>
          <pre id="ship-log" class="log"></pre>
        </div>
        ${problems.length ? `<details class="ship-more"><summary>${t(lang, "folder_notes")} (${problems.length})</summary><ul class="work">${problems.map((problem) => `<li><p>${esc(problem)}</p></li>`).join("")}</ul></details>` : ""}
        <div class="ship-foot" title="${esc(t(lang, "ship_foot"))}"><button type="button" id="rewrite-docker">${t(lang, "rewrite_docker")}</button><button type="button" id="run-validate">${t(lang, "check_project")}</button><button type="button" id="run-evals">${t(lang, "run_evals")}</button></div>
        </div>
        <section class="ship-cloud ship-stack" data-ship-panel="gcp"${shipTarget === "gcp" ? "" : " hidden"}>
          <p id="gcp-status" class="${ui.gcpNote ? "hint" : "hint"}"${ui.gcpNote ? "" : " hidden"}>${esc(ui.gcpNote || "")}</p>
          ${gcpTabs}
          <div class="cloud-top" id="gcp-deploy-pane">${gcpCard}${gcpForm}</div>
          <div class="ship-split"><button type="button" id="fold-gcp-top" aria-expanded="true" title="${esc(t(lang, "fold_deploy_title"))}">${t(lang, "fold_status")}</button><button type="button" id="fold-gcp-bottom" aria-expanded="true" title="${esc(t(lang, "fold_run_title"))}">${t(lang, "fold_log")}</button></div>
          <div class="cloud-bottom" id="gcp-run-pane"><div class="row"><h3>${t(lang, "gcp_title")}</h3><button type="button" data-clear-log>${t(lang, "clear_log")}</button></div><pre id="gcp-log" class="log"></pre></div>
        </section>
        <section class="ship-cloud" data-ship-panel="aws"${shipTarget === "aws" ? "" : " hidden"}><h3>${t(lang, "aws_title")}</h3><p>${t(lang, "aws_body")}</p></section>
        <section class="ship-cloud" data-ship-panel="azure"${shipTarget === "azure" ? "" : " hidden"}><h3>${t(lang, "azure_title")}</h3><p>${t(lang, "azure_body")}</p></section>
        </div>`
    : "";
  const otherChannels = project ? project.items.filter((item) => item.kind === "channel" && !["telegram", "whatsapp", "slack", "github", "gitlab", "bitbucket"].includes(item.description || "")) : [];
  const slack = project?.items.some((item) => item.kind === "channel" && item.description === "slack") ?? false;
  const github = project?.items.some((item) => item.kind === "channel" && item.description === "github") ?? false;
  const gitlab = project?.items.some((item) => item.kind === "channel" && item.description === "gitlab") ?? false;
  const bitbucket = project?.items.some((item) => item.kind === "channel" && item.description === "bitbucket") ?? false;
  const slackProblems = project && slack ? slackReach(project.root) : [];
  const githubProblems = project && github ? hookSecretReach(project.root, "github") : [];
  const gitlabProblems = project && gitlab ? hookSecretReach(project.root, "gitlab") : [];
  const bitbucketProblems = project && bitbucket ? hookSecretReach(project.root, "bitbucket") : [];
  const channelLog = (id: string) => {
    const text = local.channelLogs?.[id] || "";
    const last = text.split("\n").map((line) => line.trim()).filter(Boolean).at(-1) || t(lang, "connect_quiet");
    const state = (id === "telegram" && local.phase === "webhook") || (id === "address" && local.phase === "tunnel") ? "busy" : /refused|did not|could not|empty|rejects/i.test(last) ? "failed" : /registered|answered|will call|Sent /i.test(last) ? "running" : "stopped";
    return `<p class="statusline" data-state="${state}"><span data-connect-status="${id}">${esc(last)}</span></p><pre class="log connect-log" data-connect-log="${id}">${esc(text || t(lang, "no_log"))}</pre>`;
  };
  const packCard = (id: string, title: string, text: string, problems: { message: string }[], extra = "") =>
    `<div class="localbar" ${connectLocked ? `aria-busy="true"` : ""}><header><span>${t(lang, "from_chat")}</span><strong>${title}</strong></header><p>${text}</p>${extra}${problems.length ? `<p class="hint">${esc(phrase(lang, problems[0].message))}</p>` : ""}${channelLog(id)}</div>`;
  const repoBlock = (type: string) => {
    const item = project?.items.find((entry) => entry.kind === "channel" && entry.description === type);
    const need = CHANNEL_NEEDS[type];
    const names = (need?.secrets || []).map((name) => `<li><strong>${name}</strong></li>`).join("");
    const repo = need?.repo ? (item?.repo ? `<p class="path">${esc(item.repo)}</p>` : `<p class="hint">${t(lang, "repo_missing")}</p>`) : "";
    return `${repo}<ul class="secrets">${names}</ul>`;
  };
  const publicBase = local.publicUrl || (project ? readGcpLink(project.root).url || "" : "");
  const hookPreview = publicChannelUrl(publicBase) || "";
  const absent = [
    ["whatsapp", "WhatsApp"],
    ["slack", "Slack"],
    ["github", "GitHub"],
    ["gitlab", "GitLab"],
    ["bitbucket", "Bitbucket"],
  ].filter(([id]) => !(project?.items.some((item) => item.kind === "channel" && item.description === id)));
  const connect = project
    ? `<div class="sheet fill"><p class="kicker">${t(lang, "outside")}</p><h2>${t(lang, "connect")}</h2><p class="hint">${t(lang, "connect_hint")}</p>
        ${telegram || whatsapp ? `<div class="localbar" ${connectLocked ? `aria-busy="true"` : ""}><header><span>${t(lang, "from_chat")}</span><strong>${t(lang, "public_address")}</strong></header><p>${t(lang, "public_shared")}</p><label>${t(lang, "public_address")}<input id="public-url" value="${esc(publicBase)}" placeholder="https://service.a.run.app" ${connectLocked ? "disabled" : ""} /></label><p id="hook-preview" class="path">${esc(hookPreview)}</p><div class="row"><button type="button" id="ship-tunnel" ${connectLocked ? "disabled" : ""}>${t(lang, "open_tunnel")}</button></div>${channelLog("address")}</div>` : ""}
        ${telegram ? `<div class="localbar" ${connectLocked ? `aria-busy="true"` : ""}><header><span>${t(lang, "from_chat")}</span><strong>Telegram</strong></header><p>${t(lang, "telegram_setup")}</p><div class="row"><button type="button" id="ship-webhook" class="primary" ${connectLocked || telegramProblems.length ? "disabled" : ""}>${local.phase === "webhook" ? t(lang, "registering") : t(lang, "register_webhook")}</button></div>${telegramProblems.length ? `<p class="hint">${t(lang, "register_off")}</p>` : ""}${channelLog("telegram")}</div>` : ""}
        ${whatsapp ? `<div class="localbar" ${connectLocked ? `aria-busy="true"` : ""}><header><span>${t(lang, "from_chat")}</span><strong>WhatsApp</strong></header><p>${t(lang, "whatsapp_setup")}</p><div class="row"><button type="button" id="whatsapp-check" ${connectLocked || whatsappProblems.length ? "disabled" : ""}>${t(lang, "whatsapp_check")}</button></div><label>${t(lang, "whatsapp_to")}<input id="whatsapp-to" placeholder="573001112233" ${connectLocked ? "disabled" : ""} /></label><div class="row"><button type="button" id="whatsapp-send" class="primary" ${connectLocked || whatsappProblems.length ? "disabled" : ""}>${t(lang, "whatsapp_send")}</button></div>${whatsappProblems.length ? `<p class="hint">${t(lang, "whatsapp_off")}</p>` : ""}${channelLog("whatsapp")}</div>` : ""}
        ${slack ? packCard("slack", "Slack", t(lang, "slack_setup"), slackProblems, `<div class="row"><button type="button" id="slack-check" ${connectLocked || slackProblems.length ? "disabled" : ""}>${t(lang, "slack_check")}</button></div>`) : ""}
        ${github ? packCard("github", "GitHub", t(lang, "github_setup"), githubProblems, repoBlock("github")) : ""}
        ${gitlab ? packCard("gitlab", "GitLab", t(lang, "gitlab_setup"), gitlabProblems, repoBlock("gitlab")) : ""}
        ${bitbucket ? packCard("bitbucket", "Bitbucket", t(lang, "bitbucket_setup"), bitbucketProblems, repoBlock("bitbucket")) : ""}
        ${absent.map(([, title]) => `<article class="env"><header><span>${t(lang, "channel")}</span><strong>${title}</strong></header><p>${esc(t(lang, "channel_absent", { name: title }))}</p></article>`).join("")}
        ${!telegram && !whatsapp && !slack && !github && !gitlab && !bitbucket ? `<p class="hint">${t(lang, "add_channel")}</p>` : ""}
        ${otherChannels.map((item) => `<article class="env"><header><span>${t(lang, "channel")}</span><strong>${esc(item.name)}</strong></header><p>${t(lang, "channel_later")}</p></article>`).join("")}
        ${telegramProblems.length ? `<ul class="work">${telegramProblems.map((finding) => `<li><p>${esc(phrase(lang, finding.message))}</p></li>`).join("")}</ul>` : ""}
        ${whatsappProblems.length ? `<ul class="work">${whatsappProblems.map((finding) => `<li><p>${esc(phrase(lang, finding.message))}</p></li>`).join("")}</ul>` : ""}</div>`
    : "";
  const prove = project
    ? `<div class="sheet wide"><p class="kicker">${t(lang, "fixed_cases")}</p><h2>${t(lang, "prove")}</h2><p class="hint">${t(lang, "prove_hint")}</p>
        <ul class="work">${(studio?.evals || []).map((suite) => `<li><div><strong>${esc(suite.file)}</strong><p class="hint">${suite.cases.length ? esc(suite.cases.join(", ")) : t(lang, "no_case")}</p></div><button type="button" data-open="${esc(suite.file)}">${t(lang, "open_file")}</button></li>`).join("") || `<li class="hint">${t(lang, "no_eval")}</li>`}</ul>
        <form id="eval-form"><label>${t(lang, "case_id")}<input name="name" placeholder="in-scope" required /></label><label>${t(lang, "prompt")}<textarea name="prompt" placeholder="How do I reset my password?"></textarea></label><label>${t(lang, "check")}<select name="check"><option value="lookup">${t(lang, "must_lookup")}</option><option value="no-escalate">${t(lang, "must_not")}</option></select></label><div class="row"><button type="submit" class="primary">${t(lang, "add_case")}</button><button type="button" id="run-evals">${t(lang, "run_evals")}</button></div></form></div>`
    : "";
  const platform = project
    ? `<div class="sheet wide"><p class="kicker">${t(lang, "outside_drawing")}</p><h2>${t(lang, "platform")}</h2><p class="hint">${t(lang, "platform_hint")}</p>
        <ul class="work">${(studio?.files || []).map((file) => { const label = studioText(lang, file); return `<li><div><strong>${esc(label.title)}</strong><p class="hint">${esc(label.detail)}</p><p class="path">${esc(file.path)}</p></div><button type="button" data-open="${esc(file.path)}" data-create="${esc(file.id)}">${file.present ? t(lang, "open_file") : t(lang, "create_file")}</button></li>`; }).join("")}</ul></div>`
    : "";
  const checklist = scan
    ? `<ul class="scan">${scan.found.map((piece) => `<li class="ok">${esc(piece.label)}</li>`).join("")}${scan.missing.map((piece) => `<li class="miss">${esc(piece.label)}</li>`).join("")}</ul>`
    : "";
  const repair =
    project && scan && scan.missing.length > 0
      ? `<p class="banner">${t(lang, "missing")} ${esc(scan.missing.map((piece) => piece.label).join(", "))}. <button type="button" id="repair">${t(lang, "repair")}</button></p>`
      : "";
  const examplesPage = `<div class="sheet fill"><p class="kicker">${t(lang, "examples_kicker")}</p><h2>${t(lang, "examples")}</h2><p class="hint">${t(lang, "examples_hint")}</p>
        <div class="row"><button type="button" id="open-guide" class="primary">${t(lang, "open_guide")}</button></div>
        <div class="row"><button type="button" id="keep-folder">${t(lang, "keep_folder")}</button><button type="button" id="restore-folder">${t(lang, "restore_folder")}</button></div>
        ${EXAMPLES.map((example) => { const label = exampleText(lang, example); return `<article class="env"><header><span>${esc(label.level)}</span><strong>${esc(example.title)}</strong></header><p>${esc(label.summary)}</p><div class="row"><button type="button" class="primary" data-example="${esc(example.id)}">${t(lang, "load")}</button></div></article>`; }).join("")}</div>`;
  const help = `<div id="help" class="help"${ui.helpOpen ? "" : " hidden"}><div class="helpcard" role="dialog" aria-labelledby="help-title"><header><strong id="help-title">${t(lang, "help_title")}</strong><button type="button" id="help-close">${t(lang, "close")}</button></header>
      <h3>${t(lang, "help_path_h")}</h3><ol class="path"><li><strong>${t(lang, "path1_h")}</strong>${t(lang, "path1")}</li><li><strong>${t(lang, "path2_h")}</strong>${t(lang, "path2")}</li><li><strong>${t(lang, "path3_h")}</strong>${t(lang, "path3")}</li><li><strong>${t(lang, "path4_h")}</strong>${t(lang, "path4")}</li><li><strong>${t(lang, "path5_h")}</strong>${t(lang, "path5")}</li></ol>
      <h3>${t(lang, "help_need_h")}</h3><p>${t(lang, "help_key")}</p><p>${t(lang, "help_docker")}</p>
      <h3>${t(lang, "help_sdk_h")}</h3><p>${t(lang, "help_sdk")}</p>
      <h3>${t(lang, "help_what_h")}</h3><p>${t(lang, "help_what")}</p>
      <h3>${t(lang, "help_where_h")}</h3><ul class="where"><li>${t(lang, "where_design")}</li><li>${t(lang, "where_secrets")}</li><li>${t(lang, "where_connect")}</li><li>${t(lang, "where_ship")}</li><li>${t(lang, "where_examples")}</li></ul>
      <div class="row"><button type="button" id="help-guide" class="primary">${t(lang, "open_guide")}</button></div></div></div>`;
  const body = !hasFolder
    ? `<div class="empty"><h2>${t(lang, "open_folder")}</h2><p class="hint">${t(lang, "open_folder_hint")}</p></div>`
    : ui.mode === "examples"
      ? examplesPage
      : !project
      ? `<form id="create-form" class="start"><h2>${t(lang, "init_title")}</h2><p class="lead-in">${scan && scan.found.length ? t(lang, "init_keep") : t(lang, "init_lead")}</p>${scan && scan.found.length ? checklist : ""}<section class="example-box"><h3>${t(lang, "init_examples_title")}</h3><div class="picks">${EXAMPLES.map((example) => { const label = exampleText(lang, example); return `<button type="button" class="pick primary" data-init-example="${esc(example.id)}"><strong>${esc(example.title)}</strong><span>${esc(label.summary)}</span></button>`; }).join("")}</div></section><section class="blank"><h3>${t(lang, "init_blank_h")}</h3><label>${t(lang, "name")}<input name="name" value="${esc(suggestedName)}" required /></label><div class="row"><button type="submit">${t(lang, "init_button")}</button><button type="button" id="open-guide">${t(lang, "open_guide")}</button></div></section></form>`
      : ui.mode === "prove"
        ? prove
        : ui.mode === "platform"
          ? platform
          : ui.mode === "secrets"
            ? secrets
            : ui.mode === "connect"
              ? connect
              : ui.mode === "deploy"
                ? deploy
                : flow;
  const data = JSON.stringify({
    selected: ui.selected,
    libraryOpen: ui.libraryOpen !== false,
    inspectorOpen: ui.inspectorOpen !== false,
  }).replace(/</g, "\\u003c");
  return shell(
    `<style>
      header.bar { display: flex; gap: 8px; align-items: center; padding: 10px 16px; border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,.28)); }
      header.bar strong { font-size: 13px; font-weight: 600; letter-spacing: .01em; }
      .bar-end { margin-left: auto; display: flex; align-items: center; gap: 8px; }
      .langs { display: flex; gap: 2px; padding: 2px; border-radius: 8px; background: color-mix(in srgb, var(--vscode-foreground) 8%, transparent); }
      .langs button { background: transparent; border-radius: 6px; font-weight: 600; }
      .langs button.on { background: var(--vscode-editor-background); outline: 0; }
      .helpbtn { font-weight: 600; }
      .help { position: fixed; inset: 0; z-index: 30; display: flex; justify-content: flex-end; background: color-mix(in srgb, #000 28%, transparent); }
      .help[hidden] { display: none; }
      .helpcard { width: min(440px, 100%); height: 100%; overflow: auto; box-sizing: border-box; padding: 16px 18px 32px; background: var(--vscode-editor-background); border-left: 1px solid var(--vscode-widget-border, rgba(128,128,128,.4)); }
      .helpcard header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
      .helpcard header strong { margin-right: auto; font-size: 16px; }
      .helpcard h3 { margin: 18px 0 6px; }
      .helpcard p, .helpcard li { font-size: 13px; line-height: 1.5; }
      ol.path { margin: 8px 0 0; padding-left: 1.2rem; }
      ol.path li { margin: 10px 0; }
      ol.path strong { display: block; }
      ul.where { margin: 8px 0 0; padding-left: 1.2rem; }
      .modes { display: flex; gap: 2px; padding: 2px; border-radius: 8px; background: color-mix(in srgb, var(--vscode-foreground) 8%, transparent); flex-wrap: wrap; }
      .modes button { background: transparent; border-radius: 6px; }
      .modes button.on { background: var(--vscode-editor-background); outline: 0; }
      main { flex: 1; display: flex; min-height: 0; min-width: 0; }
      .stage { flex: 1; display: flex; min-height: 0; min-width: 0; }
      .rail { position: relative; flex: none; display: flex; flex-direction: column; min-height: 0; background: var(--vscode-sideBar-background); }
      .rail.left { border-right: 1px solid var(--vscode-widget-border, rgba(128,128,128,.35)); }
      .rail.right { border-left: 1px solid var(--vscode-widget-border, rgba(128,128,128,.35)); }
      .railhead { display: flex; align-items: center; gap: 8px; padding: 10px 10px 4px 12px; }
      .rail.right .railhead h2 { margin-right: auto; }
      .rail.left .railhead h2 { margin-right: auto; }
      .railbody { flex: 1; min-height: 0; overflow: auto; padding: 4px 12px 8px; }
      .railbody .savebar { position: sticky; bottom: 0; z-index: 2; margin: 12px -12px 0; padding: 10px 12px; background: var(--vscode-sideBar-background, var(--vscode-editor-background)); border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,.35)); }
      .savebar .primary:active { transform: translateY(1px); }
      .savebar .primary.hit { transform: scale(.98); }
      .savebar .primary.done { background: #16a34a; color: #fff; }
      .sash { position: absolute; top: 0; bottom: 0; width: 6px; cursor: col-resize; z-index: 3; }
      .rail.left .sash { right: -3px; }
      .rail.right .sash { left: -3px; }
      .hide { min-height: 32px; padding: 6px 12px; font-size: 13px; font-weight: 600; border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.45)); border-radius: 8px; }
      .tab { flex: none; width: 44px; padding: 12px 6px; border-radius: 0; writing-mode: vertical-rl; letter-spacing: .04em; font-size: 13px; font-weight: 600; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border-right: 1px solid var(--vscode-widget-border, rgba(128,128,128,.35)); }
      .tab.right { border-right: 0; border-left: 1px solid var(--vscode-widget-border, rgba(128,128,128,.35)); }
      .canvascol { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
      .board { position: relative; flex: 1; min-width: 0; overflow: hidden; cursor: grab; background-image: radial-gradient(circle, color-mix(in srgb, var(--vscode-foreground) 18%, transparent) 1px, transparent 1px); background-size: 18px 18px; }
      .surface { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
      .surface .node { position: absolute; width: 228px; margin: 0; }
      .dock, .look { position: absolute; left: 12px; z-index: 4; display: flex; align-items: center; gap: 4px; padding: 4px; border-radius: 12px; background: var(--vscode-editor-background); border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.4)); }
      .dock { bottom: 12px; }
      .look { bottom: 52px; }
      .look[hidden] { display: none; }
      .dock button, .look button { min-width: 28px; height: 28px; padding: 0 8px; display: grid; place-items: center; }
      .chips { display: flex; flex-direction: column; gap: 8px; margin: 8px 0 16px; }
      .chip { display: flex; gap: 10px; align-items: center; text-align: left; width: 100%; padding: 8px; border-radius: 12px; background: transparent; border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.28)); cursor: grab; }
      .chip .k { display: block; font-size: 12px; letter-spacing: 0; text-transform: none; opacity: 1; font-weight: 600; }
      .chip .hint { display: block; }
      .assist[hidden] { display: none; }
      .board.connecting { outline: 1px dashed var(--vscode-focusBorder); outline-offset: -8px; }
      #zoom-label { min-width: 42px; text-align: center; font-size: 12px; opacity: .75; }
      .board[data-look="soft"] .node { box-shadow: none; }
      .board[data-look="contrast"] .node { border-width: 2px; }
      .leadrow { display: flex; align-items: flex-start; gap: 12px; padding: 10px 16px 0; }
      .lead { margin: 0; padding: 0; flex: 1; max-width: 46rem; font-size: 13px; line-height: 1.5; opacity: .78; }
      .saved { flex: none; display: flex; align-items: center; gap: 6px; margin-top: 1px; padding: 4px 10px 4px 8px; border-radius: 999px; border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.4)); background: var(--vscode-editor-background); font-size: 12px; font-weight: 600; color: #3f9d68; pointer-events: none; }
      .saved .tick { display: block; }
      .saved.flash .tick { animation: ticksaved .45s ease; }
      @keyframes ticksaved { 0% { transform: scale(.4); opacity: 0; } 55% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
      .editbar { position: absolute; top: 12px; left: 12px; z-index: 4; display: flex; gap: 4px; padding: 4px; border-radius: 12px; background: var(--vscode-editor-background); border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.4)); }
      .editbar button { height: 28px; padding: 0 10px; }
      .editbar button:disabled { opacity: .38; }
      .flowline { display: grid; grid-template-columns: minmax(150px, 1fr) 200px 210px minmax(170px, 1fr); gap: 28px; align-items: start; }
      .step { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
      .step span { width: 18px; height: 18px; border-radius: 99px; display: grid; place-items: center; font-size: 10px; opacity: .7; border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.45)); }
      .step span:empty { display: none; }
      .demand { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 8px; padding: 16px 0 0; border-top: 1px dashed var(--vscode-widget-border, rgba(128,128,128,.4)); }
      .pill { display: inline-block; margin: 6px 6px 0 0; padding: 1px 6px; border-radius: 99px; font-size: 10px; letter-spacing: .03em; text-transform: uppercase; border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.45)); }
      .pill.write { border-color: #c4964a; }
      .pill.irreversible, .pill.gap { border-color: #d66b6b; }
      .param { display: grid; grid-template-columns: 1fr 92px; gap: 6px; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,.3)); }
      .check { display: flex; align-items: center; gap: 6px; text-transform: none; letter-spacing: 0; }
      .check input { width: auto; margin: 0; }
      #wires { position: absolute; left: 0; top: 0; pointer-events: none; overflow: visible; }
      .col, .mid { position: relative; z-index: 1; }
      .mid { display: flex; align-items: center; min-height: 280px; }
      .node { display: flex; gap: 10px; align-items: flex-start; width: 100%; text-align: left; margin: 0 0 8px; padding: 12px; border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.32)); border-radius: 14px; background: var(--vscode-editor-background); }
      .stepno { position: absolute; z-index: 2; top: -8px; left: -8px; width: 18px; height: 18px; border-radius: 99px; display: grid; place-items: center; font-size: 10px; font-weight: 700; line-height: 1; background: var(--vscode-editor-background); border: 1.5px solid var(--vscode-foreground); }
      .stepno.parallel { box-shadow: 0 0 0 2px var(--vscode-editor-background), 0 0 0 3.5px var(--vscode-foreground); }
      .node:hover { border-color: color-mix(in srgb, var(--vscode-foreground) 28%, transparent); }
      .mark { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; flex: none; }
      .node.channel .mark, .chip.channel .mark, .node.schedule .mark, .chip.schedule .mark { color: #6b93d6; background: color-mix(in srgb, #6b93d6 16%, transparent); }
      .node.tool .mark, .chip.tool .mark { color: #3f9d68; background: color-mix(in srgb, #3f9d68 16%, transparent); }
      .node.skill .mark, .chip.skill .mark, .node.subagent .mark, .chip.subagent .mark { color: #b8883a; background: color-mix(in srgb, #b8883a 16%, transparent); }
      .node.mcp .mark, .chip.mcp .mark, .node.host .mark, .chip.host .mark { color: #7b74c9; background: color-mix(in srgb, #7b74c9 16%, transparent); }
      .node.hook .mark, .chip.hook .mark { color: #8a8f98; background: color-mix(in srgb, #8a8f98 18%, transparent); }
      .node.agent .mark, .node.scope .mark { color: var(--vscode-foreground); background: color-mix(in srgb, var(--vscode-foreground) 8%, transparent); }
      .copy { min-width: 0; display: block; }
      .node.on { border-color: var(--vscode-focusBorder); }
      .node.gap { border-color: #d66b6b; background: color-mix(in srgb, #d66b6b 12%, var(--vscode-editor-background)); }
      label.need { color: #d66b6b; }
      label.need input, label.need textarea, label.need select, li.need { border-color: #d66b6b; }
      ul.needlist { color: #d66b6b; margin: 0 0 8px; padding-left: 1.1rem; }
      .result { position: fixed; z-index: 28; top: 72px; left: 50%; transform: translateX(-50%); width: min(460px, calc(100% - 32px)); max-height: min(70vh, 520px); overflow: auto; box-sizing: border-box; padding: 16px 18px 20px; border-radius: 12px; background: var(--vscode-editor-background); border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.45)); box-shadow: 0 16px 48px rgba(0,0,0,.35); }
      .result[hidden] { display: none; }
      .result header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
      .result header strong { margin-right: auto; font-size: 16px; }
      .result .verdict { margin: 0 0 12px; font-size: 14px; line-height: 1.45; }
      .result h3 { margin: 14px 0 4px; font-size: 12px; letter-spacing: .04em; text-transform: uppercase; opacity: .7; }
      .result ul { margin: 0; padding-left: 1.2rem; }
      .result li { margin: 6px 0; font-size: 13px; line-height: 1.45; }
      .result .warn { margin-top: 14px; padding: 12px; border-radius: 10px; border: 1px solid color-mix(in srgb, #c47a2a 55%, transparent); border-left: 3px solid #c47a2a; background: color-mix(in srgb, #c47a2a 10%, transparent); }
      .result .warn p { margin: 8px 0 0; font-size: 13px; line-height: 1.45; }
      .result .warn h3 { margin-top: 10px; }
      .ask { position: fixed; right: 16px; bottom: 16px; z-index: 24; width: min(360px, calc(100% - 32px)); max-height: min(480px, calc(100% - 32px)); display: flex; flex-direction: column; box-sizing: border-box; padding: 12px; border-radius: 12px; background: var(--vscode-editor-background); border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.4)); box-shadow: 0 8px 24px rgba(0,0,0,.18); }
      .ask[hidden] { display: none; }
      .ask header { display: flex; align-items: center; gap: 8px; }
      .ask header strong { margin-right: auto; }
      .ask textarea { min-height: 72px; }
      #ask-log { overflow: auto; margin-top: 8px; }
      #ask-log p { margin: 6px 0; font-size: 13px; }
      .assistant { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); font-weight: 600; }
      .assistant.on { outline: 2px solid var(--vscode-focusBorder); }
      .node .k { display: block; font-size: 10px; letter-spacing: .06em; text-transform: uppercase; opacity: .6; }
      .node strong, .node em { display: block; }
      .node em { font-style: normal; opacity: .72; font-size: 12px; margin-top: 4px; }
      .node.agent { min-height: 96px; padding: 16px; }
      .ghost { margin: 8px 0 16px; font-size: 12px; opacity: .55; }
      section { margin-bottom: 18px; }
      .eyebrow, .path { margin: 0; font-size: 11px; letter-spacing: .04em; text-transform: uppercase; opacity: .6; }
      .path { text-transform: none; letter-spacing: 0; margin-top: 4px; font-family: var(--vscode-editor-font-family, monospace); }
      .railbody h2 { margin-top: 6px; }
      .railbody section header { display: flex; align-items: center; justify-content: space-between; }
      .item { display: block; width: 100%; text-align: left; margin-top: 6px; border-left: 3px solid transparent; }
      .item.channel { border-left-color: #6b93d6; }
      .item.tool { border-left-color: #5ea87a; }
      .item.skill { border-left-color: #c4964a; }
      .item.mcp { border-left-color: #8d84d6; }
      .form { margin-top: 8px; }
      .form[hidden] { display: none; }
      .sheet, .empty, .start { padding: 28px 32px; max-width: 40rem; box-sizing: border-box; }
      .start h2 { font-size: 22px; }
      .lead-in { margin: 8px 0 0; font-size: 14px; line-height: 1.5; }
      .example-box { margin: 20px 0 8px; padding: 16px; border: 1px solid var(--vscode-focusBorder); border-radius: 14px; background: color-mix(in srgb, var(--vscode-foreground) 5%, transparent); }
      .example-box h3, .blank h3 { margin: 0 0 12px; font-size: 15px; font-weight: 650; letter-spacing: 0; text-transform: none; opacity: 1; }
      .picks { display: grid; gap: 10px; }
      .pick { display: flex; flex-direction: column; align-items: flex-start; width: 100%; padding: 14px 16px; border-radius: 10px; text-align: left; }
      .pick strong { font-size: 15px; }
      .pick span { margin-top: 4px; font-size: 13px; font-weight: 400; line-height: 1.4; opacity: .9; }
      .blank { margin-top: 22px; padding-top: 16px; border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,.35)); }
      .sheet.wide { max-width: 64rem; }
      .sheet.fill { max-width: none; flex: 1; min-width: 0; overflow: auto; }
      .kicker { margin: 0 0 6px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; opacity: .55; }
      .destinations { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin: 18px 0; }
      .env { margin: 0; padding: 14px; border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.35)); border-radius: 12px; background: var(--vscode-editor-background); overflow: hidden; }
      .localbar { margin: 18px 0; padding: 14px; border: 1px solid var(--vscode-focusBorder); border-radius: 12px; background: var(--vscode-editor-background); }
      .localbar header { display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; }
      .localbar header span { font-size: 10px; letter-spacing: .06em; text-transform: uppercase; opacity: .55; }
      .statusline { display: inline-flex; align-items: center; gap: 8px; }
      .localbar .spin { display: inline-block; width: 16px; height: 16px; box-sizing: border-box; border-radius: 99px; border: 2px solid color-mix(in srgb, var(--vscode-foreground) 28%, transparent); border-top-color: var(--vscode-progressBar-background, #3794ff); opacity: 1; animation: spin 0.7s linear infinite; flex: none; }
      .working { display: flex; align-items: center; gap: 10px; margin: 10px 0; padding: 10px 12px; border-radius: 8px; background: color-mix(in srgb, var(--vscode-progressBar-background, #3794ff) 16%, transparent); font-size: 13px; }
      .working .spin { width: 18px; height: 18px; }
      .working .worktext { flex: none; }
      .working .bar { position: relative; flex: 1; height: 4px; border-radius: 99px; overflow: hidden; background: color-mix(in srgb, var(--vscode-foreground) 16%, transparent); }
      .working .bar::before { content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 35%; background: var(--vscode-progressBar-background, #3794ff); animation: ship-load 1.1s ease-in-out infinite; }
      .ship-error { margin: 10px 0; padding: 10px 12px; border-radius: 8px; color: #d66b6b; background: color-mix(in srgb, #d66b6b 16%, transparent); font-size: 13px; }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes ship-load { from { transform: translateX(-120%); } to { transform: translateX(320%); } }
      .env.on { border-color: var(--vscode-focusBorder); }
      .env header { display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; }
      .env header span { font-size: 10px; letter-spacing: .06em; text-transform: uppercase; opacity: .55; }
      .env p { margin: 0; font-size: 13px; line-height: 1.45; opacity: .8; }
      .env code { display: block; margin-top: 10px; font-size: 12px; }
      pre.log { max-height: 320px; overflow: auto; margin: 16px 0; padding: 12px; border-radius: 8px; background: var(--vscode-textCodeBlock-background, rgba(128,128,128,.12)); font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; line-height: 1.45; white-space: pre-wrap; }
      .sheet.fill.ship { display: flex; flex-direction: column; min-height: 0; overflow: hidden; padding: 12px 16px 8px; }
      .ship-tabs { display: flex; flex: none; gap: 6px; margin: 8px 0 4px; }
      .ship-tabs button.on { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
      .ship-local { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; }
      .ship-local[hidden] { display: none; }
      .ship-cloud { flex: 1; min-height: 0; overflow: auto; padding: 8px 4px 24px; }
      .ship-cloud.ship-stack { display: flex; flex-direction: column; overflow: hidden; padding: 4px 4px 8px; }
      .cloud-top { flex: 1; max-height: none; min-height: 0; overflow: auto; display: flex; flex-direction: column; }
      .cloud-bottom { flex: none; height: 22%; min-height: 72px; display: flex; flex-direction: column; }
      .gcp-sub { position: sticky; top: 0; z-index: 2; background: var(--vscode-sideBar-background, var(--vscode-editor-background)); }
      .gcp-pane { flex: 1; min-height: 0; }
      .chart { min-height: 180px; margin: 0; }
      .chart svg { display: block; width: 100%; }
      .mon { display: flex; flex-direction: column; gap: 12px; }
      .mon-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-end; }
      .mon-head .kicker { margin: 0 0 4px; }
      .mon-head strong { display: block; font-size: 16px; line-height: 1.35; max-width: 52ch; color: var(--vscode-foreground); }
      .mon-head strong[data-state]::before { content: ""; display: inline-block; width: 8px; height: 8px; margin-right: 8px; border-radius: 99px; background: #8d93a3; vertical-align: 1px; }
      .mon-head strong[data-state="running"]::before { background: #22C55E; }
      .mon-head strong[data-state="failed"]::before { background: #F04438; }
      .mon-head strong[data-state="busy"]::before { background: #F5B942; }
      .mon-tools { display: flex; gap: 8px; align-items: flex-end; flex: none; }
      .mon-tools label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; letter-spacing: .04em; text-transform: uppercase; opacity: .7; }
      .mon-tools select { text-transform: none; letter-spacing: 0; font-size: 13px; opacity: 1; }
      .kpis { display: grid; gap: 8px; }
      .kpis.primary { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .kpis.secondary { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 8px; }
      .kpis.secondary strong { font-size: 16px; }
      .kpis article { padding: 10px 12px; border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.35)); border-radius: 10px; background: color-mix(in srgb, var(--vscode-foreground) 4%, transparent); }
      .kpis span { display: block; font-size: 11px; letter-spacing: .04em; text-transform: uppercase; opacity: .6; }
      .kpis strong { display: block; margin-top: 4px; font-size: 22px; font-variant-numeric: tabular-nums; }
      .kpis article.bad strong { color: #F04438; }
      .kpis article.wait strong { color: #F5B942; }
      .chart-card { margin: 0; padding: 12px 12px 8px; border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.35)); border-radius: 12px; background: color-mix(in srgb, var(--vscode-foreground) 3%, transparent); }
      .chart-card figcaption { font-size: 12px; letter-spacing: .04em; text-transform: uppercase; opacity: .65; margin-bottom: 6px; }
      .legend { display: flex; gap: 14px; align-items: center; margin: 6px 0 0; font-size: 12px; opacity: .75; }
      .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; }
      .legend i.ok { background: #22C55E; }
      .legend i.prep { background: #F5B942; }
      .legend i.accept { background: #38BDF8; }
      .legend i.miss { background: #F5B942; }
      .legend i.bad { background: #F04438; }
      .mon-read p { margin: 0 0 4px; font-size: 13px; line-height: 1.4; }
      .cloud-bottom pre.log { flex: 1; max-height: none; min-height: 0; margin: 8px 0 0; }
      .ship-stack.fold-top .cloud-top { display: none; }
      .ship-stack.fold-top .cloud-bottom { flex: 1; height: auto; min-height: 0; }
      .ship-stack.fold-bottom .cloud-bottom { display: none; }
      .ship-stack.fold-bottom .cloud-top { flex: 1; max-height: none; }
      .ship-cloud[hidden] { display: none; }
      .ship-cloud h3 { margin: 8px 0; font-size: 16px; letter-spacing: 0; text-transform: none; opacity: 1; }
      .ship-cloud p { max-width: 62ch; line-height: 1.5; }
      .gcp-actions { position: sticky; top: 0; z-index: 2; display: flex; gap: 8px; padding: 8px 0 10px; background: var(--vscode-sideBar-background, var(--vscode-editor-background)); }
      .scale { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px 12px; margin-top: 8px; }
      .gcp-sub { display: flex; flex: none; flex-wrap: wrap; gap: 4px; margin: 8px 0 4px; }
      .gcp-sub button.on { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
      .gcp-pane[hidden] { display: none; }
      .exposure { border: 0; margin: 14px 0 0; padding: 0; }
      .exposure label { font-size: 14px; }
      .ship-split { flex: none; display: flex; justify-content: center; gap: 8px; }
      .ship-split button { font-size: 12px; padding: 2px 12px; }
      .ship-local.fold-status .localbar,
      .ship-local.fold-status .ship-more,
      .ship-local.fold-status .ship-foot { display: none; }
      .ship-local.fold-log .logwrap { display: none; }
      .ship-local.fold-log .localbar { flex: 1; min-height: 0; overflow: auto; }
      .sheet.ship .localbar { flex: none; margin: 8px 0 10px; }
      .sheet.ship .logwrap { flex: 1; min-height: 180px; }
      .ship-more { flex: none; margin: 6px 0 0; }
      .ship-more summary { cursor: pointer; font-size: 12px; opacity: .75; }
      .ship-foot { flex: none; display: flex; flex-wrap: wrap; gap: 8px; margin: 6px 0 0; }
      .logwrap { flex: 1; min-height: 140px; display: flex; flex-direction: column; }
      .logbar { display: flex; gap: 8px; flex-wrap: wrap; }
      .logbar input, .logbar select { flex: 1; min-width: 120px; }
      .sheet.ship pre.log { flex: 1; max-height: none; min-height: 0; margin: 8px 0 0; }
      .meters { display: flex; flex-wrap: wrap; gap: 12px 16px; margin: 8px 0; font-size: 12px; }
      .meters b { font-weight: 600; }
      .meters em { font-style: normal; opacity: .6; margin-right: 6px; text-transform: uppercase; font-size: 10px; letter-spacing: .04em; }
      .localbar header strong { font-size: 16px; }
      .localbar pre.connect-log { max-height: 140px; margin: 8px 0 0; }
      .bearer-note { margin: 12px 0 0; padding: 12px; border-radius: 10px; border: 1px solid color-mix(in srgb, #c47a2a 55%, transparent); border-left: 3px solid #c47a2a; background: color-mix(in srgb, #c47a2a 10%, transparent); }
      .bearer-note strong { display: block; margin: 10px 0 4px; }
      .bearer-note p { margin: 0; font-size: 13px; line-height: 1.45; }
      button.attention { display: inline-block; background: #c47a2a; color: #1a1208; font-weight: 650; }
      .localbar header .statusline[data-state="running"] { color: #3f9d68; opacity: 1; }
      .localbar header .statusline[data-state="current"] { color: #22C55E; opacity: 1; }
      .localbar header .statusline[data-state="other"] { color: #F5B942; opacity: 1; }
      .localbar header .statusline[data-state="failed"] { color: #d66b6b; opacity: 1; }
      #gcp-status.same { color: #22C55E; opacity: 1; font-weight: 650; }
      #gcp-status.other { color: #F5B942; opacity: 1; font-weight: 650; }
      .verdict { margin: 8px 0; padding: 10px 12px; border-radius: 8px; font-weight: 650; line-height: 1.4; }
      .verdict.current { color: #052e16; background: #22C55E; }
      .verdict.other { color: #1a1208; background: #F5B942; }
      .verdict.unknown { color: #fff; background: #F04438; }
      #gcp-trail { list-style: none; margin: 8px 0 0; padding: 0; font-size: 12px; line-height: 1.4; }
      #gcp-trail li { padding: 2px 0; opacity: .8; }
      #gcp-trail li:last-child { opacity: 1; }
      ul.secrets { list-style: none; padding: 0; margin: 16px 0; }
      ul.secrets li { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,.28)); }
      ul.secrets li.gcp-secret { flex-wrap: wrap; align-items: center; }
      ul.secrets li.gcp-secret label { flex: 1 1 220px; margin: 0; }
      ul.secrets li.gcp-secret input { width: 100%; }
      ul.secrets li.gcp-secret button { flex: none; }
      ul.work { list-style: none; padding: 0; margin: 18px 0; }
      ul.work li { display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,.28)); }
      ul.work p { margin: 4px 0 0; }
      ul.work button { flex: none; }
      ul.secrets span { opacity: .65; font-size: 12px; }
      ul.scan { list-style: none; padding: 0; }
      ul.scan li { padding: 3px 0; font-size: 13px; }
      ul.scan li.miss { opacity: .55; }
      #confirm[hidden] { display: none; }
    </style></head><body>
      <header class="bar">
        <strong>${project ? esc(project.name) : "BigAgentCreator"}</strong>
        ${hasFolder ? `<div class="modes">${project ? `<button type="button" data-mode="flow" class="${ui.mode === "flow" ? "on" : ""}">${t(lang, "design")}</button><button type="button" data-mode="prove" class="${ui.mode === "prove" ? "on" : ""}">${t(lang, "prove")}</button><button type="button" data-mode="platform" class="${ui.mode === "platform" ? "on" : ""}">${t(lang, "platform")}</button><button type="button" data-mode="secrets" class="${ui.mode === "secrets" ? "on" : ""}">${t(lang, "secrets")}</button><button type="button" data-mode="connect" class="${ui.mode === "connect" ? "on" : ""}">${t(lang, "connect")}</button><button type="button" data-mode="deploy" class="${ui.mode === "deploy" ? "on" : ""}">${t(lang, "ship")}</button>` : ""}<button type="button" data-mode="examples" class="${ui.mode === "examples" ? "on" : ""}">${t(lang, "examples")}</button></div>` : ""}
        <div class="bar-end">${project ? `<button type="button" id="ask-open" class="assistant" title="${esc(t(lang, "ask_title"))}"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="7.2" r="3.4" fill="currentColor"/><path d="M5.2 19.2c.8-3.4 3.2-5.2 6.8-5.2s6 1.8 6.8 5.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10.6" cy="6.8" r=".6" fill="var(--vscode-button-background)"/><circle cx="13.4" cy="6.8" r=".6" fill="var(--vscode-button-background)"/></svg> ${t(lang, "ask")}</button>` : ""}${langSwitch(lang)}<button type="button" id="help-open" class="helpbtn">${t(lang, "help")}</button></div>
      </header>
      ${ui.notice ? `<p class="banner">${esc(ui.notice)}</p>` : ""}${repair}
      <main>${body}</main>${help}`,
    `const vscode = acquireVsCodeApi();
    const state = ${data};
    const uiText = ${JSON.stringify({
      saved: t(lang, "saved"),
      save: t(lang, "save"),
      saving: t(lang, "saving"),
      copied: t(lang, "copied"),
      noLog: t(lang, "no_log"),
      clickFirst: t(lang, "click_first"),
      clickNext: t(lang, "click_next"),
      building: t(lang, "building"),
      gcpDeploy: t(lang, "gcp_deploy"),
      publishing: t(lang, "gcp_publishing"),
      uploading: t(lang, "gcp_uploading"),
      workingOn: t(lang, "gcp_working"),
      upToDate: t(lang, "gcp_up_to_date"),
      otherImage: t(lang, "gcp_other_image"),
      unknownImage: t(lang, "gcp_unknown"),
      refreshIn: t(lang, "gcp_refresh_in"),
      updating: t(lang, "gcp_updating"),
      reading: t(lang, "gcp_reading"),
      noCalls: t(lang, "gcp_no_calls"),
      chartReply: t(lang, "gcp_chart_title"),
      chartAccept: t(lang, "gcp_chart_accept"),
      latency: t(lang, "gcp_latency"),
      p95: t(lang, "gcp_p95"),
      errors: t(lang, "gcp_errors"),
      turnTime: t(lang, "gcp_turn"),
      prep: t(lang, "gcp_prep"),
      noReply: t(lang, "gcp_no_reply"),
      accepted: t(lang, "gcp_accepted"),
      cut: t(lang, "gcp_cut"),
      load: t(lang, "gcp_load"),
      calls: t(lang, "gcp_calls"),
      rejected: t(lang, "gcp_rejected"),
      slowest: t(lang, "gcp_slowest"),
      median: t(lang, "gcp_median"),
      rebuilding: t(lang, "rebuilding"),
      stopping: t(lang, "stopping"),
      checking: t(lang, "checking"),
      opening: t(lang, "opening_tunnel"),
      registering: t(lang, "registering"),
      sending: t(lang, "whatsapp_send"),
      phName: t(lang, "ph_name"),
      required: t(lang, "required"),
      phMeans: t(lang, "ph_means"),
      remove: t(lang, "remove"),
      lastError: t(lang, "last_error"),
      hideStatus: t(lang, "fold_status"),
      showStatus: t(lang, "show_status"),
      hideLog: t(lang, "fold_log"),
      showLog: t(lang, "show_log"),
      hideStatusTitle: t(lang, "fold_status_title"),
      hideLogTitle: t(lang, "fold_log_title"),
      showDeploy: t(lang, "show_deploy"),
      showRun: t(lang, "show_run"),
      hideDeployTitle: t(lang, "fold_deploy_title"),
      hideRunTitle: t(lang, "fold_run_title"),
      imagePin: t(lang, "image_pin"),
    }).replace(/</g, "\\u003c")};
    for (const button of document.querySelectorAll("[data-init-example]")) {
      button.addEventListener("click", () => vscode.postMessage({ type: "create-example", id: button.dataset.initExample }));
    }
    for (const button of document.querySelectorAll("[data-set-secret]")) {
      button.addEventListener("click", () => vscode.postMessage({ type: "open-secret", name: button.dataset.setSecret }));
    }
    const secretName = document.getElementById("secret-name");
    const secretValue = document.getElementById("secret-value");
    if (secretName && secretName.value && secretValue) secretValue.focus();
    document.getElementById("simulate-flow")?.addEventListener("click", () => { const box = document.getElementById("flow-sim"); if (box) box.hidden = false; });
    document.getElementById("flow-sim-close")?.addEventListener("click", () => { const box = document.getElementById("flow-sim"); if (box) box.hidden = true; });
    document.getElementById("ask-open")?.addEventListener("click", () => vscode.postMessage({ type: "open-chat" }));
    for (const button of document.querySelectorAll("[data-apply]")) {
      button.addEventListener("click", () => vscode.postMessage({ type: "apply-proposal", index: Number(button.dataset.apply) }));
    }
    for (const button of document.querySelectorAll("[data-dismiss]")) {
      button.addEventListener("click", () => vscode.postMessage({ type: "dismiss-proposal", index: Number(button.dataset.dismiss) }));
    }
    document.getElementById("ask-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = document.getElementById("ask-text")?.value || "";
      vscode.postMessage({ type: "lm-ask", text });
    });
    document.getElementById("create-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      vscode.postMessage({ type: "create", name: new FormData(event.target).get("name") });
    });
    for (const button of document.querySelectorAll("[data-mode]")) {
      button.addEventListener("click", () => vscode.postMessage({ type: "mode", mode: button.dataset.mode }));
    }
    for (const button of document.querySelectorAll("[data-open]")) {
      button.addEventListener("click", () => vscode.postMessage({ type: "open-file", path: button.dataset.open, create: button.dataset.create || "" }));
    }
    document.getElementById("eval-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.target);
      vscode.postMessage({ type: "eval-add", name: data.get("name"), text: data.get("prompt"), check: data.get("check") });
    });
    document.getElementById("run-evals")?.addEventListener("click", () => vscode.postMessage({ type: "task", task: "eval" }));
    document.getElementById("run-validate")?.addEventListener("click", () => vscode.postMessage({ type: "task", task: "validate" }));
    document.getElementById("ship-start")?.addEventListener("click", () => { arm(uiText.building); vscode.postMessage({ type: "ship", task: "start" }); });
    document.getElementById("ship-rebuild")?.addEventListener("click", () => { arm(uiText.rebuilding); vscode.postMessage({ type: "ship", task: "rebuild" }); });
    document.getElementById("ship-stop")?.addEventListener("click", () => { arm(uiText.stopping); vscode.postMessage({ type: "ship", task: "stop" }); });
    document.getElementById("ship-refresh")?.addEventListener("click", () => { arm(uiText.checking); vscode.postMessage({ type: "ship", task: "refresh" }); });
    document.getElementById("ship-logs")?.addEventListener("click", () => vscode.postMessage({ type: "ship", task: "follow" }));
    for (const button of document.querySelectorAll("[data-clear-log]")) {
      button.addEventListener("click", () => {
        logLines = [];
        paintLogs();
        vscode.postMessage({ type: "ship", task: "clear-log" });
      });
    }
    const shipLocal = document.querySelector(".ship-local");
    const foldStatus = document.getElementById("fold-status");
    const foldLog = document.getElementById("fold-log");
    const paintFold = () => {
      if (!shipLocal || !foldStatus || !foldLog) return;
      const statusHidden = shipLocal.classList.contains("fold-status");
      const logHidden = shipLocal.classList.contains("fold-log");
      foldStatus.textContent = statusHidden ? uiText.showStatus : uiText.hideStatus;
      foldStatus.title = statusHidden ? uiText.showStatus : uiText.hideStatusTitle;
      foldStatus.setAttribute("aria-expanded", statusHidden ? "false" : "true");
      foldLog.textContent = logHidden ? uiText.showLog : uiText.hideLog;
      foldLog.title = logHidden ? uiText.showLog : uiText.hideLogTitle;
      foldLog.setAttribute("aria-expanded", logHidden ? "false" : "true");
    };
    foldStatus?.addEventListener("click", () => {
      if (!shipLocal) return;
      if (shipLocal.classList.contains("fold-status")) shipLocal.classList.remove("fold-status");
      else { shipLocal.classList.add("fold-status"); shipLocal.classList.remove("fold-log"); }
      paintFold();
    });
    foldLog?.addEventListener("click", () => {
      if (!shipLocal) return;
      if (shipLocal.classList.contains("fold-log")) shipLocal.classList.remove("fold-log");
      else { shipLocal.classList.add("fold-log"); shipLocal.classList.remove("fold-status"); }
      paintFold();
    });
    const gcpStack = document.querySelector(".ship-stack");
    const foldGcpTop = document.getElementById("fold-gcp-top");
    const foldGcpBottom = document.getElementById("fold-gcp-bottom");
    const paintGcpFold = () => {
      if (!gcpStack || !foldGcpTop || !foldGcpBottom) return;
      const topHidden = gcpStack.classList.contains("fold-top");
      const bottomHidden = gcpStack.classList.contains("fold-bottom");
      foldGcpTop.textContent = topHidden ? uiText.showDeploy : uiText.hideStatus;
      foldGcpTop.title = topHidden ? uiText.showDeploy : uiText.hideDeployTitle;
      foldGcpTop.setAttribute("aria-expanded", topHidden ? "false" : "true");
      foldGcpBottom.textContent = bottomHidden ? uiText.showRun : uiText.hideLog;
      foldGcpBottom.title = bottomHidden ? uiText.showRun : uiText.hideRunTitle;
      foldGcpBottom.setAttribute("aria-expanded", bottomHidden ? "false" : "true");
    };
    foldGcpTop?.addEventListener("click", () => {
      if (!gcpStack) return;
      if (gcpStack.classList.contains("fold-top")) gcpStack.classList.remove("fold-top");
      else { gcpStack.classList.add("fold-top"); gcpStack.classList.remove("fold-bottom"); }
      paintGcpFold();
    });
    foldGcpBottom?.addEventListener("click", () => {
      if (!gcpStack) return;
      if (gcpStack.classList.contains("fold-bottom")) gcpStack.classList.remove("fold-bottom");
      else { gcpStack.classList.add("fold-bottom"); gcpStack.classList.remove("fold-top"); }
      paintGcpFold();
    });
    for (const tab of document.querySelectorAll("[data-gcp-tab]")) {
      tab.addEventListener("click", () => {
        const id = tab.dataset.gcpTab;
        for (const button of document.querySelectorAll("[data-gcp-tab]")) {
          const on = button.dataset.gcpTab === id;
          button.classList.toggle("on", on);
          button.setAttribute("aria-selected", on ? "true" : "false");
        }
        for (const pane of document.querySelectorAll("[data-gcp-pane]")) pane.hidden = pane.dataset.gcpPane !== id;
        if (id === "monitor") { armWatch(); pullMonitor(false); }
        else if (gcpWatch) { clearInterval(gcpWatch); gcpWatch = null; }
      });
    }
    for (const tab of document.querySelectorAll("[data-target]")) {
      tab.addEventListener("click", () => {
        const id = tab.dataset.target;
        for (const button of document.querySelectorAll("[data-target]")) {
          const on = button.dataset.target === id;
          button.classList.toggle("on", on);
          button.setAttribute("aria-selected", on ? "true" : "false");
        }
        for (const panel of document.querySelectorAll("[data-ship-panel]")) panel.hidden = panel.dataset.shipPanel !== id;
        vscode.postMessage({ type: "ship-target", target: id });
      });
    }
    const gcpNumber = (id, fallback) => {
      const raw = document.getElementById(id)?.value;
      const number = Number(raw);
      return Number.isFinite(number) ? number : fallback;
    };
    const gcpFields = () => {
      const env = [];
      for (const row of document.querySelectorAll("[data-env-row]")) {
        const name = row.querySelector("[data-env-name]")?.value?.trim() || "";
        const value = row.querySelector("[data-env-value]")?.value ?? "";
        if (name || value) env.push({ name, value });
      }
      const secretOverrides = [];
      for (const input of document.querySelectorAll("[data-gcp-secret]")) {
        secretOverrides.push({ name: input.dataset.gcpSecret || "", value: input.value || "" });
      }
      return {
        project: document.getElementById("gcp-project")?.value || "",
        region: document.getElementById("gcp-region")?.value || "",
        exposure: document.querySelector("input[name='gcp-exposure']:checked")?.value || "internet",
        minInstances: gcpNumber("gcp-min", 0),
        maxInstances: gcpNumber("gcp-max", 4),
        concurrency: gcpNumber("gcp-concurrency", 4),
        cpu: document.getElementById("gcp-cpu")?.value || "1",
        memory: document.getElementById("gcp-memory")?.value || "1Gi",
        timeout: gcpNumber("gcp-timeout", 300),
        env,
        secretOverrides,
      };
    };
    let gcpWatch = null;
    let gcpWatchBusy = false;
    const pullMonitor = (manual) => {
      const pane = document.querySelector('[data-gcp-pane="monitor"]');
      if (!pane || pane.hidden || gcpWatchBusy) return;
      gcpWatchBusy = true;
      const line = document.getElementById("gcp-signal-headline");
      if (manual && line) { line.dataset.state = "busy"; line.textContent = uiText.reading; }
      vscode.postMessage({ type: "gcp-logs", ...gcpFields() });
    };
    const armWatch = () => {
      if (gcpWatch) clearInterval(gcpWatch);
      gcpWatch = null;
      const every = Number(document.getElementById("gcp-every")?.value || 0);
      const pane = document.querySelector('[data-gcp-pane="monitor"]');
      if (every >= 15 && pane && !pane.hidden) gcpWatch = setInterval(() => pullMonitor(false), every * 1000);
    };
    document.getElementById("gcp-every")?.addEventListener("change", () => { armWatch(); pullMonitor(true); });
    document.getElementById("gcp-logs")?.addEventListener("click", () => pullMonitor(true));
    document.getElementById("gcp-env-add")?.addEventListener("click", () => {
      const list = document.getElementById("gcp-env-list");
      const sample = list?.querySelector("[data-env-row]");
      if (!list || !sample) return;
      const row = sample.cloneNode(true);
      for (const input of row.querySelectorAll("input")) input.value = "";
      list.append(row);
    });
    const gcpStatus = document.getElementById("gcp-status");
    const showGcpStatus = (text, kind, step) => {
      if (!gcpStatus) return;
      gcpStatus.hidden = !text;
      gcpStatus.textContent = text || "";
      gcpStatus.className = kind === "error" ? "ship-error" : kind === "working" ? "working" : step === "current" ? "hint same" : step === "other" ? "hint other" : "hint";
    };
    let gcpClock = null;
    let gcpLeft = 10;
    const paintClock = () => {
      const el = document.getElementById("gcp-clock");
      if (!el) return;
      el.hidden = false;
      el.textContent = gcpLeft <= 0 ? uiText.updating : uiText.refreshIn.replace("{n}", String(gcpLeft));
    };
    const stopClock = () => {
      if (gcpClock) clearInterval(gcpClock);
      gcpClock = null;
      const el = document.getElementById("gcp-clock");
      if (el) el.hidden = true;
    };
    const startClock = () => {
      if (gcpClock) clearInterval(gcpClock);
      gcpLeft = 10;
      paintClock();
      gcpClock = setInterval(() => {
        gcpLeft = Math.max(0, gcpLeft - 1);
        paintClock();
      }, 1000);
    };
    const paintVerdict = (text, step) => {
      const box = document.getElementById("gcp-verdict");
      if (!box || !text) return;
      box.hidden = false;
      box.className = "verdict " + step;
      box.textContent = text;
    };
    const armGcp = (text, kind, step) => {
      showGcpStatus(text, kind, step);
      if (kind === "working") startClock();
      else stopClock();
      const lasting = step === "current" || step === "other" || step === "unknown";
      if (lasting) paintVerdict(text, step);
      const held = document.getElementById("gcp-verdict");
      const pinned = Boolean(held && !held.hidden);
      const summary = document.getElementById("gcp-summary");
      if (summary && text && (lasting || !pinned)) summary.textContent = text;
      const line = document.querySelector("#gcp-live .statusline");
      const label = line?.querySelector("[data-gcp-label]");
      if (lasting && line) line.dataset.state = step === "current" ? "current" : step === "other" ? "other" : "failed";
      else if (!pinned && line) line.dataset.state = kind === "error" ? "failed" : kind === "working" ? "busy" : "running";
      if (lasting && label) label.textContent = step === "current" ? uiText.upToDate : step === "other" ? uiText.otherImage : uiText.unknownImage;
      else if (!pinned && label && text) label.textContent = text;
      const busy = kind === "working";
      const deploy = document.getElementById("gcp-deploy");
      if (deploy) {
        deploy.disabled = busy;
        deploy.textContent = !busy ? uiText.gcpDeploy : step === "push" ? uiText.uploading : step === "publish" ? uiText.publishing : uiText.workingOn;
      }
      const build = document.getElementById("gcp-build");
      if (build) build.disabled = busy;
      const refresh = document.getElementById("gcp-refresh");
      if (refresh) refresh.disabled = busy;
    };
    document.getElementById("gcp-check")?.addEventListener("click", () => {
      armGcp(uiText.checking, "working");
      vscode.postMessage({ type: "gcp-check", ...gcpFields() });
    });
    document.getElementById("gcp-refresh")?.addEventListener("click", () => {
      armGcp(uiText.checking, "working", "working");
      vscode.postMessage({ type: "gcp-live", ...gcpFields() });
    });
    document.getElementById("gcp-sync")?.addEventListener("click", () => {
      showGcpStatus("", "");
      vscode.postMessage({ type: "gcp-sync", ...gcpFields() });
    });
    document.getElementById("gcp-form")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-sync-one]");
      if (!button) return;
      showGcpStatus("", "");
      vscode.postMessage({ type: "gcp-sync", ...gcpFields(), only: button.dataset.syncOne || "" });
    });
    document.getElementById("gcp-build")?.addEventListener("click", () => {
      armGcp(uiText.building, "working");
      vscode.postMessage({ type: "gcp-build" });
    });
    document.getElementById("gcp-deploy")?.addEventListener("click", () => {
      armGcp(uiText.workingOn, "working", "working");
      vscode.postMessage({ type: "gcp-deploy", ...gcpFields() });
    });
    document.getElementById("open-playground")?.addEventListener("click", () => vscode.postMessage({ type: "ship", task: "playground" }));
    for (const button of document.querySelectorAll("[data-example]")) {
      button.addEventListener("click", () => vscode.postMessage({ type: "load-example", id: button.dataset.example }));
    }
    document.getElementById("open-guide")?.addEventListener("click", () => vscode.postMessage({ type: "open-guide" }));
    document.getElementById("help-guide")?.addEventListener("click", () => vscode.postMessage({ type: "open-guide" }));
    document.getElementById("help-open")?.addEventListener("click", () => { const box = document.getElementById("help"); if (box) box.hidden = false; });
    document.getElementById("help-close")?.addEventListener("click", () => { const box = document.getElementById("help"); if (box) box.hidden = true; });
    document.getElementById("help")?.addEventListener("click", (event) => { if (event.target === event.currentTarget) event.currentTarget.hidden = true; });
    for (const button of document.querySelectorAll("[data-set-lang]")) {
      button.addEventListener("click", () => {
        if (button.classList.contains("on")) return;
        const box = document.getElementById("help");
        vscode.postMessage({ type: "lang", lang: button.dataset.setLang, helpOpen: Boolean(box && !box.hidden) });
      });
    }
    document.getElementById("keep-folder")?.addEventListener("click", () => vscode.postMessage({ type: "keep-folder" }));
    document.getElementById("restore-folder")?.addEventListener("click", () => vscode.postMessage({ type: "restore-folder" }));
    document.getElementById("ship-tunnel")?.addEventListener("click", () => { arm(uiText.opening); vscode.postMessage({ type: "ship", task: "tunnel" }); });
    const publicUrl = document.getElementById("public-url");
    const hookPreview = document.getElementById("hook-preview");
    const showHook = () => {
      if (!publicUrl || !hookPreview) return;
      const raw = publicUrl.value.trim();
      let next = "";
      try {
        const url = new URL(raw);
        const path = url.pathname.replace(/\\/+$/, "");
        if (url.protocol === "https:" && url.hostname && (path === "" || path === "/v1/channels/telegram")) next = url.origin + "/v1/channels/telegram/";
      } catch (e) { next = ""; }
      hookPreview.textContent = next;
    };
    publicUrl?.addEventListener("input", showHook);
    showHook();
    document.getElementById("ship-webhook")?.addEventListener("click", () => { arm(uiText.registering); vscode.postMessage({ type: "ship", task: "webhook", url: document.getElementById("public-url")?.value || "" }); });
    document.getElementById("whatsapp-check")?.addEventListener("click", () => { arm(uiText.checking); vscode.postMessage({ type: "ship", task: "whatsapp-check" }); });
    document.getElementById("whatsapp-send")?.addEventListener("click", () => { arm(uiText.sending); vscode.postMessage({ type: "ship", task: "whatsapp-send", phone: document.getElementById("whatsapp-to")?.value || "" }); });
    document.getElementById("slack-check")?.addEventListener("click", () => { arm(uiText.checking); vscode.postMessage({ type: "ship", task: "slack-check" }); });
    function arm(label) {
      const line = document.querySelector(".localbar .statusline");
      if (line && !line.querySelector(".spin")) {
        line.insertAdjacentHTML("afterbegin", '<span class="spin" aria-hidden="true"></span>');
        const text = line.querySelector("[data-status]");
        if (text) text.textContent = label;
      }
      for (const bar of document.querySelectorAll(".localbar")) bar.setAttribute("aria-busy", "true");
      for (const id of ["ship-start", "ship-rebuild", "ship-refresh", "ship-tunnel", "ship-webhook", "whatsapp-check", "whatsapp-send", "slack-check"]) {
        const button = document.getElementById(id);
        if (button) button.disabled = true;
      }
      const address = document.getElementById("public-url");
      if (address) address.disabled = true;
    }
    let connectFrom = "";
    for (const button of document.querySelectorAll(".node")) {
      button.addEventListener("click", () => {
        if (!board?.classList.contains("connecting")) {
          vscode.postMessage({ type: "select", id: button.dataset.id });
          return;
        }
        const target = button.dataset.id;
        if (!connectFrom) {
          connectFrom = target;
          const lead = document.getElementById("lead");
          if (lead) lead.textContent = uiText.clickNext;
          return;
        }
        if (connectFrom !== target) vscode.postMessage({ type: "link", from: connectFrom, to: target });
        connectFrom = "";
        board.classList.remove("connecting");
      });
    }
    document.getElementById("save-agent")?.addEventListener("click", () => {
      armSave(document.getElementById("save-agent"));
      const limit = document.getElementById("limit-tools")?.checked;
      const harness = limit ? [...document.querySelectorAll(".harness")].filter((box) => box.checked).map((box) => box.value) : null;
      const turns = document.getElementById("turns")?.value.trim();
      vscode.postMessage({
        type: "instructions",
        text: document.getElementById("instructions").value,
        model: document.getElementById("model")?.value || "auto",
        effort: document.getElementById("effort")?.value || "high",
        fast: Boolean(document.getElementById("fast")?.checked),
        sandbox: Boolean(document.getElementById("sandbox")?.checked),
        reminders: Boolean(document.getElementById("reminders")?.checked),
        harness,
        maxRunningTurns: turns ? Number(turns) : null,
        egress: (document.getElementById("egress")?.value || "").split(/\\n+/).map((line) => line.trim()).filter(Boolean),
      });
    });
    document.getElementById("save-scope")?.addEventListener("click", () => { armSave(document.getElementById("save-scope")); vscode.postMessage({ type: "scope", text: document.getElementById("scope").value }); });
    document.getElementById("add-param")?.addEventListener("click", () => {
      const box = document.getElementById("params");
      if (!box) return;
      const row = document.createElement("div");
      row.className = "param";
      row.innerHTML = '<input name="pname" placeholder="' + uiText.phName + '" /><select name="ptype"><option>string</option><option>number</option><option>boolean</option></select><label class="check"><input name="preq" type="checkbox" /> ' + uiText.required + '</label><input name="pdesc" placeholder="' + uiText.phMeans + '" /><button type="button" class="quiet drop-param">' + uiText.remove + '</button>';
      box.appendChild(row);
    });
    document.getElementById("params")?.addEventListener("click", (event) => {
      const button = event.target.closest(".drop-param");
      if (button) button.closest(".param")?.remove();
    });
    function channelRoute() {
      const type = document.getElementById("field");
      if (type && type.tagName === "SELECT") {
        if (type.value === "cron") return document.getElementById("route-cron")?.value || "";
        if (type.value === "slack") return document.getElementById("route-slack")?.value || "";
        if (type.value === "github") return document.getElementById("route-github")?.value || "";
        if (type.value === "gitlab") return document.getElementById("route-gitlab")?.value || "";
        if (type.value === "bitbucket") return document.getElementById("route-bitbucket")?.value || "";
        if (type.value === "telegram") return document.getElementById("route-telegram")?.value || "/";
        return document.getElementById("route")?.value || "";
      }
      if (document.getElementById("route-cron")) return document.getElementById("route-cron").value || "";
      return document.getElementById("route")?.value || "";
    }
    document.getElementById("field")?.addEventListener("change", () => {
      const type = document.getElementById("field").value;
      for (const panel of document.querySelectorAll(".assist")) panel.hidden = panel.dataset.for !== type;
    });
    for (const button of document.querySelectorAll("[data-cron]")) {
      button.addEventListener("click", () => { const input = document.getElementById("route-cron"); if (input) input.value = button.dataset.cron; });
    }
    document.getElementById("save-item")?.addEventListener("click", () => {
      armSave(document.getElementById("save-item"));
      const parameters = [...document.querySelectorAll("#params .param")].map((row) => ({
        name: row.querySelector("[name=pname]")?.value || "",
        type: row.querySelector("[name=ptype]")?.value || "string",
        required: Boolean(row.querySelector("[name=preq]")?.checked),
        description: row.querySelector("[name=pdesc]")?.value || "",
      }));
      vscode.postMessage({
        type: "save",
        id: state.selected,
        description: document.getElementById("when") ? document.getElementById("when").value : (document.getElementById("field")?.value || ""),
        body: document.getElementById("procedure")?.value ?? document.getElementById("extra")?.value ?? (document.getElementById("when") ? (document.getElementById("field")?.value || "") : ""),
        effect: document.getElementById("effect")?.value || "read",
        execution: document.getElementById("execution")?.value || "server",
        transport: document.getElementById("transport")?.value || "http",
        command: document.getElementById("command")?.value || "",
        advertise: Boolean(document.getElementById("advertise")?.checked),
        verify: document.getElementById("field")?.value === "telegram" ? Boolean(document.getElementById("verify-telegram")?.checked) : Boolean(document.getElementById("verify")?.checked),
        url: document.getElementById("url")?.value || "",
        route: channelRoute(),
        repo: document.getElementById("repo-" + (document.getElementById("field")?.value || ""))?.value || "",
        secret: document.getElementById("field")?.value === "telegram" ? (document.getElementById("secret-telegram")?.value || "") : document.getElementById("field")?.value === "whatsapp" ? (document.getElementById("secret-whatsapp")?.value || "") : (document.getElementById("secret")?.value || ""),
        calls: document.getElementById("call-mcp")?.value || document.getElementById("calls")?.value || "",
        parameters,
      });
    });
    document.getElementById("delete-item")?.addEventListener("click", () => vscode.postMessage({ type: "delete", id: state.selected }));
    document.getElementById("delete-node")?.addEventListener("click", () => vscode.postMessage({ type: "delete", id: state.selected }));
    document.getElementById("undo")?.addEventListener("click", () => vscode.postMessage({ type: "undo" }));
    document.getElementById("redo")?.addEventListener("click", () => vscode.postMessage({ type: "redo" }));
    document.getElementById("duplicate")?.addEventListener("click", () => vscode.postMessage({ type: "duplicate", id: state.selected }));
    document.getElementById("save-secret")?.addEventListener("click", () => vscode.postMessage({ type: "secret", name: document.getElementById("secret-name").value, value: document.getElementById("secret-value").value }));
    document.getElementById("rewrite-docker")?.addEventListener("click", () => vscode.postMessage({ type: "docker" }));
    document.getElementById("repair")?.addEventListener("click", () => vscode.postMessage({ type: "repair" }));
    const form = document.getElementById("add-form");
    for (const button of document.querySelectorAll(".add")) {
      button.addEventListener("click", () => {
        if (!form) return;
        form.hidden = false;
        form.querySelector("[name=kind]").value = button.dataset.kind;
        document.getElementById("add-title").textContent = "Add " + button.dataset.kind;
        form.querySelector("[name=name]").focus();
      });
    }
    document.getElementById("cancel")?.addEventListener("click", () => { if (form) form.hidden = true; });
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      vscode.postMessage({ type: "add", kind: data.get("kind"), name: data.get("name"), detail: data.get("detail") });
    });
    for (const button of document.querySelectorAll(".item")) {
      button.addEventListener("click", () => vscode.postMessage({ type: "select", id: button.dataset.id }));
    }
    for (const button of document.querySelectorAll("[data-chrome]")) {
      button.addEventListener("click", () => {
        const key = button.dataset.chrome === "library" ? "libraryOpen" : "inspectorOpen";
        vscode.postMessage({ type: "chrome", [key]: !state[key] });
      });
    }
    for (const sash of document.querySelectorAll("[data-sash]")) {
      sash.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        const which = sash.dataset.sash;
        const rail = sash.closest(".rail");
        const startX = event.clientX;
        const startW = rail.getBoundingClientRect().width;
        const move = (ev) => {
          const dx = ev.clientX - startX;
          const width = Math.max(200, Math.min(480, which === "library" ? startW + dx : startW - dx));
          rail.style.width = width + "px";
          rail.dataset.width = String(Math.round(width));
          draw();
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          const field = which === "library" ? "libraryWidth" : "inspectorWidth";
          vscode.postMessage({ type: "chrome", [field]: Number(rail.dataset.width || startW) });
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      });
    }
    const surface = document.getElementById("surface");
    const board = document.getElementById("board");
    let zoom = ${layout?.zoom || 1};
    let pan = { x: ${layout?.pan.x || 24}, y: ${layout?.pan.y || 16} };
    let look = "${layout?.look || "clear"}";
    function apply() {
      if (!surface) return;
      surface.style.transform = "translate(" + pan.x + "px," + pan.y + "px) scale(" + zoom + ")";
      const label = document.getElementById("zoom-label");
      if (label) label.textContent = Math.round(zoom * 100) + "%";
      if (board) board.dataset.look = look;
    }
    function publish() {
      const positions = {};
      for (const el of document.querySelectorAll("#surface .node")) positions[el.dataset.id] = { x: el.offsetLeft, y: el.offsetTop };
      vscode.postMessage({ type: "layout", positions, zoom, pan, look });
    }
    function draw() {
      const svg = document.getElementById("wires");
      if (!surface || !svg) return;
      let minX = 0;
      let minY = 0;
      let maxX = surface.offsetWidth;
      let maxY = surface.offsetHeight;
      for (const node of surface.querySelectorAll(".node")) {
        minX = Math.min(minX, node.offsetLeft - 80);
        minY = Math.min(minY, node.offsetTop - 80);
        maxX = Math.max(maxX, node.offsetLeft + node.offsetWidth + 80);
        maxY = Math.max(maxY, node.offsetTop + node.offsetHeight + 80);
      }
      const spanX = Math.max(1, maxX - minX);
      const spanY = Math.max(1, maxY - minY);
      svg.style.left = minX + "px";
      svg.style.top = minY + "px";
      svg.style.width = spanX + "px";
      svg.style.height = spanY + "px";
      svg.setAttribute("viewBox", minX + " " + minY + " " + spanX + " " + spanY);
      const box = (el) => ({
        y: el.offsetTop + el.offsetHeight / 2,
        left: el.offsetLeft,
        right: el.offsetLeft + el.offsetWidth,
        top: el.offsetTop,
        bottom: el.offsetTop + el.offsetHeight,
        cx: el.offsetLeft + el.offsetWidth / 2,
      });
      const curve = (a, b) => {
        const dx = b.cx - a.cx;
        const dy = (b.top + b.bottom) / 2 - (a.top + a.bottom) / 2;
        let x1, y1, x2, y2, c1x, c1y, c2x, c2y;
        if (Math.abs(dx) >= Math.abs(dy) - 24) {
          if (dx >= 0) { x1 = a.right; y1 = a.y; x2 = b.left; y2 = b.y; }
          else { x1 = a.left; y1 = a.y; x2 = b.right; y2 = b.y; }
          const pull = Math.max(36, Math.abs(x2 - x1) * 0.45);
          const dir = x2 >= x1 ? 1 : -1;
          c1x = x1 + pull * dir; c1y = y1; c2x = x2 - pull * dir; c2y = y2;
        } else {
          if (dy >= 0) { x1 = a.cx; y1 = a.bottom; x2 = b.cx; y2 = b.top; }
          else { x1 = a.cx; y1 = a.top; x2 = b.cx; y2 = b.bottom; }
          const pull = Math.max(36, Math.abs(y2 - y1) * 0.45);
          const dir = y2 >= y1 ? 1 : -1;
          c1x = x1; c1y = y1 + pull * dir; c2x = x2; c2y = y2 - pull * dir;
        }
        return {
          d: "M " + x1 + " " + y1 + " C " + c1x + " " + c1y + ", " + c2x + " " + c2y + ", " + x2 + " " + y2,
          mx: 0.125 * x1 + 0.375 * c1x + 0.375 * c2x + 0.125 * x2,
          my: 0.125 * y1 + 0.375 * c1y + 0.375 * c2y + 0.125 * y2,
        };
      };
      let stored = [];
      let steps = {};
      try { stored = JSON.parse(board?.dataset.links || "[]"); } catch (error) { stored = []; }
      try { steps = JSON.parse(board?.dataset.steps || "{}"); } catch (error) { steps = {}; }
      const counts = {};
      for (const id of Object.keys(steps)) counts[steps[id]] = (counts[steps[id]] || 0) + 1;
      const weight = board?.dataset.look === "contrast" ? "2" : "1.4";
      const color = "var(--vscode-foreground)";
      let body = '<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 1.2 L 8.5 5 L 0 8.8 Z" fill="var(--vscode-foreground)" /></marker></defs>';
      for (const edge of stored) {
        if (!/^[a-z0-9:-]+$/i.test(edge.from) || !/^[a-z0-9:-]+$/i.test(edge.to)) continue;
        const from = surface.querySelector('[data-id="' + edge.from + '"]');
        const to = surface.querySelector('[data-id="' + edge.to + '"]');
        if (!from || !to) continue;
        const line = curve(box(from), box(to));
        const dashed = from.classList.contains("skill") || from.classList.contains("mcp") || from.classList.contains("hook") || from.classList.contains("host") || to.classList.contains("skill") || to.classList.contains("mcp") || to.classList.contains("hook") || to.classList.contains("host");
        const step = steps[edge.to];
        const label = step ? String(step) : "↻";
        const parallel = Boolean(step && counts[step] > 1);
        body += '<path d="' + line.d + '" fill="none" stroke="' + color + '" stroke-width="' + weight + '" stroke-opacity="0.72" marker-end="url(#arrow)"' + (dashed ? ' stroke-dasharray="5 4"' : "") + " />";
        if (parallel) body += '<circle cx="' + line.mx + '" cy="' + line.my + '" r="12" fill="none" stroke="' + color + '" stroke-opacity="0.45" />';
        body += '<circle cx="' + line.mx + '" cy="' + line.my + '" r="9" fill="var(--vscode-editor-background)" stroke="' + color + '" stroke-opacity="0.55" />';
        body += '<text x="' + line.mx + '" y="' + line.my + '" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="700" fill="' + color + '">' + label + "</text>";
      }
      svg.innerHTML = body;
    }
    apply();
    requestAnimationFrame(draw);
    window.addEventListener("resize", draw);
    const setZoom = (value) => { zoom = Math.min(1.8, Math.max(0.4, value)); apply(); draw(); publish(); };
    document.getElementById("zoom-in")?.addEventListener("click", () => setZoom(zoom * 1.12));
    document.getElementById("zoom-out")?.addEventListener("click", () => setZoom(zoom / 1.12));
    document.getElementById("zoom-fit")?.addEventListener("click", () => {
      const nodes = [...document.querySelectorAll("#surface .node")];
      if (!board || !nodes.length) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const node of nodes) {
        minX = Math.min(minX, node.offsetLeft); minY = Math.min(minY, node.offsetTop);
        maxX = Math.max(maxX, node.offsetLeft + node.offsetWidth); maxY = Math.max(maxY, node.offsetTop + node.offsetHeight);
      }
      zoom = Math.min(1.4, Math.max(0.4, Math.min((board.clientWidth - 64) / (maxX - minX), (board.clientHeight - 64) / (maxY - minY))));
      pan = { x: 32 - minX * zoom, y: 24 - minY * zoom };
      apply(); draw(); publish();
    });
    board?.addEventListener("wheel", (event) => { event.preventDefault(); setZoom(zoom * (event.deltaY < 0 ? 1.08 : 0.92)); }, { passive: false });
    document.getElementById("look-btn")?.addEventListener("click", () => { const menu = document.getElementById("look-menu"); if (menu) menu.hidden = !menu.hidden; });
    for (const button of document.querySelectorAll("[data-look]")) {
      button.addEventListener("click", () => { look = button.dataset.look; apply(); draw(); publish(); const menu = document.getElementById("look-menu"); if (menu) menu.hidden = true; });
    }
    document.getElementById("reset-layout")?.addEventListener("click", () => {
      for (const node of document.querySelectorAll("#surface .node")) { node.style.left = node.dataset.homeX + "px"; node.style.top = node.dataset.homeY + "px"; }
      zoom = 1; pan = { x: 24, y: 16 }; look = "clear"; apply(); draw(); publish();
    });
    board?.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest(".node, .dock, .look, .editbar")) return;
      const startX = event.clientX, startY = event.clientY, origin = { ...pan };
      const move = (ev) => { pan = { x: origin.x + ev.clientX - startX, y: origin.y + ev.clientY - startY }; apply(); };
      const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); publish(); };
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    });
    for (const node of document.querySelectorAll("#surface .node")) {
      node.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        const startX = event.clientX, startY = event.clientY, left = node.offsetLeft, top = node.offsetTop;
        let moved = false;
        const move = (ev) => {
          if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) > 4) moved = true;
          node.style.left = Math.round(left + (ev.clientX - startX) / zoom) + "px";
          node.style.top = Math.round(top + (ev.clientY - startY) / zoom) + "px";
          draw();
        };
        const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); if (moved) publish(); };
        window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
      });
    }
    document.getElementById("connect")?.addEventListener("click", () => {
      connectFrom = "";
      board?.classList.add("connecting");
      const lead = document.getElementById("lead");
      if (lead) lead.textContent = uiText.clickFirst;
    });
    for (const chip of document.querySelectorAll(".chip")) {
      chip.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/plain", chip.dataset.kind);
        event.dataTransfer.effectAllowed = "copy";
      });
    }
    board?.addEventListener("dragover", (event) => { event.preventDefault(); });
    board?.addEventListener("drop", (event) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData("text/plain");
      if (!surface || !kind) return;
      const rect = surface.getBoundingClientRect();
      vscode.postMessage({ type: "drop", kind, x: Math.round((event.clientX - rect.left) / zoom), y: Math.round((event.clientY - rect.top) / zoom) });
    });
    function markSaved() {
      const el = document.getElementById("saved");
      const label = document.getElementById("saved-label");
      if (el) {
        if (label) label.textContent = uiText.saved;
        el.classList.remove("flash");
        void el.offsetWidth;
        el.classList.add("flash");
      }
      const bar = document.querySelector(".savebar .primary");
      if (!bar) return;
      bar.classList.add("done");
      bar.textContent = uiText.saved;
      setTimeout(() => {
        bar.classList.remove("done");
        bar.textContent = uiText.save;
      }, 1600);
    }
    function armSave(button) {
      if (!button) return;
      button.classList.add("hit");
      button.textContent = uiText.saving;
    }
    let logLines = [];
    function logRank(line) {
      if (/\\b(error|failed|failure|exception|panic)\\b/i.test(line)) return "error";
      if (/\\bwarn(?:ing)?\\b/i.test(line)) return "warn";
      return "info";
    }
    function paintLogs() {
      const pre = document.getElementById("ship-log");
      const query = (document.getElementById("log-search")?.value || "").toLowerCase();
      const level = document.getElementById("log-level")?.value || "all";
      const fromValue = document.getElementById("log-from")?.value || "";
      const toValue = document.getElementById("log-to")?.value || "";
      const from = fromValue ? Date.parse(fromValue) : NaN;
      const to = toValue ? Date.parse(toValue) + 59999 : NaN;
      const shown = logLines.filter((line) => {
        if (!String(line).trim()) return false;
        if (query && !String(line).toLowerCase().includes(query)) return false;
        if (level !== "all" && logRank(line) !== level) return false;
        const stamp = (String(line).match(/\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?Z/) || [])[0];
        if (stamp && !Number.isNaN(from) && Date.parse(stamp) < from) return false;
        if (stamp && !Number.isNaN(to) && Date.parse(stamp) > to) return false;
        return true;
      });
      if (pre) pre.textContent = shown.join("\\n") || uiText.noLog;
      const cloud = document.getElementById("gcp-log");
      if (cloud) {
        const all = logLines.filter((line) => String(line).trim());
        cloud.textContent = all.join("\\n") || uiText.noLog;
      }
    }
    const logSeed = document.getElementById("log-seed");
    if (logSeed) {
      try { logLines = String(JSON.parse(logSeed.textContent || '""')).split(/\\n/); } catch (e) { logLines = []; }
      for (const id of ["log-search", "log-level", "log-from", "log-to"]) document.getElementById(id)?.addEventListener("input", paintLogs);
      paintLogs();
    }
    function applyFace(face) {
      const live = document.getElementById("ship-live");
      if (!live || !face) return;
      if (face.ariaBusy) live.setAttribute("aria-busy", "true");
      else live.removeAttribute("aria-busy");
      const line = live.querySelector(".statusline");
      if (line) {
        line.setAttribute("data-state", face.state);
        let spin = line.querySelector(".spin");
        if (face.ariaBusy && !spin) {
          spin = document.createElement("span");
          spin.className = "spin";
          spin.setAttribute("aria-hidden", "true");
          line.insertBefore(spin, line.firstChild);
        }
        if (!face.ariaBusy && spin) spin.remove();
        const status = line.querySelector("[data-status]");
        if (status) status.textContent = face.label || "";
      }
      const slot = document.getElementById("ship-summary");
      if (slot) {
        slot.replaceChildren();
        if (face.summaryKind === "working") {
          const box = document.createElement("div");
          box.className = "working";
          box.setAttribute("role", "status");
          const spin = document.createElement("span");
          spin.className = "spin";
          const text = document.createElement("span");
          text.className = "worktext";
          text.textContent = face.summary || "";
          const move = document.createElement("span");
          move.className = "bar";
          box.append(spin, text, move);
          slot.append(box);
        } else if (face.summaryKind === "error") {
          const alert = document.createElement("p");
          alert.className = "ship-error";
          alert.setAttribute("role", "alert");
          alert.textContent = face.summary || "";
          slot.append(alert);
        } else {
          const paragraph = document.createElement("p");
          paragraph.textContent = face.summary || "";
          slot.append(paragraph);
        }
      }
      const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
      setText("meter-cpu", face.cpu || "—");
      setText("meter-memory", face.memory || "—");
      setText("meter-health", face.health || "—");
      setText("meter-errors", face.errors || "0");
      setText("meter-window", face.window || "—");
      const last = document.getElementById("ship-last-error");
      if (last) {
        const empty = !face.lastError || face.lastError === "—";
        last.hidden = empty;
        last.textContent = empty ? "" : uiText.lastError + ": " + face.lastError;
      }
      const built = document.getElementById("ship-image");
      if (built) {
        built.hidden = !face.image;
        built.textContent = face.image ? uiText.imagePin + " " + face.image : "";
      }
      const route = document.getElementById("ship-path");
      if (route) route.textContent = (face.playgroundLine || "") + " · http://127.0.0.1:3000/playground";
      const start = document.getElementById("ship-start");
      if (start) { start.disabled = !!face.startDisabled; start.textContent = face.startText || start.textContent; start.title = face.summary || ""; }
      const play = document.getElementById("open-playground");
      if (play) play.disabled = !!face.playgroundDisabled;
      const rebuild = document.getElementById("ship-rebuild");
      if (rebuild) rebuild.disabled = !!face.rebuildDisabled;
      const stop = document.getElementById("ship-stop");
      if (stop) stop.disabled = !!face.stopDisabled;
      const refresh = document.getElementById("ship-refresh");
      if (refresh) refresh.disabled = !!face.refreshDisabled;
    }
    let savedWait;
    window.addEventListener("message", (event) => {
      const data = event.data || {};
      if (data.type === "saved") {
        clearTimeout(savedWait);
        savedWait = setTimeout(markSaved, 180);
      }
      if (data.type === "connect-log") {
        const pre = document.querySelector('[data-connect-log="' + data.channel + '"]');
        const status = document.querySelector('[data-connect-status="' + data.channel + '"]');
        if (pre) {
          pre.textContent = data.text || uiText.noLog;
          pre.scrollTop = pre.scrollHeight;
        }
        if (status) status.textContent = data.status || "";
      }
      function paintChart(bars, measure, facts) {
        const host = document.getElementById("gcp-chart");
        const meters = document.getElementById("gcp-meters");
        if (!host) return;
        const rows = Array.isArray(bars) ? bars : [];
        const values = rows.map((bar) => Math.round(Number(bar.ms) || 0)).sort((a, b) => a - b);
        const slow = values.length ? values[values.length - 1] : 0;
        const shown = (ms) => ms >= 1000 ? (ms / 1000).toFixed(1) + " s" : Math.round(ms) + " ms";
        const dash = "—";
        const caption = document.querySelector(".chart-card figcaption");
        if (caption) caption.textContent = uiText.chartAccept;
        const legend = document.querySelector(".chart-card .legend");
        if (legend) legend.innerHTML = '<i class="ok"></i>' + uiText.latency + '<i class="prep"></i>' + uiText.prep + '<i class="bad"></i>' + uiText.errors;
        if (meters && facts) {
          const card = (name, value, tone) => '<article class="' + (tone || "") + '"><span>' + name + '</span><strong>' + value + '</strong></article>';
          const prep = Number(facts.prepMs) || 0;
          const turn = Number(facts.replyMedianMs) || 0;
          const accept = Number(facts.acceptMedianMs) || 0;
          const p95 = Number(facts.acceptP95Ms) || 0;
          const requests = Number(facts.calls) || 0;
          meters.innerHTML = '<div class="kpis primary">' + card(uiText.calls, String(requests), "") + card(uiText.errors, String(facts.rejected || 0), facts.rejected ? "bad" : "") + card(uiText.latency, requests ? shown(accept) : dash, accept >= 1000 ? "wait" : "") + card(uiText.p95, requests ? shown(p95) : dash, p95 >= 1000 ? "wait" : "") + '</div><div class="kpis secondary">' + card(uiText.turnTime, turn ? shown(turn) : dash, turn >= 8000 ? "wait" : "") + card(uiText.prep, prep ? shown(prep) : dash, prep >= 3000 ? "wait" : "") + card(uiText.cut, String(facts.interrupted || 0), facts.interrupted ? "wait" : "") + '</div>';
        }
        if (!rows.length) {
          host.innerHTML = '<p class="hint">' + uiText.noCalls + '</p>';
          return;
        }
        const w = Math.max(360, host.clientWidth || 520);
        const h = 196;
        const left = 42;
        const bottom = 28;
        const top = 8;
        const max = Math.max(slow, 1);
        const ticks = [0, Math.round(max / 2), max];
        const inner = w - left - 12;
        const bw = Math.min(22, Math.max(8, (inner / rows.length) - 10));
        const gap = (inner - bw * rows.length) / (rows.length + 1);
        const yOf = (ms) => top + (h - bottom - top) * (1 - ms / max);
        const parts = ['<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" role="img">'];
        ticks.forEach((tick) => {
          const y = yOf(tick);
          parts.push('<line x1="' + left + '" y1="' + y + '" x2="' + (w - 8) + '" y2="' + y + '" stroke="currentColor" stroke-opacity="0.15"/>');
          const tickLabel = max >= 1000 ? (tick / 1000).toFixed(tick >= 10000 ? 0 : 1) + "s" : String(tick);
          parts.push('<text x="' + (left - 6) + '" y="' + (y + 3) + '" text-anchor="end" font-size="10" fill="currentColor" opacity="0.55">' + tickLabel + '</text>');
        });
        rows.forEach((bar, index) => {
          const ms = Math.round(Number(bar.ms) || 0);
          const bh = Math.max(3, (h - bottom) - yOf(ms));
          const x = left + gap + index * (bw + gap);
          const y = (h - bottom) - bh;
          const color = !bar.ok ? "#F04438" : ms >= 1000 ? "#F5B942" : "#22C55E";
          parts.push('<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="3" fill="' + color + '"><title>' + (bar.label || "") + " " + ms + ' ms</title></rect>');
          if (rows.length <= 8) parts.push('<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (h - 8) + '" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.6">' + (bar.label || "") + '</text>');
        });
        parts.push("</svg>");
        host.innerHTML = parts.join("");
      }
      if (data.type === "gcp-signal") {
        gcpWatchBusy = false;
        paintChart(data.bars, data.measure, data.facts);
        const headline = document.getElementById("gcp-signal-headline");
        if (headline) {
          headline.dataset.state = data.kind === "error" ? "failed" : "running";
          headline.textContent = data.headline || "";
        }
        const webhook = document.getElementById("gcp-signal-webhook");
        if (webhook) webhook.textContent = data.webhook || "";
        const turn = document.getElementById("gcp-signal-turn");
        if (turn) turn.textContent = data.turn || "";
        const advice = document.getElementById("gcp-signal-advice");
        if (advice) advice.textContent = data.advice || "";
      }
      if (data.type === "gcp-status") {
        if (data.kind !== "working") gcpWatchBusy = false;
        if (data.face === false) { showGcpStatus("", ""); stopClock(); return; }
        armGcp(data.text || "", data.kind || "", data.step || "");
        const trail = document.getElementById("gcp-trail");
        if (trail && Array.isArray(data.trail)) {
          trail.replaceChildren();
          for (const line of data.trail) {
            const item = document.createElement("li");
            item.textContent = line || "";
            trail.append(item);
          }
        }
        if (data.image) {
          const image = document.getElementById("gcp-image");
          if (image) {
            image.hidden = false;
            image.textContent = uiText.imagePin + " " + data.image;
          }
        }
        const link = document.getElementById("gcp-url");
        if (link && data.url) {
          link.hidden = false;
          link.textContent = data.url;
          link.href = data.url;
        }
      }
      if (data.type === "gcp-image") {
        const image = document.getElementById("gcp-image");
        if (image && data.image) {
          image.hidden = false;
          image.textContent = uiText.imagePin + " " + data.image;
        }
        const target = document.getElementById("gcp-target");
        if (target) {
          target.hidden = !data.target;
          target.textContent = data.target || "";
        }
        const held = document.getElementById("gcp-verdict");
        const pinned = Boolean(held && !held.hidden);
        const summary = document.getElementById("gcp-summary");
        if (!pinned && summary && data.summary) summary.textContent = data.summary;
        const list = document.getElementById("gcp-checks");
        if (list && Array.isArray(data.checks)) {
          list.replaceChildren();
          for (const row of data.checks) {
            const item = document.createElement("li");
            item.className = row.ok ? "ok" : "miss";
            item.textContent = row.text || "";
            list.append(item);
          }
        }
        const line = document.querySelector("#gcp-live .statusline");
        const label = line?.querySelector("[data-gcp-label]");
        if (!pinned && line && label && data.label) {
          line.dataset.state = "stopped";
          label.textContent = data.label;
        }
      }
      if (data.type === "gcp-secrets-cleared") {
        const names = Array.isArray(data.names) ? data.names : null;
        for (const input of document.querySelectorAll("[data-gcp-secret]")) {
          if (!names || names.includes(input.dataset.gcpSecret)) input.value = "";
        }
      }
      if (data.type === "ship-log") {
        if (data.replace) logLines = String(data.text || "").split(/\\n/).filter((line) => String(line).trim());
        else String(data.text || "").split(/\\n/).forEach((line) => { if (line) logLines.push(line); });
        paintLogs();
        for (const id of ["ship-log", "gcp-log"]) {
          const pre = document.getElementById(id);
          if (pre) pre.scrollTop = pre.scrollHeight;
        }
      }
      if (data.type === "ship-face") {
        applyFace(data.face);
        if (typeof data.logs === "string" && data.logs.trim()) {
          const pre = document.getElementById("ship-log");
          const stick = !pre || pre.scrollHeight - pre.scrollTop - pre.clientHeight < 48;
          logLines = data.logs.split(/\\n/);
          paintLogs();
          if (stick && pre) pre.scrollTop = pre.scrollHeight;
        }
      }
      if (data.type === "hint") {
        const el = document.getElementById("saved");
        const label = document.getElementById("saved-label");
        if (!el || !label) return;
        label.textContent = data.text === "Copied" ? uiText.copied : (data.text || uiText.copied);
        el.classList.remove("flash");
        void el.offsetWidth;
        el.classList.add("flash");
        const shown = label.textContent;
        setTimeout(() => { if (label.textContent === shown) label.textContent = uiText.saved; }, 1400);
      }
    });
    if (document.getElementById("saved")?.dataset.flash === "1") markSaved();
    window.addEventListener("keydown", (event) => {
      const typing = event.target.closest && event.target.closest("input, textarea, select");
      const key = event.key.toLowerCase();
      const meta = event.ctrlKey || event.metaKey;
      if (meta && key === "z" && !event.shiftKey) {
        if (typing) return;
        event.preventDefault();
        vscode.postMessage({ type: "undo" });
        return;
      }
      if (meta && (key === "y" || (key === "z" && event.shiftKey))) {
        if (typing) return;
        event.preventDefault();
        vscode.postMessage({ type: "redo" });
        return;
      }
      if (meta && key === "c" && !typing && state.selected.includes(":")) {
        event.preventDefault();
        vscode.postMessage({ type: "copy", id: state.selected });
        return;
      }
      if (meta && key === "v" && !typing) {
        event.preventDefault();
        vscode.postMessage({ type: "paste" });
        return;
      }
      if (meta && key === "d" && !typing && state.selected.includes(":")) {
        event.preventDefault();
        vscode.postMessage({ type: "duplicate", id: state.selected });
        return;
      }
      if (!typing && (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
        if (state.selected.includes(":")) vscode.postMessage({ type: "delete", id: state.selected });
      }
    });`,
    lang,
  );
}
