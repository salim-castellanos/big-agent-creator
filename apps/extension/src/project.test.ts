// Release gate. `npm test` must stay green before a version is packaged.
// It locks the folder contract: secrets stay out of the image, the SDK can load
// the TypeScript, the local sandbox stays off, a trigger that does not reach
// Agent does not call the model, and Telegram registration rejects an illegal secret.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { designerHtml, shipFace, type Ui } from "./designer";
import { copy, phrase } from "./copy";
import { applyProposal, arrange, assistantContext, captureFolder, cardNeeds, CHANNEL_NEEDS, composeIsRunning, composePortClosed, DOCKER_MISSING, dockerProblem, flowReport, lmGate, readProposal, replyWithoutProposal, chatHandoff, simulateFlow, createProject, deleteItem, deliveryCheck, emitSdk, ensureStudioFile, EXAMPLES, executionSteps, flowGaps, flowLinks, initWorkspace, keepWorkspace, LIBRARY_KINDS, linksExcept, loadExample, loadProject, logLevel, logStamp, nextCopyName, publicChannelUrl, webhookNeedsLocal, readLayout, readStudio, restoreFolder, restoreWorkspace, review, runSignals, redactValues, envState, imageName, languageChoice, cloudRunArgs, cloudRunPlan, cloudRunRuntimeAccount, secretAccessorArgs, agentSignal, parseLogEntries, channelBars, monitorFacts, monitorFilter, interactionStages, monitorFreshness, consoleAppend, pushProgress, windowsShell, pickGcloud, commandFailure, consoleCommand, formatCommand, gcpPreview, gcpChecks, cloudRunImageMatch, parseTrafficRevision, parseServiceRelease, releasedImage, serviceMissing, cloudRunDescribeFailure, shortImage, composeImageId, secretSyncPlan, parseGcpLink, readGcpLink, writeGcpLink, parseEnv, parseImageId, readImagePin, safeRelative, saveAgentSettings, shipArgs, portHolder, mergeLogs, writeDocker, writeImagePin, saveItem, saveModel, saveScope, scanWorkspace, scrubLogs, setCanvasNode, setSecret, slackCheckTarget, slackReach, slug, telegramReach, telegramSetWebhookTarget, TRIGGER_TYPES, toggleLink, whatsappCheckTarget, whatsappReach, whatsappSendTarget, writeEvalCase, writeLayout } from "./project";

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
  assert.match(channel, /replied in/);
  const agent = fs.readFileSync(path.join(root, "bot", "agent.ts"), "utf8");
  assert.match(agent, /workspaceDir: "\/srv\/agent\/bot"/);
  assert.equal(/local:\s*\{\s*cwd:/.test(agent), false);
  assert.equal(/sandbox:\s*true/.test(agent), false);
  assert.match(fs.readFileSync(path.join(root, ".cursorignore"), "utf8"), /node_modules/);
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
  assert.match(image, /node:22\.23\.5-slim/);
  assert.match(image, /--allow-anonymous/);
  assert.equal(image.includes("npm install -g"), false);
  assert.match(image, /node_modules\/\.bin\/agent-sdk/);
  assert.match(image, /git init --quiet \/srv\/agent\/bot/);
  assert.match(image, /setpriv --reuid=node/);
  assert.match(image, /HOME=\/home\/node/);
  assert.match(image, /chown -R node:node \/var\/lib\/agent-sdk/);
  assert.equal(image.includes("USER node"), false);
  fs.writeFileSync(path.join(root, "Dockerfile"), "FROM node:22.13-slim\nCMD [\"agent-sdk\", \"serve\", \"--dir\", \"/srv/agent\"]\n", "utf8");
  emitSdk(root);
  assert.match(fs.readFileSync(path.join(root, "Dockerfile"), "utf8"), /git init --quiet \/srv\/agent\/bot/);
  const dockerPath = path.join(root, "Dockerfile");
  const past = new Date("2020-01-01T00:00:00Z");
  fs.utimesSync(dockerPath, past, past);
  emitSdk(root);
  assert.equal(fs.statSync(dockerPath).mtimeMs, past.getTime());
  const custom = "FROM scratch\nCMD [\"echo\", \"hi\"]\n";
  fs.writeFileSync(path.join(root, "Dockerfile"), custom, "utf8");
  emitSdk(root);
  assert.equal(fs.readFileSync(path.join(root, "Dockerfile"), "utf8"), custom);
  assert.match(fs.readFileSync(path.join(root, ".dockerignore"), "utf8"), /\nout\n/);
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
  assert.ok(ids.includes("docker-git"));
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
  for (const id of ["hello", "telegram-desk", "clock-desk", "support-desk", "change-gate"]) {
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
  assert.equal(webhookNeedsLocal("https://bigagent-telegram-desk-olwhvzss2q-uc.a.run.app/v1/channels/telegram/"), false);
  assert.equal(webhookNeedsLocal("https://name.trycloudflare.com/v1/channels/telegram/"), true);
  const cloud = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  createProject(cloud, "Desk");
  saveItem(cloud, { kind: "channel", name: "telegram", description: "telegram", body: "A person writes.", verify: true, route: "/", secret: "TELEGRAM_WEBHOOK_SECRET" });
  setSecret(cloud, "TELEGRAM_WEBHOOK_SECRET", "mesa-local");
  setSecret(cloud, "TELEGRAM_BOT_TOKEN", "123456:ABC");
  fs.mkdirSync(path.join(cloud, ".bigagent"), { recursive: true });
  fs.writeFileSync(path.join(cloud, ".bigagent", "gcp.json"), JSON.stringify({ project: "mistratos", region: "us-central1", url: "https://bigagent-telegram-desk-olwhvzss2q-uc.a.run.app" }), "utf8");
  const stopped = { docker: "ready" as const, running: false, phase: "checking" as const, summary: "", logs: "", publicUrl: "" };
  const ready = designerHtml(loadProject(cloud), { mode: "connect", selected: "", notice: "", libraryOpen: false, inspectorOpen: false, libraryWidth: 240, inspectorWidth: 280 }, true, undefined, "", readLayout(cloud), readLayout(cloud), false, undefined, stopped);
  assert.match(ready, /value="https:\/\/bigagent-telegram-desk-olwhvzss2q-uc\.a\.run\.app"/);
  assert.match(ready, /https:\/\/bigagent-telegram-desk-olwhvzss2q-uc\.a\.run\.app\/v1\/channels\/telegram\//);
  assert.equal(/id="public-url"[^>]*disabled/.test(ready), false);
  assert.equal(/id="ship-webhook"[^>]*disabled/.test(ready), false);
  assert.match(ready, /This agent has no WhatsApp channel/);
  assert.match(ready, /data-connect-log="telegram"/);
  assert.match(ready, /Nothing has been registered in this session yet/);
  const told = designerHtml(loadProject(cloud), { mode: "connect", selected: "", notice: "", libraryOpen: false, inspectorOpen: false, libraryWidth: 240, inspectorWidth: 280 }, true, undefined, "", readLayout(cloud), readLayout(cloud), false, undefined, { ...stopped, phase: "idle", summary: "Webhook registered. Telegram will call https://bigagent-telegram-desk-olwhvzss2q-uc.a.run.app/v1/channels/telegram/.", logs: "", channelLogs: { telegram: "Webhook registered. Telegram will call https://bigagent-telegram-desk-olwhvzss2q-uc.a.run.app/v1/channels/telegram/.\n" } });
  assert.match(told, /Telegram will call https:\/\/bigagent-telegram-desk-olwhvzss2q-uc\.a\.run\.app\/v1\/channels\/telegram\//);
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
  const bank = parseEnv("CURSOR_API_KEY=desk-key-value\nTELEGRAM_BOT_TOKEN=\n# note\nTELEGRAM_WEBHOOK_SECRET=desk-hook-value\n");
  assert.deepEqual(envState(bank, ["CURSOR_API_KEY", "TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET"]), [
    { name: "CURSOR_API_KEY", present: true },
    { name: "TELEGRAM_BOT_TOKEN", present: false },
    { name: "TELEGRAM_WEBHOOK_SECRET", present: true },
  ]);
  const shown = redactValues("log desk-key-value and desk-hook-value", ["desk-key-value", "desk-hook-value"]);
  assert.equal(shown.includes("desk-key-value"), false);
  assert.equal(shown.includes("desk-hook-value"), false);
  const live = fs.readFileSync(path.join(process.cwd(), "scripts", "live-telegram.ts"), "utf8");
  assert.equal(live.includes("setWebhook"), false);
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

test("whatsapp verifies with Meta and the token stays out of the url", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  createProject(root, "Desk");
  saveItem(root, { kind: "channel", name: "whatsapp", description: "whatsapp", body: "A person writes.", verify: true, route: "/", secret: "WHATSAPP_VERIFY_TOKEN" });
  const token = "aaaaaaaaaaaaaaaaaaaa";
  setSecret(root, "WHATSAPP_TOKEN", token);
  setSecret(root, "WHATSAPP_PHONE_NUMBER_ID", "abc");
  setSecret(root, "WHATSAPP_VERIFY_TOKEN", "mesa-local");
  assert.equal(whatsappReach(root).some((finding) => finding.id === "whatsapp-phone"), true);
  assert.equal(whatsappReach(root).map((finding) => finding.message).join("\n").includes(token), false);
  const channel = fs.readFileSync(path.join(root, "bot", "channels", "whatsapp.ts"), "utf8");
  assert.match(channel, /hub\.verify_token/);
  assert.match(fs.readFileSync(path.join(root, "bot", "lib", "whatsapp.ts"), "utf8"), /graph\.facebook\.com/);
  assert.match(channel, /zod\/v4/);
  assert.match(channel, /x-hub-signature-256/);
  assert.equal(channel.includes(token), false);
  assert.deepEqual(deliveryCheck(root), []);
  const ui: Ui = { mode: "connect", selected: "", notice: "", libraryOpen: false, inspectorOpen: false, libraryWidth: 240, inspectorWidth: 280 };
  const layout = readLayout(root);
  const html = designerHtml(loadProject(root), ui, true, undefined, "", layout, layout);
  assert.match(html, /Send a test/);
  assert.match(html, /id="whatsapp-send"[^>]*disabled/);
  const spanish = designerHtml(loadProject(root), { ...ui, lang: "es" }, true, undefined, "", layout, layout);
  assert.match(spanish, /Enviar prueba/);
  assert.match(spanish, /id="whatsapp-send"/);
  const check = whatsappCheckTarget(token, "123456");
  if ("error" in check) throw new Error(check.error);
  assert.equal(check.endpoint.includes(token), false);
  assert.match(check.authorization, /Bearer /);
  const sent = whatsappSendTarget(token, "123456", "+57 300 111 2233");
  if ("error" in sent) throw new Error(sent.error);
  assert.equal(sent.endpoint.includes(token), false);
  assert.match(sent.body, /"to":"573001112233"/);
  assert.match(sent.body, /hello/);
  assert.match(fs.readFileSync(path.join(root, "AGENTS.md"), "utf8"), /save-gap/);
});

test("slack github gitlab and bitbucket write the sdk channel and a bad slack token keeps check off", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  createProject(root, "Desk");
  saveItem(root, { kind: "channel", name: "room", description: "slack", body: "A mention", verify: false, route: "message" });
  saveItem(root, { kind: "channel", name: "prs", description: "github", body: "A pull request", verify: true, route: "pull_request", secret: "GITHUB_WEBHOOK_SECRET" });
  saveItem(root, { kind: "channel", name: "mrs", description: "gitlab", body: "A note", verify: true, route: "note", secret: "GITLAB_WEBHOOK_SECRET" });
  saveItem(root, { kind: "channel", name: "bbs", description: "bitbucket", body: "A pull request", verify: true, route: "pull_request", secret: "BITBUCKET_WEBHOOK_SECRET" });
  assert.match(fs.readFileSync(path.join(root, "bot", "channels", "room.ts"), "utf8"), /slackChannel/);
  assert.match(fs.readFileSync(path.join(root, "bot", "channels", "prs.ts"), "utf8"), /githubChannel/);
  assert.match(fs.readFileSync(path.join(root, "bot", "channels", "prs.ts"), "utf8"), /onPullRequest/);
  assert.match(fs.readFileSync(path.join(root, "bot", "channels", "mrs.ts"), "utf8"), /onNote/);
  assert.match(fs.readFileSync(path.join(root, "bot", "channels", "bbs.ts"), "utf8"), /bitbucketChannel/);
  assert.equal(slackReach(root).some((finding) => finding.id === "slack-bot"), true);
  const check = slackCheckTarget("xoxb-not-the-real-value");
  if ("error" in check) throw new Error(check.error);
  assert.equal(check.endpoint.includes("xoxb-"), false);
  const ui: Ui = { mode: "connect", selected: "", notice: "", libraryOpen: false, inspectorOpen: false, libraryWidth: 240, inspectorWidth: 280 };
  const html = designerHtml(loadProject(root), ui, true, undefined, "", readLayout(root), readLayout(root));
  assert.match(html, /id="slack-check"[^>]*disabled/);
  assert.match(html, /GitHub/);
  assert.match(html, /GitLab/);
  assert.match(html, /Bitbucket/);
  fs.writeFileSync(path.join(root, "channels", "desk.json"), JSON.stringify({ type: "whatsapp", description: "A WhatsApp message", verify: true, route: "/", secret: "WHATSAPP_VERIFY_TOKEN" }), "utf8");
  fs.writeFileSync(path.join(root, "tools", "lookup.json"), JSON.stringify({ description: "Find a passage", effect: "read", calls: "mcp:knowledge", procedure: "return input;" }), "utf8");
  fs.writeFileSync(path.join(root, "mcp-connections", "knowledge.json"), JSON.stringify({ url: "http://127.0.0.1:7000/knowledge", description: "The knowledge base", transport: "http" }), "utf8");
  emitSdk(root);
  assert.match(fs.readFileSync(path.join(root, "bot", "channels", "desk.ts"), "utf8"), /hub\.verify_token/);
  assert.match(fs.readFileSync(path.join(root, "bot", "tools", "lookup.ts"), "utf8"), /mcp:knowledge|Find a passage/);
  assert.match(fs.readFileSync(path.join(root, "AGENTS.md"), "utf8"), /save-gap/);
});

test("each host flow can be finished from the card, the secrets page, and connect", () => {
  const flows = [
    { type: "github", route: "pull_request", repo: "acme/app" },
    { type: "gitlab", route: "note", repo: "acme/app" },
    { type: "bitbucket", route: "pull_request", repo: "acme/app" },
  ] as const;
  for (const flow of flows) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
    createProject(root, "Desk");
    saveItem(root, { kind: "channel", name: "gate", description: flow.type, body: "A review", verify: true, route: flow.route, secret: CHANNEL_NEEDS[flow.type].secrets[0] });
    assert.equal(flowGaps(loadProject(root)).some((gap) => gap.message.includes("repository")), true, flow.type);
    const selected = designerHtml(loadProject(root), { mode: "flow", selected: "channel:gate", notice: "", libraryOpen: true, inspectorOpen: true, libraryWidth: 240, inspectorWidth: 300 }, true, undefined, "", readLayout(root), readLayout(root));
    assert.match(selected, new RegExp(`id="repo-${flow.type}"`), flow.type);
    for (const secret of CHANNEL_NEEDS[flow.type].secrets) assert.match(selected, new RegExp(secret), `${flow.type} ${secret}`);
    saveItem(root, { kind: "channel", name: "gate", description: flow.type, body: "A review", verify: true, route: flow.route, secret: CHANNEL_NEEDS[flow.type].secrets[0], repo: flow.repo });
    const project = loadProject(root);
    assert.deepEqual(flowGaps(project), [], flow.type);
    for (const secret of CHANNEL_NEEDS[flow.type].secrets) {
      assert.equal(project.secrets.some((row) => row.name === secret), true, secret);
    }
    const page = { mode: "secrets" as const, selected: "", notice: "", libraryOpen: false, inspectorOpen: false, libraryWidth: 240, inspectorWidth: 280 };
    const secrets = designerHtml(project, page, true, undefined, "", readLayout(root), readLayout(root));
    for (const secret of CHANNEL_NEEDS[flow.type].secrets) assert.match(secrets, new RegExp(secret), secret);
    const connect = designerHtml(project, { ...page, mode: "connect" }, true, undefined, "", readLayout(root), readLayout(root));
    assert.match(connect, /acme\/app/, flow.type);
    assert.match(fs.readFileSync(path.join(root, "bot", "channels", "gate.ts"), "utf8"), /acme\/app/, flow.type);
  }
});

test("every component and every trigger option can be finished from its card", () => {
  const seenKinds = new Set<string>(["agent", "limits"]);
  const seenTypes = new Set<string>();
  const card = (root: string, selected: string) =>
    designerHtml(
      loadProject(root),
      { mode: "flow", selected, notice: "", libraryOpen: true, inspectorOpen: true, libraryWidth: 240, inspectorWidth: 320 },
      true,
      undefined,
      "",
      readLayout(root),
      readLayout(root),
    );
  const fresh = (name: string) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
    createProject(root, name);
    return root;
  };
  const panel = (html: string, type: string) => {
    const at = html.indexOf(`data-for="${type}"`);
    assert.ok(at >= 0, type);
    const rest = html.slice(at);
    const next = rest.indexOf("data-for=", 12);
    return next < 0 ? rest : rest.slice(0, next);
  };

  const agent = fresh("Desk");
  const agentCard = card(agent, "agent");
  for (const id of ["model", "effort", "fast", "sandbox", "instructions", "save-agent"]) assert.match(agentCard, new RegExp(`id="${id}"`), id);
  assert.match(agentCard, /class="row savebar"/);
  assert.match(agentCard, /Saving…/);
  const limitsCard = card(agent, "scope");
  assert.match(limitsCard, /id="scope"/);
  assert.match(limitsCard, /id="save-scope"/);

  const tool = fresh("Desk");
  saveItem(tool, { kind: "tool", name: "lookup", description: "Find", body: "", calls: "" });
  assert.equal(review(loadProject(tool)).some((finding) => finding.id === "tool:lookup"), true);
  const toolCard = card(tool, "tool:lookup");
  for (const id of ["calls", "effect", "execution", "procedure", "secret", "add-param"]) assert.match(toolCard, new RegExp(`id="${id}"`), id);
  saveItem(tool, { kind: "tool", name: "lookup", description: "Find", body: "return input;", calls: "POST /search", secret: "LOOKUP_TOKEN", effect: "read" });
  assert.equal(review(loadProject(tool)).some((finding) => finding.id === "tool:lookup"), false);
  assert.equal(loadProject(tool).secrets.some((row) => row.name === "LOOKUP_TOKEN"), true);
  seenKinds.add("tool");

  const skill = fresh("Desk");
  saveItem(skill, { kind: "skill", name: "hand-off", description: "", body: "" });
  assert.equal(review(loadProject(skill)).some((finding) => finding.id === "skill:hand-off"), true);
  assert.match(card(skill, "skill:hand-off"), /id="when"/);
  saveItem(skill, { kind: "skill", name: "hand-off", description: "the lookup found nothing", body: "Offer a person.\n" });
  assert.equal(review(loadProject(skill)).some((finding) => finding.id === "skill:hand-off"), false);
  seenKinds.add("skill");

  const server = fresh("Desk");
  saveItem(server, { kind: "mcp", name: "knowledge", description: "The base", body: "", transport: "http" });
  assert.equal(review(loadProject(server)).some((finding) => finding.message.includes("no URL")), true);
  const serverCard = card(server, "mcp:knowledge");
  for (const id of ["url", "command", "secret", "transport", "advertise"]) assert.match(serverCard, new RegExp(`id="${id}"`), id);
  assert.match(serverCard, /value="account"/);
  saveItem(server, { kind: "mcp", name: "knowledge", description: "The base", body: "", transport: "http", url: "http://127.0.0.1:7000/knowledge", secret: "MCP_TOKEN" });
  assert.equal(review(loadProject(server)).some((finding) => finding.id === "mcp:knowledge"), false);
  assert.equal(loadProject(server).secrets.some((row) => row.name === "MCP_TOKEN"), true);
  seenKinds.add("mcp");

  const local = fresh("Desk");
  saveItem(local, { kind: "mcp", name: "local", description: "A process", body: "", transport: "stdio" });
  assert.equal(review(loadProject(local)).some((finding) => finding.message.includes("no command")), true);
  saveItem(local, { kind: "mcp", name: "local", description: "A process", body: "", transport: "stdio", command: "node" });
  assert.equal(review(loadProject(local)).some((finding) => finding.id === "mcp:local"), false);
  assert.match(fs.readFileSync(path.join(local, "bot", "mcp-connections", "local.ts"), "utf8"), /command: "node"/);

  const account = fresh("Desk");
  saveItem(account, { kind: "mcp", name: "cursor", description: "The account", body: "", transport: "account" });
  assert.equal(review(loadProject(account)).some((finding) => finding.id === "mcp:cursor"), false);
  assert.match(fs.readFileSync(path.join(account, "bot", "mcp-connections", "cursor.ts"), "utf8"), /cursorAccount: true/);

  const host = fresh("Desk");
  saveItem(host, { kind: "host", name: "private", description: "Hidden", body: "", transport: "http" });
  assert.equal(review(loadProject(host)).some((finding) => finding.message.includes("no URL")), true);
  assert.match(card(host, "host:private"), /id="url"/);
  saveItem(host, { kind: "host", name: "private", description: "Hidden", body: "", transport: "http", url: "http://127.0.0.1:7001" });
  assert.equal(review(loadProject(host)).some((finding) => finding.id === "host:private"), false);
  assert.match(fs.readFileSync(path.join(host, "bot", "host-connections", "private.ts"), "utf8"), /127\.0\.0\.1:7001/);
  seenKinds.add("host");

  const clock = fresh("Desk");
  saveItem(clock, { kind: "schedule", name: "monday", description: "Weekly", body: "" });
  assert.equal(review(loadProject(clock)).some((finding) => finding.id === "schedule:monday"), true);
  assert.match(card(clock, "schedule:monday"), /id="route-cron"/);
  saveItem(clock, { kind: "schedule", name: "monday", description: "Weekly", body: "", route: "0 9 * * 1" });
  assert.equal(review(loadProject(clock)).some((finding) => finding.id === "schedule:monday"), false);
  assert.match(fs.readFileSync(path.join(clock, "bot", "schedules", "monday.md"), "utf8"), /0 9 \* \* 1/);
  seenKinds.add("schedule");

  const delegate = fresh("Desk");
  saveItem(delegate, { kind: "subagent", name: "reviewer", description: "", body: "" });
  assert.equal(review(loadProject(delegate)).some((finding) => finding.id === "subagent:reviewer"), true);
  assert.match(card(delegate, "subagent:reviewer"), /id="when"/);
  saveItem(delegate, { kind: "subagent", name: "reviewer", description: "a pull request needs a second pass", body: "Look again.\n" });
  assert.equal(review(loadProject(delegate)).some((finding) => finding.id === "subagent:reviewer"), false);
  seenKinds.add("subagent");

  const watch = fresh("Desk");
  saveItem(watch, { kind: "hook", name: "log", description: "", body: "" });
  const hookCard = card(watch, "hook:log");
  for (const event of ["message.received", "turn.completed", "turn.failed", "actions.requested", "actions.completed", "action.result"]) {
    assert.match(hookCard, new RegExp(event), event);
  }
  saveItem(watch, { kind: "hook", name: "log", description: "turn.completed", body: "return;" });
  assert.equal(review(loadProject(watch)).some((finding) => finding.id === "hook:log"), false);
  assert.match(fs.readFileSync(path.join(watch, "bot", "hooks", "log.ts"), "utf8"), /turn\.completed/);
  seenKinds.add("hook");

  const triggers: { type: (typeof TRIGGER_TYPES)[number]; route: string; repo?: string; file: string; mark: RegExp }[] = [
    { type: "telegram", route: "/", file: "bot/channels/gate.ts", mark: /replyTelegram/ },
    { type: "whatsapp", route: "/", file: "bot/channels/gate.ts", mark: /hub\.verify_token/ },
    { type: "webhook", route: "", file: "bot/channels/gate.ts", mark: /POST/ },
    { type: "slack", route: "message", file: "bot/channels/gate.ts", mark: /slackChannel/ },
    { type: "github", route: "pull_request", repo: "acme/app", file: "bot/channels/gate.ts", mark: /acme\/app/ },
    { type: "gitlab", route: "note", repo: "acme/app", file: "bot/channels/gate.ts", mark: /acme\/app/ },
    { type: "bitbucket", route: "pull_request", repo: "acme/app", file: "bot/channels/gate.ts", mark: /acme\/app/ },
    { type: "cron", route: "", file: "bot/schedules/gate.md", mark: /0 9 \* \* 1/ },
  ];
  for (const trigger of triggers) {
    const root = fresh("Desk");
    saveItem(root, { kind: "channel", name: "gate", description: trigger.type, body: "A message", verify: true, route: trigger.route, secret: "WEBHOOK_SECRET" });
    const html = card(root, "channel:gate");
    const piece = panel(html, trigger.type);
    assert.match(piece, new RegExp(`^data-for="${trigger.type}">`), trigger.type);
    for (const secret of CHANNEL_NEEDS[trigger.type]?.secrets || []) assert.match(piece, new RegExp(secret), `${trigger.type} ${secret}`);
    if (trigger.repo) {
      assert.match(piece, new RegExp(`id="repo-${trigger.type}"`), trigger.type);
      assert.equal(flowGaps(loadProject(root)).some((gap) => gap.message.includes("repository")), true, trigger.type);
      saveItem(root, { kind: "channel", name: "gate", description: trigger.type, body: "A message", verify: true, route: trigger.route, secret: "WEBHOOK_SECRET", repo: trigger.repo });
    }
    if (trigger.type === "webhook") {
      assert.match(piece, /id="route"/);
      assert.match(piece, /id="secret"/);
      assert.equal(review(loadProject(root)).some((finding) => finding.message.includes("no endpoint")), true);
      saveItem(root, { kind: "channel", name: "gate", description: "webhook", body: "A message", verify: true, route: "/hooks/inbox", secret: "WEBHOOK_SECRET" });
      assert.equal(loadProject(root).secrets.some((row) => row.name === "WEBHOOK_SECRET"), true);
    }
    if (trigger.type === "cron") {
      assert.match(piece, /id="route-cron"/);
      assert.equal(review(loadProject(root)).some((finding) => finding.message.includes("cron")), true);
      saveItem(root, { kind: "channel", name: "gate", description: "cron", body: "Weekly", verify: false, route: "0 9 * * 1" });
    }
    assert.match(fs.readFileSync(path.join(root, trigger.file), "utf8"), trigger.mark, trigger.type);
    assert.deepEqual(deliveryCheck(root), [], trigger.type);
    seenTypes.add(trigger.type);
    seenKinds.add("channel");
  }

  for (const kind of LIBRARY_KINDS) assert.ok(seenKinds.has(kind), kind);
  for (const type of TRIGGER_TYPES) assert.ok(seenTypes.has(type), type);
});

test("a folder with every component is one the Agent SDK can typecheck", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  createProject(root, "Whole");
  saveScope(root, "Refuse money.");
  saveItem(root, { kind: "tool", name: "lookup", description: "Find a passage", body: "return input;", calls: "mcp:knowledge", effect: "read", secret: "LOOKUP_TOKEN" });
  saveItem(root, { kind: "skill", name: "when-empty", description: "the lookup found nothing", body: "Call save-gap.\n" });
  saveItem(root, { kind: "tool", name: "save-gap", description: "Store the question", body: "return input;", calls: "http://127.0.0.1:7000/gaps", effect: "write" });
  saveItem(root, { kind: "mcp", name: "knowledge", description: "The knowledge base", body: "", transport: "http", url: "http://127.0.0.1:7000/knowledge" });
  saveItem(root, { kind: "host", name: "private", description: "Hidden", body: "", transport: "http", url: "http://127.0.0.1:7001" });
  saveItem(root, { kind: "schedule", name: "monday", description: "Weekly", body: "", route: "0 9 * * 1" });
  saveItem(root, { kind: "subagent", name: "reviewer", description: "a second pass", body: "Look again.\n" });
  saveItem(root, { kind: "hook", name: "log", description: "turn.completed", body: "return;" });
  saveItem(root, { kind: "channel", name: "telegram", description: "telegram", body: "A chat", verify: true, route: "/", secret: "TELEGRAM_WEBHOOK_SECRET" });
  saveItem(root, { kind: "channel", name: "whatsapp", description: "whatsapp", body: "A chat", verify: true, route: "/", secret: "WHATSAPP_VERIFY_TOKEN" });
  saveItem(root, { kind: "channel", name: "slack", description: "slack", body: "A mention", verify: false, route: "message" });
  saveItem(root, { kind: "channel", name: "github", description: "github", body: "A pull request", verify: true, route: "pull_request", repo: "acme/app", secret: "GITHUB_WEBHOOK_SECRET" });
  saveItem(root, { kind: "channel", name: "gitlab", description: "gitlab", body: "A note", verify: true, route: "note", repo: "acme/app", secret: "GITLAB_WEBHOOK_SECRET" });
  saveItem(root, { kind: "channel", name: "bitbucket", description: "bitbucket", body: "A pull request", verify: true, route: "pull_request", repo: "acme/app", secret: "BITBUCKET_WEBHOOK_SECRET" });
  saveItem(root, { kind: "channel", name: "inbox", description: "webhook", body: "A message", verify: true, route: "/hooks/inbox", secret: "WEBHOOK_SECRET" });
  saveItem(root, { kind: "channel", name: "monday-note", description: "cron", body: "Weekly", verify: false, route: "0 9 * * 1" });
  assert.deepEqual(deliveryCheck(root), []);
  assert.deepEqual(flowGaps(loadProject(root)).filter((gap) => gap.message.includes("repository")), []);

  const extensionModules = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../node_modules");
  const tsc = path.join(extensionModules, "typescript", "bin", "tsc");
  assert.equal(fs.existsSync(tsc), true, "npm install must include typescript so the generated folder can be typechecked");
  assert.equal(fs.existsSync(path.join(extensionModules, "@grok", "agent-sdk", "package.json")), true, "npm install must include @grok/agent-sdk");
  fs.symlinkSync(extensionModules, path.join(root, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "bundler",
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          types: ["node"],
        },
        include: ["bot/**/*.ts"],
      },
      null,
      2,
    ),
    "utf8",
  );
  const ran = spawnSync(process.execPath, [tsc, "--noEmit", "--pretty", "false"], { cwd: root, encoding: "utf8" });
  assert.equal(ran.status, 0, `${ran.stdout}\n${ran.stderr}`);
});

test("three canvas agents keep their settings and are ready to deploy", () => {
  const typecheck = (root: string) => {
    const extensionModules = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../node_modules");
    fs.symlinkSync(extensionModules, path.join(root, "node_modules"), process.platform === "win32" ? "junction" : "dir");
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "bundler", strict: true, noEmit: true, skipLibCheck: true, types: ["node"] },
        include: ["bot/**/*.ts"],
      }),
      "utf8",
    );
    const tsc = path.join(extensionModules, "typescript", "bin", "tsc");
    const ran = spawnSync(process.execPath, [tsc, "--noEmit", "--pretty", "false"], { cwd: root, encoding: "utf8" });
    assert.equal(ran.status, 0, `${ran.stdout}\n${ran.stderr}`);
  };
  const finish = (root: string) => {
    for (const name of flowReport(loadProject(root)).secrets) setSecret(root, name, "set");
    const done = simulateFlow(loadProject(root));
    assert.equal(done.ready, true, done.lines.join(" | "));
    assert.deepEqual(deliveryCheck(root), []);
  };

  const clock = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-sim-clock-"));
  createProject(clock, "Clock desk");
  saveScope(clock, "Hours are weekdays 9 to 18. Time answers come from the clock tool. Refuse payments.");
  saveAgentSettings(clock, { model: "composer-2.5", effort: "low", fast: true, sandbox: false, reminders: false, harness: [], maxRunningTurns: 2, egress: ["api.telegram.org"] });
  saveItem(clock, { kind: "channel", name: "telegram", description: "telegram", body: "A person writes.", verify: true, route: "/", secret: "TELEGRAM_WEBHOOK_SECRET" });
  saveItem(clock, { kind: "skill", name: "ask-the-clock", description: "the person asks the time", body: "Call current-time.\n" });
  saveItem(clock, { kind: "tool", name: "current-time", description: "Read the current time.", body: "", calls: "mcp:clock:get_current_time", effect: "read", parameters: [{ name: "timezone", type: "string", required: true, description: "IANA timezone." }] });
  saveItem(clock, { kind: "mcp", name: "clock", description: "Public clock", body: "", transport: "http", url: "https://time.now/mcp" });
  saveItem(clock, { kind: "schedule", name: "monday", description: "Open the desk.", body: "", route: "0 9 * * 1" });
  saveItem(clock, { kind: "hook", name: "audit", description: "turn.completed", body: "return;" });
  const clockProject = loadProject(clock);
  const clockLinks = [
    { from: "channel:telegram", to: "scope" },
    { from: "schedule:monday", to: "scope" },
    { from: "scope", to: "agent" },
    { from: "agent", to: "skill:ask-the-clock" },
    { from: "skill:ask-the-clock", to: "tool:current-time" },
    { from: "tool:current-time", to: "mcp:clock" },
  ];
  writeLayout(clock, { ...readLayout(clock), links: clockLinks });
  const steps = executionSteps(["channel:telegram", "schedule:monday", "scope", "agent", "skill:ask-the-clock", "tool:current-time", "mcp:clock"], flowLinks(clockProject, readLayout(clock)));
  assert.ok(steps["channel:telegram"] < steps.scope);
  assert.ok(steps.scope < steps.agent);
  assert.ok(steps.agent < steps["tool:current-time"]);
  assert.ok(steps["tool:current-time"] < steps["mcp:clock"]);
  const clockAgent = fs.readFileSync(path.join(clock, "bot", "agent.ts"), "utf8");
  assert.match(clockAgent, /id: "composer-2.5"/);
  assert.match(clockAgent, /value: "low"/);
  assert.match(clockAgent, /value: "true"/);
  assert.match(clockAgent, /maxRunningTurns: 2/);
  assert.match(clockAgent, /api\.telegram\.org/);
  assert.match(clockAgent, /time\.now/);
  assert.equal(clockAgent.includes("sandbox: true"), false);
  assert.match(fs.readFileSync(path.join(clock, "bot", "tools", "current-time.ts"), "utf8"), /callTool\("clock", "get_current_time", input\)/);
  assert.match(fs.readFileSync(path.join(clock, "bot", "tools", "current-time.ts"), "utf8"), /typeof part.text === "string"/);
  assert.match(fs.readFileSync(path.join(clock, "bot", "channels", "telegram.ts"), "utf8"), /waitUntil\(send/);
  finish(clock);
  const clockPlan = cloudRunPlan({
    agentName: "Clock desk",
    project: "mistratos",
    region: "us-central1",
    imageId: `sha256:${"ab".repeat(32)}`,
    exposure: "internet",
    hasPublicChannel: true,
    secretNames: loadProject(clock).secrets.filter((row) => row.configured).map((row) => row.name),
    minInstances: 1,
    maxInstances: 1,
    concurrency: 10,
    cpu: "1",
    memory: "1Gi",
    cpuAlways: true,
    timeout: 300,
  });
  if ("error" in clockPlan) throw new Error(clockPlan.error);
  const clockArgs = cloudRunArgs(clockPlan.plan).join(" ");
  assert.match(clockArgs, / --cpu 1 /);
  assert.match(clockArgs, / --memory 1Gi /);
  assert.match(clockArgs, / --no-cpu-throttling/);
  assert.match(clockArgs, / --min-instances 1/);
  assert.match(clockArgs, /TELEGRAM_BOT_TOKEN=TELEGRAM_BOT_TOKEN:latest/);
  assert.equal(clockArgs.includes("=set"), false);
  typecheck(clock);

  const ops = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-sim-ops-"));
  createProject(ops, "Ops desk");
  saveScope(ops, "Open a case only after lookup. Refuse payments.");
  saveAgentSettings(ops, { model: "grok-4.5", effort: "high", fast: false, maxRunningTurns: 4, egress: ["example.com"] });
  saveItem(ops, { kind: "channel", name: "inbox", description: "webhook", body: "A customer message", verify: true, route: "/hooks/inbox", secret: "WEBHOOK_SECRET" });
  saveItem(ops, { kind: "schedule", name: "morning", description: "Review the queue.", body: "", route: "0 9 * * 1" });
  saveItem(ops, { kind: "mcp", name: "cases", description: "Case store", body: "", transport: "http", url: "https://cases.example.com/mcp", secret: "CASES_TOKEN" });
  saveItem(ops, { kind: "tool", name: "open-case", description: "Open a case.", body: "", calls: "mcp:cases:open_case", effect: "write", parameters: [{ name: "question", type: "string", required: true, description: "The unanswered question." }] });
  saveItem(ops, { kind: "host", name: "pager", description: "Hidden pager", body: "", transport: "http", url: "https://pager.example.com/mcp", secret: "PAGER_TOKEN" });
  saveItem(ops, { kind: "tool", name: "page", description: "Page the on-call person.", body: "", calls: "mcp:pager:send", effect: "irreversible", parameters: [{ name: "reason", type: "string", required: true, description: "Why a person is needed." }] });
  saveItem(ops, { kind: "subagent", name: "reviewer", description: "a case needs a second pass", body: "Look again.\n" });
  saveItem(ops, { kind: "hook", name: "audit", description: "turn.completed", body: "return;" });
  const opsAgent = fs.readFileSync(path.join(ops, "bot", "agent.ts"), "utf8");
  assert.match(opsAgent, /id: "grok-4.5"/);
  assert.match(opsAgent, /value: "high"/);
  assert.match(opsAgent, /value: "false"/);
  assert.match(opsAgent, /cases\.example\.com/);
  assert.match(opsAgent, /pager\.example\.com/);
  assert.match(fs.readFileSync(path.join(ops, "bot", "tools", "open-case.ts"), "utf8"), /callTool\("cases", "open_case", input\)/);
  assert.match(fs.readFileSync(path.join(ops, "bot", "tools", "page.ts"), "utf8"), /needsApproval: true/);
  assert.match(fs.readFileSync(path.join(ops, "bot", "tools", "page.ts"), "utf8"), /callTool\("pager", "send", input\)/);
  assert.match(fs.readFileSync(path.join(ops, "bot", "host-connections", "pager.ts"), "utf8"), /https:\/\/pager\.example\.com\/mcp/);
  assert.match(fs.readFileSync(path.join(ops, "bot", "subagents", "reviewer", "agent.ts"), "utf8"), /a case needs a second pass/);
  assert.match(fs.readFileSync(path.join(ops, "bot", "schedules", "morning.md"), "utf8"), /0 9 \* \* 1/);
  finish(ops);
  const opsPlan = cloudRunPlan({
    agentName: "Ops desk",
    project: "mistratos",
    region: "us-central1",
    imageId: `sha256:${"cd".repeat(32)}`,
    exposure: "internet",
    hasPublicChannel: true,
    secretNames: loadProject(ops).secrets.filter((row) => row.configured).map((row) => row.name),
    minInstances: 1,
    maxInstances: 2,
    concurrency: 4,
    cpu: "2",
    memory: "2Gi",
    cpuAlways: false,
    timeout: 120,
  });
  if ("error" in opsPlan) throw new Error(opsPlan.error);
  const opsArgs = cloudRunArgs(opsPlan.plan).join(" ");
  assert.match(opsArgs, / --cpu-throttling/);
  assert.equal(opsArgs.includes("--no-cpu-throttling"), false);
  assert.match(opsArgs, / --cpu 2 /);
  assert.match(opsArgs, / --memory 2Gi /);
  assert.match(opsArgs, /CASES_TOKEN=CASES_TOKEN:latest/);
  typecheck(ops);

  const gate = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-sim-gate-"));
  createProject(gate, "Change gate");
  saveScope(gate, "Comment on the pull request. Do not merge.");
  saveAgentSettings(gate, { model: "auto", effort: "medium", fast: true, maxRunningTurns: 1 });
  saveItem(gate, { kind: "channel", name: "github", description: "github", body: "A pull request", verify: true, route: "pull_request", repo: "acme/app", secret: "GITHUB_WEBHOOK_SECRET" });
  saveItem(gate, { kind: "channel", name: "telegram", description: "telegram", body: "A person writes.", verify: true, route: "/", secret: "TELEGRAM_WEBHOOK_SECRET" });
  saveItem(gate, { kind: "mcp", name: "repo", description: "Repository", body: "", transport: "stdio", command: "node" });
  saveItem(gate, { kind: "subagent", name: "security-pass", description: "a diff needs a security pass", body: "Name the risk.\n" });
  const gateAgent = fs.readFileSync(path.join(gate, "bot", "agent.ts"), "utf8");
  assert.equal(/model:\s*\{/.test(gateAgent), false);
  assert.match(fs.readFileSync(path.join(gate, "bot", "channels", "github.ts"), "utf8"), /onPullRequest/);
  assert.match(fs.readFileSync(path.join(gate, "bot", "channels", "github.ts"), "utf8"), /acme\/app/);
  assert.match(fs.readFileSync(path.join(gate, "bot", "mcp-connections", "repo.ts"), "utf8"), /command: "node"/);
  finish(gate);
  const gatePlan = cloudRunPlan({
    agentName: "Change gate",
    project: "mistratos",
    region: "us-central1",
    imageId: `sha256:${"ef".repeat(32)}`,
    exposure: "internet",
    hasPublicChannel: true,
    secretNames: loadProject(gate).secrets.filter((row) => row.configured).map((row) => row.name),
    minInstances: 0,
    maxInstances: 4,
    cpu: "1",
    memory: "1Gi",
    cpuAlways: true,
    timeout: 300,
  });
  if ("error" in gatePlan) throw new Error(gatePlan.error);
  assert.match(gatePlan.plan.warning, /min instances/);
  assert.match(cloudRunArgs(gatePlan.plan).join(" "), / --no-cpu-throttling/);
  typecheck(gate);
});

test("a person can go from an empty folder through the canvas to ship", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  assert.equal(scanWorkspace(root).missing.some((piece) => piece.id === "marker"), true);
  assert.throws(() => initWorkspace(root, "!!!"), /short name/);

  const project = initWorkspace(root, "Desk");
  assert.equal(project.think, true);
  assert.equal(project.limits, true);
  assert.equal(project.secrets.some((row) => row.name === "CURSOR_API_KEY"), true);
  assert.deepEqual(deliveryCheck(root), []);
  assert.match(fs.readFileSync(path.join(root, "compose.yaml"), "utf8"), /127\.0\.0\.1:3000:3000/);
  assert.match(fs.readFileSync(path.join(root, "compose.yaml"), "utf8"), /BIGAGENT_ADMIT_LOCAL/);
  assert.equal(fs.readFileSync(path.join(root, "bot", "agent.ts"), "utf8").includes("sandbox: true"), false);

  saveAgentSettings(root, { model: "grok-4.7", effort: "low", fast: true });
  assert.equal(loadProject(root).model, "grok-4.7");
  assert.match(fs.readFileSync(path.join(root, "bot", "agent.ts"), "utf8"), /id: "grok-4.7"/);
  assert.match(fs.readFileSync(path.join(root, "bot", "agent.ts"), "utf8"), /value: "low"/);
  saveAgentSettings(root, { model: "composer-2.5", effort: "low", fast: false, sandbox: true, reminders: true, harness: ["read", "shell"], maxRunningTurns: 2, egress: ["example.com"] });
  const tuned = loadProject(root);
  assert.equal(tuned.model, "composer-2.5");
  assert.equal(tuned.effort, "low");
  assert.equal(tuned.fast, false);
  assert.equal(tuned.sandbox, true);
  assert.equal(review(tuned).some((finding) => finding.id === "sandbox"), true);
  assert.equal(fs.readFileSync(path.join(root, "bot", "agent.ts"), "utf8").includes("sandbox: true"), false);

  const shot = captureFolder(root);
  saveItem(root, { kind: "tool", name: "lookup", description: "Find", body: "return input;", calls: "POST /search", effect: "read" });
  setSecret(root, "LOOKUP_TOKEN", "not-in-the-image");
  assert.throws(() => setSecret(root, "bad name", "x"), /CURSOR_API_KEY/);
  deleteItem(root, "tool", "lookup");
  assert.equal(loadProject(root).items.some((item) => item.name === "lookup"), false);
  restoreFolder(root, shot);
  assert.equal(loadProject(root).items.some((item) => item.name === "lookup"), false);
  assert.match(fs.readFileSync(path.join(root, ".env"), "utf8"), /LOOKUP_TOKEN=not-in-the-image/);
  assert.equal(fs.readFileSync(path.join(root, "Dockerfile"), "utf8").includes("not-in-the-image"), false);

  const evalFile = writeEvalCase(root, "in-scope", "How do I reset my password?", "lookup");
  assert.equal(evalFile, "evals/in-scope.eval.ts");
  assert.throws(() => writeEvalCase(root, "in-scope", "again", "lookup"), /already has a file/);
  const studio = ensureStudioFile(root, "lib");
  assert.equal(studio, "bot/lib/index.ts");
  assert.equal(fs.existsSync(path.join(root, "bot", "lib", "index.ts")), true);

  const page = { mode: "deploy" as const, selected: "", notice: "", libraryOpen: false, inspectorOpen: false, libraryWidth: 240, inspectorWidth: 280 };
  const layout = readLayout(root);
  const unknown = designerHtml(loadProject(root), page, true, undefined, "", layout, layout, false, undefined, { docker: "unknown", running: false, phase: "idle", summary: "", logs: "", publicUrl: "" });
  assert.equal(/id="ship-start"[^>]*disabled/.test(unknown), false);
  const stopped = designerHtml(loadProject(root), page, true, undefined, "", layout, layout, false, undefined, { docker: "ready", running: false, phase: "idle", summary: "", logs: "", publicUrl: "" });
  assert.equal(/id="ship-start"[^>]*disabled/.test(stopped), false);
  assert.match(stopped, /id="open-playground"[^>]*disabled/);
  assert.match(stopped, /id="ship-stop"[^>]*disabled/);
  assert.match(stopped, /data-target="local"/);
  assert.match(stopped, /data-target="gcp"/);
  assert.match(stopped, /data-ship-panel="gcp" hidden/);
  assert.match(stopped, /data-gcp-tab="status"/);
  assert.match(stopped, /class="ship-local"/);
  assert.match(stopped, /id="fold-status"/);
  assert.match(stopped, /id="fold-log"/);
  assert.match(stopped, /id="fold-gcp-top"/);
  assert.match(stopped, /id="fold-gcp-bottom"/);
  assert.match(stopped, /gcpPane/);
  assert.match(stopped, /followGcpLog/);
  assert.match(stopped, /\.ship-stack\.fold-top \.cloud-bottom \{ flex: 1; height: auto; min-height: 0; \}/);
  assert.match(stopped, /Uploading…/);
  assert.match(stopped, /id="gcp-deploy-pane"/);
  assert.match(stopped, /id="gcp-sync"/);
  assert.match(stopped, /data-sync-one="CURSOR_API_KEY"/);
  assert.match(stopped, /data-gcp-secret="CURSOR_API_KEY"/);
  assert.match(stopped, /Sync secrets/);
  assert.match(stopped, /Uses the local value/);
  assert.equal(stopped.includes("not-in-the-image"), false);
  assert.match(stopped, /id="gcp-refresh"/);
  assert.match(stopped, /id="gcp-stop"/);
  assert.match(stopped, /id="gcp-verdict"/);
  assert.match(stopped, /id="gcp-trail"/);
  assert.match(stopped, /\.verdict\.current \{ color: #052e16; background: #22C55E; \}/);
  assert.match(stopped, /#gcp-status\.same \{ color: #22C55E/);
  assert.match(stopped, /id="gcp-log"/);
  assert.match(stopped, /Optional on this machine/);
  assert.equal(stopped.includes("AGENT_SDK_BEARER_TOKEN is empty"), false);
  assert.equal(stopped.includes("Kubernetes"), false);
  assert.match(stopped, /id="rewrite-docker"/);
  assert.equal(stopped.includes('id="ship-aws"'), false);
  const running = designerHtml(loadProject(root), page, true, undefined, "", layout, layout, false, undefined, { docker: "ready", running: true, phase: "idle", summary: "Listening on http://127.0.0.1:3000.", logs: "2026-11-07T20:00:00.000Z info ready", publicUrl: "", stats: { cpu: "1.2%", memory: "40MiB / 1GiB", healthMs: 12 } });
  assert.match(running, /id="ship-start"[^>]*disabled[^>]*>Running</);
  assert.equal(/id="ship-refresh"[^>]*disabled/.test(running), false);
  assert.match(running, /Read this machine again/);
  assert.equal(/id="open-playground"[^>]*disabled/.test(running), false);
  assert.equal(/id="ship-stop"[^>]*disabled/.test(running), false);
  assert.match(running, /data-state="running"/);
  assert.match(running, /data-agent>Desk</);
  assert.match(running, /1\.2%/);
  assert.match(running, /12 ms/);
  assert.match(running, /id="log-search"/);
  assert.match(running, /id="log-from"/);
  assert.match(running, /max-height: none/);
  const failed = designerHtml(loadProject(root), page, true, undefined, "", layout, layout, false, undefined, { docker: "ready", running: false, failed: true, phase: "idle", summary: "The build stopped. Read the log.", logs: "", publicUrl: "" });
  assert.match(failed, /data-state="failed"/);
  assert.match(failed, /class="ship-error"/);
  assert.match(failed, />Failed</);
  assert.equal(/id="ship-start"[^>]*disabled/.test(failed), false);
  assert.match(failed, /id="open-playground"[^>]*disabled/);
  const spanish = designerHtml(loadProject(root), { ...page, lang: "es" }, true, undefined, "", layout, layout, false, undefined, { docker: "ready", running: false, failed: true, phase: "idle", summary: "The build stopped. Read the log.", logs: "", publicUrl: "" });
  assert.match(spanish, />Falló</);
  assert.match(spanish, /Buscar en logs/);
  assert.match(spanish, /La construcción se detuvo/);

  const examples = designerHtml(loadProject(root), { ...page, mode: "examples" }, true, undefined, "", layout, layout);
  for (const example of EXAMPLES) assert.match(examples, new RegExp(`data-example="${example.id}"`), example.id);
  const prove = designerHtml(loadProject(root), { ...page, mode: "prove" }, true, undefined, "", layout, layout, false, readStudio(root));
  assert.match(prove, /id="eval-form"/);
  assert.match(prove, /in-scope/);
});

test("a blank folder offers each example, and the canvas names what a flow still needs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  const page = { mode: "flow" as const, selected: "agent", notice: "", libraryOpen: true, inspectorOpen: true, libraryWidth: 240, inspectorWidth: 280 };
  const blank = designerHtml(null, page, true, scanWorkspace(root), "agent");
  assert.match(blank, /id="create-form"/);
  for (const example of EXAMPLES) assert.match(blank, new RegExp(`data-init-example="${example.id}"`), example.id);
  const spanishBlank = designerHtml(null, { ...page, lang: "es" }, true, scanWorkspace(root), "agent");
  assert.match(blank, /Agentic flow examples/);
  assert.match(blank, /class="pick primary" data-init-example="hello"/);
  assert.ok(blank.indexOf("data-init-example") < blank.indexOf("Initialize blank"));
  assert.match(spanishBlank, /Ejemplos de flujos agénticos/);
  assert.match(spanishBlank, /class="pick primary" data-init-example="hello"/);
  assert.ok(spanishBlank.indexOf("data-init-example") < spanishBlank.indexOf("Inicializar en blanco"));

  const project = initWorkspace(root, "Desk");
  assert.equal(cardNeeds(project).some((row) => row.id === "agent" && row.missing.some((line) => line.includes("CURSOR_API_KEY"))), true);
  assert.equal(cardNeeds(project).some((row) => row.id === "scope"), true);
  assert.equal(simulateFlow(project).ready, false);
  const layout = readLayout(root);
  const canvas = designerHtml(project, page, true, undefined, "", layout, layout);
  assert.match(canvas, /class="node agent on gap"/);
  assert.match(canvas, /title="[^"]*CURSOR_API_KEY is empty/);
  assert.match(canvas, /id="simulate-flow"/);
  assert.match(canvas, /id="flow-sim"[\s\S]*CURSOR_API_KEY is empty/);
  assert.match(canvas, /data-set-secret="CURSOR_API_KEY"/);
  assert.match(canvas, /Set CURSOR_API_KEY in Secrets/);
  const warn = canvas.slice(canvas.indexOf('class="warn"'));
  assert.ok(warn.indexOf('class="attention"') < warn.indexOf("Local run is fine without this"));
  assert.match(canvas, /Local run is fine without this/);
  assert.match(canvas, /later cloud deploy/);
  const secretsPage = designerHtml(project, { ...page, mode: "secrets", secretFocus: "CURSOR_API_KEY" }, true, undefined, "", layout, layout);
  assert.match(secretsPage, /id="secret-name" value="CURSOR_API_KEY"/);
  assert.match(secretsPage, /Type the value for CURSOR_API_KEY/);
  assert.match(canvas, /id="ask-open" class="assistant"/);
  assert.match(canvas, /Assistant<\/button>/);
  assert.equal(/id="lm-test"/.test(canvas), false);
  assert.equal(/id="ask-text"[^>]*disabled/.test(canvas), false);
  const spanish = designerHtml(project, { ...page, lang: "es" }, true, undefined, "", layout, layout);
  assert.match(spanish, /Simular flujo/);
  assert.match(spanish, /CURSOR_API_KEY está vacío/);
  assert.match(spanish, /Asistente<\/button>/);

  saveScope(root, "Refuse refunds.");
  setSecret(root, "CURSOR_API_KEY", "not-a-real-key");
  const readyProject = loadProject(root);
  assert.equal(simulateFlow(readyProject).ready, true);
  const ready = designerHtml(readyProject, page, true, undefined, "", layout, layout);
  assert.match(ready, /This flow has the minimum configuration/);
  assert.equal(/class="node agent on gap"/.test(ready), false);

  saveItem(root, { kind: "tool", name: "lookup", description: "Find", body: "", calls: "", effect: "read" });
  const withTool = loadProject(root);
  const toolPage = { ...page, selected: "tool:lookup" };
  const tool = designerHtml(withTool, toolPage, true, undefined, "", readLayout(root), layout);
  assert.match(tool, /class="node tool on gap"/);
  assert.match(tool, /title="[^"]*does not say what it calls/);
  assert.match(tool, /id="calls" data-need="1"/);
  assert.match(tool, /<label class="need">/);

  saveItem(root, { kind: "channel", name: "gate", description: "github", body: "", route: "pull_request", repo: "" });
  const channel = loadProject(root);
  assert.equal(cardNeeds(channel).some((row) => row.id === "channel:gate" && row.fields.includes("repo-github")), true);
  assert.equal(cardNeeds(channel).some((row) => row.missing.some((line) => line.includes("GITHUB_WEBHOOK_SECRET is empty"))), true);

  assert.equal(dockerProblem("'docker' is not recognized as an internal or external command"), "missing");
  assert.equal(dockerProblem("spawn docker ENOENT"), "missing");
  assert.equal(dockerProblem("error during connect: cannot find the file specified"), "down");
  assert.equal(dockerProblem("Docker did not answer in time."), "down");
  const checking = designerHtml(readyProject, { ...page, mode: "deploy" }, true, undefined, "", layout, layout, false, undefined, { docker: "unknown", running: false, phase: "checking", summary: "Checking Docker on this machine.", logs: "Checking Docker on this machine.\n", publicUrl: "" });
  assert.match(checking, /class="working"/);
  assert.match(checking, /class="bar"/);
  assert.match(checking, /class="spin"/);
  assert.equal(/id="ship-start"[^>]*disabled/.test(checking), false);
  assert.equal(/id="ship-refresh"[^>]*disabled/.test(checking), false);
  const building = designerHtml(readyProject, { ...page, mode: "deploy" }, true, undefined, "", layout, layout, false, undefined, { docker: "ready", running: false, phase: "building", summary: "Building the local image. The log shows each step.", logs: "Building the local image. The log shows each step.\n", publicUrl: "" });
  assert.match(building, /class="working"/);
  assert.match(building, /id="ship-start"[^>]*disabled/);
  assert.match(checking, /button:disabled/);
  assert.match(checking, /Checking Docker on this machine/);
  const ship = designerHtml(readyProject, { ...page, mode: "deploy" }, true, undefined, "", layout, layout, false, undefined, { docker: "down", dockerWhy: "missing", running: false, phase: "idle", summary: DOCKER_MISSING, logs: "", publicUrl: "" });
  assert.match(ship, /class="ship-error"/);
  assert.match(ship, /Docker missing/);
  assert.match(ship, /Install Docker, leave it running/);
  const shipEs = designerHtml(readyProject, { ...page, mode: "deploy", lang: "es" }, true, undefined, "", layout, layout, false, undefined, { docker: "down", dockerWhy: "missing", running: false, phase: "idle", summary: DOCKER_MISSING, logs: "", publicUrl: "" });
  assert.match(shipEs, /Falta Docker/);
  assert.match(shipEs, /Instala Docker/);

  assert.equal(lmGate({ hasApi: false, modelCount: 0 }).ok, false);
  assert.equal(lmGate({ hasApi: true, modelCount: 0 }).ok, false);
  const open = lmGate({ hasApi: true, modelCount: 2 });
  assert.equal(open.ok, true);
  const ask = designerHtml(readyProject, { ...page, askOpen: true, lm: { ...open, models: [{ id: "grok", name: "Grok" }, { id: "composer", name: "Composer" }], modelId: "composer" } }, true, undefined, "", layout, layout);
  assert.equal(/id="ask-text"[^>]*disabled/.test(ask), false);
  assert.equal(/id="lm-test"/.test(ask), false);
  assert.equal(/id="ask-form"/.test(ask), false);
  assert.match(ask, /id="ask-open"/);
});

test("a canvas clock calls the public MCP named on the tool", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-clock-"));
  createProject(root, "Clock desk");
  saveItem(root, { kind: "mcp", name: "clock", description: "Public clock", body: "", url: "https://time.now/mcp", transport: "http" });
  saveItem(root, {
    kind: "tool",
    name: "current-time",
    description: "Read the current time in one IANA timezone from the public clock.",
    body: "",
    calls: "mcp:clock:get_current_time",
    effect: "read",
    parameters: [{ name: "timezone", type: "string", required: true, description: "IANA timezone, for example America/Bogota." }],
  });
  assert.match(fs.readFileSync(path.join(root, "bot", "tools", "current-time.ts"), "utf8"), /callTool\("clock", "get_current_time", input\)/);
  assert.match(fs.readFileSync(path.join(root, "bot", "mcp-connections", "clock.ts"), "utf8"), /https:\/\/time\.now\/mcp/);
  assert.match(fs.readFileSync(path.join(root, "bot", "agent.ts"), "utf8"), /time\.now/);
  assert.equal(review(loadProject(root)).some((row) => row.message.includes("No MCP named")), false);
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-clock-ex-"));
  loadExample(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../examples/clock-desk"), dest);
  const project = loadProject(dest);
  assert.equal(project.items.some((item) => item.kind === "mcp" && item.name === "clock" && item.url === "https://time.now/mcp"), true);
  assert.equal(project.items.some((item) => item.kind === "tool" && item.calls === "mcp:clock:get_current_time"), true);
  assert.equal(project.items.some((item) => item.kind === "skill" && item.name === "ask-the-clock"), true);
  const links = readLayout(dest).links.map((link) => `${link.from}>${link.to}`);
  assert.equal(links.includes("skill:ask-the-clock>tool:current-time"), true);
  assert.equal(links.includes("tool:current-time>mcp:clock"), true);
  emitSdk(dest);
  assert.match(fs.readFileSync(path.join(dest, "bot", "tools", "current-time.ts"), "utf8"), /callTool\("clock", "get_current_time", input\)/);
  assert.match(fs.readFileSync(path.join(dest, "bot", "agent.ts"), "utf8"), /time\.now/);
});

test("each example is servable and only owes secrets the person must set", () => {
  const examplesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "examples");
  const expected: Record<string, string[]> = {
    hello: ["CURSOR_API_KEY"],
    "telegram-desk": ["CURSOR_API_KEY", "TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET"],
    "clock-desk": ["CURSOR_API_KEY", "TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET"],
    "support-desk": ["CASES_TOKEN", "CURSOR_API_KEY", "WEBHOOK_SECRET"],
    "change-gate": ["CURSOR_API_KEY", "GITHUB_TOKEN", "GITHUB_WEBHOOK_SECRET", "PAGER_TOKEN", "REVIEW_TOKEN", "TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET", "WEBHOOK_SECRET"],
  };
  for (const example of EXAMPLES) {
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
    loadExample(path.join(examplesRoot, example.id), dest);
    const project = loadProject(dest);
    const report = flowReport(project);
    assert.deepEqual(report.folder, [], example.id);
    assert.deepEqual([...report.secrets].sort(), expected[example.id], example.id);
    if (example.id === "change-gate") {
      assert.deepEqual(report.cards.map((row) => row.id), ["channel:github"]);
      assert.match(report.cards[0].missing.join(" "), /repository/);
    } else assert.deepEqual(report.cards, [], example.id);
    for (const name of report.secrets) setSecret(dest, name, "set");
    const open = loadProject(dest);
    for (const card of flowReport(open).cards) {
      const item = open.items.find((entry) => `${entry.kind}:${entry.name}` === card.id);
      if (item) saveItem(dest, { ...item, repo: "acme/app" });
    }
    const done = flowReport(loadProject(dest));
    assert.equal(done.ready, true, `${example.id}: ${done.secrets.concat(done.cards.flatMap((row) => row.missing), done.folder).join(" | ")}`);
    const page = { mode: "flow" as const, selected: "agent", notice: "", libraryOpen: false, inspectorOpen: false, libraryWidth: 240, inspectorWidth: 280 };
    const layout = readLayout(dest);
    const html = designerHtml(project, page, true, undefined, "", layout, layout);
    assert.match(html, /id="flow-sim"[^>]*hidden/);
    assert.match(html, /Flow check/);
    assert.match(html, /This flow cannot run yet/);
    assert.match(html, /Set these in Secrets/);
  }
});

test("a canvas change is saved only when the proposal is applied", () => {
  const reply = "Add lookup.\n```proposal\n{\"kind\":\"tool\",\"name\":\"lookup\",\"description\":\"Find\",\"calls\":\"mcp:knowledge\",\"effect\":\"read\"}\n```";
  const proposal = readProposal(reply);
  assert.equal(proposal && proposal.kind === "tool" && proposal.name, "lookup");
  assert.equal(replyWithoutProposal(reply), "Add lookup.");
  assert.equal(readProposal("```proposal\n{\"kind\":\"tool\",\"name\":\"lookup\",\"value\":\"not-a-real-key\"}\n```"), null);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  initWorkspace(root, "Desk");
  assert.equal(fs.existsSync(path.join(root, "tools", "lookup.json")), false);
  applyProposal(root, proposal!);
  const saved = fs.readFileSync(path.join(root, "tools", "lookup.json"), "utf8");
  assert.match(saved, /mcp:knowledge/);
  assert.equal(saved.includes("not-a-real-key"), false);
  const handoff = chatHandoff(loadProject(root));
  assert.match(handoff, /canvas reloads when files change/);
  assert.match(handoff, /agent:Desk/);
  assert.equal(handoff.includes("not-a-real-key"), false);
  assert.equal(handoff.includes("Do not write files"), false);
  const spanish = chatHandoff(loadProject(root), "es");
  assert.match(spanish, /El lienzo se actualiza cuando cambian los archivos/);
  assert.match(spanish, /Tarjetas: agent:Desk/);
  assert.equal(spanish.includes("not-a-real-key"), false);
  assert.equal(languageChoice(undefined, "es-CO"), "es");
  assert.equal(languageChoice(undefined, "en-US"), "en");
  assert.equal(languageChoice("en", "es-CO"), "en");
  assert.equal(languageChoice("es", "en-US"), "es");
  const id = `sha256:${"ab".repeat(32)}`;
  const internet = cloudRunPlan({ agentName: "Telegram desk", project: "my-project", region: "us-central1", imageId: id, exposure: "internet", hasPublicChannel: true, secretNames: ["CURSOR_API_KEY", "TELEGRAM_BOT_TOKEN"] });
  assert.equal("error" in internet, false);
  if ("error" in internet) return;
  const args = cloudRunArgs(internet.plan).join(" ");
  assert.match(args, /--ingress all/);
  assert.match(args, /--allow-unauthenticated/);
  assert.match(args, /--min-instances 1/);
  assert.match(args, /CURSOR_API_KEY=CURSOR_API_KEY:latest/);
  assert.equal(args.includes("not-a-real-key"), false);
  assert.equal(args.includes("BIGAGENT_ADMIT_LOCAL"), false);
  const account = cloudRunRuntimeAccount("405804269877");
  assert.equal(account, "405804269877-compute@developer.gserviceaccount.com");
  assert.equal(cloudRunRuntimeAccount("not-a-number"), "");
  const grant = secretAccessorArgs("mistratos", "TELEGRAM_WEBHOOK_SECRET", account).join(" ");
  assert.match(grant, /secrets add-iam-policy-binding TELEGRAM_WEBHOOK_SECRET/);
  assert.match(grant, /roles\/secretmanager\.secretAccessor/);
  assert.match(grant, /serviceAccount:405804269877-compute@developer\.gserviceaccount\.com/);
  assert.equal(grant.includes("not-a-real-key"), false);
  assert.match(phrase("es", "Could not grant TELEGRAM_WEBHOOK_SECRET to the Cloud Run account. Continuing in case it was granted already."), /Se continúa/);
  const internal = cloudRunPlan({ agentName: "Telegram desk", project: "my-project", region: "us-central1", imageId: id, exposure: "internal", hasPublicChannel: true, secretNames: [] });
  if ("error" in internal) throw new Error(internal.error);
  assert.equal(internal.plan.ingress, "internal");
  assert.equal(internal.plan.allowUnauthenticated, false);
  assert.match(internal.plan.warning, /public internet/);
  assert.equal("error" in cloudRunPlan({ agentName: "Desk", project: "Bad_Project", region: "us-central1", imageId: id, exposure: "internet", hasPublicChannel: false, secretNames: [] }), true);
  assert.match(args, /--cpu 1/);
  assert.match(args, /--memory 1Gi/);
  assert.equal(args.includes("--set-env-vars"), false);
});

test("a person configures Cloud Run on the GCP tab and the result stays there", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-gcp-"));
  const example = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../examples/telegram-desk");
  loadExample(example, root);
  setSecret(root, "CURSOR_API_KEY", "not-a-real-key");
  const project = loadProject(root);
  const layout = readLayout(root);
  const page = { mode: "deploy" as const, selected: "", notice: "", libraryOpen: false, inspectorOpen: false, libraryWidth: 240, inspectorWidth: 280 };
  const ship = { docker: "ready" as const, running: false, phase: "idle" as const, summary: "", logs: "", publicUrl: "" };
  const opened = designerHtml(project, page, true, undefined, "", layout, layout, false, undefined, ship);
  assert.match(opened, /data-ship-panel="gcp" hidden/);
  assert.match(opened, /data-ship-panel="local"/);
  assert.equal(/data-ship-panel="local" hidden/.test(opened), false);
  assert.match(opened, /id="gcp-min"[^>]*value="1"/);
  assert.match(opened, /id="gcp-max"/);
  assert.match(opened, /id="gcp-concurrency"/);
  assert.match(opened, /id="gcp-cpu"/);
  assert.match(opened, /id="gcp-memory"/);
  assert.match(opened, /id="gcp-timeout"/);
  assert.match(opened, /id="gcp-env-add"/);
  assert.match(opened, /data-gcp-tab="scale"/);
  assert.match(opened, /data-gcp-pane="scale" hidden/);
  assert.match(opened, /data-gcp-tab="monitor"/);
  assert.match(opened, /id="gcp-logs"/);
  assert.match(opened, /id="gcp-signal-headline"/);
  const incident = agentSignal([{
    timestamp: "2026-11-15T02:28:34.176510Z",
    httpRequest: { status: 200, requestUrl: "https://bigagent-telegram-desk-olwhvzss2q-uc.a.run.app/v1/channels/telegram/" },
  }, {
    timestamp: "2026-11-15T02:30:46.892784Z",
    textPayload: "[telegram] turn failed: turn interrupted",
  }]);
  assert.match(incident.headline, /reply was not sent/);
  assert.equal(incident.kind, "error");
  assert.match(incident.advice, /not a CPU/);
  assert.match(agentSignal([{ timestamp: "2026-11-15T02:00:00Z", httpRequest: { status: 401, requestUrl: "https://example.run.app/v1/channels/telegram/" } }]).headline, /rejected/);
  assert.match(agentSignal([]).headline, /No channel call/);
  const bars = channelBars([{ timestamp: "2026-11-15T02:28:34.176510Z", httpRequest: { status: 200, requestUrl: "https://example.run.app/v1/channels/telegram/", latency: "0.014s" } }, { timestamp: "2026-11-15T02:29:05.736676Z", httpRequest: { status: 401, requestUrl: "https://example.run.app/v1/channels/telegram/", latency: "12ms" } }]);
  assert.equal(bars.length, 2);
  assert.equal(bars[0].ok, true);
  assert.equal(bars[1].ok, false);
  assert.equal(bars[0].kind, "accept");
  const waited = channelBars([
    { timestamp: "2026-11-15T02:28:34.000Z", httpRequest: { status: 200, requestUrl: "https://example.run.app/v1/channels/telegram/", latency: "0.016s" } },
    { timestamp: "2026-11-15T02:30:46.000Z", textPayload: "[telegram] turn failed: turn interrupted" },
    { timestamp: "2026-11-15T02:31:10.000Z", httpRequest: { status: 200, requestUrl: "https://example.run.app/v1/channels/telegram/", latency: "0.020s" } },
    { timestamp: "2026-11-15T02:31:22.000Z", textPayload: "[telegram] replied in 12000ms" },
  ]);
  assert.equal(waited[1].kind, "accept");
  assert.equal(waited[1].ms, 20);
  const live = monitorFacts([
    { timestamp: "2026-11-15T03:09:28.126Z", httpRequest: { status: 200, requestUrl: "https://example.run.app/v1/channels/telegram/", latency: "0.016s" } },
    { timestamp: "2026-11-15T03:09:28.161Z", textPayload: "LocalCursorRulesService load completed meta={durationMs: 18063, ruleCount: 0}" },
    { timestamp: "2026-11-15T03:10:01.060Z", httpRequest: { status: 200, requestUrl: "https://example.run.app/v1/channels/telegram/", latency: "0.007s" } },
    { timestamp: "2026-11-15T03:10:01.075Z", textPayload: "[telegram] turn failed: turn interrupted" },
    { timestamp: "2026-11-15T03:10:01.139Z", textPayload: "[telegram] turn failed: turn interrupted" },
    { timestamp: "2026-11-15T03:13:26.230Z", httpRequest: { status: 200, requestUrl: "https://example.run.app/v1/channels/telegram/", latency: "0.015s" } },
  ]);
  assert.equal(live.calls, 3);
  assert.equal(live.accepted, 3);
  assert.equal(live.interrupted, 1);
  assert.equal(live.prepMs, 18063);
  assert.equal(live.replyMedianMs, 0);
  const split = monitorFacts([
    { timestamp: "2026-11-15T03:09:28.126Z", httpRequest: { status: 200, requestUrl: "https://example.run.app/v1/channels/telegram/", latency: "0.016s" } },
    { timestamp: "2026-11-15T03:09:28.161Z", textPayload: "LocalCursorRulesService load completed meta={durationMs: 18063, ruleCount: 0}" },
    { timestamp: "2026-11-15T03:09:48.000Z", textPayload: "[telegram] replied in 20000ms" },
  ]);
  assert.equal(split.replyMedianMs, 20000);
  assert.equal(split.prepMs, 18063);
  assert.equal(split.modelMedianMs, 1937);
  assert.equal(split.acceptMedianMs, 16);
  assert.equal(split.acceptP95Ms, 16);
  const rules = channelBars([
    { timestamp: "2026-11-15T03:09:28.126Z", httpRequest: { status: 200, requestUrl: "https://example.run.app/v1/channels/telegram/", latency: "0.016s" } },
    { timestamp: "2026-11-15T03:09:28.161Z", textPayload: "LocalCursorRulesService load completed meta={durationMs: 18063, ruleCount: 0}" },
  ]);
  assert.equal(rules[0].kind, "accept");
  assert.equal(rules[0].ms, 16);
  assert.match(monitorFilter("bigagent-telegram-desk", "us-central1"), /replied in/);
  assert.match(monitorFilter("bigagent-telegram-desk", "us-central1"), /durationMs/);
  assert.equal(monitorFilter("bigagent-telegram-desk", "us-central1").includes("not-a-real-key"), false);
  const open = agentSignal([{ timestamp: "2026-11-15T03:13:26.230Z", httpRequest: { status: 200, requestUrl: "https://example.run.app/v1/channels/telegram/", latency: "0.008s" } }], Date.parse("2026-11-15T03:14:11.230Z"));
  assert.match(open.headline, /waiting 45s/);
  assert.match(open.headline, /8ms/);
  assert.match(phrase("es", open.headline), /lleva 45 s esperando/);
  assert.equal(monitorFacts([{ timestamp: "2026-11-15T03:13:26.230Z", httpRequest: { status: 200, requestUrl: "https://example.run.app/v1/channels/telegram/", latency: "0.008s" } }], Date.parse("2026-11-15T03:14:11.230Z")).waitingMs, 45000);
  const stacked = interactionStages([
    { timestamp: "2026-11-15T03:13:26.230Z", httpRequest: { status: 200, requestUrl: "https://example.run.app/v1/channels/telegram/", latency: "0.008s" } },
    { timestamp: "2026-11-15T03:13:27.000Z", textPayload: "LocalCursorRulesService load completed meta={durationMs: 18000, ruleCount: 0}" },
  ], Date.parse("2026-11-15T03:14:11.230Z"));
  assert.equal(stacked[0].acceptMs, 8);
  assert.equal(stacked[0].prepMs, 18000);
  assert.equal(stacked[0].modelMs, 0);
  assert.equal(stacked[0].openMs, 45000 - 8 - 18000);
  const closed = interactionStages([
    { timestamp: "2026-11-15T03:13:26.230Z", httpRequest: { status: 200, requestUrl: "https://example.run.app/v1/channels/telegram/", latency: "0.008s" } },
    { timestamp: "2026-11-15T03:13:27.000Z", textPayload: "LocalCursorRulesService load completed meta={durationMs: 18000, ruleCount: 0}" },
    { timestamp: "2026-11-15T03:13:46.000Z", textPayload: "[telegram] replied in 20000ms" },
  ], Date.parse("2026-11-15T03:14:11.230Z"));
  assert.equal(closed[0].modelMs, 20000 - 8 - 18000);
  assert.equal(closed[0].openMs, 0);
  const lied = interactionStages([
    { timestamp: "2026-11-15T03:13:26.000Z", textPayload: "[telegram] turn started" },
    { timestamp: "2026-11-15T03:13:27.000Z", textPayload: "LocalCursorRulesService load completed meta={durationMs: 4000, ruleCount: 1}" },
    { timestamp: "2026-11-15T03:13:46.000Z", textPayload: "[telegram] replied in 999999ms" },
    { timestamp: "2026-11-15T03:14:00.000Z", textPayload: "[whatsapp] turn started" },
  ], Date.parse("2026-11-15T03:14:10.000Z"));
  assert.equal(lied[0].channel, "telegram");
  assert.equal(lied[0].prepMs, 4000);
  assert.equal(lied[0].modelMs, 16000);
  assert.equal(lied[0].openMs, 0);
  assert.equal(lied[1].channel, "whatsapp");
  assert.equal(lied[1].openMs, 10000);
  const many = interactionStages(Array.from({ length: 9 }, (_, index) => ({
    timestamp: new Date(Date.parse("2026-11-15T03:00:00.000Z") + index * 60000).toISOString(),
    textPayload: "[telegram] turn started",
  })), Date.parse("2026-11-15T03:20:00.000Z"));
  assert.equal(many.length, 9);
  assert.equal(monitorFreshness("24h"), "1d");
  assert.equal(monitorFreshness("custom", Date.parse("2026-11-15T01:30:00.000Z"), Date.parse("2026-11-15T03:00:00.000Z")), "2h");
  assert.equal(monitorFreshness("nope"), "6h");
  assert.equal(bars[0].at, Date.parse("2026-11-15T02:28:34.176510Z"));
  assert.ok(bars[0].ms > 10 && bars[0].ms < 20);
  assert.equal(parseLogEntries("noise [{\"timestamp\":\"2026-11-15T02:00:00Z\",\"textPayload\":\"[telegram] turn failed: turn interrupted\"}] tail").length, 1);
  assert.match(opened, /data-gcp-pane="status"/);
  assert.equal(/data-gcp-pane="status" hidden/.test(opened), false);
  assert.match(opened, /data-gcp-pane="place" hidden/);
  assert.match(opened, /id="gcp-chart"/);
  assert.ok(opened.indexOf('id="gcp-stages"') < opened.indexOf('id="gcp-chart"'));
  assert.match(opened, /id="gcp-range"/);
  assert.match(opened, /id="gcp-stage-pager"/);
  assert.match(opened, /id="gcp-chart-pager"/);
  assert.match(opened, /value="6h" selected/);
  assert.match(opened, /id="gcp-every"/);
  assert.match(opened, /value="30" selected/);
  assert.equal(opened.includes("One image. Four places."), false);
  assert.equal(opened.includes("Local runs on this machine."), false);
  assert.match(opened, /Secret Manager/);
  assert.match(opened, /TELEGRAM_BOT_TOKEN/);
  assert.equal(opened.includes("not-a-real-key"), false);

  const stayed = designerHtml(project, { ...page, shipTarget: "gcp", gcpNote: "Checking the Google account." }, true, undefined, "", layout, layout, false, undefined, ship);
  assert.match(stayed, /data-ship-panel="local" hidden/);
  assert.equal(/data-ship-panel="gcp" hidden/.test(stayed), false);
  assert.match(stayed, /data-target="gcp"[^>]*class="on"|class="on"[^>]*data-target="gcp"/);
  assert.match(stayed, /Checking the Google account/);
  const spanish = designerHtml(project, { ...page, lang: "es", shipTarget: "gcp" }, true, undefined, "", layout, layout, false, undefined, ship);
  assert.match(spanish, /Instancias mínimas/);
  assert.match(spanish, /Dejar CPU y memoria asignadas/);
  assert.match(opened, /id="gcp-cpu-always"[^>]*checked/);
  assert.match(spanish, /Actualizar/);
  assert.match(spanish, /Cada mensaje, desde que entra hasta que responde/);
  assert.match(spanish, /Rango/);
  assert.match(spanish, /Anteriores/);
  assert.match(spanish, /Recientes/);
  assert.match(spanish, /Parar/);
  assert.match(phrase("es", "Stopped. Nothing new was published. Deploy starts again from the beginning."), /empieza otra vez desde el principio/);
  assert.match(spanish, /Preparación/);
  assert.match(spanish, /Variables de entorno planas/);
  assert.equal(/data-ship-panel="gcp" hidden/.test(spanish), false);

  const typed = parseGcpLink({
    project: "my-project",
    region: "us-central1",
    exposure: "internet",
    minInstances: 1,
    maxInstances: 2,
    concurrency: 2,
    cpu: "2",
    memory: "2Gi",
    timeout: 600,
    env: [{ name: "LOG_LEVEL", value: "info" }, { name: "", value: "" }],
  });
  if ("error" in typed) throw new Error(typed.error);
  writeGcpLink(root, typed.link);
  const saved = readGcpLink(root);
  assert.equal(saved.minInstances, 1);
  assert.equal(saved.maxInstances, 2);
  assert.equal(saved.cpu, "2");
  assert.equal(saved.memory, "2Gi");
  assert.equal(saved.timeout, 600);
  assert.deepEqual(saved.env, [{ name: "LOG_LEVEL", value: "info" }]);
  assert.equal(fs.readFileSync(path.join(root, ".bigagent", "gcp.json"), "utf8").includes("not-a-real-key"), false);

  const id = `sha256:${"cd".repeat(32)}`;
  const plan = cloudRunPlan({
    agentName: project.name,
    project: typed.link.project,
    region: typed.link.region,
    imageId: id,
    exposure: "internet",
    hasPublicChannel: true,
    secretNames: ["CURSOR_API_KEY", "TELEGRAM_BOT_TOKEN"],
    minInstances: typed.link.minInstances,
    maxInstances: typed.link.maxInstances,
    concurrency: typed.link.concurrency,
    cpu: typed.link.cpu,
    memory: typed.link.memory,
    timeout: typed.link.timeout,
    env: typed.link.env,
  });
  if ("error" in plan) throw new Error(plan.error);
  const args = cloudRunArgs(plan.plan).join(" ");
  assert.match(args, /--min-instances 1/);
  assert.match(args, /--max-instances 2/);
  assert.match(args, /--update-annotations run\.googleapis\.com\/minScale=1,run\.googleapis\.com\/maxScale=2/);
  assert.match(args, /--concurrency 2/);
  assert.match(args, /--cpu 2/);
  assert.match(args, /--memory 2Gi/);
  assert.match(args, / --no-cpu-throttling/);
  assert.equal(/ --cpu-throttling/.test(args), false);
  assert.equal(saved.cpuAlways, true);
  const throttled = cloudRunPlan({
    agentName: project.name,
    project: "my-project",
    region: "us-central1",
    imageId: id,
    exposure: "internet",
    hasPublicChannel: true,
    secretNames: [],
    cpuAlways: false,
  });
  if ("error" in throttled) throw new Error(throttled.error);
  const throttledArgs = cloudRunArgs(throttled.plan).join(" ");
  assert.match(throttledArgs, / --cpu-throttling/);
  assert.equal(throttledArgs.includes("--no-cpu-throttling"), false);
  assert.match(args, /--timeout 600/);
  assert.match(args, /--set-env-vars LOG_LEVEL=info/);
  assert.match(args, /TELEGRAM_BOT_TOKEN=TELEGRAM_BOT_TOKEN:latest/);
  assert.equal(args.includes("BIGAGENT_ADMIT_LOCAL"), false);
  assert.equal(args.includes("not-a-real-key"), false);

  const secretEnv = cloudRunPlan({
    agentName: project.name,
    project: "my-project",
    region: "us-central1",
    imageId: id,
    exposure: "internet",
    hasPublicChannel: true,
    secretNames: ["CURSOR_API_KEY"],
    minInstances: 1,
    maxInstances: 2,
    concurrency: 2,
    cpu: "1",
    memory: "1Gi",
    timeout: 300,
    env: [{ name: "CURSOR_API_KEY", value: "not-a-real-key" }],
  });
  assert.equal("error" in secretEnv, true);
  if (!("error" in secretEnv)) return;
  assert.match(secretEnv.error, /Secret Manager/);
  assert.equal(secretEnv.error.includes("not-a-real-key"), false);
  assert.match(phrase("es", secretEnv.error), /Secret Manager/);
  const sync = secretSyncPlan(
    ["CURSOR_API_KEY", "TELEGRAM_BOT_TOKEN", "WHATSAPP_TOKEN"],
    [{ name: "CURSOR_API_KEY", value: " cloud-only " }, { name: "TELEGRAM_BOT_TOKEN", value: "   " }],
    { CURSOR_API_KEY: "local-key", TELEGRAM_BOT_TOKEN: "local-telegram", WHATSAPP_TOKEN: "" },
  );
  assert.deepEqual(sync.ready.map((row) => ({ name: row.name, value: row.value, source: row.source })), [
    { name: "CURSOR_API_KEY", value: "cloud-only", source: "environment" },
    { name: "TELEGRAM_BOT_TOKEN", value: "local-telegram", source: "local" },
  ]);
  assert.deepEqual(sync.missing, ["WHATSAPP_TOKEN"]);
  assert.equal(secretSyncPlan(["CURSOR_API_KEY"], [{ name: "OTHER", value: "nope" }], {}).missing[0], "CURSOR_API_KEY");
  assert.match(phrase("es", "Synced 2 to Secret Manager. Could not sync WHATSAPP_TOKEN. It has no local value."), /Se sincronizaron 2 secretos/);
  assert.match(phrase("es", "Could not sync CURSOR_API_KEY. It has no local value."), /No se pudo sincronizar CURSOR_API_KEY/);
  assert.equal(formatCommand("gcloud", ["secrets", "versions", "add", "CURSOR_API_KEY", "--data-file=C:\\temp\\secret", "--quiet"]), "$ gcloud secrets versions add CURSOR_API_KEY \"--data-file=C:\\temp\\secret\" --quiet");
  assert.match(formatCommand("docker", ["compose", "up", "--build"]), /\$ docker compose up --build/);
  const pasted = consoleCommand("gcloud", ["services", "enable", "secretmanager.googleapis.com", "--project", "mistratos"], "win32");
  assert.equal(pasted, "$ gcloud.cmd services enable secretmanager.googleapis.com --project mistratos");
  assert.equal(pasted.includes("Start-Transcript"), false);
  assert.equal(pasted.includes("not-a-real-key"), false);
  const missingImage = gcpPreview({ agentName: "Telegram desk", imageId: null, project: "mistratos", region: "us-central1" });
  assert.equal(missingImage.state, "need-image");
  assert.match(missingImage.summary, /Local first/);
  const pinned = `sha256:${"ab".repeat(32)}`;
  const ready = gcpPreview({ agentName: "Telegram desk", imageId: pinned, project: "mistratos", region: "us-central1" });
  assert.equal(ready.state, "ready");
  assert.match(ready.image, /sha256:abababababab/);
  assert.match(ready.target, /us-central1-docker\.pkg\.dev\/mistratos\/bigagent\/bigagent-telegram-desk:abababababab/);
  const published = gcpPreview({ agentName: "Telegram desk", imageId: pinned, project: "mistratos", region: "us-central1", url: "https://desk-abc.run.app" });
  assert.equal(published.state, "published");
  assert.equal(published.url, "https://desk-abc.run.app");
  const before = gcpChecks({ imageId: null, project: "", region: "bad", secrets: [{ name: "CURSOR_API_KEY", configured: false }] });
  assert.equal(before.filter((row) => row.ok).length, 0);
  assert.match(before[0].text, /Build it here/);
  const after = gcpChecks({ imageId: pinned, project: "mistratos", region: "us-central1", secrets: [{ name: "CURSOR_API_KEY", configured: true }] });
  assert.equal(after.every((row) => row.ok), true);
  const found = composeImageId(`[{"ID":"sha256:${"e8".repeat(32)}","Repository":"prueba-2-agent","ContainerName":"prueba-2-agent-1"}]`);
  assert.equal(found, `sha256:${"e8".repeat(32)}`);
  const newer = `sha256:${"f4".repeat(32)}`;
  const older = `sha256:${"35".repeat(32)}`;
  const picked = composeImageId(JSON.stringify([
    { ID: older, Repository: "sha256", ContainerName: "sqlite-crash-probe" },
    { ID: newer, Repository: "prueba-2-agent", ContainerName: "prueba-2-agent-1" },
  ]));
  assert.equal(picked, newer);
  let pushed = consoleAppend("", "The push refers to repository [desk]\n");
  pushed = consoleAppend(pushed, "2135c70dc831: Preparing\r");
  pushed = consoleAppend(pushed, "2135c70dc831: Pushing 12MB/80MB\r");
  pushed = consoleAppend(pushed, "1162e6817b10: Waiting\n");
  assert.match(pushed, /Pushing 12MB\/80MB/);
  assert.equal(pushed.includes("Preparing"), false);
  assert.match(pushed, /1162e6817b10: Waiting/);
  const kept = consoleAppend("$ gcloud.cmd run deploy desk\n", "\rDeploying...\rERROR: (gcloud.run.deploy) Permission denied on the secret\r");
  assert.match(kept, /\$ gcloud\.cmd run deploy desk/);
  assert.match(kept, /Permission denied on the secret/);
  assert.match(commandFailure("\rDeploying...\rERROR: (gcloud.run.deploy) Permission denied on the secret\r"), /Permission denied/);
  const layers = pushProgress("2135c70dc831: Layer already exists\ndafb8aed9f7f: Preparing\n");
  assert.equal(layers.done, 1);
  assert.equal(layers.pending, 1);
  assert.match(layers.detail, /dafb8aed9f7f: Preparing/);
  const sdk = "C:\\Program Files (x86)\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd";
  assert.equal(pickGcloud(`${sdk}\r\n`), sdk);
  assert.equal(pickGcloud("gcloud.cmd\r\n"), "");
  const shell = windowsShell(sdk, ["run", "deploy", "desk", "--set-secrets", "CURSOR_API_KEY=CURSOR_API_KEY:latest"], "C:\\temp\\gcloud.log");
  assert.match(shell, /"C:\\Program Files \(x86\)\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud\.cmd"/);
  assert.match(shell, /2>&1/);
  assert.equal(shell.includes("not-a-real-key"), false);
  assert.match(commandFailure("ok\nERROR: (gcloud.run.deploy) Secret CURSOR_API_KEY was not found\n"), /was not found/);
  assert.match(phrase("es", "Cloud Run did not accept the service. ERROR: Secret was not found"), /no aceptó el servicio/);
  assert.match(phrase("es", "Pushing the image. 9 layers are already in the registry. 2 have not moved for 40s. abcdef012345: Preparing"), /no se mueven desde hace 40 s/);
  assert.match(phrase("es", "Pushing the image. Every layer is in the registry. Docker has been quiet for 40s."), /no escribe desde hace 40 s/);
  const localId = `sha256:${"ab".repeat(32)}`;
  assert.equal(shortImage(localId), "sha256:abababababab");
  assert.equal(cloudRunImageMatch(localId, "us-central1-docker.pkg.dev/mistratos/bigagent/desk:abababababab"), "same");
  assert.equal(cloudRunImageMatch(localId, "us-central1-docker.pkg.dev/mistratos/bigagent/desk:ffffffffffff"), "other");
  assert.equal(cloudRunImageMatch(localId, "us-central1-docker.pkg.dev/mistratos/bigagent/desk@sha256:" + "cd".repeat(32)), "unknown");
  assert.equal(cloudRunImageMatch(localId, "us-central1-docker.pkg.dev/mistratos/bigagent/desk@sha256:" + "cd".repeat(32), "sha256:" + "cd".repeat(32)), "same");
  assert.equal(cloudRunImageMatch(localId, "us-central1-docker.pkg.dev/mistratos/bigagent/desk@sha256:" + "cd".repeat(32), "sha256:" + "ef".repeat(32)), "other");
  const release = parseServiceRelease('{"spec":{"template":{"spec":{"containers":[{"image":"us-central1-docker.pkg.dev/mistratos/bigagent/desk:abababababab"}]}}},"status":{"latestCreatedRevisionName":"desk-00007","latestReadyRevisionName":"desk-00007","traffic":[{"revisionName":"desk-00007","percent":100}],"url":"https://desk-abc.run.app"}}');
  assert.equal(release?.image, "us-central1-docker.pkg.dev/mistratos/bigagent/desk:abababababab");
  assert.equal(releasedImage(release || { url: "", revision: "", ready: "", created: "", image: "" }), "us-central1-docker.pkg.dev/mistratos/bigagent/desk:abababababab");
  assert.equal(releasedImage({ url: "", revision: "desk-00004", ready: "desk-00004", created: "desk-00007", image: "us-central1-docker.pkg.dev/mistratos/bigagent/desk:ffffffffffff" }), "");
  assert.equal(serviceMissing("ERROR: (gcloud.run.services.describe) Resource was not found"), true);
  assert.equal(serviceMissing("ERROR: (gcloud.run.services.describe) Cannot find service [bigagent-telegram-desk]"), true);
  assert.equal(cloudRunDescribeFailure("ERROR: (gcloud.run.services.describe) Cannot find service [bigagent-telegram-desk]"), "missing");
  assert.equal(cloudRunDescribeFailure("ERROR: You do not currently have an active account selected.\n"), "auth");
  assert.equal(cloudRunDescribeFailure("ERROR: (gcloud.run.services.describe) PERMISSION_DENIED: Permission 'run.services.get' denied"), "denied");
  assert.match(phrase("es", "Cloud Run has no service bigagent-telegram-desk in project mistratos, region us-central1. It was deleted or never published. Deploy creates it. This is not a Google sign-in error."), /no tiene el servicio bigagent-telegram-desk/);
  assert.match(phrase("es", "This Google account cannot read Cloud Run in project mistratos. Sign in with an account that has access, or choose another project."), /no puede leer Cloud Run/);
  const traffic = parseTrafficRevision('{"status":{"url":"https://desk-abc.run.app","traffic":[{"revisionName":"desk-00001","percent":0},{"revisionName":"desk-00004","percent":100}]}}');
  assert.equal(traffic?.revision, "desk-00004");
  assert.equal(traffic?.url, "https://desk-abc.run.app");
  assert.match(phrase("es", "Cloud Run is up to date with image sha256:abababababab. Live at https://desk-abc.run.app."), /ya está actualizado con la imagen sha256:abababababab/);

  const admit = parseGcpLink({
    project: "my-project",
    region: "us-central1",
    exposure: "internet",
    minInstances: 0,
    maxInstances: 4,
    concurrency: 4,
    cpu: "1",
    memory: "1Gi",
    timeout: 300,
    env: [{ name: "BIGAGENT_ADMIT_LOCAL", value: "1" }],
  });
  assert.equal("error" in admit, true);

  const cold = cloudRunPlan({
    agentName: project.name,
    project: "my-project",
    region: "us-central1",
    imageId: id,
    exposure: "internet",
    hasPublicChannel: true,
    secretNames: [],
    minInstances: 0,
    maxInstances: 4,
    concurrency: 4,
    cpu: "1",
    memory: "1Gi",
    timeout: 300,
    env: [],
  });
  if ("error" in cold) throw new Error(cold.error);
  assert.match(cold.plan.warning, /min instances to 1/);
});

test("the editor assistant gets the canvas and the platform rules, not a secret value", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  const project = initWorkspace(root, "Desk");
  setSecret(root, "CURSOR_API_KEY", "not-a-real-key");
  const prompt = assistantContext(loadProject(root), "What is missing?");
  assert.equal(prompt.includes("not-a-real-key"), false);
  assert.match(prompt, /Do not invent a secret value/);
  assert.match(prompt, /Do not write files/);
  assert.match(prompt, /agent:Desk/);
  assert.match(prompt, /AGENT_SDK_BEARER_TOKEN/);
  assert.match(prompt, /What is missing\?/);
});

test("a ship update paints the same face the page shows and keeps the log filters", () => {
  const logs = "2026-11-07T20:00:00.000Z info ready\n2026-11-07T20:00:05.000Z error tool lookup failed\n";
  const signals = runSignals(logs);
  assert.equal(signals.errors, 1);
  assert.match(signals.lastError, /tool lookup failed/);
  assert.equal(signals.spanMs, 5000);
  assert.equal(runSignals("2026-11-07T20:00:00.000Z info ready").spanMs, null);
  assert.equal(runSignals("").errors, 0);
  assert.equal(runSignals("info not-a-real-key").lastError, "");

  const status = { docker: "ready" as const, running: true, phase: "idle" as const, summary: "Listening on http://127.0.0.1:3000.", logs, publicUrl: "", stats: { cpu: "1.2%", memory: "40MiB / 1GiB", healthMs: 12 } };
  const face = shipFace(status, "en", false);
  assert.equal(face.state, "running");
  assert.equal(face.label, "Running");
  assert.equal(face.summaryKind, "plain");
  assert.equal(face.cpu, "1.2%");
  assert.equal(face.health, "12 ms");
  assert.equal(face.errors, "1");
  assert.equal(face.window, "5 s");
  assert.match(face.lastError, /tool lookup failed/);
  assert.equal(face.startDisabled, true);
  assert.equal(face.startText, "Running");
  assert.equal(face.playgroundDisabled, false);
  assert.equal(face.refreshDisabled, false);

  const checking = shipFace({ docker: "unknown", running: false, phase: "checking", summary: "Checking Docker on this machine.", logs: "", publicUrl: "" }, "en", false);
  assert.equal(checking.summaryKind, "working");
  assert.equal(checking.startDisabled, false);
  assert.equal(checking.refreshDisabled, false);
  const building = shipFace({ docker: "ready", running: false, phase: "building", summary: "Building the local image. The log shows each step.", logs: "", publicUrl: "" }, "en", false);
  assert.equal(building.startDisabled, true);
  assert.equal(building.startText, "Building");
  assert.equal(building.refreshDisabled, true);
  const down = shipFace({ docker: "down", running: false, phase: "idle", dockerWhy: "missing", summary: "Docker is not installed, or this machine cannot run it. Install Docker, leave it running, then come back to Ship.", logs: "", publicUrl: "" }, "en", false);
  assert.equal(down.state, "down");
  assert.equal(down.summaryKind, "error");
  const failed = shipFace({ docker: "ready", running: false, failed: true, phase: "idle", summary: "The build stopped. Read the log.", logs: "", publicUrl: "" }, "es", false);
  assert.equal(failed.label, "Falló");

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  initWorkspace(root, "Desk");
  const page = { mode: "deploy" as const, selected: "", notice: "", libraryOpen: false, inspectorOpen: false, libraryWidth: 240, inspectorWidth: 280 };
  const layout = readLayout(root);
  const html = designerHtml(loadProject(root), page, true, undefined, "", layout, layout, false, undefined, status);
  assert.match(html, /id="ship-live"/);
  assert.match(html, /id="meter-cpu">1\.2%/);
  assert.match(html, /id="meter-errors">1/);
  assert.match(html, /id="meter-window">5 s/);
  assert.match(html, /id="ship-last-error"/);
  assert.match(html, /tool lookup failed/);
  assert.match(html, /data-state="running"/);
  assert.match(html, /id="ship-start"[^>]*disabled[^>]*>Running</);
  assert.match(html, /id="log-search"/);
  assert.match(html, /function applyFace/);
  assert.match(html, /data\.type === "ship-face"/);
  assert.equal(html.includes('document.getElementById("log-search").value ='), false);
  assert.equal(html.includes("webview.html"), false);
  const flow = designerHtml(loadProject(root), { ...page, mode: "flow" }, true, undefined, "", layout, layout, false, undefined, status);
  assert.match(flow, /id="surface"/);
  assert.equal(flow.includes('id="ship-live"'), false);
});

test("a built image is pinned and the next start does not rebuild it", () => {
  assert.equal(imageName("Telegram desk"), "bigagent-telegram-desk");
  const id = `sha256:${"ab".repeat(32)}`;
  assert.equal(parseImageId(`image ${id}`), id);
  assert.equal(parseImageId("not-a-real-token"), null);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-"));
  initWorkspace(root, "Telegram desk");
  const first = fs.readFileSync(path.join(root, "compose.yaml"), "utf8");
  assert.match(first, /build: \./);
  assert.match(first, /image: bigagent-telegram-desk\n/);
  assert.equal(shipArgs("start", false, false).includes("--build"), true);
  writeImagePin(root, id);
  writeDocker(root, true);
  const pinned = fs.readFileSync(path.join(root, "compose.yaml"), "utf8");
  assert.match(pinned, new RegExp(`image: bigagent-telegram-desk@${id}`));
  assert.equal(pinned.includes("build: ."), false);
  assert.equal(readImagePin(root), id);
  assert.equal(fs.readFileSync(path.join(root, ".bigagent", "image.json"), "utf8").includes("not-a-real-token"), false);
  assert.equal(shipArgs("start", true, false).includes("--build"), false);
  assert.equal(shipArgs("rebuild", true, false).includes("--build"), true);
  assert.throws(() => writeImagePin(root, "sha256:short"), /sha256/);
  const layout = readLayout(root);
  const html = designerHtml(loadProject(root), { mode: "deploy", selected: "", notice: "", libraryOpen: false, inspectorOpen: false, libraryWidth: 240, inspectorWidth: 280 }, true, undefined, "", layout, layout, false, undefined, {
    docker: "ready", running: true, phase: "idle", summary: "Listening on http://127.0.0.1:3000.", logs: "", publicUrl: "", image: id,
  });
  assert.match(html, /id="ship-image"/);
  assert.match(html, /sha256:abababababab/);
  assert.equal(html.includes(id), false);
  const clash = "Bind for 127.0.0.1:3000 failed: port is already allocated";
  assert.equal(portHolder(clash, "workspace-agent-1 127.0.0.1:3000->3000/tcp"), "Port 3000 is already used by workspace-agent-1. Stop that container, then Start again.");
  assert.equal(portHolder(clash, ""), "Port 3000 is already used on this machine. Stop the other agent, then Start again.");
  assert.equal(portHolder("The build stopped.", "workspace-agent-1 127.0.0.1:3000->3000/tcp"), "");
  assert.equal(mergeLogs("build step\n", ""), "build step\n");
  assert.equal(mergeLogs("build step\n", "agent-1  | Telegram desk listening\n"), "agent-1  | Telegram desk listening\n");
  assert.match(phrase("es", portHolder(clash, "workspace-agent-1 127.0.0.1:3000->3000/tcp")), /workspace-agent-1/);
});

test("local ship reads running, failed, and log lines", () => {
  const ndjson = '{"Service":"agent","State":"running"}\n';
  const array = '[{"Service":"agent","Status":"Up 3 seconds"}]';
  const exited = '{"State":"exited","Status":"Exited (1)"}';
  assert.equal(composePortClosed('{"State":"running","Ports":"3000/tcp","Publishers":[{"PublishedPort":0,"TargetPort":3000}]}'), true);
  assert.equal(composePortClosed('{"State":"running","Ports":"127.0.0.1:3000->3000/tcp","Publishers":[{"PublishedPort":3000,"TargetPort":3000}]}'), false);
  assert.equal(composeIsRunning(ndjson), true);
  assert.equal(composeIsRunning(array), true);
  assert.equal(composeIsRunning(exited), false);
  assert.equal(composeIsRunning("Stopped"), false);
  assert.equal(logLevel("2026-11-07T20:00:00.000Z error boom"), "error");
  assert.equal(logLevel("warning: retry"), "warn");
  assert.equal(logLevel("ready"), "info");
  assert.equal(logStamp("agent-1  | 2026-11-07T20:00:00.000Z ready"), Date.parse("2026-11-07T20:00:00.000Z"));
  assert.equal(logStamp("no time here"), null);
});
