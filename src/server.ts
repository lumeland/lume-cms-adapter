import { Options as GitOptions } from "lume/cms/core/git.ts";

export interface Options {
  port?: number;
  basePath?: string;
  git?: GitOptions | boolean;
  auth?: AuthOptions;
  env?: Record<string, string>;
}

export interface AuthOptions {
  method: "basic";
  users: Record<string, string>;
}

export const defaults = {
  port: 3000,
  basePath: "/admin",
  git: false,
};

export function getServeHandler(userOptions?: Options): Deno.ServeHandler {
  const options = { ...defaults, ...userOptions };
  const { port, basePath, git, env } = options;

  let process: { process: Deno.ChildProcess; ready: boolean } | undefined;
  let ws: WebSocket | undefined;
  let timeout: number | undefined;
  const sockets = new Set<WebSocket>();

  return async function (request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Git actions
    if (
      request.method === "POST" && git && url.pathname === `${basePath}/_git`
    ) {
      const formData = await request.formData();

      try {
        closeServer();
        const { handleForm } = await import("./git.ts");
        await handleForm(formData, typeof git === "boolean" ? {} : git);
      } catch (error) {
        const message = Deno.inspect(error);
        return new Response(message, { status: 500 });
      }

      const redirect = url.searchParams.get("redirect") ||
        url.origin + basePath;
      return Response.redirect(redirect, 303);
    }

    // Start the server on the first request
    if (!process?.ready) {
      startServer();
      return new Response(
        `<html><head><title>Please wait...</title><meta http-equiv="refresh" content="2"><style>body{ font-family:sans-serif}</style></head><body><p>Please wait...</p></body></html>`,
        {
          status: 200,
          headers: { "content-type": "text/html" },
        },
      );
    }

    // Close the server after 2 hours of inactivity
    clearTimeout(timeout);
    timeout = setTimeout(closeServer, 2 * 60 * 60 * 1000);

    // Forward the request to the server
    url.port = port.toString();

    const headers = new Headers(request.headers);
    headers.set("host", url.host);
    headers.set("origin", url.origin);

    if (headers.get("upgrade") === "websocket") {
      return proxyWebSocket(request);
    }

    return await fetch(url, {
      redirect: "manual",
      headers,
      method: request.method,
      body: request.body,
    });
  };

  // Start the server
  async function startServer() {
    if (process?.ready === false) {
      return;
    }

    console.log("Starting proxy server");
    const envVars = { ...env };

    if (git) {
      envVars["LUMECMS_GIT"] = JSON.stringify(git === true ? {} : git);
    }

    const serve = import.meta.resolve("./start.ts");
    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "serve",
        "--allow-all",
        "--unstable-kv",
        `--port=${port}`,
        serve,
        `--location=http://localhost`,
        `--port=${port}`,
      ],
      env: envVars,
    });

    process = {
      process: command.spawn(),
      ready: false,
    };
    ws = await startWebSocket();
    process.ready = true;
  }

  // Close the server
  function closeServer() {
    process?.process.kill();
    ws?.close();
    process = undefined;
    ws = undefined;
    sockets.clear();
  }

  // Start the WebSocket server
  async function startWebSocket(): Promise<WebSocket> {
    let timeout = 0;

    while (true) {
      try {
        const ws = new WebSocket(`ws://localhost:${port}${basePath}/_socket`);

        ws.onmessage = (event) => {
          for (const socket of sockets) {
            socket.send(event.data);
          }
        };

        return await new Promise((resolve, reject) => {
          ws.onopen = () => resolve(ws);
          ws.onerror = reject;
        });
      } catch {
        timeout += 1000;
        await new Promise((resolve) => setTimeout(resolve, timeout));
      }
    }
  }

  // Proxy the WebSocket connection
  function proxyWebSocket(request: Request) {
    const { socket, response } = Deno.upgradeWebSocket(request);

    socket.onmessage = (event) => {
      ws?.send(event.data);
    };

    socket.onopen = () => {
      sockets.add(socket);
    };

    socket.onclose = () => {
      sockets.delete(socket);
    };

    return response;
  }
}
