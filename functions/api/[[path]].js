// Cloudflare Pages Function: same-origin API passthrough.
// Environment variable in Pages: NICESV_API_ORIGIN = https://niceshot-api.matiasboy289.workers.dev
// Uses a fixed allowlisted origin to avoid an open proxy.
const FALLBACK_ORIGIN = "https://niceshot-api.matiasboy289.workers.dev";
export async function onRequest(context) {
  const origin = context.env.NICESV_API_ORIGIN || FALLBACK_ORIGIN;
  if (origin !== FALLBACK_ORIGIN) return new Response("API origin not allowed", { status: 500 });
  const from = new URL(context.request.url);
  const target = new URL(from.pathname + from.search, origin);
  const request = new Request(target.toString(), context.request);
  const response = await fetch(request);
  return response;
}
