export interface Options {
  port: number;
  basePath: string;
}

export const defaults: Options = {
  port: 3000,
  basePath: "/admin",
};

export function getServeHandler(
  userOptions?: Partial<Options>,
): Deno.ServeHandler {
  const options = { ...defaults, ...userOptions };
  const { port, basePath } = options;

  let process: { process: Deno.ChildProcess; ready: boolean } | undefined;
  let ws: WebSocket | undefined;
  let timeout: number | undefined;
  const sockets = new Set<WebSocket>();

  return async function (request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Start the server on the first request
    if (!process?.ready) {
      startServer(url);
      return new Response(
        `<html><head><title>Please wait...</title><meta http-equiv="refresh" content="2">
        <style>body{font-family:sans-serif;margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh}</style>
        </head><body><p>Please wait...</p></body></html>`,
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

    const response = await fetch(url, {
      redirect: "manual",
      headers,
      method: request.method,
      body: request.body,
    });

    // Close the server if the response header tells us to
    if (response.headers.get("X-Lume-CMS") === "reload") {
      closeServer();
    }

    return response;
  };

  // Start the server
  async function startServer(location: URL): Promise<void> {
    if (process?.ready === false) {
      return;
    }
    console.log(`Start proxied server on port ${port}`);
    const code = await (await fetch(import.meta.resolve("./adapter.ts")))
      .text();

    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "eval",
        "--unstable-kv",
        code,
        "--",
        `--port=${port}`,
        `--hostname=${location.hostname}`,
        `--location=${location.origin}`,
      ],
    });

    process = {
      process: command.spawn(),
      ready: false,
    };

    // Wait for the server to start
    let timeout = 0;
    while (true) {
      try {
        await fetch(`${location.protocol}//${location.hostname}:${port}`);
        process.ready = true;
        break;
      } catch {
        timeout += 1000;
        await new Promise((resolve) => setTimeout(resolve, timeout));
      }
    }

    // Start the WebSocket server
    const socket = new WebSocket(
      `ws://${location.hostname}:${port}${basePath}/_socket`,
    );

    socket.onmessage = (event) => {
      for (const socket of sockets) {
        socket.send(event.data);
      }
    };

    return await new Promise((resolve, reject) => {
      socket.onopen = () => {
        ws = socket;
        resolve();
      };
      socket.onerror = reject;
    });
  }

  // Close the server
  function closeServer() {
    process?.process.kill();
    ws?.close();
    process = undefined;
    ws = undefined;
    sockets.clear();
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

export default {
  fetch: getServeHandler(),
};
