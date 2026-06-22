import { rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { build } from "vite";

const outDir = resolve("dist-balance");
await rm(outDir, { recursive: true, force: true });

await build({
  configFile: false,
  logLevel: "warn",
  build: {
    ssr: "scripts/balance-runner.ts",
    target: "node22",
    outDir,
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      output: {
        entryFileNames: "balance-runner.mjs",
      },
    },
  },
});

await import(pathToFileURL(resolve(outDir, "balance-runner.mjs")).href);
