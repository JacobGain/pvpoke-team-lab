import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const outputDirectory = process.argv[2];

if (!outputDirectory) {
  throw new Error(
    "Static artifact preparation requires an output directory argument.",
  );
}

const indexPath = resolve(outputDirectory, "index.html");
const fallbackPath = resolve(outputDirectory, "404.html");
const indexHtml = await readFile(indexPath, "utf8");

if (!indexHtml.includes('<div id="root"></div>')) {
  throw new Error(`${indexPath} is not a TeamLab application entry point.`);
}

await writeFile(fallbackPath, indexHtml);
console.log(`Static hosting fallback prepared at ${fallbackPath}.`);
