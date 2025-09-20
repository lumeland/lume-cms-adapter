# LumeCMS Adapter proxy

A simple proxy to run LumeCMS in a VPS easily on demand.

- This script opens a permanent server under the port `8000` (configurable).
- On the first request, the script runs `deno task lume --serve --proxied ...`
  (also configurable). This initializes the Lume's dev server in the port
  `3000`.
- Once the Lume's server is running, this scripts works as a reverse proxy,
  forwarding all the client's request to the Lume's server.
- After 2 hours of inactivity, the Lume's server is closed. It will be created
  again on the next request.

## Usage

In the Lume project, run
`deno serve -Ar https://deno.land/x/lume_cms_adapter/mod.ts`.

## Configuration

### `--port`

If the proxied server is in on a different port (by default is `3000`), you can
configure it with this option:

```sh
deno serve -Ar https://deno.land/x/lume_cms_adapter/mod.ts --port=3001
```

### `--show-terminal`

Show the terminal output of the Lume build at the cold start:

```sh
deno serve -Ar https://deno.land/x/lume_cms_adapter/mod.ts --show-terminal
```
