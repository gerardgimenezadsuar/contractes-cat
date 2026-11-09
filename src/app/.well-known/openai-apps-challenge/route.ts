// Domain verification for the OpenAI (ChatGPT / Codex) plugin directory.
// The portal issues a token; set it as OPENAI_APPS_CHALLENGE in Vercel and
// redeploy. The response must be the bare token as plain text.
export const dynamic = "force-dynamic";

export function GET() {
  const token = process.env.OPENAI_APPS_CHALLENGE?.trim();
  if (!token) return new Response("Not found", { status: 404 });
  return new Response(token, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
