// Release gate. `npm test` must stay green before a version is packaged.
// It locks the folder contract: secrets stay out of the image, the SDK can load
// the TypeScript, the local sandbox stays off, a trigger that does not reach
// Agent does not call the model, and Telegram registration rejects an illegal secret.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { designerHtml, type Ui } from "./designer";
import { copy, phrase } from "./copy";
import { arrange, captureFolder, createProject, deleteItem, deliveryCheck, ensureStudioFile, executionSteps, flowLinks, initWorkspace, keepWorkspace, linksExcept, loadExample, loadProject, nextCopyName, publicChannelUrl, readLayout, readStudio, restoreFolder, restoreWorkspace, review, safeRelative, saveAgentSettings, saveItem, saveModel, saveScope, scanWorkspace, scrubLogs, setCanvasNode, setSecret, telegramReach, telegramSetWebhookTarget, toggleLink, writeEvalCase, writeLayout } from "./project";

test("an agent folder keeps secrets out of the image", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  const project = createProject(root, "Customer support");
  assert.equal(project.name, "Customer support");
  assert.equal(fs.existsSync(path.join(root, "instructions.md")), true);
  assert.equal(fs.existsSync(path.join(root, "tools")), true);
  assert.match(fs.readFileSync(path.join(root, ".dockerignore"), "utf8"), /\.env/);
  assert.equal(fs.readFileSync(path.join(root, "Dockerfile"), "utf8").includes("CURSOR_API_KEY="), false);

  saveItem(root, { kind: "tool", name: "Lookup passage", description: "Read one passage", body: "" });
  assert.equal(loadProject(root).items.some((item) => item.kind === "tool" && item.name === "lookup-passage"), true);

  setSecret(root, "CURSOR_API_KEY", "not-in-the-image");
  assert.equal(loadProject(root).secrets.find((row) => row.name === "CURSOR_API_KEY")?.configured, true);
  assert.equal(fs.readFileSync(path.join(root, "Dockerfile"), "utf8").includes("not-in-the-image"), false);
  assert.equal(fs.readFileSync(path.join(root, ".dockerignore"), "utf8").includes("not-in-the-image"), false);

  deleteItem(root, "tool", "lookup-passage");
  assert.equal(loadProject(root).items.length, 0);
});

test("initialize keeps files already in the folder and the canvas can read them", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  fs.mkdirSync(path.join(root, "tools"));
  fs.writeFileSync(path.join(root, "instructions.md"), "# Keep me\n", "utf8");
  fs.writeFileSync(path.join(root, "tools", "lookup.json"), JSON.stringify({ description: "Find a passage" }), "utf8");
  const before = scanWorkspace(root);
  assert.equal(before.found.some((piece) => piece.id === "instructions"), true);
  assert.equal(before.missing.some((piece) => piece.id === "marker"), true);

  const project = initWorkspace(root, "Desk");
  assert.equal(fs.readFileSync(path.join(root, "instructions.md"), "utf8"), "# Keep me\n");
  assert.equal(project.instructions, "# Keep me\n");
  const fresh = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  createProject(fresh, "Hello");
  assert.match(fs.readFileSync(path.join(fresh, "START.md"), "utf8"), /docs\/start\.md/);
  assert.match(fs.readFileSync(path.join(fresh, "AGENTS.md"), "utf8"), /START\.md/);
  assert.equal(project.items.some((item) => item.kind === "tool" && item.name === "lookup"), true);
  assert.equal(scanWorkspace(root).missing.length, 0);
});

test("a tool keeps its effect and inputs, and scope stays out of the image", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  createProject(root, "Desk");
  saveItem(root, {
    kind: "tool",
    name: "lookup",
    description: "Find a passage",
    body: "",
    effect: "read",
    parameters: [{ name: "question", type: "string", required: true, description: "The customer question" }],
  });
  saveItem(root, { kind: "skill", name: "hand-off", description: "the question is outside the base", body: "Offer a person.\n", effect: "read" });
  saveScope(root, "Do not move money.");
  const project = loadProject(root);
  const tool = project.items.find((item) => item.kind === "tool");
  assert.equal(tool?.effect, "read");
  assert.equal(tool?.parameters?.[0]?.name, "question");
  const skill = project.items.find((item) => item.kind === "skill");
  assert.equal(skill?.description, "the question is outside the base");
  assert.match(skill?.body || "", /Offer a person/);
  assert.equal(project.scope, "Do not move money.");
  assert.equal(fs.readFileSync(path.join(root, "Dockerfile"), "utf8").includes("Do not move money"), false);
});

test("moving a card stores the view and keeps a home for a new card", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  const project = createProject(root, "Desk");
  writeLayout(root, { positions: { agent: { x: 900, y: 40 } }, zoom: 1.2, pan: { x: 10, y: 12 }, look: "contrast" });
  const placed = arrange(project, readLayout(root));
  assert.equal(placed.positions.agent.x, 900);
  assert.equal(placed.positions.scope.x, 300);
  assert.equal(placed.look, "contrast");
  assert.equal(placed.zoom, 1.2);
});

test("three flows show what a professional contract still owes", () => {
  const support = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  createProject(support, "Support");
  saveModel(support, "strong");
  saveScope(support, "Refuse money.");
  saveItem(support, { kind: "mcp", name: "knowledge", description: "The document base", body: "", url: "http://127.0.0.1:7000/knowledge" });
  saveItem(support, { kind: "channel", name: "inbox", description: "webhook", body: "Customer message", verify: true, route: "/hooks/inbox", secret: "WEBHOOK_SECRET" });
  saveItem(support, { kind: "tool", name: "lookup", description: "Find a passage", body: "", calls: "mcp:knowledge", effect: "read" });
  saveItem(support, { kind: "skill", name: "hand-off", description: "outside the base", body: "Offer a person.\n" });
  assert.deepEqual(review(loadProject(support)).map((finding) => finding.id), []);

  const cron = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  createProject(cron, "Digest");
  saveItem(cron, { kind: "channel", name: "monday", description: "cron", body: "Weekly", verify: false });
  assert.equal(review(loadProject(cron)).some((finding) => finding.message.includes("cron")), true);

  const loose = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  createProject(loose, "Loose");
  saveItem(loose, { kind: "channel", name: "inbox", description: "webhook", body: "In", verify: true });
  saveItem(loose, { kind: "tool", name: "lookup", description: "Find", body: "", calls: "mcp:missing", effect: "read" });
  const findings = review(loadProject(loose)).map((finding) => finding.message);
  assert.equal(findings.some((message) => message.includes("no endpoint")), true);
  assert.equal(findings.some((message) => message.includes("no secret name")), true);
  assert.equal(findings.some((message) => message.includes("No MCP named missing")), true);
});

test("connecting twice removes the line and a drag keeps the other lines", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  const project = createProject(root, "Desk");
  const layout = readLayout(root);
  const linked = toggleLink(project, layout, "scope", "agent");
  assert.equal(linked.some((link) => link.from === "scope" && link.to === "agent"), false);
  writeLayout(root, { ...layout, positions: { agent: { x: 10, y: 10 } }, links: linked });
  const again = readLayout(root);
  assert.equal(again.positions.agent.x, 10);
  assert.equal(flowLinks(project, again).some((link) => link.from === "scope" && link.to === "agent"), false);
  writeLayout(root, { ...again, positions: { ...again.positions, scope: { x: 4, y: 4 } } });
  assert.equal(readLayout(root).links?.some((link) => link.from === "scope" && link.to === "agent"), false);
});

test("undo puts a deleted component and its arrow back", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  createProject(root, "Desk");
  saveItem(root, { kind: "tool", name: "lookup", description: "Find", body: "", effect: "read", calls: "mcp:knowledge" });
  writeLayout(root, {
    positions: { "tool:lookup": { x: 12, y: 20 } },
    zoom: 1,
    pan: { x: 24, y: 16 },
    look: "clear",
    links: [{ from: "agent", to: "tool:lookup" }],
  });
  const shot = captureFolder(root);
  deleteItem(root, "tool", "lookup");
  const layout = readLayout(root);
  writeLayout(root, { ...layout, positions: {}, links: linksExcept(layout.links || [], "tool:lookup") });
  assert.equal(loadProject(root).items.length, 0);
  assert.equal(readLayout(root).links?.some((link) => link.to === "tool:lookup"), false);
  restoreFolder(root, shot);
  assert.equal(loadProject(root).items.some((item) => item.name === "lookup"), true);
  assert.equal(readLayout(root).positions["tool:lookup"].x, 12);
  assert.equal(readLayout(root).links?.some((link) => link.to === "tool:lookup"), true);
});

test("step numbers follow the arrows and share a number when they can run together", () => {
  const ids = [
    "channel:inbox",
    "channel:morning",
    "scope",
    "agent",
    "tool:lookup",
    "tool:open-case",
    "tool:escalate",
    "skill:answer",
    "mcp:knowledge",
    "mcp:cases",
    "tool:loose",
  ];
  const links = [
    { from: "channel:inbox", to: "scope" },
    { from: "scope", to: "agent" },
    { from: "channel:morning", to: "agent" },
    { from: "agent", to: "tool:lookup" },
    { from: "tool:lookup", to: "mcp:knowledge" },
    { from: "agent", to: "tool:open-case" },
    { from: "agent", to: "tool:escalate" },
    { from: "tool:open-case", to: "mcp:cases" },
    { from: "tool:escalate", to: "mcp:cases" },
    { from: "agent", to: "skill:answer" },
  ];
  const steps = executionSteps(ids, links);
  assert.equal(steps["tool:loose"], undefined);
  assert.equal(steps["channel:inbox"], 1);
  assert.equal(steps["channel:morning"], 1);
  assert.equal(steps.scope, 2);
  assert.equal(steps.agent, 3);
  assert.equal(steps["tool:lookup"], 4);
  assert.equal(steps["tool:open-case"], 4);
  assert.equal(steps["tool:escalate"], 4);
  assert.equal(steps["skill:answer"], 4);
  assert.equal(steps["mcp:knowledge"], 5);
  assert.equal(steps["mcp:cases"], 5);

  const after = executionSteps(ids, [...links, { from: "mcp:knowledge", to: "tool:open-case" }]);
  assert.equal(after["tool:lookup"], 4);
  assert.equal(after["mcp:knowledge"], 5);
  assert.equal(after["tool:open-case"], 6);
  assert.equal(after["mcp:cases"], 7);
  assert.equal(after["tool:escalate"], 4);

  const loop = executionSteps(["a", "b", "c"], [
    { from: "c", to: "a" },
    { from: "a", to: "b" },
    { from: "b", to: "a" },
  ]);
  assert.equal(loop.c, 1);
  assert.equal(loop.a, undefined);
  assert.equal(loop.b, undefined);
});

test("a canvas save writes the Agent SDK folder", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  createProject(root, "Desk");
  saveItem(root, { kind: "schedule", name: "morning", description: "Review the queue.", body: "", route: "0 9 * * 1" });
  saveItem(root, { kind: "tool", name: "lookup", description: "Find a passage", body: "  return { ok: true };", effect: "read", calls: "mcp:knowledge", execution: "server" });
  saveItem(root, { kind: "hook", name: "audit", description: "turn.completed", body: "  return;" });
  const agent = fs.readFileSync(path.join(root, "bot", "agent.ts"), "utf8");
  assert.match(agent, /defineAgent/);
  assert.match(fs.readFileSync(path.join(root, "bot", "schedules", "morning.md"), "utf8"), /0 9 \* \* 1/);
  assert.match(fs.readFileSync(path.join(root, "bot", "tools", "lookup.ts"), "utf8"), /return \{ ok: true \}/);
  assert.match(fs.readFileSync(path.join(root, "bot", "hooks", "audit.ts"), "utf8"), /turn\.completed/);
  deleteItem(root, "hook", "audit");
  assert.equal(fs.existsSync(path.join(root, "bot", "hooks", "audit.ts")), false);
});

test("a case and a platform file stay inside the agent folder", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  createProject(root, "Desk");
  assert.equal(safeRelative("../secret"), undefined);
  const rel = writeEvalCase(root, "in-scope", "How do I reset my password?", "lookup");
  assert.equal(readStudio(root).evals[0]?.cases[0], "in-scope");
  assert.equal(rel, "evals/in-scope.eval.ts");
  assert.equal(ensureStudioFile(root, "artifacts"), "bot/artifacts.ts");
  assert.match(fs.readFileSync(path.join(root, "bot", "artifacts.ts"), "utf8"), /defineArtifacts/);
  assert.equal(ensureStudioFile(root, "artifacts"), "bot/artifacts.ts");
});

test("a telegram chat verifies the secret and answers in the same conversation", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  createProject(root, "Desk");
  saveItem(root, {
    kind: "channel",
    name: "telegram",
    description: "telegram",
    body: "A person writes in the chat.",
    verify: true,
    route: "/",
    secret: "TELEGRAM_WEBHOOK_SECRET",
  });
  const channel = fs.readFileSync(path.join(root, "bot", "channels", "telegram.ts"), "utf8");
  const reply = fs.readFileSync(path.join(root, "bot", "lib", "telegram.ts"), "utf8");
  assert.match(channel, /publicEndpoint/);
  assert.match(channel, /x-telegram-bot-api-secret-token/);
  assert.match(channel, /continuationToken: `telegram:\$\{chatId\}`/);
  assert.match(channel, /replyTelegram/);
  assert.match(reply, /sendMessage/);
  assert.match(reply, /slice\(0, 4000\)/);
  assert.equal(loadProject(root).secrets.some((row) => row.name === "TELEGRAM_BOT_TOKEN"), true);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as { type?: string; dependencies?: Record<string, string> };
  assert.equal(pkg.type, "module");
  assert.equal(typeof pkg.dependencies?.["@grok/agent-sdk"], "string");
  assert.match(fs.readFileSync(path.join(root, "bot", "channels", "telegram.ts"), "utf8"), /zod\/v4/);
  assert.deepEqual(deliveryCheck(root), []);
});

test("a folder the SDK would refuse is named before Docker starts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  createProject(root, "Desk");
  assert.deepEqual(deliveryCheck(root), []);
  const image = fs.readFileSync(path.join(root, "Dockerfile"), "utf8");
  assert.match(image, /--allow-anonymous/);
  assert.equal(image.includes("AGENT_SDK_BEARER_TOKEN="), false);

  const pkgPath = path.join(root, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { type?: string; dependencies?: Record<string, string> };
  delete pkg.type;
  delete pkg.dependencies?.zod;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg), "utf8");
  fs.writeFileSync(path.join(root, "Dockerfile"), "FROM node:22.13\nWORKDIR /srv/agent\nCOPY . .\nCMD [\"agent-sdk\", \"serve\", \"--dir\", \"/srv/agent\"]\n", "utf8");
  fs.mkdirSync(path.join(root, "bot", "tools"), { recursive: true });
  fs.writeFileSync(path.join(root, "bot", "tools", "broken.ts"), `// @bigagent generated\nimport { z } from "zod";\nexport default z.object({});\n`, "utf8");

  const ids = deliveryCheck(root).map((finding) => finding.id);
  assert.ok(ids.includes("package-type"));
  assert.ok(ids.includes("zod-dep"));
  assert.ok(ids.includes("docker-install"));
  assert.ok(ids.includes("docker-mode"));
  assert.ok(ids.includes("zod:bot/tools/broken.ts"));
  assert.match(deliveryCheck(root).map((finding) => finding.message).join("\n"), /require\(\) ES Module in a cycle/);

  const ui: Ui = { mode: "deploy", selected: "", notice: "", libraryOpen: false, inspectorOpen: false, libraryWidth: 240, inspectorWidth: 280 };
  const layout = readLayout(root);
  const html = designerHtml(loadProject(root), ui, true, undefined, "", layout, layout);
  assert.match(html, /id="ship-start"[^>]*disabled/);
  assert.match(html, /Start and Rebuild stay off until this folder is one that agent-sdk serve can load/);
  const spanish = designerHtml(loadProject(root), { ...ui, lang: "es" }, true, undefined, "", layout, layout);
  assert.match(spanish, /id="ship-start"[^>]*disabled/);
  assert.match(spanish, /siguen apagados/);
  assert.equal(spanish.includes("Start and Rebuild stay off"), false);
});

test("the shipped examples still satisfy the serve contract", () => {
  const examples = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../examples");
  for (const id of ["hello", "telegram-desk", "support-desk", "change-gate"]) {
    const example = path.join(examples, id);
    assert.equal(fs.existsSync(path.join(example, "bot", "agent.ts")), true, id);
    assert.deepEqual(deliveryCheck(example), [], id);
  }
});

test("loading an example keeps the first folder and restore brings it back", () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  const source = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-ex-"));
  fs.writeFileSync(path.join(dest, "mine.txt"), "mine");
  fs.writeFileSync(path.join(dest, "old.txt"), "old");
  fs.writeFileSync(path.join(dest, ".env"), "TOKEN=mine\n");
  fs.mkdirSync(path.join(source, ".bigagent"), { recursive: true });
  fs.writeFileSync(path.join(source, ".bigagent", "project.json"), JSON.stringify({ name: "Ex", secretNames: ["CURSOR_API_KEY"] }));
  fs.writeFileSync(path.join(source, "instructions.md"), "# Ex\n");
  fs.writeFileSync(path.join(source, "mine.txt"), "example");
  fs.writeFileSync(path.join(source, "extra.txt"), "extra");
  fs.writeFileSync(path.join(source, ".env"), "TOKEN=leak\n");
  const loaded = loadExample(source, dest);
  assert.equal(loaded.keptFresh, true);
  assert.equal(loaded.keptEnv, true);
  assert.equal(fs.readFileSync(path.join(dest, ".keep", "original", "mine.txt"), "utf8"), "mine");
  assert.equal(fs.readFileSync(path.join(dest, ".keep", "original", "old.txt"), "utf8"), "old");
  assert.equal(fs.existsSync(path.join(dest, "old.txt")), false);
  assert.match(fs.readFileSync(path.join(dest, ".env"), "utf8"), /TOKEN=mine/);
  assert.equal(fs.existsSync(path.join(dest, "extra.txt")), true);
  assert.equal(keepWorkspace(dest).fresh, false);
  restoreWorkspace(dest);
  assert.equal(fs.readFileSync(path.join(dest, "mine.txt"), "utf8"), "mine");
  assert.equal(fs.existsSync(path.join(dest, "extra.txt")), false);
  assert.equal(fs.existsSync(path.join(dest, ".keep", "original", "mine.txt")), true);
});

test("telegram register stays off when the webhook secret has a character Telegram rejects", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  createProject(root, "Desk");
  saveItem(root, { kind: "channel", name: "telegram", description: "telegram", body: "A person writes.", verify: true, route: "/", secret: "TELEGRAM_WEBHOOK_SECRET" });
  setSecret(root, "TELEGRAM_WEBHOOK_SECRET", "has a colon:no");
  setSecret(root, "TELEGRAM_BOT_TOKEN", "123456:ABC");
  const findings = telegramReach(root);
  assert.equal(findings.some((finding) => finding.id === "telegram-secret"), true);
  assert.equal(findings.map((finding) => finding.message).join("\n").includes("has a colon:no"), false);
  const ui: Ui = { mode: "connect", selected: "", notice: "", libraryOpen: false, inspectorOpen: false, libraryWidth: 240, inspectorWidth: 280 };
  const layout = readLayout(root);
  const ship = { docker: "ready" as const, running: true, phase: "idle" as const, summary: "", logs: "", publicUrl: "" };
  const html = designerHtml(loadProject(root), ui, true, undefined, "", layout, layout, false, undefined, ship);
  assert.match(html, /Register webhook/);
  assert.match(html, /id="ship-webhook"[^>]*disabled/);
  const spanish = designerHtml(loadProject(root), { ...ui, lang: "es" }, true, undefined, "", layout, layout, false, undefined, ship);
  assert.match(spanish, /Registrar webhook/);
  assert.match(spanish, /id="ship-webhook"[^>]*disabled/);
  assert.equal(spanish.includes(">Register webhook<"), false);
  const deployed = designerHtml(loadProject(root), { ...ui, mode: "deploy" }, true, undefined, "", layout, layout, false, undefined, ship);
  assert.equal(deployed.includes("Register webhook"), false);
  assert.match(deployed, /http:\/\/127\.0\.0\.1:3000\/playground/);
  assert.match(deployed, /Playground is ready/);
  assert.match(deployed, /id="open-playground"/);
});

test("a tunnel address becomes the telegram route and the token stays out of the body", () => {
  assert.equal(publicChannelUrl("https://name.trycloudflare.com"), "https://name.trycloudflare.com/v1/channels/telegram/");
  assert.equal(publicChannelUrl("https://name.trycloudflare.com/v1/channels/telegram/"), "https://name.trycloudflare.com/v1/channels/telegram/");
  assert.equal(publicChannelUrl("http://127.0.0.1:3000"), undefined);
  const target = telegramSetWebhookTarget("123456:ABC", "mesa-local", "https://name.trycloudflare.com");
  assert.equal("error" in target, false);
  if (!("error" in target)) {
    assert.equal(target.hook, "https://name.trycloudflare.com/v1/channels/telegram/");
    assert.match(target.endpoint, /\/setWebhook$/);
    assert.match(target.body, /mesa-local/);
    assert.equal(target.body.includes("123456:ABC"), false);
  }
  assert.equal("error" in telegramSetWebhookTarget("123456:ABC", "has a colon:no", "https://name.trycloudflare.com"), true);
});

test("sandbox on the local image is named before a silent chat", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  createProject(root, "Desk");
  saveAgentSettings(root, { sandbox: true });
  const agent = fs.readFileSync(path.join(root, "bot", "agent.ts"), "utf8");
  assert.equal(/sandbox:\s*true/.test(agent), false);
  assert.equal(review(loadProject(root)).some((finding) => finding.id === "sandbox"), true);
  assert.match(review(loadProject(root)).map((finding) => finding.message).join("\n"), /Telegram stays silent/);
  fs.writeFileSync(path.join(root, "bot", "agent.ts"), agent.replace("defineAgent({", "defineAgent({\n  local: { sandbox: true },"), "utf8");
  assert.equal(deliveryCheck(root).some((finding) => finding.id === "sandbox-image"), true);
});

test("limits and think can leave the canvas and a trigger can skip the model", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  createProject(root, "Desk");
  saveItem(root, { kind: "channel", name: "telegram", description: "telegram", body: "String(Number(text) * 2)", verify: true, route: "/", secret: "TELEGRAM_WEBHOOK_SECRET" });
  const layout = readLayout(root);
  const base: Ui = { mode: "flow", selected: "scope", notice: "", libraryOpen: true, inspectorOpen: false, libraryWidth: 240, inspectorWidth: 280 };
  const shown = designerHtml(loadProject(root), base, true, undefined, "", layout, layout);
  assert.match(shown, /data-kind="limits"/);
  assert.match(shown, /data-kind="think"/);
  assert.match(shown, /id="duplicate"[^>]*disabled/);
  assert.equal(/id="delete-node"[^>]*disabled/.test(shown), false);
  const copied = designerHtml(loadProject(root), { ...base, selected: "channel:telegram" }, true, undefined, "", layout, layout);
  assert.equal(/id="duplicate"[^>]*disabled/.test(copied), false);
  setCanvasNode(root, "think", false);
  setCanvasNode(root, "limits", false);
  const gone = loadProject(root);
  assert.equal(gone.think, false);
  assert.equal(gone.limits, false);
  const channel = fs.readFileSync(path.join(root, "bot", "channels", "telegram.ts"), "utf8");
  assert.equal(channel.includes("send("), false);
  assert.match(channel, /Number\(text\) \* 2/);
  const hidden = designerHtml(gone, { ...base, selected: "" }, true, undefined, "", readLayout(root), readLayout(root));
  assert.equal(hidden.includes('data-id="agent"'), false);
  assert.equal(hidden.includes('data-id="scope"'), false);
});

test("logs hide secret values", () => {
  assert.match(scrubLogs("TELEGRAM_BOT_TOKEN=123456:abc", ["TELEGRAM_BOT_TOKEN"]), /TELEGRAM_BOT_TOKEN=•••/);
  assert.equal(scrubLogs("bot 123456789:AAHdefghijklmnopQRST", []).includes("123456789:"), false);
});

test("a copy name skips names already on the canvas", () => {
  assert.equal(nextCopyName(new Set(["lookup", "lookup-2"]), "lookup"), "lookup-3");
});

test("a dropped card stays unconnected", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  const project = createProject(root, "Desk");
  const layout = readLayout(root);
  const frozen = flowLinks(project, layout);
  saveItem(root, { kind: "tool", name: "action", description: "", body: "", effect: "read" });
  writeLayout(root, { ...layout, links: frozen });
  assert.equal(flowLinks(loadProject(root), readLayout(root)).some((link) => link.to === "tool:action"), false);
});

test("the language switch changes labels and leaves the controls alone", () => {
  assert.deepEqual(Object.keys(copy.en).sort(), Object.keys(copy.es).sort());
  for (const key of Object.keys(copy.en) as Array<keyof typeof copy.en>) {
    assert.ok(copy.en[key].trim().length > 0, key);
    assert.ok(copy.es[key].trim().length > 0, key);
  }
  assert.equal(phrase("en", "Listening on http://127.0.0.1:3000."), "Listening on http://127.0.0.1:3000.");
  assert.match(phrase("es", "Tunnel ready at https://a.trycloudflare.com. Register webhook next. Leave this session open."), /https:\/\/a\.trycloudflare\.com/);
  assert.match(phrase("es", "No MCP named missing is on this canvas."), /missing/);
  assert.match(phrase("es", "Loaded Hello. This folder was kept in .keep/original. Your .env stayed."), /Hello/);
  assert.match(phrase("es", "CURSOR_API_KEY is empty. Set it in Secrets."), /CURSOR_API_KEY/);
  assert.equal(phrase("es", "A sentence the catalog does not know."), "A sentence the catalog does not know.");

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  createProject(root, "Hello");
  const layout = readLayout(root);
  const base: Ui = { mode: "flow", selected: "agent", notice: "", libraryOpen: true, inspectorOpen: true, libraryWidth: 240, inspectorWidth: 300 };
  const english = designerHtml(loadProject(root), base, true, undefined, "", layout, layout);
  const spanish = designerHtml(loadProject(root), { ...base, lang: "es" }, true, undefined, "", layout, layout);
  const ids = (html: string) => [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]).sort();
  const modes = (html: string) => [...html.matchAll(/data-mode="([^"]+)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(ids(english), ids(spanish));
  assert.deepEqual(modes(english), modes(spanish));
  assert.match(english, />Design</);
  assert.match(spanish, />Diseño</);
  assert.equal(spanish.includes(">Design<"), false);
  const bar = spanish.slice(spanish.indexOf('<header class="bar">'), spanish.indexOf("</header>"));
  assert.ok(bar.indexOf(">Diseño<") < bar.indexOf("data-set-lang"));
  assert.ok(bar.indexOf("data-set-lang") < bar.indexOf('id="help-open"'));
  assert.match(spanish, /El Agent SDK llama al modelo de Cursor/);
  assert.equal(spanish.includes("Qué es esto"), false);
  assert.match(english, /data-set-lang="en"/);
  assert.match(spanish, /data-set-lang="es"/);
  assert.match(english, /id="help" class="help" hidden/);
  assert.match(spanish, /CURSOR_API_KEY/);
  assert.match(spanish, /@grok\/agent-sdk/);
  assert.match(spanish, /id="save-agent"/);
  const open = designerHtml(loadProject(root), { ...base, lang: "es", helpOpen: true }, true, undefined, "", layout, layout);
  assert.match(open, /id="help" class="help"><div/);
  const examples = designerHtml(loadProject(root), { ...base, mode: "examples", lang: "es" }, true, undefined, "", layout, layout);
  assert.match(examples, /data-example="hello"/);
  assert.match(examples, /data-example="telegram-desk"/);
  assert.match(examples, />Cargar</);
});
