import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "ui",
  timeout: 30000,
  fullyParallel: false,
  reporter: "line",
  use: { viewport: { width: 1280, height: 800 } },
});
