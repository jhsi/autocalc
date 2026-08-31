import * as esbuild from "esbuild";
import { mkdir, copyFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "../../dist/figma");
const watch = process.argv.includes("--watch");

const html = await readFile(join(here, "ui.html"), "utf8");

await mkdir(outDir, { recursive: true });

const options = {
  absWorkingDir: here,
  entryPoints: ["code.ts"],
  bundle: true,
  outfile: join(outDir, "code.js"),
  target: "es2017",
  format: "iife",
  logLevel: "info",
  define: {
    __html__: JSON.stringify(html),
  },
};

await copyFile(join(here, "manifest.json"), join(outDir, "manifest.json"));
await copyFile(join(here, "ui.html"), join(outDir, "ui.html"));

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("Watching Figma plugin…");
} else {
  await esbuild.build(options);
}
