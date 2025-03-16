import { parseArgs } from "jsr:@std/cli@1.0.8/parse-args";

// We need to eval the code instead of running it to keep the same cwd
const code = await (await fetch(import.meta.resolve("./adapter.ts"))).text();

// Capture flags to pass to the server
const flags = parseArgs(Deno.args, {
  "--": true,
  string: ["port", "adminPath"],
  boolean: ["show-terminal"],
  default: {
    port: "3000",
    adminPath: "/admin",
    showTerminal: false,
  },
});

export function getServeHandler(): Deno.ServeHandler {
  const { port, adminPath, "show-terminal": showTerminal } = flags;

  let process:
    | { process: Deno.ChildProcess; ready: boolean; error: boolean }
    | undefined;
  let ws: WebSocket | undefined;
  let timeout: number | undefined;
  const sockets = new Set<WebSocket>();

  return async function (request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Start the server on the first request
    if (!process?.ready) {
      const body = new BodyStream();
      body.message(`
        <html><head><title>Starting...</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <script>setInterval(() => window.scroll({top:document.documentElement.scrollHeight,behavior:"instant"}), 10);</script>
        <style>
        body {
          font-family: sans-serif;
          margin: 0;
          padding: 2rem;
          box-sizing: border-box;
          display: grid;
          grid-template-columns: minmax(0, 800px);
          align-content: center;
          justify-content: center;
          min-height: 100vh
        }
        pre {
          overflow-x: auto;
        }
        </style></head><body><pre><samp>Starting LumeCMS...`);

      startServer(url, body).then(() => {
        if (process?.error) {
          body.message("Error starting the server");
          body.close();
          process = undefined;
          return;
        }
        body.message("</pre></samp><script>location.reload()</script>");
        body.close();
      });
      return new Response(body.body, {
        status: 200,
        headers: {
          "Content-Type": "text/html",
          "Transfer-Encoding": "chunked",
        },
      });
    }

    // Close the server after 2 hours of inactivity
    clearTimeout(timeout);
    timeout = setTimeout(closeServer, 2 * 60 * 60 * 1000);

    // Forward the request to the server
    url.port = port;

    const headers = new Headers(request.headers);
    headers.set("host", url.host);
    headers.set("origin", url.origin);

    if (headers.get("upgrade") === "websocket") {
      return proxyWebSocket(request);
    }

    console.log(`Proxy request to ${url}`);
    console.log({
      redirect: "manual",
      headers,
      method: request.method,
      body: request.body,
    });

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
  async function startServer(location: URL, body: BodyStream): Promise<void> {
    if (process?.ready === false) {
      return;
    }

    body.message("Starting CMS...");
    console.log(`Start proxied server on port ${port}`);

    const command = new Deno.Command(Deno.execPath(), {
      stdout: "piped",
      stderr: "piped",
      args: [
        "eval",
        "--unstable-kv",
        code,
        // Lume flags
        "--",
        ...flags["--"],
        // Server flags
        "--",
        `--port=${port}`,
        `--hostname=${location.hostname}`,
      ],
    });

    process = {
      process: command.spawn(),
      ready: false,
      error: false,
    };

    process.process.status.then((status) => {
      if (status.success === false) {
        process!.error = true;
      }
    });

    if (showTerminal) {
      body.readStd(process.process.stdout);
      body.readStd(process.process.stderr);
    }

    // Wait for the server to start
    let timeout = 0;
    while (true) {
      if (process.error) {
        return;
      }

      body.message("Waiting for server");

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
      `ws://${location.hostname}:${port}${adminPath}/_socket`,
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

class BodyStream {
  #timer: number | undefined = undefined;
  #chunks: string[] = [];
  #body: ReadableStream | undefined;
  #closed = false;

  get body() {
    return this.#body;
  }

  constructor() {
    this.#body = new ReadableStream({
      start: (controller) => {
        this.#timer = setInterval(() => {
          while (this.#chunks.length > 0) {
            const message = this.#chunks.shift();
            controller.enqueue(new TextEncoder().encode(message));
          }
          if (this.#closed) {
            clearInterval(this.#timer);
            controller.close();
          }
        }, 100);
      },
      cancel: () => {
        this.close();
      },
    });
  }

  readStd(stream: ReadableStream) {
    stream.pipeThrough(new TextDecoderStream()).pipeTo(
      new WritableStream({
        write: (chunk) => {
          chunk = chunk.replaceAll(
            /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
            "",
          );
          this.#chunks.push(chunk);
        },
      }),
    );
  }

  message(message: string) {
    this.#chunks.push(message + "\n");
  }

  close() {
    this.#closed = true;
  }
}
