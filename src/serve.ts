console.log(Deno.cwd());

const { default: site } = await import(Deno.cwd() + "/_config.ts");
const { default: cms } = await import(Deno.cwd() + "/_cms.ts");

import adapter from "./adapter.ts";

export default await adapter({ site, cms });
