import { parseArgs } from "jsr:@std/cli@1.0.8/parse-args";
import { type Context, Hono, Next, serveStatic } from "lume/cms/deps/hono.ts";
import authRoutes from "lume/cms/core/routes/auth.ts";
import { dispatch } from "lume/cms/core/utils/event.ts";
import { asset, getPath } from "lume/cms/core/utils/path.ts";
import { relative } from "lume/cms/deps/std.ts";

import type Site from "lume/core/site.ts";
import type Cms from "lume/cms/core/cms.ts";

export interface Options {
  site: Site;
  cms: Cms;
  basePath?: string;
}

export const defaults: Omit<Options, "site" | "cms"> = {
  basePath: "/admin",
};

export default async function adapter(userOptions?: Options): Promise<Hono> {
  const options = {
    ...defaults,
    ...userOptions,
  } as Required<Options>;

  const { site, cms, basePath } = options;

  // Enable drafts previews in the CMS
  Deno.env.set("LUME_DRAFTS", "true");

  await site.build();

  // Start the watcher
  const watcher = site.getWatcher();

  // deno-lint-ignore no-explicit-any
  watcher.addEventListener("change", async (event: any) => {
    const files = event.files!;
    await site.update(files);
    dispatch("previewUpdated");
  });

  watcher.start();

  if (!cms.options.site?.url) {
    cms.options.site!.url = site.url("/", true);
  }
  cms.storage("src");
  cms.options.basePath = basePath;
  cms.options.root = site.src();
  const data = cms.options.data ?? {};
  data.site = site;
  cms.options.data = data;

  addEventListener("cms:previewUrl", (e) => {
    // @ts-ignore: Detail declared in the event.
    e.detail.url = getPreviewUrl(e.detail.src);
  });

  addEventListener("cms:editSource", (e) => {
    // @ts-ignore: Detail declared in the event.
    e.detail.src = getSourceFile(e.detail.url);
  });

  function getPreviewUrl(src: string): string | undefined {
    for (const page of site.pages) {
      if (page.src.entry?.src === src) {
        return page.outputPath;
      }
    }
  }

  function getSourceFile(url: string): string | undefined {
    for (const page of site.pages) {
      if (page.data.url === url) {
        return page.src.entry?.src;
      }
    }
  }

  const app = new Hono({ strict: false });

  // Add the CMS routes
  app.route(basePath, cms.init());

  // Apply the auth to the main app
  authRoutes(app, cms.options.auth);

  // Add the edit button
  app.get("*", async (c: Context, next: Next) => {
    await next();

    const { res } = c;
    if (
      res.status === 200 &&
      res.headers.get("content-type")?.includes("text/html")
    ) {
      const body = await res.text();
      const code = `
          ${body}
          <script type="module" src="${
        asset(basePath, "components/u-bar.js")
      }"></script>
          <u-bar data-api="${getPath(basePath, "status")}"></u-bar>
        `;
      c.res = new Response(code, res);
      c.res.headers.delete("Content-Length");
    }
  });

  const root = relative(Deno.cwd(), site.dest());

  app.get(
    "*",
    serveStatic({ root }),
  );

  app.notFound(() => {
    const notFoundUrl = site.options.server?.page404;
    // deno-lint-ignore no-explicit-any
    const page = site.pages.find((p: any) =>
      p.data.url === notFoundUrl || p.outputPath === notFoundUrl
    );

    return new Response(page?.content ?? "Not found", {
      status: 404,
      headers: {
        "Content-Type": "text/html",
      },
    });
  });

  return app;
}

if (import.meta.main) {
  const flags = parseArgs(
    parseArgs(Deno.args, { "--": true })["--"],
    {
      string: ["port", "hostname"],
      default: {
        port: "3000",
        hostname: "0.0.0.0",
      },
    },
  );

  const { default: site } = await import(Deno.cwd() + "/_config.ts") as {
    default: Site;
  };
  const { default: cms } = await import(Deno.cwd() + "/_cms.ts") as {
    default: Cms;
  };

  const handler = await adapter({ site, cms });

  Deno.serve({
    port: parseInt(flags.port),
    hostname: flags.hostname,
  }, handler.fetch);
}
