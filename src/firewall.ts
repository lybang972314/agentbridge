import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface SecurityRule {
  id: string;
  tool: string;
  description: string;
  condition: string;
  params: Record<string, any>;
  action: "block" | "warn";
  message: string;
}

interface FirewallCheck {
  blocked: boolean;
  rule_id?: string;
  message?: string;
}

let rules: SecurityRule[] = [];
const ipRateLimit = new Map<string, { count: number; windowStart: number }>();

export function loadFirewallRules(): number {
  try {
    const path = join(__dirname, "..", "tools", "security-rules.json");
    rules = JSON.parse(readFileSync(path, "utf-8"));
    return rules.length;
  } catch {
    return 0;
  }
}

export function checkFirewall(
  toolName: string,
  params: Record<string, unknown>,
  bodySize: number,
  callerIp: string
): FirewallCheck {
  for (const rule of rules) {
    // Check if rule applies to this tool
    if (rule.tool !== "*" && rule.tool !== toolName) continue;

    const result = evaluateRule(rule, toolName, params, bodySize, callerIp);
    if (result.blocked) return result;
  }
  return { blocked: false };
}

function evaluateRule(
  rule: SecurityRule,
  toolName: string,
  params: Record<string, unknown>,
  bodySize: number,
  callerIp: string
): FirewallCheck {
  switch (rule.condition) {
    case "rate_limit_per_ip": {
      const now = Date.now();
      const window = rule.params.window_seconds * 1000;
      let entry = ipRateLimit.get(callerIp);
      if (!entry || now - entry.windowStart > window) {
        entry = { count: 1, windowStart: now };
        ipRateLimit.set(callerIp, entry);
      } else {
        entry.count++;
      }
      if (entry.count > rule.params.max_calls) {
        return { blocked: true, rule_id: rule.id, message: rule.message };
      }
      return { blocked: false };
    }

    case "param_check": {
      const field = rule.params.field;
      const value = params[field];
      const op = rule.params.operator;
      const threshold = rule.params.value;

      if (op === "array_length_gt" && Array.isArray(value) && value.length > threshold) {
        return { blocked: true, rule_id: rule.id, message: rule.message };
      }
      return { blocked: false };
    }

    case "code_pattern": {
      const code = String(params.code || "");
      for (const pattern of rule.params.patterns) {
        if (code.includes(pattern)) {
          return { blocked: true, rule_id: rule.id, message: rule.message };
        }
      }
      return { blocked: false };
    }

    case "body_size": {
      if (bodySize > rule.params.max_bytes) {
        return { blocked: true, rule_id: rule.id, message: rule.message };
      }
      return { blocked: false };
    }

    case "param_pattern": {
      const bodyStr = JSON.stringify(params).toUpperCase();
      for (const pattern of rule.params.patterns) {
        if (bodyStr.includes(pattern.toUpperCase())) {
          return { blocked: true, rule_id: rule.id, message: rule.message };
        }
      }
      return { blocked: false };
    }

    default:
      return { blocked: false };
  }
}
