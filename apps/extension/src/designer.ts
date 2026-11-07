import { exampleText, phrase, studioText, t, type CopyKey, type Lang } from "./copy";
import { CHANNEL_NEEDS, deliveryCheck, EXAMPLES, executionSteps, flowLinks, GUIDE_URL, GUIDE_URL_ES, hookSecretReach, LIBRARY_KINDS, review, slackReach, telegramReach, TRIGGER_TYPES, whatsappReach, type Item, type Kind, type Layout, type Project, type Scan, type Studio } from "./project";

export type ShipStatus = {
  docker: "unknown" | "down" | "ready";
  running: boolean;
  phase: "idle" | "building" | "stopping" | "checking" | "rebuilding" | "tunnel" | "webhook";
  summary: string;
  logs: string;
  publicUrl: string;
};

export type Ui = {
  mode: "flow" | "prove" | "platform" | "secrets" | "connect" | "deploy" | "examples";
  selected: string;
  notice: string;
  libraryOpen: boolean;
  inspectorOpen: boolean;
  libraryWidth: number;
  inspectorWidth: number;
  lang?: Lang;
  helpOpen?: boolean;
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

function nodeButton(item: Item, selected: string, at?: { x: number; y: number }, home?: { x: number; y: number }, gap = false, badge = "", lang: Lang = "en"): string {
  const id = `${item.kind}:${item.name}`;
  const blurb = (item.kind === "channel" ? item.route || t(lang, "no_endpoint") : item.kind === "tool" ? item.calls || t(lang, "no_calls") : item.kind === "skill" || item.kind === "mcp" ? "" : item.description || item.body).replace(/\s+/g, " ").trim().slice(0, 72);
  const place = at ? ` style="left:${at.x}px;top:${at.y}px" data-home-x="${home?.x ?? at.x}" data-home-y="${home?.y ?? at.y}"` : "";
  return `<button type="button" class="node ${item.kind}${id === selected ? " on" : ""}" data-id="${esc(id)}"${place}>
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
      <div class="row"><button type="button" id="save-agent" class="primary">${t(lang, "save")}</button></div>`;
  }
  if (selected === "scope") {
    return `<p class="eyebrow">${kindLabel(lang, "limits")}</p><h2>${t(lang, "scope_name")}</h2><p class="path">.bigagent/project.json</p>
      <p class="hint">${t(lang, "limits_hint")}</p>
      <label>${t(lang, "refusal")}<textarea id="scope">${esc(project.scope)}</textarea></label>
      <div class="row"><button type="button" id="save-scope" class="primary">${t(lang, "save")}</button></div>`;
  }
  const [kind, name] = selected.split(":") as [Kind, string];
  const item = project.items.find((entry) => entry.kind === kind && entry.name === name);
  if (!item) return `<p class="hint">${t(lang, "select_node")}</p>`;
  const head = `<p class="eyebrow">${kindLabel(lang, kind)}</p><h2>${esc(item.name)}</h2>`;
  const foot = `<div class="row"><button type="button" id="save-item" class="primary">${t(lang, "save")}</button><button type="button" id="delete-item">${t(lang, "delete")}</button></div>
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
  const gaps = new Set(project ? review(project).map((finding) => finding.id) : []);
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
            </div>
            <div class="surface" id="surface" style="width:${Math.max(1200, ...Object.values(layout?.positions || { a: { x: 0 } }).map((point) => point.x + 280))}px;height:${Math.max(720, ...Object.values(layout?.positions || { a: { y: 0 } }).map((point) => point.y + 200))}px;transform:translate(${layout?.pan.x || 24}px,${layout?.pan.y || 16}px) scale(${layout?.zoom || 1})">
              <svg id="wires"></svg>
              ${channels.map((item) => nodeButton(item, ui.selected, spot(layout!, home!, `channel:${item.name}`).at, spot(layout!, home!, `channel:${item.name}`).origin, gaps.has(`channel:${item.name}`), badge(`channel:${item.name}`, lang))).join("")}
              ${project.limits ? (() => { const place = spot(layout!, home!, "scope"); return `<button type="button" class="node scope ${ui.selected === "scope" ? "on" : ""}" data-id="scope" style="left:${place.at.x}px;top:${place.at.y}px" data-home-x="${place.origin.x}" data-home-y="${place.origin.y}">${badge("scope")}<span class="mark">${icon("limits")}</span><span class="copy"><span class="k">${kindLabel(lang, "limits")}</span><strong>${t(lang, "scope_name")}</strong><em>${esc((project.scope || t(lang, "scope_fallback")).replace(/\s+/g, " ").slice(0, 90))}</em></span></button>`; })() : ""}
              ${project.think ? (() => { const place = spot(layout!, home!, "agent"); const model = project.model === "fast" ? t(lang, "fast_model") : project.model === "strong" ? t(lang, "strong_model") : t(lang, "auto_model"); return `<button type="button" class="node agent ${ui.selected === "agent" ? "on" : ""}" data-id="agent" style="left:${place.at.x}px;top:${place.at.y}px" data-home-x="${place.origin.x}" data-home-y="${place.origin.y}">${badge("agent")}<span class="mark">${icon("agent")}</span><span class="copy"><span class="k">${kindLabel(lang, "agent")}</span><strong>${esc(project.name)}</strong><em>${model}</em></span></button>`; })() : ""}
              ${tools.map((item) => nodeButton(item, ui.selected, spot(layout!, home!, `tool:${item.name}`).at, spot(layout!, home!, `tool:${item.name}`).origin, gaps.has(`tool:${item.name}`), badge(`tool:${item.name}`, lang))).join("")}
              ${skills.map((item) => nodeButton(item, ui.selected, spot(layout!, home!, `skill:${item.name}`).at, spot(layout!, home!, `skill:${item.name}`).origin, gaps.has(`skill:${item.name}`), badge(`skill:${item.name}`, lang))).join("")}
              ${(project.items.filter((item) => item.kind === "schedule")).map((item) => nodeButton(item, ui.selected, spot(layout!, home!, `schedule:${item.name}`).at, spot(layout!, home!, `schedule:${item.name}`).origin, gaps.has(`schedule:${item.name}`), badge(`schedule:${item.name}`, lang))).join("")}
              ${(project.items.filter((item) => item.kind === "subagent")).map((item) => nodeButton(item, ui.selected, spot(layout!, home!, `subagent:${item.name}`).at, spot(layout!, home!, `subagent:${item.name}`).origin, gaps.has(`subagent:${item.name}`), badge(`subagent:${item.name}`, lang))).join("")}
              ${(project.items.filter((item) => item.kind === "hook")).map((item) => nodeButton(item, ui.selected, spot(layout!, home!, `hook:${item.name}`).at, spot(layout!, home!, `hook:${item.name}`).origin, gaps.has(`hook:${item.name}`), badge(`hook:${item.name}`, lang))).join("")}
              ${mcps.map((item) => nodeButton(item, ui.selected, spot(layout!, home!, `mcp:${item.name}`).at, spot(layout!, home!, `mcp:${item.name}`).origin, gaps.has(`mcp:${item.name}`), badge(`mcp:${item.name}`, lang))).join("")}
              ${(project.items.filter((item) => item.kind === "host")).map((item) => nodeButton(item, ui.selected, spot(layout!, home!, `host:${item.name}`).at, spot(layout!, home!, `host:${item.name}`).origin, gaps.has(`host:${item.name}`), badge(`host:${item.name}`, lang))).join("")}
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
        ${ui.inspectorOpen !== false ? `<aside class="rail right" style="width:${inspectorWidth}px"><div class="sash" data-sash="inspector"></div><header class="railhead"><button type="button" class="hide" data-chrome="inspector">${t(lang, "hide")}</button><h2>${t(lang, "properties")}</h2></header><div class="railbody">${inspector(project, ui.selected, lang)}</div></aside>` : `<button type="button" class="tab right" data-chrome="inspector">${t(lang, "show_properties")}</button>`}
      </div>`
    : "";
  const secrets = project
    ? `<div class="sheet"><p class="kicker">${t(lang, "secrets_kicker")}</p><h2>${t(lang, "secrets")}</h2><p class="hint">${t(lang, "secrets_hint")}</p>
        <ul class="secrets">${project.secrets.map((secret) => `<li><strong>${esc(secret.name)}</strong><span>${secret.configured ? t(lang, "set_locally") : t(lang, "empty")}</span></li>`).join("") || `<li class="hint">${t(lang, "no_names")}</li>`}</ul>
        <label>${t(lang, "name")}<input id="secret-name" placeholder="CURSOR_API_KEY" /></label>
        <label>${t(lang, "value")}<input id="secret-value" type="password" autocomplete="off" /></label>
        <div class="row"><button type="button" id="save-secret" class="primary">${t(lang, "save_secret")}</button></div></div>`
    : "";
  const local = ship ?? { docker: "unknown" as const, running: false, phase: "idle" as const, summary: "Checking this machine.", logs: "", publicUrl: "" };
  const busy = local.phase !== "idle";
  const localLabel = local.phase === "building" ? t(lang, "building") : local.phase === "rebuilding" ? t(lang, "rebuilding") : local.phase === "stopping" ? t(lang, "stopping") : local.phase === "checking" ? t(lang, "checking") : local.phase === "tunnel" ? t(lang, "opening_tunnel") : local.phase === "webhook" ? t(lang, "registering") : local.docker === "down" ? t(lang, "docker_off") : local.running ? t(lang, "running") : t(lang, "stopped");
  const delivery = project ? deliveryCheck(project.root) : [];
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
        ...project.secrets.filter((secret) => !secret.configured).map((secret) => phrase(lang, `${secret.name} is empty. Set it in Secrets.`)),
      ]
    : [];
  const deploy = project
    ? `<div class="sheet fill"><p class="kicker">${t(lang, "one_image")}</p><h2>${t(lang, "ship")}</h2><p class="hint">${t(lang, "ship_hint")}</p>
        <div class="localbar" ${busy ? `aria-busy="true"` : ""}><header><span class="statusline">${busy ? `<span class="spin" aria-hidden="true"></span>` : ""}<span data-status>${esc(localLabel)}</span></span><strong>${t(lang, "local")}</strong></header><p>${esc(phrase(lang, local.summary))}</p><p class="path">${local.running ? t(lang, "playground_ready") : t(lang, "playground_after")} · http://127.0.0.1:3000/playground</p>
          <div class="row"><button type="button" id="ship-start" class="primary" ${local.docker !== "ready" || busy || delivery.length ? "disabled" : ""}>${t(lang, "start")}</button><button type="button" id="open-playground" ${local.running && !busy ? "" : "disabled"}>${t(lang, "open_playground")}</button><button type="button" id="ship-rebuild" ${local.docker !== "ready" || busy || delivery.length ? "disabled" : ""}>${t(lang, "rebuild")}</button><button type="button" id="ship-stop" ${local.running || local.phase === "building" || local.phase === "rebuilding" ? "" : "disabled"}>${t(lang, "stop")}</button><button type="button" id="ship-refresh" ${busy ? "disabled" : ""}>${t(lang, "refresh")}</button><button type="button" id="ship-logs">${t(lang, "follow_logs")}</button></div>
          <p class="hint">${t(lang, "rebuild_hint")}</p>
          ${delivery.length ? `<p class="hint">${t(lang, "start_off")}</p>` : ""}
        </div>
        <div class="destinations">
          <article class="env"><header><span>${t(lang, "same_image")}</span><strong>${t(lang, "k8s")}</strong></header><p>${t(lang, "k8s_p")}</p></article>
          <article class="env"><header><span>${t(lang, "same_image")}</span><strong>AWS</strong></header><p>${t(lang, "aws_p")}</p></article>
          <article class="env"><header><span>${t(lang, "same_image")}</span><strong>GCP</strong></header><p>${t(lang, "gcp_p")}</p></article>
          <article class="env"><header><span>${t(lang, "same_image")}</span><strong>Azure</strong></header><p>${t(lang, "azure_p")}</p></article>
        </div>
        ${problems.length ? `<ul class="work">${problems.map((problem) => `<li><p>${esc(problem)}</p></li>`).join("")}</ul>` : `<p class="hint">${t(lang, "no_problems")}</p>`}
        <pre id="ship-log" class="log">${esc(local.logs || t(lang, "no_log"))}</pre>
        <p class="hint">${t(lang, "ship_foot")}</p>
        <div class="row"><button type="button" id="rewrite-docker">${t(lang, "rewrite_docker")}</button><button type="button" id="run-validate">${t(lang, "check_project")}</button><button type="button" id="run-evals">${t(lang, "run_evals")}</button></div></div>`
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
  const packCard = (title: string, text: string, problems: { message: string }[], extra = "") =>
    `<div class="localbar" ${busy ? `aria-busy="true"` : ""}><header><span>${t(lang, "from_chat")}</span><strong>${title}</strong></header><p>${text}</p>${extra}${problems.length ? `<p class="hint">${esc(phrase(lang, problems[0].message))}</p>` : ""}</div>`;
  const repoBlock = (type: string) => {
    const item = project?.items.find((entry) => entry.kind === "channel" && entry.description === type);
    const need = CHANNEL_NEEDS[type];
    const names = (need?.secrets || []).map((name) => `<li><strong>${name}</strong></li>`).join("");
    const repo = need?.repo ? (item?.repo ? `<p class="path">${esc(item.repo)}</p>` : `<p class="hint">${t(lang, "repo_missing")}</p>`) : "";
    return `${repo}<ul class="secrets">${names}</ul>`;
  };
  const connect = project
    ? `<div class="sheet fill"><p class="kicker">${t(lang, "outside")}</p><h2>${t(lang, "connect")}</h2><p class="hint">${t(lang, "connect_hint")}</p>
        ${telegram || whatsapp ? `<div class="localbar" ${busy ? `aria-busy="true"` : ""}><header><span>${t(lang, "from_chat")}</span><strong>${t(lang, "public_address")}</strong></header><p>${t(lang, "public_shared")}</p><label>${t(lang, "public_address")}<input id="public-url" value="${esc(local.publicUrl)}" placeholder="https://name.trycloudflare.com" ${busy ? "disabled" : ""} /></label><div class="row"><button type="button" id="ship-tunnel" ${busy ? "disabled" : ""}>${t(lang, "open_tunnel")}</button></div></div>` : ""}
        ${telegram ? `<div class="localbar" ${busy ? `aria-busy="true"` : ""}><header><span>${t(lang, "from_chat")}</span><strong>Telegram</strong></header><p>${t(lang, "telegram_setup")}</p><div class="row"><button type="button" id="ship-webhook" class="primary" ${busy || !local.running || telegramProblems.length ? "disabled" : ""}>${t(lang, "register_webhook")}</button></div>${telegramProblems.length ? `<p class="hint">${t(lang, "register_off")}</p>` : ""}</div>` : ""}
        ${whatsapp ? `<div class="localbar" ${busy ? `aria-busy="true"` : ""}><header><span>${t(lang, "from_chat")}</span><strong>WhatsApp</strong></header><p>${t(lang, "whatsapp_setup")}</p><div class="row"><button type="button" id="whatsapp-check" ${busy || whatsappProblems.length ? "disabled" : ""}>${t(lang, "whatsapp_check")}</button></div><label>${t(lang, "whatsapp_to")}<input id="whatsapp-to" placeholder="573001112233" ${busy ? "disabled" : ""} /></label><div class="row"><button type="button" id="whatsapp-send" class="primary" ${busy || whatsappProblems.length ? "disabled" : ""}>${t(lang, "whatsapp_send")}</button></div>${whatsappProblems.length ? `<p class="hint">${t(lang, "whatsapp_off")}</p>` : ""}</div>` : ""}
        ${slack ? packCard("Slack", t(lang, "slack_setup"), slackProblems, `<div class="row"><button type="button" id="slack-check" ${busy || slackProblems.length ? "disabled" : ""}>${t(lang, "slack_check")}</button></div>`) : ""}
        ${github ? packCard("GitHub", t(lang, "github_setup"), githubProblems, repoBlock("github")) : ""}
        ${gitlab ? packCard("GitLab", t(lang, "gitlab_setup"), gitlabProblems, repoBlock("gitlab")) : ""}
        ${bitbucket ? packCard("Bitbucket", t(lang, "bitbucket_setup"), bitbucketProblems, repoBlock("bitbucket")) : ""}
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
      ? `<form id="create-form" class="empty"><h2>${t(lang, "init_title")}</h2><p class="hint">${scan && scan.found.length ? t(lang, "init_keep") : t(lang, "init_empty")}</p><p class="path">${esc(lang === "es" ? GUIDE_URL_ES : GUIDE_URL)}</p>${checklist}<label>${t(lang, "name")}<input name="name" value="${esc(suggestedName)}" required /></label><div class="row"><button type="submit" class="primary">${t(lang, "init_button")}</button><button type="button" id="open-guide">${t(lang, "open_guide")}</button></div></form>`
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
        ${hasFolder ? `<div class="modes">${project ? `<button type="button" data-mode="flow" class="${ui.mode === "flow" ? "on" : ""}">${t(lang, "design")}</button><button type="button" data-mode="prove" class="${ui.mode === "prove" ? "on" : ""}">${t(lang, "prove")}</button><button type="button" data-mode="platform" class="${ui.mode === "platform" ? "on" : ""}">${t(lang, "platform")}</button><button type="button" data-mode="secrets" class="${ui.mode === "secrets" ? "on" : ""}">${t(lang, "secrets")}</button><button type="button" data-mode="connect" class="${ui.mode === "connect" ? "on" : ""}">${t(lang, "connect")}</button><button type="button" data-mode="deploy" class="${ui.mode === "deploy" ? "on" : ""}">${t(lang, "ship")}</button>` : ""}<button type="button" data-mode="examples" class="${ui.mode === "examples" ? "on" : ""}">${t(lang, "examples")}</button></div>` : ""}
        <div class="bar-end">${langSwitch(lang)}<button type="button" id="help-open" class="helpbtn">${t(lang, "help")}</button></div>
      </header>
      ${ui.notice ? `<p class="banner">${esc(ui.notice)}</p>` : ""}${repair}
      <main>${body}</main>${help}`,
    `const vscode = acquireVsCodeApi();
    const state = ${data};
    const uiText = ${JSON.stringify({
      saved: t(lang, "saved"),
      copied: t(lang, "copied"),
      noLog: t(lang, "no_log"),
      clickFirst: t(lang, "click_first"),
      clickNext: t(lang, "click_next"),
      building: t(lang, "building"),
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
    }).replace(/</g, "\\u003c")};
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
      if (!el) return;
      if (label) label.textContent = uiText.saved;
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
        if (pre.textContent === uiText.noLog) pre.textContent = "";
        pre.textContent += data.text;
        pre.scrollTop = pre.scrollHeight;
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
