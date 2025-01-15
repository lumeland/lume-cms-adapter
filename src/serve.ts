const { default: site } = await import(Deno.cwd() + "/_config.ts");
const { default: cms } = await import(Deno.cwd() + "/_cms.ts");
console.log(Deno.cwd());
import adapter from "./adapter.ts";

export default await adapter({ site, cms });
