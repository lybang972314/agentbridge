# MCP Gateway — Promotion Plan & Content

## Posting Strategy

1. **Hacker News** — Show HN: launch post (highest signal for dev tools)
2. **IndieHackers** — Product launch + "how I built it" post
3. **Twitter/X** — Thread about the pain point + launch announcement
4. **Reddit** — r/SaaS, r/OpenAI, r/ClaudeAI (reply-first, then post)
5. **AI Discord communities** — MCP Discord, LangChain Discord, AutoGPT Discord

---

## 1. Hacker News — Show HN

### Title
Show HN: MCP Gateway — One endpoint for all your AI agent tools

### Body
I got tired of writing 5 different auth integrations every time I built an AI agent. GitHub uses Bearer tokens in headers, OpenWeather puts the key in query params, Resend wants it in Authorization — and they all return different error formats.

So I built MCP Gateway: a single proxy that normalizes all of this.

How it works:
- Define your tools as JSON (endpoint, auth type, params)
- Your agent calls ONE endpoint: POST /gateway/:toolName
- Gateway handles auth, rate limiting, error normalization, and logging
- Works via HTTP REST or native MCP protocol (Codex/Claude Desktop/Hermes)

Built in 2 weeks. Free tier available. Would love feedback from anyone building agents.

### Reply template (when someone asks about MCP support)
It supports both HTTP and native MCP stdio protocol. If you're using Codex or Claude Desktop, just add it to your MCP servers config and your agent discovers the tools automatically. Here's the config snippet: [link]

### Reply template (when someone asks "why not just use function calling?")
Function calling is great for simple cases. The problem starts when you have 10+ tools across 5+ services. Each one has different auth, rate limits, and error patterns. The gateway centralizes all that — your agent code stays clean, and you can add/remove tools without touching agent logic.

---

## 2. IndieHackers — Product Launch

### Title
I built an MCP Gateway to solve AI agent tool integration hell — $0 MRR, looking for feedback

### Body
After spending weeks on IndieHackers reading about AI agent failures (shoutout to the "3 months, 0 customers on Reddit" thread), one theme kept coming up:

AI agents don't fail because they can't reason. They fail because TOOL INTEGRATION IS A MESS.

Every API wants auth in a different place. Every service returns errors differently. Every tool needs its own rate limit logic.

So I built MCP Gateway — a single proxy layer that handles all of this:

- Define tools as JSON → Gateway normalizes everything
- Built-in rate limiting per tool (stop getting API-banned)
- Full call logging with P99 latency
- Works with Codex, Claude Desktop, Hermes (native MCP protocol)
- Free tier: 3 tools, 100 calls/day. Pro: $19/mo unlimited.

I'm at $0 MRR and would love brutal feedback from this community. What's missing? What would make you pay $19/mo for this?

---

## 3. Twitter/X — Launch Thread

### Tweet 1 (hook)
AI agents keep failing. Not because of bad reasoning — because tool integration is chaos.

5 APIs = 5 auth methods = 5 error formats.

I built something to fix this. 🧵

### Tweet 2 (the pain)
Every time I build an AI agent:
- GitHub: Bearer token in Authorization header
- OpenWeather: API key in query param
- Resend: Bearer in Authorization (but different format)
- OpenAI: Bearer in Authorization (another format)
- Stripe: Basic auth + secret key

That's 5 different auth implementations before the agent does anything useful.

### Tweet 3 (the solution)
MCP Gateway: One endpoint for all your agent tools.

Define tools as JSON. Your agent calls POST /gateway/:toolName. Gateway handles the rest.

→ Unified auth (env or passthrough)
→ Rate limiting per tool
→ Full call logging
→ Native MCP protocol support

### Tweet 4 (the offer)
Free tier: 3 tools, 100 calls/day — no credit card needed.
Pro: $19/mo, unlimited tools, 10K calls/day.

Built in 2 weeks. Looking for first users and feedback.

🔗 [link to landing page]

---

## 4. Reddit Replies (reply-first strategy)

### Target threads to reply to:
- r/SaaS: "What are you building this week?"
- r/OpenAI: "How do you manage tools in your agents?"
- r/ClaudeAI: "MCP server recommendations"
- r/artificial: "What's missing in the AI agent ecosystem?"

### Reply template (general):
I've been building AI agents and the tool integration part is always the worst. I ended up building MCP Gateway — it's a proxy that normalizes all your tool APIs behind one endpoint. Define tools as JSON, get unified auth, rate limiting, and logging for free. Works with Codex and Claude Desktop natively. Free tier available if you want to try it: [link]

### Reply template (MCP-specific):
If you're using Claude Desktop or Codex with MCP, I built a gateway that auto-discovers your tools via the MCP protocol. Just add the server config and all your registered tools show up in the agent. Saves writing MCP server wrappers for every API: [link]

---

## 5. AI Agent Discord Communities

### Post template:
Hey folks — I've been struggling with tool integration in my AI agents. Every API has different auth, different error formats, different rate limits. So I built MCP Gateway to solve this once and for all:

- Define tools as JSON, call via one endpoint
- Unified auth (API key, Bearer, custom header)
- Per-tool rate limiting
- Full observability (latency, errors, P99)

Free tier with 3 tools + 100 calls/day. Works natively with MCP protocol (Codex/Claude Desktop).

Would love feedback from this community — what's the #1 tool you'd want pre-integrated?

---

## Posting Schedule

| Day | Platform | Action |
|-----|----------|--------|
| Day 1 | Hacker News | Show HN post |
| Day 1 | Twitter | Launch thread |
| Day 1-2 | Reddit | Reply to 5+ relevant threads |
| Day 2 | IndieHackers | Product launch post |
| Day 2-3 | Discord | Post in 3+ AI agent communities |
| Day 5 | Hacker News | Reply to comments |
| Day 7 | All | Follow-up: "What we learned from first 100 users" |
