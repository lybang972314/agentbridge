# MCP Gateway

> **One endpoint for all your AI agent tools.** Unified auth, rate limiting, and observability.
> Dual protocol: HTTP REST + MCP stdio.

AI agents fail not because they can't reason — they fail because tool integration is chaos: 5 APIs, 5 auth methods, 5 formats. MCP Gateway unifies this into a single proxy, so your agent focuses on reasoning while the gateway handles the plumbing.

## Quick Start

```bash
npm install
cp .env.example .env          # fill in your API keys

# HTTP mode (dashboard at http://localhost:3100)
npm run dev

# MCP mode (for Codex, Hermes, Claude Desktop)
npm run mcp
```

## Dual Protocol

| Mode | Command | Protocol | Use Case |
|------|---------|----------|----------|
| HTTP | `npm run dev` | REST API | Standalone proxy; dashboard at :3100 |
| MCP  | `npm run mcp` | MCP stdio  | Native integration with Codex, Hermes, Claude |

Both modes share the same tool registry and gateway logic. Define tools once, use them everywhere.

## Using with Codex

Already configured. If you need to re-add:

```toml
# ~/.codex/config.toml
[mcp_servers.mcp-gateway]
command = "/Users/lybang/Documents/赚钱/mcp-gateway/node_modules/.bin/tsx"
args = ["/Users/lybang/Documents/赚钱/mcp-gateway/src/mcp.ts"]
startup_timeout_sec = 30
```

Restart Codex, then ask: "Search GitHub for 'mcp gateway'" — the agent will discover and use the `github-search` tool through the gateway.

See [config-snippets.md](config-snippets.md) for Hermes and Claude Desktop config.

## How It Works

```
AI Agent → tools/call (MCP) → MCP Gateway → Upstream API
                  or
AI Agent → POST /gateway/:toolName (HTTP) → Gateway Server → Upstream API
                ↓
        unified auth / rate limit / logging
```

## Registering Tools

Tools are defined as JSON files in `/tools/`. Example:

```json
{
  "name": "github-search",
  "label": "GitHub Code Search",
  "description": "Search GitHub repositories",
  "base_url": "https://api.github.com",
  "endpoint": "/search/repositories?q=:query",
  "method": "GET",
  "auth": {
    "type": "bearer",
    "header_name": "Authorization",
    "prefix": "Bearer ",
    "source": "passthrough"
  },
  "rate_limit_rpm": 30,
  "enabled": true,
  "category": "Developer Tools"
}
```

### Auth Modes

- **env** — Credentials stored server-side in `.env`. Best for shared API keys.
- **passthrough** — Caller provides the credential with each request. Best for user-specific tokens.

## API Reference

| Endpoint | Description |
|----------|-------------|
| `POST /gateway/:toolName` | HTTP: proxy a tool call |
| `GET /health` | Health check |
| `GET /api/tools` | List all registered tools with metrics |
| `GET /api/stats` | Aggregate stats (success rate, P99, etc.) |
| `GET /api/logs` | Recent call logs |

## Monetization Leverage

Once agents route through the gateway, you own the control plane:

1. **Usage-based billing** — charge per call ($0.001–0.01), revenue scales with customer growth
2. **Tiered plans** — Free (3 tools, 100 calls/day) → Pro ($29/mo, unlimited) → Enterprise ($499/mo)
3. **Observability upsell** — Basic logging free; advanced tracing, alerting, and dashboards are paid
4. **Managed auth** — Store credentials server-side as a premium security feature
5. **Tool marketplace** — Curated tool packs for verticals, 30% revenue share

## Architecture

```
src/
  index.ts         — Fastify HTTP server entry
  mcp.ts           — MCP stdio server entry (for Codex/Hermes/Claude)
  gateway-core.ts  — Shared tool execution logic (used by both protocols)
  gateway.ts       — HTTP route handlers (thin wrapper around core)
  registry.ts      — Tool registry + metrics + rate limiting
  auth.ts          — Auth resolver (env / passthrough / custom)
  logger.ts        — Ring buffer logger + stats
  api.ts           — Dashboard data API routes
tools/             — Tool definition JSON files
public/            — Admin dashboard (single-page HTML, real-time)
```

## Next Steps (Post-MVP)

- [ ] Persistent storage (SQLite) for tool configs and logs
- [ ] OAuth 2.0 flow support
- [ ] Webhook callbacks for async tool results
- [ ] Usage-based billing integration (Stripe)
- [ ] Tool marketplace with one-click install
- [ ] Custom `input_schema` validation per tool
