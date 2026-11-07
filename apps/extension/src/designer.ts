import { deliveryCheck, executionSteps, flowLinks, review, telegramReach, type Item, type Kind, type Layout, type Project, type Scan, type Studio } from "./project";

export type ShipStatus = {
  docker: "unknown" | "down" | "ready";
  running: boolean;
  phase: "idle" | "building" | "stopping" | "checking" | "rebuilding" | "tunnel" | "webhook";
  summary: string;
  logs: string;
  publicUrl: string;
};

export type Ui = {
  mode: "flow" | "prove" | "platform" | "secrets" | "connect" | "deploy";
  selected: string;
  notice: string;
  libraryOpen: boolean;
  inspectorOpen: boolean;
  libraryWidth: number;
  inspectorWidth: number;
};

const KIND_LABEL: Record<Kind, string> = {
  channel: "Trigger",
  schedule: "Schedule",
  tool: "Action",
  skill: "Guide",
  mcp: "Service",
  host: "Host",
  subagent: "Subagent",
  hook: "Hook",
};

const PURPOSE: Record<Kind, string> = {
  channel: "Starts a run from outside",
  schedule: "Starts a run on a clock",
  tool: "Something it can do",
  skill: "Steps, only when needed",
  mcp: "A system the model can call",
  host: "A system only code can call",
  subagent: "Another agent it can delegate to",
  hook: "Watches a run. Cannot change it",
};

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

const KINDS: Kind[] = ["channel", "schedule", "tool", "skill", "mcp", "host", "subagent", "hook"];

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function shell(body: string, script: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<style>
  html, body { height: 100%; margin: 0; }
  body { display: flex; flex-direction: column; font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); }
  button, input, textarea, select { font: inherit; color: inherit; }
  button { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 0; border-radius: 4px; padding: 6px 10px; cursor: pointer; }
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

function pill(item: Item): string {
  if (item.kind === "tool") {
    const effect = item.effect || "read";
    const label = effect === "irreversible" ? "Needs a person" : effect === "write" ? "Writes" : "Reads";
    const inputs = item.parameters?.length ? `${item.parameters.length} input${item.parameters.length === 1 ? "" : "s"}` : "";
    return `<span class="pill ${effect}">${label}</span>${inputs ? `<span class="pill">${inputs}</span>` : ""}`;
  }
  if (item.kind === "channel") return `<span class="pill">${item.verify ? "Signed" : "Open"}</span>`;
  if (item.kind === "skill") return item.description ? `<em>${esc(item.description)}</em>` : "";
  if (item.kind === "mcp") return item.url ? `<em>${esc(item.url)}</em>` : "";
  return "";
}

function stepBadge(steps: Record<string, number>, counts: Map<number, number>, id: string): string {
  const step = steps[id];
  if (!step) return "";
  const parallel = (counts.get(step) || 0) > 1;
  const title = parallel
    ? `Step ${step}. Anything else marked ${step} can run at the same time.`
    : step === 1
      ? "Step 1. Nothing has to finish before this."
      : `Step ${step}. It waits until every arrow into it has finished.`;
  return `<span class="stepno${parallel ? " parallel" : ""}" title="${esc(title)}">${step}</span>`;
}

function nodeButton(item: Item, selected: string, at?: { x: number; y: number }, home?: { x: number; y: number }, gap = false, badge = ""): string {
  const id = `${item.kind}:${item.name}`;
  const blurb = (item.kind === "channel" ? item.route || "No endpoint" : item.kind === "tool" ? item.calls || "Does not say what it calls" : item.kind === "skill" || item.kind === "mcp" ? "" : item.description || item.body).replace(/\s+/g, " ").trim().slice(0, 72);
  const place = at ? ` style="left:${at.x}px;top:${at.y}px" data-home-x="${home?.x ?? at.x}" data-home-y="${home?.y ?? at.y}"` : "";
  return `<button type="button" class="node ${item.kind}${id === selected ? " on" : ""}" data-id="${esc(id)}"${place}>
    ${badge}<span class="mark">${icon(item.kind)}</span>
    <span class="copy"><span class="k">${KIND_LABEL[item.kind]}</span><strong>${esc(item.name)}</strong>${pill(item)}${gap ? `<span class="pill gap">Incomplete</span>` : ""}${blurb ? `<em>${esc(blurb)}</em>` : ""}</span>
  </button>`;
}

function group(step: string, title: string, hint: string, items: Item[], selected: string): string {
  const cards = items.map((item) => nodeButton(item, selected)).join("");
  return `<section><header class="step"><span>${step}</span><h3>${title}</h3></header><p class="hint">${hint}</p>${cards || `<p class="ghost">Nothing here yet. Add it from the library.</p>`}</section>`;
}

function inspector(project: Project, selected: string): string {
  if (selected === "agent") {
    const harness = project.harness;
    const tools = ["read", "grep", "glob", "ls", "edit", "delete", "shell", "task"];
    const boxes = tools
      .map((name) => `<label class="check"><input class="harness" type="checkbox" value="${name}" ${!harness || harness.includes(name) ? "checked" : ""} /> ${name}</label>`)
      .join("");
    return `<p class="eyebrow">Agent</p><h2>${esc(project.name)}</h2><p class="path">bot/agent.ts · instructions.md</p>
      <p class="hint">The one definition for this folder. A trigger answers with the model only when its arrow reaches this card.</p>
      <label>Model<select id="model"><option value="auto" ${project.model === "auto" ? "selected" : ""}>Auto</option><option value="grok-4.5" ${project.model === "grok-4.5" ? "selected" : ""}>Grok 4.5</option><option value="composer-2.5" ${project.model === "composer-2.5" ? "selected" : ""}>Composer 2.5</option></select></label>
      <label>Effort<select id="effort"><option value="low" ${project.effort === "low" ? "selected" : ""}>Low</option><option value="medium" ${project.effort === "medium" ? "selected" : ""}>Medium</option><option value="high" ${project.effort === "high" ? "selected" : ""}>High</option></select></label>
      <label class="check"><input id="fast" type="checkbox" ${project.fast ? "checked" : ""} /> Fast</label>
      <p class="hint">Auto leaves the model to the SDK. Effort and Fast are parameters, not part of the model name.</p>
      <label class="check"><input id="sandbox" type="checkbox" ${project.sandbox ? "checked" : ""} /> Sandbox untrusted input</label>
      <label class="check"><input id="limit-tools" type="checkbox" ${harness ? "checked" : ""} /> Limit built-in tools</label>
      <div id="harness">${boxes}</div>
      <p class="hint">Leave the limit off for the full set. Shell is required for an action that runs beside the checkout. Task is required to delegate to a subagent.</p>
      <label class="check"><input id="reminders" type="checkbox" ${project.reminders ? "checked" : ""} /> Let it set reminders</label>
      <label>Max running turns<input id="turns" value="${project.maxRunningTurns ?? ""}" placeholder="empty means no cap" /></label>
      <label>Egress domains<textarea id="egress">${esc(project.egress.join("\n"))}</textarea></label>
      <label>Instructions<textarea id="instructions">${esc(project.instructions)}</textarea></label>
      <div class="row"><button type="button" id="save-agent" class="primary">Save</button></div>`;
  }
  if (selected === "scope") {
    return `<p class="eyebrow">Limits</p><h2>Scope</h2><p class="path">.bigagent/project.json</p>
      <p class="hint">What this agent will not do. A customer message cannot widen it.</p>
      <label>Refusal<textarea id="scope">${esc(project.scope)}</textarea></label>
      <div class="row"><button type="button" id="save-scope" class="primary">Save</button></div>`;
  }
  const [kind, name] = selected.split(":") as [Kind, string];
  const item = project.items.find((entry) => entry.kind === kind && entry.name === name);
  if (!item) return `<p class="hint">Select a node on the flow, or pick one in the library.</p>`;
  const head = `<p class="eyebrow">${KIND_LABEL[kind]}</p><h2>${esc(item.name)}</h2>`;
  const foot = `<div class="row"><button type="button" id="save-item" class="primary">Save</button><button type="button" id="delete-item">Delete</button></div>
    <p class="hint">Delete removes this file. Ctrl+Z brings it back.</p>`;
  if (kind === "tool") {
    const effect = item.effect || "read";
    const params = (item.parameters || [])
      .map(
        (param) => `<div class="param">
          <input name="pname" value="${esc(param.name)}" placeholder="name" />
          <select name="ptype">${["string", "number", "boolean"].map((type) => `<option ${param.type === type ? "selected" : ""}>${type}</option>`).join("")}</select>
          <label class="check"><input name="preq" type="checkbox" ${param.required ? "checked" : ""} /> required</label>
          <input name="pdesc" value="${esc(param.description)}" placeholder="what it means" />
          <button type="button" class="quiet drop-param">Remove</button>
        </div>`,
      )
      .join("");
    return `${head}<p class="path">tools/${esc(item.name)}.json</p>
      <label>What it does<textarea id="field">${esc(item.description)}</textarea></label>
      <label>Calls an MCP on this canvas<select id="call-mcp"><option value="">HTTP path instead</option>${project.items.filter((entry) => entry.kind === "mcp").map((entry) => `<option value="mcp:${esc(entry.name)}" ${item.calls === `mcp:${entry.name}` ? "selected" : ""}>${esc(entry.name)}</option>`).join("")}</select></label>
      <label>Or an HTTP path<input id="calls" value="${esc(item.calls && !item.calls.startsWith("mcp:") ? item.calls : "")}" placeholder="POST /search" /></label>
      <label>Secret name<input id="secret" value="${esc(item.secret || "")}" placeholder="only if this call needs one" /></label>
      <label>Effect<select id="effect"><option value="read" ${effect === "read" ? "selected" : ""}>Reads</option><option value="write" ${effect === "write" ? "selected" : ""}>Writes</option><option value="idempotent" ${effect === "idempotent" ? "selected" : ""}>Idempotent</option><option value="irreversible" ${effect === "irreversible" ? "selected" : ""}>Needs a person</option></select></label>
      <label>Runs<select id="execution"><option value="server" ${item.execution !== "agent" ? "selected" : ""}>On the server</option><option value="agent" ${item.execution === "agent" ? "selected" : ""}>Beside the checkout</option></select></label>
      <p class="hint">Reads can run again. Writes run once. Idempotent can repeat safely. Needs a person waits for approval. Beside the checkout needs the shell tool.</p>
      <label>Procedure<textarea id="procedure" placeholder="return input;">${esc(item.body)}</textarea></label>
      <div id="params">${params}</div>
      <button type="button" id="add-param">Add parameter</button>${foot}`;
  }
  if (kind === "skill") {
    return `${head}<p class="path">skills/${esc(item.name)}.md</p>
      <label>Load it when<input id="when" value="${esc(item.description)}" placeholder="the question is outside the knowledge base" /></label>
      <label>Procedure<textarea id="field">${esc(item.body)}</textarea></label>${foot}`;
  }
  if (kind === "mcp" || kind === "host") {
    const transport = item.transport || "http";
    const where = kind === "host" ? "bot/host-connections" : "bot/mcp-connections";
    return `${head}<p class="path">${where}/${esc(item.name)}.ts</p>
      <p class="hint">${kind === "host" ? "Host code can call this. The model never sees it." : "The model can call this when it is advertised, or an action can name it."}</p>
      <label>Transport<select id="transport"><option value="http" ${transport === "http" ? "selected" : ""}>HTTP</option><option value="stdio" ${transport === "stdio" ? "selected" : ""}>Local process</option><option value="account" ${transport === "account" ? "selected" : ""}>Cursor account</option></select></label>
      <label>Server URL<input id="url" value="${esc(item.url || "")}" placeholder="https://mcp.example.com/mcp" /></label>
      <label>Command<input id="command" value="${esc(item.command || "")}" placeholder="node" /></label>
      <label>Secret name<input id="secret" value="${esc(item.secret || "")}" placeholder="MCP_TOKEN" /></label>
      <label class="check"><input id="advertise" type="checkbox" ${item.advertise ? "checked" : ""} /> Advertise its tools to the model</label>
      <label>What it is for<textarea id="field">${esc(item.description)}</textarea></label>${foot}`;
  }
  if (kind === "schedule") {
    return `${head}<p class="path">bot/schedules/${esc(item.name)}.md</p>
      <p class="hint">A schedule starts a new run. It does not resume a conversation. UTC, to the minute.</p>
      <div class="row"><button type="button" data-cron="0 * * * *">Every hour</button><button type="button" data-cron="0 9 * * *">Every day at 9</button><button type="button" data-cron="0 9 * * 1">Monday at 9</button></div>
      <label>Schedule<input id="route-cron" value="${esc(item.route || "")}" placeholder="0 9 * * 1" /></label>
      <label>What the run should do<textarea id="field">${esc(item.description)}</textarea></label>${foot}`;
  }
  if (kind === "subagent") {
    return `${head}<p class="path">bot/subagents/${esc(item.name)}/</p>
      <p class="hint">Agent delegates here only when the built-in task tool is allowed. The description is what the parent reads.</p>
      <label>Delegate when<input id="when" value="${esc(item.description)}" placeholder="a pull request needs a second pass" /></label>
      <label>Instructions<textarea id="field">${esc(item.body)}</textarea></label>${foot}`;
  }
  if (kind === "hook") {
    const events = ["message.received", "turn.completed", "turn.failed", "actions.requested", "actions.completed", "action.result"];
    return `${head}<p class="path">bot/hooks/${esc(item.name)}.ts</p>
      <p class="hint">A hook watches the run after the fact. It cannot change the prompt, the turn, or the reply.</p>
      <label>Event<select id="field">${events.map((event) => `<option ${item.description === event ? "selected" : ""}>${event}</option>`).join("")}</select></label>
      <label>Procedure<textarea id="procedure">${esc(item.body)}</textarea></label>${foot}`;
  }
  const type = item.description || "webhook";
  const types = ["telegram", "webhook", "slack", "github", "gitlab", "bitbucket", "cron"]
    .map((option) => `<option value="${option}" ${type === option ? "selected" : ""}>${option}</option>`)
    .join("");
  const show = (name: string) => (type === name ? "" : " hidden");
  return `${head}<p class="path">channels/${esc(item.name)}.json</p>
    <label>Type<select id="field">${types}</select></label>
    <div class="assist" data-for="webhook"${show("webhook")}>
      <label>Endpoint<input id="route" value="${esc(type === "webhook" ? item.route || "" : "")}" placeholder="/hooks/inbox" /></label>
      <p class="hint">A hook is a path. Example: POST /hooks/inbox</p>
      <label class="check"><input id="verify" type="checkbox" ${item.verify ? "checked" : ""} /> Verify the signature</label>
      <label>Secret name<input id="secret" value="${esc(item.secret || "")}" placeholder="WEBHOOK_SECRET" /></label>
    </div>
    <div class="assist" data-for="telegram"${show("telegram")}>
      <label>Endpoint<input id="route-telegram" value="${esc(type === "telegram" ? item.route || "/" : "/")}" placeholder="/" /></label>
      <p class="hint">Telegram posts to /v1/channels/${esc(item.name)} plus this path. / keeps it short. One chat keeps one conversation.</p>
      <label class="check"><input id="verify-telegram" type="checkbox" ${item.verify ? "checked" : ""} /> Verify the secret token</label>
      <label>Webhook secret name<input id="secret-telegram" value="${esc(item.secret || "TELEGRAM_WEBHOOK_SECRET")}" placeholder="TELEGRAM_WEBHOOK_SECRET" /></label>
      <p class="hint">The bot token is TELEGRAM_BOT_TOKEN in Secrets. The answer is sent back to the same chat after the turn.</p>
    </div>
    <div class="assist" data-for="cron"${show("cron")}>
      <p class="hint">Pick a rhythm. The field keeps the cron expression.</p>
      <div class="row"><button type="button" data-cron="0 * * * *">Every hour</button><button type="button" data-cron="0 9 * * *">Every day at 9</button><button type="button" data-cron="0 9 * * 1">Monday at 9</button></div>
      <label>Schedule<input id="route-cron" value="${esc(type === "cron" ? item.route || "" : "")}" placeholder="0 9 * * 1" /></label>
    </div>
    <div class="assist" data-for="slack"${show("slack")}>
      <label>Event<select id="route-slack">${["message", "app_mention"].map((event) => `<option ${item.route === event ? "selected" : ""}>${event}</option>`).join("")}</select></label>
      <p class="hint">Slack wakes the agent on this event.</p>
    </div>
    <div class="assist" data-for="github"${show("github")}>
      <label>Event<select id="route-github">${["pull_request", "push", "issues"].map((event) => `<option ${item.route === event ? "selected" : ""}>${event}</option>`).join("")}</select></label>
      <p class="hint">GitHub wakes the agent on this event. On Cursor hosting it uses the connected account, so no public URL is required.</p>
    </div>
    <div class="assist" data-for="gitlab"${show("gitlab")}>
      <label>Event<select id="route-gitlab">${["merge_request", "push", "note"].map((event) => `<option ${item.route === event ? "selected" : ""}>${event}</option>`).join("")}</select></label>
    </div>
    <div class="assist" data-for="bitbucket"${show("bitbucket")}>
      <label>Event<select id="route-bitbucket">${["pull_request", "push"].map((event) => `<option ${item.route === event ? "selected" : ""}>${event}</option>`).join("")}</select></label>
    </div>
    <label>Note<textarea id="extra">${esc(item.body)}</textarea></label>${foot}`;
}

function palette(project: Project, ui: Ui): string {
  const optional = (kind: "limits" | "think", on: boolean) => {
    const label = kind === "limits" ? "Limits" : "Agent";
    const purpose = kind === "limits" ? "What one path must refuse" : "This folder's one definition";
    return `<button type="button" class="chip ${kind}" draggable="${on ? "false" : "true"}" data-kind="${kind}" ${on ? "disabled" : ""} title="${on ? "Already on the canvas" : "Add to the canvas"}"><span class="mark">${icon(kind === "limits" ? "limits" : "agent")}</span><span class="copy"><span class="k">${label}</span><span class="hint">${purpose}</span></span></button>`;
  };
  const chips = KINDS.map(
    (kind) => `<button type="button" class="chip ${kind}" draggable="true" data-kind="${kind}"><span class="mark">${icon(kind)}</span><span class="copy"><span class="k">${KIND_LABEL[kind]}</span><span class="hint">${PURPOSE[kind]}</span></span></button>`,
  ).join("");
  const rows = [
    project.limits ? `<button type="button" class="item scope${ui.selected === "scope" ? " on" : ""}" data-id="scope">Limits · Scope</button>` : "",
    project.think ? `<button type="button" class="item agent${ui.selected === "agent" ? " on" : ""}" data-id="agent">Agent · ${esc(project.name)}</button>` : "",
    ...project.items.map((item) => {
      const id = `${item.kind}:${item.name}`;
      return `<button type="button" class="item ${item.kind}${id === ui.selected ? " on" : ""}" data-id="${esc(id)}">${esc(KIND_LABEL[item.kind])} · ${esc(item.name)}</button>`;
    }),
  ]
    .filter(Boolean)
    .join("");
  return `<p class="hint">Drag a component onto the canvas. It stays unconnected until you draw the arrow. A trigger that does not reach Agent answers in code.</p>
    <div class="chips">${optional("limits", project.limits)}${optional("think", project.think)}${chips}</div>
    <h3>On this canvas</h3>
    ${rows || `<p class="hint">None yet.</p>`}`;
}

export function libraryHtml(project: Project | null, ui: Ui, hasFolder: boolean): string {
  const body = !hasFolder
    ? `<div class="pad"><h2>Canvas</h2><p class="hint">Open the agent folder first.</p></div>`
    : `<div class="pad"><h2>Canvas</h2><p class="hint">${project ? "Library and properties are on the flow. Hide either tab and the canvas keeps the rest. Hide both and only the flow remains." : "Initialize the folder on the canvas."}</p>
        <button type="button" id="open" class="primary">Show canvas</button>
        ${project ? `<div class="row"><button type="button" data-show="library">Show library</button><button type="button" data-show="inspector">Show properties</button></div>` : ""}</div>`;
  return shell(
    `<style>
      body { background: var(--vscode-sideBar-background); }
      .pad { padding: 14px; }
    </style></head><body>${body}`,
    `const vscode = acquireVsCodeApi();
    document.getElementById("open")?.addEventListener("click", () => vscode.postMessage({ type: "open" }));
    for (const button of document.querySelectorAll("[data-show]")) {
      button.addEventListener("click", () => vscode.postMessage({ type: "chrome", [button.dataset.show + "Open"]: true, focus: true }));
    }`,
  );
}

function spot(layout: Layout, home: Layout, id: string): { at: { x: number; y: number }; origin: { x: number; y: number } } {
  return { at: layout.positions[id] || { x: 40, y: 40 }, origin: home.positions[id] || layout.positions[id] || { x: 40, y: 40 } };
}

export function designerHtml(project: Project | null, ui: Ui, hasFolder = true, scan?: Scan, suggestedName = "", layout?: Layout, home?: Layout, saved = false, studio?: Studio, ship?: ShipStatus): string {
  const channels = project?.items.filter((item) => item.kind === "channel") ?? [];
  const tools = project?.items.filter((item) => item.kind === "tool") ?? [];
  const skills = project?.items.filter((item) => item.kind === "skill") ?? [];
  const mcps = project?.items.filter((item) => item.kind === "mcp") ?? [];
  const gaps = new Set(project ? review(project).map((finding) => finding.id) : []);
  const nodeIds = project ? [...(project.limits ? ["scope"] : []), ...(project.think ? ["agent"] : []), ...project.items.map((item) => `${item.kind}:${item.name}`)] : [];
  const steps = project && layout ? executionSteps(nodeIds, flowLinks(project, layout)) : {};
  const stepCounts = new Map<number, number>();
  for (const step of Object.values(steps)) stepCounts.set(step, (stepCounts.get(step) || 0) + 1);
  const badge = (id: string) => stepBadge(steps, stepCounts, id);
  const libraryWidth = Math.min(480, Math.max(200, ui.libraryWidth || 240));
  const inspectorWidth = Math.min(480, Math.max(200, ui.inspectorWidth || 300));
  const flow = project
    ? `<div class="stage">
        ${ui.libraryOpen !== false ? `<aside class="rail left" style="width:${libraryWidth}px"><header class="railhead"><h2>Library</h2><button type="button" class="hide" data-chrome="library">Hide</button></header><div class="sash" data-sash="library"></div><div class="railbody">${palette(project, ui)}</div></aside>` : `<button type="button" class="tab" data-chrome="library">Show library</button>`}
        <div class="canvascol">
          <div class="leadrow">
            <p class="lead" id="lead">The number is the step that arrow enters. The same number can run together. A higher number waits. Ctrl+Z undoes.</p>
            <div id="saved" class="saved" data-flash="${saved ? "1" : "0"}" title="Moves and edits save to this folder on their own."><svg class="tick" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 8.5 L6.5 11.5 L12.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span id="saved-label">Saved</span></div>
          </div>
          <div class="board" id="board" data-look="${layout?.look || "clear"}" data-links="${esc(JSON.stringify(project && layout ? flowLinks(project, layout) : []))}" data-steps="${esc(JSON.stringify(steps))}">
            <div class="editbar">
              <button type="button" id="undo" title="Undo (Ctrl+Z)">Undo</button>
              <button type="button" id="redo" title="Redo (Ctrl+Y)">Redo</button>
              <button type="button" id="duplicate" title="${ui.selected === "agent" ? "One Agent per folder. Delegate with a Subagent." : ui.selected === "scope" ? "One Limits card. Leave a trigger unconnected when it should not use it." : "Duplicate (Ctrl+D)"}" ${ui.selected.includes(":") ? "" : "disabled"}>Duplicate</button>
              <button type="button" id="delete-node" title="${ui.selected === "scope" || ui.selected === "agent" ? "Remove from the canvas. Add it again from the library." : "Delete (Delete)"}" ${ui.selected.includes(":") || ui.selected === "scope" || ui.selected === "agent" ? "" : "disabled"}>Delete</button>
            </div>
            <div class="surface" id="surface" style="width:${Math.max(1200, ...Object.values(layout?.positions || { a: { x: 0 } }).map((point) => point.x + 280))}px;height:${Math.max(720, ...Object.values(layout?.positions || { a: { y: 0 } }).map((point) => point.y + 200))}px;transform:translate(${layout?.pan.x || 24}px,${layout?.pan.y || 16}px) scale(${layout?.zoom || 1})">
              <svg id="wires"></svg>
              ${channels.map((item) => nodeButton(item, ui.selected, spot(layout!, home!, `channel:${item.name}`).at, spot(layout!, home!, `channel:${item.name}`).origin, gaps.has(`channel:${item.name}`), badge(`channel:${item.name}`))).join("")}
              ${project.limits ? (() => { const place = spot(layout!, home!, "scope"); return `<button type="button" class="node scope ${ui.selected === "scope" ? "on" : ""}" data-id="scope" style="left:${place.at.x}px;top:${place.at.y}px" data-home-x="${place.origin.x}" data-home-y="${place.origin.y}">${badge("scope")}<span class="mark">${icon("limits")}</span><span class="copy"><span class="k">Limits</span><strong>Scope</strong><em>${esc((project.scope || "What it must refuse").replace(/\s+/g, " ").slice(0, 90))}</em></span></button>`; })() : ""}
              ${project.think ? (() => { const place = spot(layout!, home!, "agent"); const model = project.model === "fast" ? "Fast" : project.model === "strong" ? "Strong" : "Auto"; return `<button type="button" class="node agent ${ui.selected === "agent" ? "on" : ""}" data-id="agent" style="left:${place.at.x}px;top:${place.at.y}px" data-home-x="${place.origin.x}" data-home-y="${place.origin.y}">${badge("agent")}<span class="mark">${icon("agent")}</span><span class="copy"><span class="k">Agent</span><strong>${esc(project.name)}</strong><em>${model}</em></span></button>`; })() : ""}
              ${tools.map((item) => nodeButton(item, ui.selected, spot(layout!, home!, `tool:${item.name}`).at, spot(layout!, home!, `tool:${item.name}`).origin, gaps.has(`tool:${item.name}`), badge(`tool:${item.name}`))).join("")}
              ${skills.map((item) => nodeButton(item, ui.selected, spot(layout!, home!, `skill:${item.name}`).at, spot(layout!, home!, `skill:${item.name}`).origin, gaps.has(`skill:${item.name}`), badge(`skill:${item.name}`))).join("")}
              ${(project.items.filter((item) => item.kind === "schedule")).map((item) => nodeButton(item, ui.selected, spot(layout!, home!, `schedule:${item.name}`).at, spot(layout!, home!, `schedule:${item.name}`).origin, gaps.has(`schedule:${item.name}`), badge(`schedule:${item.name}`))).join("")}
              ${(project.items.filter((item) => item.kind === "subagent")).map((item) => nodeButton(item, ui.selected, spot(layout!, home!, `subagent:${item.name}`).at, spot(layout!, home!, `subagent:${item.name}`).origin, gaps.has(`subagent:${item.name}`), badge(`subagent:${item.name}`))).join("")}
              ${(project.items.filter((item) => item.kind === "hook")).map((item) => nodeButton(item, ui.selected, spot(layout!, home!, `hook:${item.name}`).at, spot(layout!, home!, `hook:${item.name}`).origin, gaps.has(`hook:${item.name}`), badge(`hook:${item.name}`))).join("")}
              ${mcps.map((item) => nodeButton(item, ui.selected, spot(layout!, home!, `mcp:${item.name}`).at, spot(layout!, home!, `mcp:${item.name}`).origin, gaps.has(`mcp:${item.name}`), badge(`mcp:${item.name}`))).join("")}
              ${(project.items.filter((item) => item.kind === "host")).map((item) => nodeButton(item, ui.selected, spot(layout!, home!, `host:${item.name}`).at, spot(layout!, home!, `host:${item.name}`).origin, gaps.has(`host:${item.name}`), badge(`host:${item.name}`))).join("")}
            </div>
            <div class="dock">
              <button type="button" id="zoom-out" title="Zoom out">−</button>
              <button type="button" id="zoom-in" title="Zoom in" aria-label="Zoom in"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="6.5" cy="6.5" r="4" fill="none" stroke="currentColor"/><path d="M9.5 9.5 L13 13 M6.5 4.8 V8.2 M4.8 6.5 H8.2" stroke="currentColor" fill="none"/></svg></button>
              <button type="button" id="zoom-fit" title="Fit the flow">Fit</button>
              <button type="button" id="connect" title="Connect two components">Connect</button>
              <span id="zoom-label">${Math.round((layout?.zoom || 1) * 100)}%</span>
              <button type="button" id="look-btn" title="Contrast">Look</button>
              <button type="button" id="reset-layout" title="Restore the reading order">Reset</button>
            </div>
            <div id="look-menu" class="look" hidden>
              <button type="button" data-look="soft">Soft</button>
              <button type="button" data-look="clear">Clear</button>
              <button type="button" data-look="contrast">Contrast</button>
            </div>
          </div>
        </div>
        ${ui.inspectorOpen !== false ? `<aside class="rail right" style="width:${inspectorWidth}px"><div class="sash" data-sash="inspector"></div><header class="railhead"><button type="button" class="hide" data-chrome="inspector">Hide</button><h2>Properties</h2></header><div class="railbody">${inspector(project, ui.selected)}</div></aside>` : `<button type="button" class="tab right" data-chrome="inspector">Show properties</button>`}
      </div>`
    : "";
  const secrets = project
    ? `<div class="sheet"><p class="kicker">Names travel. Values do not.</p><h2>Secrets</h2><p class="hint">The image never contains a value. Local reads .env. Later, each cloud store injects the same name.</p>
        <ul class="secrets">${project.secrets.map((secret) => `<li><strong>${esc(secret.name)}</strong><span>${secret.configured ? "Set locally" : "Empty"}</span></li>`).join("") || `<li class="hint">No names yet.</li>`}</ul>
        <label>Name<input id="secret-name" placeholder="CURSOR_API_KEY" /></label>
        <label>Value<input id="secret-value" type="password" autocomplete="off" /></label>
        <div class="row"><button type="button" id="save-secret" class="primary">Save secret</button></div></div>`
    : "";
  const local = ship ?? { docker: "unknown" as const, running: false, phase: "idle" as const, summary: "Checking this machine.", logs: "", publicUrl: "" };
  const busy = local.phase !== "idle";
  const localLabel = local.phase === "building" ? "Building" : local.phase === "rebuilding" ? "Rebuilding" : local.phase === "stopping" ? "Stopping" : local.phase === "checking" ? "Checking" : local.phase === "tunnel" ? "Opening tunnel" : local.phase === "webhook" ? "Registering" : local.docker === "down" ? "Docker off" : local.running ? "Running" : "Stopped";
  const delivery = project ? deliveryCheck(project.root) : [];
  const telegram = project?.items.some((item) => item.kind === "channel" && item.description === "telegram") ?? false;
  const telegramProblems = project && telegram ? telegramReach(project.root) : [];
  const problems = project
    ? [
        ...delivery.map((finding) => finding.message),
        ...telegramProblems.map((finding) => finding.message),
        ...review(project).map((finding) => finding.message),
        ...project.secrets.filter((secret) => !secret.configured).map((secret) => `${secret.name} is empty. Set it in Secrets.`),
      ]
    : [];
  const deploy = project
    ? `<div class="sheet fill"><p class="kicker">One image. Four places.</p><h2>Ship</h2><p class="hint">Local runs on this machine. The other places use the same image later.</p>
        <div class="localbar" ${busy ? `aria-busy="true"` : ""}><header><span class="statusline">${busy ? `<span class="spin" aria-hidden="true"></span>` : ""}<span data-status>${esc(localLabel)}</span></span><strong>Local</strong></header><p>${esc(local.summary)}</p><p class="path">${local.running ? "Playground is ready" : "Playground, after Start"} · http://127.0.0.1:3000/playground</p>
          <div class="row"><button type="button" id="ship-start" class="primary" ${local.docker === "down" || busy || delivery.length ? "disabled" : ""}>Start</button><button type="button" id="open-playground" ${local.running && !busy ? "" : "disabled"}>Open playground</button><button type="button" id="ship-rebuild" ${local.docker === "down" || busy || delivery.length ? "disabled" : ""}>Rebuild</button><button type="button" id="ship-stop" ${local.running || local.phase === "building" || local.phase === "rebuilding" ? "" : "disabled"}>Stop</button><button type="button" id="ship-refresh" ${busy ? "disabled" : ""}>Refresh</button><button type="button" id="ship-logs">Follow logs</button></div>
          <p class="hint">Rebuild forces a new image and a new container so the agent reads the current .env. Secret values stay out of the image. This machine is admitted because Docker is not loopback. A public tunnel reaches the same port, so close it when the test is done.</p>
          ${delivery.length ? `<p class="hint">Start and Rebuild stay off until this folder is one that agent-sdk serve can load.</p>` : ""}
        </div>
        <div class="destinations">
          <article class="env"><header><span>Same image</span><strong>Kubernetes</strong></header><p>ConfigMap for plain values. A Secret for the sensitive ones.</p></article>
          <article class="env"><header><span>Same image</span><strong>AWS</strong></header><p>Secrets Manager, injected into the ECS or Fargate task.</p></article>
          <article class="env"><header><span>Same image</span><strong>GCP</strong></header><p>Secret Manager, injected into Cloud Run.</p></article>
          <article class="env"><header><span>Same image</span><strong>Azure</strong></header><p>Key Vault, referenced from Container Apps.</p></article>
        </div>
        ${problems.length ? `<ul class="work">${problems.map((problem) => `<li><p>${esc(problem)}</p></li>`).join("")}</ul>` : `<p class="hint">No problems in the folder.</p>`}
        <pre id="ship-log" class="log">${esc(local.logs || "No log yet.")}</pre>
        <p class="hint">Start builds the image and runs it in the background. Follow logs opens a live terminal. Secret values are hidden.</p>
        <div class="row"><button type="button" id="rewrite-docker">Rewrite local Docker files</button><button type="button" id="run-validate">Check project</button><button type="button" id="run-evals">Run evals</button></div></div>`
    : "";
  const otherChannels = project ? project.items.filter((item) => item.kind === "channel" && item.description !== "telegram") : [];
  const connect = project
    ? `<div class="sheet fill"><p class="kicker">Outside services</p><h2>Connect</h2><p class="hint">Each channel on the canvas gets its setup here. Secrets keep the values. Ship runs the image.</p>
        ${telegram ? `<div class="localbar" ${busy ? `aria-busy="true"` : ""}><header><span>From this chat</span><strong>Telegram</strong></header><p>Paste the https address of the tunnel, or open one. Register restarts the local agent so it reads the current secret, then tells Telegram where to call. The token stays in .env and is not shown.</p><label>Public address<input id="public-url" value="${esc(local.publicUrl)}" placeholder="https://name.trycloudflare.com" ${busy ? "disabled" : ""} /></label><div class="row"><button type="button" id="ship-tunnel" ${busy ? "disabled" : ""}>Open tunnel</button><button type="button" id="ship-webhook" class="primary" ${busy || !local.running || telegramProblems.length ? "disabled" : ""}>Register webhook</button></div>${telegramProblems.length ? `<p class="hint">Register stays off until the Telegram secret and token match what Telegram accepts. Change them in Secrets, then come back.</p>` : ""}</div>` : `<p class="hint">Add a channel on the canvas. Its setup card appears here.</p>`}
        ${otherChannels.map((item) => `<article class="env"><header><span>Channel</span><strong>${esc(item.name)}</strong></header><p>No setup step for this channel yet. When the platform can register it, the action goes on this page.</p></article>`).join("")}
        ${telegramProblems.length ? `<ul class="work">${telegramProblems.map((finding) => `<li><p>${esc(finding.message)}</p></li>`).join("")}</ul>` : ""}</div>`
    : "";
  const prove = project
    ? `<div class="sheet wide"><p class="kicker">Fixed cases</p><h2>Prove</h2><p class="hint">A case sends one prompt and checks the trajectory. The file opens in the editor, so the suite stays TypeScript.</p>
        <ul class="work">${(studio?.evals || []).map((suite) => `<li><div><strong>${esc(suite.file)}</strong><p class="hint">${suite.cases.length ? esc(suite.cases.join(", ")) : "No case id yet."}</p></div><button type="button" data-open="${esc(suite.file)}">Open</button></li>`).join("") || `<li class="hint">No eval files yet.</li>`}</ul>
        <form id="eval-form"><label>Case id<input name="name" placeholder="in-scope" required /></label><label>Prompt<textarea name="prompt" placeholder="How do I reset my password?"></textarea></label><label>Check<select name="check"><option value="lookup">Must look up a passage</option><option value="no-escalate">Must look up, and not escalate</option></select></label><div class="row"><button type="submit" class="primary">Add case</button><button type="button" id="run-evals">Run evals</button></div></form></div>`
    : "";
  const platform = project
    ? `<div class="sheet wide"><p class="kicker">Outside the drawing</p><h2>Platform</h2><p class="hint">These are files, not steps. Open one and the editor keeps the language service. Create only writes what is missing.</p>
        <ul class="work">${(studio?.files || []).map((file) => `<li><div><strong>${esc(file.title)}</strong><p class="hint">${esc(file.detail)}</p><p class="path">${esc(file.path)}</p></div><button type="button" data-open="${esc(file.path)}" data-create="${esc(file.id)}">${file.present ? "Open" : "Create"}</button></li>`).join("")}</ul></div>`
    : "";
  const checklist = scan
    ? `<ul class="scan">${scan.found.map((piece) => `<li class="ok">${esc(piece.label)}</li>`).join("")}${scan.missing.map((piece) => `<li class="miss">${esc(piece.label)}</li>`).join("")}</ul>`
    : "";
  const repair =
    project && scan && scan.missing.length > 0
      ? `<p class="banner">Missing ${esc(scan.missing.map((piece) => piece.label).join(", "))}. <button type="button" id="repair">Repair</button></p>`
      : "";
  const body = !hasFolder
    ? `<div class="empty"><h2>Open a folder</h2><p class="hint">The canvas reads the folder you have open.</p></div>`
    : !project
      ? `<form id="create-form" class="empty"><h2>Initialize workspace</h2><p class="hint">${scan && scan.found.length ? "Some agent files are already here. Initialize adds only what is missing." : "This folder has no agent files yet."}</p>${checklist}<label>Name<input name="name" value="${esc(suggestedName)}" required /></label><div class="row"><button type="submit" class="primary">Initialize workspace</button></div></form>`
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
      header.bar strong { margin-right: auto; font-size: 13px; font-weight: 600; letter-spacing: .01em; }
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
      .railbody { overflow: auto; padding: 4px 12px 20px; }
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
      .sheet, .empty { padding: 28px 32px; max-width: 40rem; box-sizing: border-box; }
      .sheet.wide { max-width: 64rem; }
      .sheet.fill { max-width: none; flex: 1; min-width: 0; overflow: auto; }
      .kicker { margin: 0 0 6px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; opacity: .55; }
      .destinations { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin: 18px 0; }
      .env { margin: 0; padding: 14px; border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.35)); border-radius: 12px; background: var(--vscode-editor-background); overflow: hidden; }
      .localbar { margin: 18px 0; padding: 14px; border: 1px solid var(--vscode-focusBorder); border-radius: 12px; background: var(--vscode-editor-background); }
      .localbar header { display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; }
      .localbar header span { font-size: 10px; letter-spacing: .06em; text-transform: uppercase; opacity: .55; }
      .statusline { display: inline-flex; align-items: center; gap: 8px; }
      .spin { width: 14px; height: 14px; border-radius: 99px; border: 2px solid color-mix(in srgb, var(--vscode-foreground) 28%, transparent); border-top-color: var(--vscode-foreground); animation: spin 0.7s linear infinite; flex: none; }
      @keyframes spin { to { transform: rotate(360deg); } }
      .env.on { border-color: var(--vscode-focusBorder); }
      .env header { display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; }
      .env header span { font-size: 10px; letter-spacing: .06em; text-transform: uppercase; opacity: .55; }
      .env p { margin: 0; font-size: 13px; line-height: 1.45; opacity: .8; }
      .env code { display: block; margin-top: 10px; font-size: 12px; }
      pre.log { max-height: 320px; overflow: auto; margin: 16px 0; padding: 12px; border-radius: 8px; background: var(--vscode-textCodeBlock-background, rgba(128,128,128,.12)); font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; line-height: 1.45; white-space: pre-wrap; }
      ul.secrets { list-style: none; padding: 0; margin: 16px 0; }
      ul.secrets li { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,.28)); }
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
        ${project ? `<div class="modes"><button type="button" data-mode="flow" class="${ui.mode === "flow" ? "on" : ""}">Design</button><button type="button" data-mode="prove" class="${ui.mode === "prove" ? "on" : ""}">Prove</button><button type="button" data-mode="platform" class="${ui.mode === "platform" ? "on" : ""}">Platform</button><button type="button" data-mode="secrets" class="${ui.mode === "secrets" ? "on" : ""}">Secrets</button><button type="button" data-mode="connect" class="${ui.mode === "connect" ? "on" : ""}">Connect</button><button type="button" data-mode="deploy" class="${ui.mode === "deploy" ? "on" : ""}">Ship</button></div>` : ""}
      </header>
      ${ui.notice ? `<p class="banner">${esc(ui.notice)}</p>` : ""}${repair}
      <main>${body}</main>`,
    `const vscode = acquireVsCodeApi();
    const state = ${data};
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
    document.getElementById("ship-start")?.addEventListener("click", () => { arm("Building"); vscode.postMessage({ type: "ship", task: "start" }); });
    document.getElementById("ship-rebuild")?.addEventListener("click", () => { arm("Rebuilding"); vscode.postMessage({ type: "ship", task: "rebuild" }); });
    document.getElementById("ship-stop")?.addEventListener("click", () => { arm("Stopping"); vscode.postMessage({ type: "ship", task: "stop" }); });
    document.getElementById("ship-refresh")?.addEventListener("click", () => { arm("Checking"); vscode.postMessage({ type: "ship", task: "refresh" }); });
    document.getElementById("ship-logs")?.addEventListener("click", () => vscode.postMessage({ type: "ship", task: "follow" }));
    document.getElementById("open-playground")?.addEventListener("click", () => vscode.postMessage({ type: "ship", task: "playground" }));
    document.getElementById("ship-tunnel")?.addEventListener("click", () => { arm("Opening tunnel"); vscode.postMessage({ type: "ship", task: "tunnel" }); });
    document.getElementById("ship-webhook")?.addEventListener("click", () => { arm("Registering"); vscode.postMessage({ type: "ship", task: "webhook", url: document.getElementById("public-url")?.value || "" }); });
    function arm(label) {
      const line = document.querySelector(".localbar .statusline");
      if (line && !line.querySelector(".spin")) {
        line.insertAdjacentHTML("afterbegin", '<span class="spin" aria-hidden="true"></span>');
        const text = line.querySelector("[data-status]");
        if (text) text.textContent = label;
      }
      for (const bar of document.querySelectorAll(".localbar")) bar.setAttribute("aria-busy", "true");
      for (const id of ["ship-start", "ship-rebuild", "ship-refresh", "ship-tunnel", "ship-webhook"]) {
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
          if (lead) lead.textContent = "Now click the component it should reach.";
          return;
        }
        if (connectFrom !== target) vscode.postMessage({ type: "link", from: connectFrom, to: target });
        connectFrom = "";
        board.classList.remove("connecting");
      });
    }
    document.getElementById("save-agent")?.addEventListener("click", () => {
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
    document.getElementById("save-scope")?.addEventListener("click", () => vscode.postMessage({ type: "scope", text: document.getElementById("scope").value }));
    document.getElementById("add-param")?.addEventListener("click", () => {
      const box = document.getElementById("params");
      if (!box) return;
      const row = document.createElement("div");
      row.className = "param";
      row.innerHTML = '<input name="pname" placeholder="name" /><select name="ptype"><option>string</option><option>number</option><option>boolean</option></select><label class="check"><input name="preq" type="checkbox" /> required</label><input name="pdesc" placeholder="what it means" /><button type="button" class="quiet drop-param">Remove</button>';
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
        secret: document.getElementById("field")?.value === "telegram" ? (document.getElementById("secret-telegram")?.value || "") : (document.getElementById("secret")?.value || ""),
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
      if (lead) lead.textContent = "Click the first component, then the one it should reach.";
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
      if (!el) return;
      if (label) label.textContent = "Saved";
      el.classList.remove("flash");
      void el.offsetWidth;
      el.classList.add("flash");
    }
    let savedWait;
    window.addEventListener("message", (event) => {
      const data = event.data || {};
      if (data.type === "saved") {
        clearTimeout(savedWait);
        savedWait = setTimeout(markSaved, 180);
      }
      if (data.type === "ship-log") {
        const pre = document.getElementById("ship-log");
        if (!pre) return;
        if (pre.textContent === "No log yet.") pre.textContent = "";
        pre.textContent += data.text;
        pre.scrollTop = pre.scrollHeight;
      }
      if (data.type === "hint") {
        const el = document.getElementById("saved");
        const label = document.getElementById("saved-label");
        if (!el || !label) return;
        label.textContent = data.text || "Copied";
        el.classList.remove("flash");
        void el.offsetWidth;
        el.classList.add("flash");
        const shown = label.textContent;
        setTimeout(() => { if (label.textContent === shown) label.textContent = "Saved"; }, 1400);
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
  );
}
