import { build } from "vite";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const distDirectory = path.resolve(root, "dist");
const routes = [
  "/",
  "/task-focus-timer",
  "/focus-session-tracker",
  "/productivity-analytics",
];

await build({
  build: {
    ssr: "src/entry-server.tsx",
    outDir: ".prerender",
    emptyOutDir: true,
  },
});

const serverEntry = path.join(root, ".prerender", "entry-server.js");
const { render } = await import(`${pathToFileURL(serverEntry).href}?cacheBust=${Date.now()}`);
const template = await readFile(path.join(distDirectory, "index.html"), "utf8");

const templateWithoutSeo = template
  .replace(/\s*<title>[\s\S]*?<\/title>/g, "")
  .replace(/\s*<meta name="description"[^>]*\/>/g, "")
  .replace(/\s*<meta name="robots"[^>]*\/>/g, "")
  .replace(/\s*<link rel="canonical"[^>]*\/>/g, "")
  .replace(/\s*<meta property="og:[^"]+"[^>]*\/>/g, "")
  .replace(/\s*<meta name="twitter:[^"]+"[^>]*\/>/g, "");

for (const route of routes) {
  const renderedApp = render(route);
  const firstMarkup = renderedApp.indexOf('<div class="min-h-screen');
  const renderedHeadTags = firstMarkup === -1 ? "" : renderedApp.slice(0, firstMarkup);
  const renderedBody = firstMarkup === -1 ? renderedApp : renderedApp.slice(firstMarkup);
  const schemaTags = renderedBody.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g)?.join("") ?? "";
  const appHtml = renderedBody.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "");
  const headTags = `${renderedHeadTags}${schemaTags}`;
  const html = templateWithoutSeo
    .replace("</head>", `${headTags}</head>`)
    .replace(
      '<div id="root"></div>',
      `<div id="root">${appHtml}</div>`,
    );
  const outputDirectory = route === "/"
    ? distDirectory
    : path.join(distDirectory, route.slice(1));

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(path.join(outputDirectory, "index.html"), html);
  console.log(`prerendered ${route}`);
}
