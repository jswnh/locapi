import React from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useSettingsStore } from "@/stores/settings-store";
import { useEnvStore } from "@/stores/env-store";
import { BUILT_IN_VARIABLES } from "@/lib/variable-replacer";
import { Loader2 } from "lucide-react";

// Dynamic import with SSR disabled for safe Next.js rendering
const Monaco = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 h-full w-full flex items-center justify-center gap-2 text-xs text-muted-foreground font-mono bg-card/20">
      <Loader2 className="size-3.5 animate-spin text-[#0275E2]" />
      <span>Loading editor...</span>
    </div>
  ),
});

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  className?: string;
}

export function CodeEditor({
  value,
  onChange,
  language = "json",
  readOnly = false,
  className = "",
}: CodeEditorProps) {
  const { theme } = useTheme();
  const editorFontSize = useSettingsStore((s) => s.settings.editorFontSize);
  const editorMinimap = useSettingsStore((s) => s.settings.editorMinimap);

  // Map request body types to Monaco supported languages
  const monacoLanguage = React.useMemo(() => {
    switch (language.toLowerCase()) {
      case "json":
        return "json";
      case "javascript":
      case "js":
        return "javascript";
      case "xml":
      case "soap":
        return "xml";
      case "graphql":
      case "gql":
        return "graphql";
      case "html":
        return "html";
      default:
        return "plaintext";
    }
  }, [language]);

  // Register Monaco themes with seamless transparent backgrounds and variable completions
  const handleBeforeMount = React.useCallback((monaco: any) => {
    // Define custom themes that blend into the app background
    monaco.editor.defineTheme('locapi-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#00000000',
        'editorGutter.background': '#00000000',
        'minimap.background': '#00000000',
        'editor.lineHighlightBackground': '#ffffff05',
        'editorLineNumber.foreground': '#71717a55',
        'editorLineNumber.activeForeground': '#a1a1aa',
      },
    });

    monaco.editor.defineTheme('locapi-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#00000000',
        'editorGutter.background': '#00000000',
        'minimap.background': '#00000000',
        'editor.lineHighlightBackground': '#00000005',
        'editorLineNumber.foreground': '#a1a1aa66',
        'editorLineNumber.activeForeground': '#71717a',
      },
    });

    if ((monaco as any).__locapi_var_provider_registered) return;
    (monaco as any).__locapi_var_provider_registered = true;

    const languages = ["json", "javascript", "xml", "graphql", "plaintext", "html"];
    languages.forEach((lang) => {
      monaco.languages.registerCompletionItemProvider(lang, {
        triggerCharacters: ["{"],
        provideCompletionItems: (model: any, position: any) => {
          const textUntilPosition = model.getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          });

          const isDoubleBrace = textUntilPosition.endsWith("{{");
          const isSingleBrace = textUntilPosition.endsWith("{");

          if (!isDoubleBrace && !isSingleBrace) {
            return { suggestions: [] };
          }

          const envState = useEnvStore.getState();
          const activeEnv = envState.environments.find(
            (e) => e.id === envState.activeEnvironmentId
          );
          const currentVars =
            activeEnv?.variables.filter((v) => v.enabled && v.key.trim()) || [];

          const suggestions: any[] = [];

          // Environment Variables
          currentVars.forEach((v) => {
            suggestions.push({
              label: `{{${v.key}}}`,
              kind: monaco.languages.CompletionItemKind.Variable,
              insertText: isDoubleBrace ? `${v.key}}}` : `{${v.key}}}`,
              detail: `Variable = "${v.value}"`,
              documentation: `Environment: ${activeEnv?.name || "Active"} | Value: ${v.value}`,
            });
          });

          // Dynamic Built-in Variables
          BUILT_IN_VARIABLES.forEach((b) => {
            suggestions.push({
              label: `{{${b.key}}}`,
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: isDoubleBrace ? `${b.key}}}` : `{${b.key}}}`,
              detail: b.description,
              documentation: `Dynamic Built-in (e.g. ${b.example})`,
            });
          });

          return { suggestions };
        },
      });
    });
  }, []);

  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-transparent ${className}`}
    >
      <Monaco
        height="100%"
        width="100%"
        language={monacoLanguage}
        value={value}
        onChange={(val) => onChange?.(val || "")}
        beforeMount={handleBeforeMount}
        theme={theme === "light" ? "locapi-light" : "locapi-dark"}
        options={{
          fontSize: editorFontSize || 12,
          fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
          minimap: { enabled: Boolean(editorMinimap) },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: "on",
          lineNumbers: "on",
          lineNumbersMinChars: 3,
          folding: true,
          readOnly,
          renderLineHighlight: "none",
          overviewRulerBorder: false,
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          glyphMargin: false,
          formatOnPaste: true,
          padding: { top: 8, bottom: 8 },
        }}
      />
    </div>
  );
}
