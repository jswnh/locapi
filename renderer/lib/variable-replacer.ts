import { v4 as uuidv4 } from 'uuid';

export const BUILT_IN_VARIABLES = [
  { key: '$uuid', description: 'Random UUID v4', example: 'd3b07384-d113-4631-9f93-5494d458c545' },
  { key: '$guid', description: 'Random GUID / UUID v4', example: 'd3b07384-d113-4631-9f93-5494d458c545' },
  { key: '$timestamp', description: 'Current Unix timestamp (seconds)', example: '1725321600' },
  { key: '$isoTimestamp', description: 'Current ISO 8601 timestamp', example: '2026-09-03T00:00:00.000Z' },
  { key: '$randomInt', description: 'Random integer between 1 and 1000', example: '442' },
];

export function replaceVariables(
  text: string,
  variables: { key: string; value: string; enabled: boolean }[] = []
): string {
  if (!text || typeof text !== 'string') return text || '';

  let result = text;

  // 1. Dynamic built-in variables
  result = result.replace(/{{\s*\$guid\s*}}/gi, () => uuidv4());
  result = result.replace(/{{\s*\$uuid\s*}}/gi, () => uuidv4());
  result = result.replace(/{{\s*\$timestamp\s*}}/gi, () => Math.floor(Date.now() / 1000).toString());
  result = result.replace(/{{\s*\$isoTimestamp\s*}}/gi, () => new Date().toISOString());
  result = result.replace(/{{\s*\$randomInt\s*}}/gi, () => Math.floor(Math.random() * 1000 + 1).toString());

  // 2. Custom environment variables
  if (variables && variables.length > 0) {
    for (const v of variables) {
      if (v.enabled && v.key) {
        const regex = new RegExp(`{{\\s*${escapeRegExp(v.key)}\\s*}}`, 'g');
        result = result.replace(regex, v.value);
      }
    }
  }

  return result;
}

export function extractVariables(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(/{{\s*([^{}]+?)\s*}}/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map((m) => m.replace(/[{}]/g, '').trim())));
}

export function getVariableResolutionStatus(
  text: string,
  variables: { key: string; value: string; enabled: boolean }[] = []
) {
  const found = extractVariables(text);
  if (found.length === 0) {
    return {
      hasVariables: false,
      resolvedText: text,
      resolvedVariables: [],
      unresolvedVariables: [],
    };
  }

  const enabledVarsMap = new Map<string, string>();
  for (const v of variables) {
    if (v.enabled && v.key) {
      enabledVarsMap.set(v.key, v.value);
    }
  }

  const builtInKeys = new Set(BUILT_IN_VARIABLES.map((b) => b.key.toLowerCase()));

  const resolvedVariables: { key: string; value: string }[] = [];
  const unresolvedVariables: string[] = [];

  for (const varName of found) {
    if (builtInKeys.has(varName.toLowerCase())) {
      resolvedVariables.push({ key: varName, value: '(Dynamic Built-in)' });
    } else if (enabledVarsMap.has(varName)) {
      resolvedVariables.push({ key: varName, value: enabledVarsMap.get(varName)! });
    } else {
      unresolvedVariables.push(varName);
    }
  }

  // Generate preview text (without generating random fresh UUID on each render)
  let resolvedText = text;
  for (const [k, val] of enabledVarsMap.entries()) {
    const regex = new RegExp(`{{\\s*${escapeRegExp(k)}\\s*}}`, 'g');
    resolvedText = resolvedText.replace(regex, val);
  }

  return {
    hasVariables: true,
    resolvedText,
    resolvedVariables,
    unresolvedVariables,
  };
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
