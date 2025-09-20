# LumeCMS adapter proxy

A simple proxy to run LumeCMS in a VPS easily on demand.

- This script opens a permanent server on the port `8000` (configurable).
- On the first request, the script runs `deno task lume --serve ...`. This
  initializes the Lume's dev server on the port `3000`.
- While the Lume's server is running, this script works as a reverse proxy,
  forwarding all the client's request to the Lume's server.
- After 2 hours of inactivity, the Lume's server is closed, waiting to be
  created again on the next request.

## Usage

Add this entry to your import map:

```json
{
  "imports": {
    "lume_cms_adapter": "https://deno.land/x/lume_cms_adapter@v0.3.0/mod.ts"
  }
}
```

In the Lume project, run `deno serve -A lume_cms_adapter`.

## Configuration

### `--port`

If the proxied server is in on a different port (by default is `3000`), you can
configure it with this option:

```sh
deno serve -A lume_cms_adapter --port=3001
```

### `--hostname`

If the proxied server is in on a different hostname (by default is `localhost`),
you can configure it with this option:

```sh
deno serve -A lume_cms_adapter --hostname=0.0.0.0
```

### `--show-terminal`

Show the terminal output of the Lume build at the cold start:

```sh
deno serve -A lume_cms_adapter --show-terminal
```
