# LumeCMS Adapter

LumeCMS adapter to run with Lume (SSG) in a VPS easily.

## Usage

- In your Lume project directory, make sure the files `_config.ts` and `_cms.ts`
  exists.
- Run
  `deno serve -Ar https://cdn.jsdelivr.net/gh/lumeland/lume-cms-adapter@latest/mod.ts`.

This starts a Deno server under the port `8000` (see
[deno serve](https://docs.deno.com/runtime/reference/cli/serve/) to learn how to
configure it) that works as a reverse proxy. In the first request, it starts
another server on demand in the port `3000` with LumeCMS.

```
reverse proxy (8000) <-- on demand server (3000)
```

You can change the port of the proxy server with the `--port` flag:

```sh
deno serve -Ar https://cdn.jsdelivr.net/gh/lumeland/lume-cms-adapter@latest/mod.ts --port=8888

# reverse proxy (8000) <-- on demand server (8888)
```

Use `--` to pass arguments to LumeCMS. For example, if your public URL is
`https://example.com` and want to configure the Lume site with this location:

```sh
deno serve -Ar https://cdn.jsdelivr.net/gh/lumeland/lume-cms-adapter@latest/mod.ts --port=8888 -- --location=https://example.com

# reverse proxy (8000) <-- on demand server (8888) --location=https://example.com
```
