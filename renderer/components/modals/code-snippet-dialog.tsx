import { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Code2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CodeEditor } from '@/components/editor/code-editor';
import { ApiRequest } from '@/types/db';
import { useEnvStore } from '@/stores/env-store';
import { replaceVariables } from '@/lib/variable-replacer';
import { toast } from 'sonner';

type CodeTarget =
  | 'curl'
  | 'fetch'
  | 'axios'
  | 'python'
  | 'go'
  | 'nodejs'
  | 'rust'
  | 'php';

interface CodeSnippetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: ApiRequest;
}

export function CodeSnippetDialog({
  open,
  onOpenChange,
  request,
}: CodeSnippetDialogProps) {
  const [target, setTarget] = useState<CodeTarget>('curl');
  const [resolveVars, setResolveVars] = useState(true);
  const [copied, setCopied] = useState(false);

  const { environments, activeEnvironmentId } = useEnvStore();
  const activeEnv = environments.find((e) => e.id === activeEnvironmentId);
  const vars = useMemo(
    () => (activeEnv ? activeEnv.variables : []),
    [activeEnv]
  );

  const snippet = useMemo(() => {
    // Optionally resolve variables
    const rawUrl = request.url || 'https://api.example.com';
    const effectiveUrl = resolveVars ? replaceVariables(rawUrl, vars) : rawUrl;

    const enabledHeaders = request.headers.filter((h) => h.enabled && h.key);
    const headersObj: Record<string, string> = {};
    enabledHeaders.forEach((h) => {
      headersObj[resolveVars ? replaceVariables(h.key, vars) : h.key] =
        resolveVars ? replaceVariables(h.value, vars) : h.value;
    });

    // Add Auth headers if needed
    if (request.auth.type === 'bearer' && request.auth.bearer?.token) {
      const token = resolveVars
        ? replaceVariables(request.auth.bearer.token, vars)
        : request.auth.bearer.token;
      headersObj['Authorization'] = `Bearer ${token}`;
    } else if (request.auth.type === 'basic' && request.auth.basic?.username) {
      const u = resolveVars
        ? replaceVariables(request.auth.basic.username, vars)
        : request.auth.basic.username;
      const p = resolveVars
        ? replaceVariables(request.auth.basic.password || '', vars)
        : request.auth.basic.password || '';
      const b64 = btoa(`${u}:${p}`);
      headersObj['Authorization'] = `Basic ${b64}`;
    }

    // Body
    let bodyStr = '';
    if (request.body.type === 'json' || request.body.type === 'raw' || request.body.type === 'xml') {
      bodyStr = resolveVars ? replaceVariables(request.body.raw || '', vars) : request.body.raw || '';
    } else if (request.body.type === 'graphql' && request.body.graphql) {
      const q = resolveVars ? replaceVariables(request.body.graphql.query, vars) : request.body.graphql.query;
      bodyStr = JSON.stringify({ query: q });
    }

    switch (target) {
      case 'curl': {
        const parts = [`curl --request ${request.method} \\\n  --url '${effectiveUrl}'`];
        for (const [k, v] of Object.entries(headersObj)) {
          parts.push(`  --header '${k}: ${v}'`);
        }
        if (bodyStr && request.method !== 'GET' && request.method !== 'HEAD') {
          const escaped = bodyStr.replace(/'/g, "'\\''");
          parts.push(`  --data '${escaped}'`);
        }
        return parts.join(' \\\n');
      }

      case 'fetch': {
        const options: any = {
          method: request.method,
        };
        if (Object.keys(headersObj).length > 0) {
          options.headers = headersObj;
        }
        if (bodyStr && request.method !== 'GET' && request.method !== 'HEAD') {
          options.body = bodyStr;
        }
        return `const response = await fetch("${effectiveUrl}", ${JSON.stringify(options, null, 2)});\nconst data = await response.json();\nconsole.log(data);`;
      }

      case 'axios': {
        return `import axios from 'axios';\n\nconst response = await axios({\n  method: '${request.method.toLowerCase()}',\n  url: '${effectiveUrl}',\n  headers: ${JSON.stringify(headersObj, null, 4)},\n${bodyStr && request.method !== 'GET' ? `  data: ${bodyStr},\n` : ''}});\n\nconsole.log(response.data);`;
      }

      case 'python': {
        const lines = [`import requests\n`, `url = "${effectiveUrl}"\n`];
        if (Object.keys(headersObj).length > 0) {
          lines.push(`headers = ${JSON.stringify(headersObj, null, 4)}\n`);
        }
        if (bodyStr && request.method !== 'GET') {
          lines.push(`payload = """${bodyStr}"""\n`);
        }
        const callArgs = ['url'];
        if (Object.keys(headersObj).length > 0) callArgs.push('headers=headers');
        if (bodyStr && request.method !== 'GET') callArgs.push('data=payload');

        lines.push(`response = requests.${request.method.toLowerCase()}(${callArgs.join(', ')})\n`);
        lines.push(`print(response.status_code)\nprint(response.text)`);
        return lines.join('');
      }

      case 'go': {
        return `package main\n\nimport (\n\t"fmt"\n\t"net/http"\n\t"io"\n${bodyStr ? '\t"strings"\n' : ''})\n\nfunc main() {\n\turl := "${effectiveUrl}"\n\tclient := &http.Client{}\n\n\treq, err := http.NewRequest("${request.method}", url, ${bodyStr ? `strings.NewReader(\`${bodyStr}\`)` : 'nil'})\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\n${Object.entries(headersObj).map(([k, v]) => `\treq.Header.Set("${k}", "${v}")`).join('\n')}\n\n\tres, err := client.Do(req)\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tdefer res.Body.Close()\n\n\tbody, _ := io.ReadAll(res.Body)\n\tfmt.Println(string(body))\n}`;
      }

      case 'nodejs': {
        return `const https = require('https');\n\nconst url = new URL("${effectiveUrl}");\n\nconst options = {\n  hostname: url.hostname,\n  port: url.port || 443,\n  path: url.pathname + url.search,\n  method: '${request.method}',\n  headers: ${JSON.stringify(headersObj, null, 4)}\n};\n\nconst req = https.request(options, (res) => {\n  let chunks = [];\n  res.on('data', (d) => chunks.push(d));\n  res.on('end', () => {\n    const body = Buffer.concat(chunks).toString();\n    console.log(body);\n  });\n});\n\nreq.on('error', (e) => console.error(e));\n${bodyStr ? `req.write(${JSON.stringify(bodyStr)});\n` : ''}req.end();`;
      }

      case 'rust': {
        return `use reqwest::header;\n\n#[tokio::main]\nasync fn main() -> Result<(), Box<dyn std::error::Error>> {\n    let client = reqwest::Client::new();\n    let res = client.${request.method.toLowerCase()}("${effectiveUrl}")\n${Object.entries(headersObj).map(([k, v]) => `        .header("${k}", "${v}")`).join('\n')}\n${bodyStr ? `        .body(\`${bodyStr}\`)\n` : ''}        .send()\n        .await?;\n\n    let body = res.text().await?;\n    println!("{}", body);\n    Ok(())\n}`;
      }

      case 'php': {
        return `<?php\n\n$curl = curl_init();\n\ncurl_setopt_array($curl, array(\n  CURLOPT_URL => '${effectiveUrl}',\n  CURLOPT_RETURNTRANSFER => true,\n  CURLOPT_CUSTOMREQUEST => '${request.method}',\n${bodyStr ? `  CURLOPT_POSTFIELDS => '${bodyStr.replace(/'/g, "\\'")}',\n` : ''}  CURLOPT_HTTPHEADER => array(\n${Object.entries(headersObj).map(([k, v]) => `    '${k}: ${v}'`).join(',\n')}\n  ),\n));\n\n$response = curl_exec($curl);\ncurl_close($curl);\necho $response;`;
      }

      default:
        return '';
    }
  }, [request, target, resolveVars, vars]);

  const editorLang = useMemo(() => {
    switch (target) {
      case 'curl':
        return 'plaintext';
      case 'fetch':
      case 'axios':
      case 'nodejs':
        return 'javascript';
      case 'python':
        return 'plaintext';
      case 'go':
      case 'rust':
      case 'php':
        return 'plaintext';
      default:
        return 'plaintext';
    }
  }, [target]);

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    toast.success('Snippet copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] h-[520px] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-3.5 border-b border-border/50 shrink-0">
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Code2 className="size-4 text-[#0275E2]" />
              <span>Generate Code Snippet</span>
            </DialogTitle>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={resolveVars}
                  onChange={(e) => setResolveVars(e.target.checked)}
                  className="rounded border-border size-3.5 text-[#0275E2]"
                />
                <span>Resolve variables</span>
              </label>

              <Button
                variant="outline"
                size="xs"
                onClick={handleCopy}
                className="h-7 px-2.5 text-xs gap-1.5 border-border hover:border-[#0275E2]/50 hover:text-[#0275E2]"
              >
                {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Language targets bar */}
        <div className="flex items-center px-3 py-1.5 border-b border-border/40 bg-muted/20 gap-1 shrink-0 overflow-x-auto scrollbar-none">
          {[
            { id: 'curl', label: 'cURL' },
            { id: 'fetch', label: 'JavaScript (Fetch)' },
            { id: 'axios', label: 'Axios' },
            { id: 'python', label: 'Python (requests)' },
            { id: 'go', label: 'Go' },
            { id: 'nodejs', label: 'Node.js' },
            { id: 'rust', label: 'Rust' },
            { id: 'php', label: 'PHP' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTarget(t.id as CodeTarget)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors shrink-0 ${
                target === t.id
                  ? 'bg-background text-[#0275E2] shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Monaco Editor preview */}
        <div className="flex-1 p-2 overflow-hidden">
          <CodeEditor
            value={snippet}
            readOnly={true}
            language={editorLang}
            className="border-none rounded-none"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
