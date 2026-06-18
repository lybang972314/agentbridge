# AgentBridge — Configuration Snippets

Add the gateway as an MCP server to your AI agent. Pick your platform:

## Codex (~/.codex/config.toml)

```toml
[mcp_servers.agentbridge]
command = "/Users/lybang/Documents/赚钱/agentbridge/node_modules/.bin/tsx"
args = ["/Users/lybang/Documents/赚钱/agentbridge/src/mcp.ts"]
startup_timeout_sec = 30
```

## Claude Desktop (claude_desktop_config.json)

```json
{
  "mcpServers": {
    "agentbridge": {
      "command": "npx",
      "args": ["tsx", "/Users/lybang/Documents/赚钱/agentbridge/src/mcp.ts"]
    }
  }
}
```

## Hermes

Hermes uses the same MCP stdio protocol. Configure it with:
- Command: `/Users/lybang/Documents/赚钱/agentbridge/node_modules/.bin/tsx`
- Args: `/Users/lybang/Documents/赚钱/agentbridge/src/mcp.ts`

## Verification

After adding the config and restarting your agent, ask it:
> "List your available tools"

The gateway's 4 enabled tools (github-search, weather-current, send-email, ai-chat) should appear alongside your agent's built-in tools.

Test a call:
> "Search GitHub for 'mcp gateway'"

The agent will use the `github-search` tool through the gateway.
