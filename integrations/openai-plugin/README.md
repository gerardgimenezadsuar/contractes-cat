# contractes.cat plugin for ChatGPT and Codex

Package for the OpenAI plugin directory (https://platform.openai.com/plugins → Create plugin → upload ZIP).
It points to the public MCP server at https://www.contractes.cat/api/mcp (no auth).

Build the ZIP (files must sit at the ZIP root):

```sh
cd integrations/openai-plugin && rm -f ../contractes-cat-plugin.zip && zip -r ../contractes-cat-plugin.zip plugin.json mcp.json assets
```

Before submitting:

- Domain verification: put the portal's token in the Vercel env var `OPENAI_APPS_CHALLENGE`
  (Production) and redeploy; it is served at `/.well-known/openai-apps-challenge`.
- Demo video: add the reviewer-accessible recording URL in the dashboard (Review details),
  or as `review.demo_recording_url` in `plugin.json`.
- `category` must match a dashboard category title; change it if the portal flags it.
