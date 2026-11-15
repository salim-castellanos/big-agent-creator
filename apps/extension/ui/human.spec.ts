import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { designerHtml, shipFace, type Ui } from "../src/designer";
import { deliveryCheck, loadExample, loadProject, readLayout, setSecret, writeGcpLink } from "../src/project";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "bigagent-ui-"));
const example = path.resolve(process.cwd(), "..", "..", "examples", "telegram-desk");
const blank: Ui = { mode: "flow", selected: "", notice: "", libraryOpen: true, inspectorOpen: true, libraryWidth: 240, inspectorWidth: 280 };

function desk(mode: Ui["mode"], extra: Partial<Ui> = {}): Ui {
  return { ...blank, mode, ...extra };
}

async function show(page: Page, html: string): Promise<void> {
  page.removeAllListeners("pageerror");
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.goto("about:blank");
  const bridged = html.replaceAll(
    "const vscode = acquireVsCodeApi();",
    "window.__msgs = []; var vscode = { postMessage(message){ window.__msgs.push(message); }, getState(){ return {}; }, setState(){} };",
  );
  await page.setContent(bridged, { waitUntil: "domcontentloaded" });
}

async function messages(page: Page): Promise<{ type?: string; [key: string]: unknown }[]> {
  return page.evaluate(() => (window as unknown as { __msgs: { type?: string }[] }).__msgs || []);
}

test.beforeAll(() => {
  loadExample(example, root);
});

test("a blank folder offers the examples before a blank start", async ({ page }) => {
  await show(page, designerHtml(null, blank, true, { found: [], missing: [] }, "agent"));
  const examples = page.locator(".example-box");
  const blankStart = page.locator(".blank");
  await expect(examples).toBeVisible();
  await expect(examples.locator("h3")).toHaveText("Agentic flow examples");
  await expect(page.locator("[data-init-example='telegram-desk']")).toContainText("Telegram desk");
  const exampleBox = await examples.boundingBox();
  const blankBox = await blankStart.boundingBox();
  expect(exampleBox && blankBox && exampleBox.y < blankBox.y).toBeTruthy();
  await page.locator("[data-init-example='telegram-desk']").click();
  expect(await messages(page)).toContainEqual({ type: "create-example", id: "telegram-desk" });
  await page.locator("#create-form button[type='submit']").click();
  const sent = await messages(page);
  expect(sent.some((message) => message.type === "create" && message.name === "agent")).toBeTruthy();
});

test("the canvas selects a card and connects two without a drop doing it", async ({ page }) => {
  const project = loadProject(root);
  const layout = readLayout(root);
  await show(page, designerHtml(project, desk("flow", { selected: "agent" }), true, undefined, "", layout, layout));
  await expect(page.locator("#surface")).toBeVisible();
  await expect(page.locator(".node.agent")).toContainText("Telegram desk");
  await page.locator(".node[data-id='channel:telegram']").click();
  expect(await messages(page)).toContainEqual({ type: "select", id: "channel:telegram" });
  await page.locator("#connect").click();
  await page.locator(".node[data-id='channel:telegram']").click();
  await page.locator(".node[data-id='agent']").click();
  expect(await messages(page)).toContainEqual({ type: "link", from: "channel:telegram", to: "agent" });
  await page.locator("#undo").click();
  expect((await messages(page)).some((message) => message.type === "undo")).toBeTruthy();
});

test("a missing secret jumps to Secrets and the saved value stays off the page", async ({ page }) => {
  const project = loadProject(root);
  const layout = readLayout(root);
  await show(page, designerHtml(project, desk("flow", { selected: "channel:telegram" }), true, undefined, "", layout, layout));
  const jump = page.locator("[data-set-secret='TELEGRAM_BOT_TOKEN']").first();
  await expect(jump).toBeVisible();
  await jump.click();
  expect(await messages(page)).toContainEqual({ type: "open-secret", name: "TELEGRAM_BOT_TOKEN" });

  await show(page, designerHtml(project, desk("secrets", { secretFocus: "TELEGRAM_BOT_TOKEN" }), true, undefined, "", layout, layout));
  await expect(page.locator("#secret-name")).toHaveValue("TELEGRAM_BOT_TOKEN");
  expect(await page.evaluate(() => document.activeElement && (document.activeElement as HTMLElement).id)).toBe("secret-value");
  await page.locator("#secret-value").fill("not-a-real-token");
  await page.locator("#save-secret").click();
  expect(await messages(page)).toContainEqual({ type: "secret", name: "TELEGRAM_BOT_TOKEN", value: "not-a-real-token" });

  setSecret(root, "TELEGRAM_BOT_TOKEN", "not-a-real-token");
  const saved = designerHtml(loadProject(root), desk("secrets"), true, undefined, "", layout, layout);
  expect(saved.includes("not-a-real-token")).toBeFalsy();
  await show(page, saved);
  await expect(page.getByText("Set locally").first()).toBeVisible();
});

test("simulate flow opens a dialog and leaves the canvas clear", async ({ page }) => {
  const project = loadProject(root);
  const layout = readLayout(root);
  await show(page, designerHtml(project, desk("flow"), true, undefined, "", layout, layout));
  await expect(page.locator("#flow-sim")).toBeHidden();
  await expect(page.locator("#surface #flow-sim")).toHaveCount(0);
  await page.locator("#simulate-flow").click();
  await expect(page.locator("#flow-sim")).toBeVisible();
  await expect(page.locator("#flow-sim")).toContainText(/cannot run yet|minimum configuration/);
  await page.locator("#flow-sim-close").click();
  await expect(page.locator("#flow-sim")).toBeHidden();

  await show(page, designerHtml(project, desk("flow", { lang: "es" }), true, undefined, "", layout, layout));
  await page.locator("#simulate-flow").click();
  await expect(page.locator("#flow-sim")).toBeVisible();
  await expect(page.locator("#flow-sim-title")).toHaveText("Revisión del flujo");
});

test("a folder the SDK would refuse keeps Start off, and a good one can start", async ({ page }) => {
  const layout = readLayout(root);
  const good = designerHtml(loadProject(root), desk("deploy"), true, undefined, "", layout, layout, false, undefined, {
    docker: "ready", running: false, phase: "idle", summary: "Stopped. Start builds the image and runs it here.", logs: "", publicUrl: "",
  });
  expect(deliveryCheck(root)).toEqual([]);
  await show(page, good);
  await expect(page.locator("#ship-start")).toBeEnabled();
  await page.locator("#run-validate").click();
  expect(await messages(page)).toContainEqual({ type: "task", task: "validate" });

  const pkgPath = path.join(root, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { type?: string };
  fs.writeFileSync(pkgPath, JSON.stringify({ ...pkg, type: "commonjs" }));
  try {
    expect(deliveryCheck(root).some((finding) => finding.id === "package-type")).toBeTruthy();
    await show(page, designerHtml(loadProject(root), desk("deploy"), true, undefined, "", layout, layout, false, undefined, {
      docker: "ready", running: false, phase: "idle", summary: "", logs: "", publicUrl: "",
    }));
    await expect(page.locator("#ship-start")).toBeDisabled();
    await expect(page.locator("body")).toContainText('package.json must set "type": "module"');
  } finally {
    fs.writeFileSync(pkgPath, JSON.stringify({ ...pkg, type: "module" }));
  }
});

test("Start shows that it is working, then a ship update leaves the log filter in place", async ({ page }) => {
  const layout = readLayout(root);
  const logs = "alpha ready\nbeta noise\n";
  await show(page, designerHtml(loadProject(root), desk("deploy"), true, undefined, "", layout, layout, false, undefined, {
    docker: "ready", running: false, phase: "idle", summary: "Stopped. Start builds the image and runs it here.", logs, publicUrl: "",
  }));
  await page.locator("#log-search").fill("alpha");
  await expect(page.locator("#ship-log")).toContainText("alpha ready");
  await expect(page.locator("#ship-log")).not.toContainText("beta noise");
  await page.locator("#ship-start").click();
  await expect(page.locator("[data-status]")).toHaveText("Building");
  await expect(page.locator("#ship-start")).toBeDisabled();
  expect(await messages(page)).toContainEqual({ type: "ship", task: "start" });

  const face = shipFace({
    docker: "ready",
    running: true,
    phase: "idle",
    summary: "Listening on http://127.0.0.1:3000.",
    logs,
    publicUrl: "",
    stats: { cpu: "1%", memory: "2MiB", healthMs: 9 },
  }, "en", false);
  await page.evaluate((payload) => {
    window.dispatchEvent(new MessageEvent("message", { data: payload }));
  }, { type: "ship-face", face, logs });
  await expect(page.locator("[data-status]")).toHaveText("Running");
  await expect(page.locator("#log-search")).toHaveValue("alpha");
  await expect(page.locator("#ship-log")).toContainText("alpha ready");
  await expect(page.locator("#ship-log")).not.toContainText("beta noise");
  await expect(page.locator("#meter-health")).toHaveText("9 ms");
  await expect(page.locator("#surface")).toHaveCount(0);
  await page.evaluate((payload) => {
    window.dispatchEvent(new MessageEvent("message", { data: payload }));
  }, { type: "ship-face", face: { ...face, cpu: "3%" } });
  await expect(page.locator("#meter-cpu")).toHaveText("3%");
  await expect(page.locator("#ship-log")).toContainText("alpha ready");
});

test("a person configures GCP and the next screen stays on GCP", async ({ page }) => {
  const project = loadProject(root);
  const layout = readLayout(root);
  const ship = { docker: "ready" as const, running: false, phase: "idle" as const, summary: "", logs: "", publicUrl: "" };
  await show(page, designerHtml(project, desk("deploy"), true, undefined, "", layout, layout, false, undefined, ship));
  await page.locator("[data-target='gcp']").click();
  await expect(page.locator("[data-ship-panel='local']")).toBeHidden();
  await expect(page.locator("#gcp-min")).toBeVisible();
  await expect(page.locator("#gcp-status")).toBeHidden();
  await page.locator("#gcp-project").fill("my-project");
  await page.locator("#gcp-region").fill("us-central1");
  await page.locator("#gcp-min").fill("1");
  await page.locator("#gcp-max").fill("2");
  await page.locator("#gcp-concurrency").fill("2");
  await page.locator("#gcp-cpu").selectOption("2");
  await page.locator("#gcp-memory").selectOption("2Gi");
  await page.locator("#gcp-timeout").fill("600");
  await page.locator("[data-env-name]").first().fill("LOG_LEVEL");
  await page.locator("[data-env-value]").first().fill("info");
  await page.locator("#gcp-check").click();
  const sent = await messages(page);
  expect(sent.some((message) => message.type === "ship-target" && message.target === "gcp")).toBeTruthy();
  const check = sent.find((message) => message.type === "gcp-check");
  expect(check).toMatchObject({
    project: "my-project",
    region: "us-central1",
    exposure: "internet",
    minInstances: 1,
    maxInstances: 2,
    concurrency: 2,
    cpu: "2",
    memory: "2Gi",
    timeout: 600,
    env: [{ name: "LOG_LEVEL", value: "info" }],
  });
  await expect(page.locator("[data-ship-panel='local']")).toBeHidden();
  await expect(page.locator("[data-ship-panel='gcp']")).toBeVisible();

  writeGcpLink(root, {
    project: "my-project",
    region: "us-central1",
    exposure: "internet",
    minInstances: 1,
    maxInstances: 2,
    concurrency: 2,
    cpu: "2",
    memory: "2Gi",
    timeout: 600,
    env: [{ name: "LOG_LEVEL", value: "info" }],
  });
  await show(page, designerHtml(loadProject(root), desk("deploy", { shipTarget: "gcp", gcpNote: "Signed in to Google as person@example.com." }), true, undefined, "", layout, layout, false, undefined, ship));
  await expect(page.locator("[data-ship-panel='local']")).toBeHidden();
  await expect(page.locator("#gcp-deploy")).toBeVisible();
  await expect(page.locator("#gcp-project")).toHaveValue("my-project");
  await expect(page.locator("#gcp-memory")).toHaveValue("2Gi");
  await expect(page.locator("#gcp-status")).toContainText("person@example.com");
  await page.locator("#gcp-deploy").click();
  expect((await messages(page)).some((message) => message.type === "gcp-deploy" && message.memory === "2Gi" && message.project === "my-project")).toBeTruthy();
  await expect(page.locator("[data-ship-panel='gcp']")).toBeVisible();
  await expect(page.locator("[data-ship-panel='local']")).toBeHidden();
  fs.rmSync(path.join(root, ".bigagent", "gcp.json"), { force: true });
});

test("the assistant opens the editor chat instead of a second panel", async ({ page }) => {
  const layout = readLayout(root);
  await show(page, designerHtml(loadProject(root), desk("flow"), true, undefined, "", layout, layout));
  await expect(page.locator("#ask-form")).toHaveCount(0);
  await page.locator("#ask-open").click();
  expect(await messages(page)).toContainEqual({ type: "open-chat" });
});

test("Spanish labels, help, prove, and connect stay usable", async ({ page }) => {
  const project = loadProject(root);
  const layout = readLayout(root);
  await show(page, designerHtml(project, desk("deploy", { lang: "es" }), true, undefined, "", layout, layout, false, undefined, {
    docker: "ready", running: false, phase: "idle", summary: "", logs: "", publicUrl: "",
  }));
  await expect(page.locator("[data-mode='deploy']")).toHaveText("Desplegar");
  await page.locator("#fold-status").click();
  await expect(page.locator("#ship-live")).toBeHidden();
  await expect(page.locator("#ship-log")).toBeVisible();
  await page.locator("#fold-status").click();
  await expect(page.locator("#ship-live")).toBeVisible();
  await page.locator("#fold-log").click();
  await expect(page.locator("#ship-log")).toBeHidden();
  await expect(page.locator("#ship-live")).toBeVisible();
  await page.locator("#fold-log").click();
  await expect(page.locator("[data-ship-panel='local']")).toBeVisible();
  await expect(page.locator("[data-ship-panel='gcp']")).toBeHidden();
  await page.locator("[data-target='gcp']").click();
  await expect(page.locator("[data-ship-panel='gcp']")).toBeVisible();
  await expect(page.locator("[data-ship-panel='gcp']")).toContainText("Una cuenta de Google");
  await page.locator("#fold-gcp-top").click();
  await expect(page.locator("#gcp-deploy-pane")).toBeHidden();
  await expect(page.locator("#gcp-log")).toBeVisible();
  await page.locator("#fold-gcp-top").click();
  await expect(page.locator("#gcp-deploy-pane")).toBeVisible();
  await page.locator("#fold-gcp-bottom").click();
  await expect(page.locator("#gcp-log")).toBeHidden();
  await expect(page.locator("#gcp-deploy-pane")).toBeVisible();
  await page.locator("#fold-gcp-bottom").click();
  await expect(page.locator("[data-ship-panel='local']")).toBeHidden();
  await page.locator("[data-target='local']").click();
  await expect(page.locator("#ship-start")).toBeVisible();
  await page.locator("[data-set-lang='en']").click();
  expect((await messages(page)).some((message) => message.type === "lang" && message.lang === "en")).toBeTruthy();
  await expect(page.locator("[data-mode='deploy']")).toBeVisible();

  await show(page, designerHtml(project, desk("flow"), true, undefined, "", layout, layout));
  await page.locator("#help-open").click();
  await expect(page.locator("#help")).toBeVisible();
  await page.locator("#help-close").click();
  await expect(page.locator("#help")).toBeHidden();

  await show(page, designerHtml(project, desk("prove"), true, undefined, "", layout, layout));
  await page.locator("#eval-form input[name='name']").fill("hours");
  await page.locator("#eval-form textarea[name='prompt']").fill("What are your hours?");
  await page.locator("#eval-form select[name='check']").selectOption("lookup");
  await page.locator("#eval-form button[type='submit']").click();
  expect(await messages(page)).toContainEqual({ type: "eval-add", name: "hours", text: "What are your hours?", check: "lookup" });

  setSecret(root, "TELEGRAM_BOT_TOKEN", "123456:not-real");
  setSecret(root, "TELEGRAM_WEBHOOK_SECRET", "hookword");
  await show(page, designerHtml(loadProject(root), desk("connect"), true, undefined, "", layout, layout, false, undefined, {
    docker: "ready", running: true, phase: "idle", summary: "", logs: "", publicUrl: "",
  }));
  await expect(page.locator("#ship-webhook")).toBeVisible();
  await page.locator("#public-url").fill("https://name.trycloudflare.com");
  await page.locator("#ship-webhook").click();
  const sent = await messages(page);
  expect(sent.some((message) => message.type === "ship" && message.task === "webhook" && message.url === "https://name.trycloudflare.com")).toBeTruthy();
});
