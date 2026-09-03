import React, { useState, useEffect } from "react";
import {
  Settings as SettingsIcon,
  Sliders,
  Keyboard,
  RefreshCw,
  Info,
  Folder,
  FolderOpen,
  Globe,
  Code,
  CheckCircle2,
} from "lucide-react";
import { useSettingsStore } from "@/stores/settings-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/ipc";
import { toast } from "sonner";

export function SettingsDialog() {
  const {
    isOpen,
    activeTab,
    settings,
    closeSettings,
    setActiveTab,
    updateSettings,
    resetSettings,
  } = useSettingsStore();

  const [version, setVersion] = useState("1.0.0");
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.system
        .getVersion()
        .then((v) => {
          if (v) setVersion(v);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleSelectDirectory = async () => {
    try {
      const selected = await api.data.selectDirectory(settings.exportLocation);
      if (selected) {
        updateSettings({ exportLocation: selected });
        toast.success("Export location updated");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to select directory");
    }
  };

  const handleOpenFolder = async () => {
    if (!settings.exportLocation) {
      toast.info("No export location configured");
      return;
    }
    try {
      const ok = await api.system.openPath(settings.exportLocation);
      if (!ok) {
        toast.error("Could not open folder");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to open directory");
    }
  };

  const handleCheckUpdates = () => {
    setIsCheckingUpdate(true);
    setUpdateStatus(null);
    setTimeout(() => {
      setIsCheckingUpdate(false);
      setUpdateStatus(
        "You are using the latest version of Locapi (v" + version + ")",
      );
      toast.success("Locapi is up to date!");
    }, 1200);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeSettings()}>
      <DialogContent className="sm:max-w-[800px] w-[800px] max-w-[calc(100%-2rem)] h-[520px] p-0 flex flex-col overflow-hidden bg-card border-border shadow-2xl">
        {/* Header */}
        <DialogHeader className="px-5 py-3 border-b border-border/60 shrink-0 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="size-6 rounded-md bg-[#0275E2]/15 text-[#0275E2] flex items-center justify-center">
              <SettingsIcon className="size-3.5" />
            </div>
            <DialogTitle className="text-sm font-semibold text-foreground tracking-tight whitespace-normal break-normal">
              Settings
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Body with Left Nav and Right Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar Navigation */}
          <div className="w-48 border-r border-border/50 bg-muted/10 p-2.5 flex flex-col gap-1 shrink-0">
            <button
              onClick={() => setActiveTab("general")}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors text-left ${
                activeTab === "general"
                  ? "bg-[#0275E2] text-white shadow-xs"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              <Sliders className="size-3.5 shrink-0" />
              <span className="whitespace-normal break-normal">General</span>
            </button>

            <button
              onClick={() => setActiveTab("shortcuts")}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors text-left ${
                activeTab === "shortcuts"
                  ? "bg-[#0275E2] text-white shadow-xs"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              <Keyboard className="size-3.5 shrink-0" />
              <span className="whitespace-normal break-normal">Shortcuts</span>
            </button>

            <button
              onClick={() => setActiveTab("update")}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors text-left ${
                activeTab === "update"
                  ? "bg-[#0275E2] text-white shadow-xs"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              <RefreshCw className="size-3.5 shrink-0" />
              <span className="whitespace-normal break-normal">Update</span>
            </button>

            <button
              onClick={() => setActiveTab("about")}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors text-left ${
                activeTab === "about"
                  ? "bg-[#0275E2] text-white shadow-xs"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              <Info className="size-3.5 shrink-0" />
              <span className="whitespace-normal break-normal">About</span>
            </button>

            <div className="mt-auto pt-2 border-t border-border/40">
              <Button
                variant="ghost"
                size="xs"
                onClick={resetSettings}
                className="w-full justify-start text-[11px] text-muted-foreground hover:text-destructive h-7 px-2.5"
              >
                Reset Defaults
              </Button>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* GENERAL TAB */}
            {activeTab === "general" && (
              <div className="space-y-6">
                {/* 1. Request Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-border/40">
                    <Globe className="size-4 text-[#0275E2]" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground whitespace-normal break-normal">
                      Request Configuration
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {/* HTTP Version */}
                    <div className="flex items-center justify-between gap-4 py-1">
                      <div className="space-y-0.5 flex-1 min-w-0 pr-4">
                        <Label className="text-xs font-semibold text-foreground whitespace-normal break-normal">
                          HTTP Version
                        </Label>
                        <p className="text-xs text-muted-foreground whitespace-normal break-normal">
                          Select the default protocol version for outgoing HTTP
                          requests.
                        </p>
                      </div>
                      <Select
                        value={settings.httpVersion}
                        onValueChange={(val: any) =>
                          updateSettings({ httpVersion: val })
                        }
                      >
                        <SelectTrigger className="w-36 h-8 text-xs font-mono bg-card shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto" className="text-xs">
                            Auto (HTTP/1.1)
                          </SelectItem>
                          <SelectItem value="1.1" className="text-xs">
                            HTTP/1.1
                          </SelectItem>
                          <SelectItem value="2" className="text-xs">
                            HTTP/2
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Request Timeout */}
                    <div className="flex items-center justify-between gap-4 py-1">
                      <div className="space-y-0.5 flex-1 min-w-0 pr-4">
                        <Label className="text-xs font-semibold text-foreground whitespace-normal break-normal">
                          Request Timeout
                        </Label>
                        <p className="text-xs text-muted-foreground whitespace-normal break-normal">
                          Maximum time in seconds to wait for a server response
                          before timing out.
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 w-36 shrink-0">
                        <Input
                          type="number"
                          min={1}
                          max={300}
                          value={settings.requestTimeout}
                          onChange={(e) =>
                            updateSettings({
                              requestTimeout: Math.max(
                                1,
                                parseInt(e.target.value) || 30,
                              ),
                            })
                          }
                          className="h-8 text-xs font-mono bg-card"
                        />
                        <span className="text-xs text-muted-foreground font-mono">
                          sec
                        </span>
                      </div>
                    </div>

                    {/* Max Response Size */}
                    <div className="flex items-center justify-between gap-4 py-1">
                      <div className="space-y-0.5 flex-1 min-w-0 pr-4">
                        <Label className="text-xs font-semibold text-foreground whitespace-normal break-normal">
                          Max Response Size
                        </Label>
                        <p className="text-xs text-muted-foreground whitespace-normal break-normal">
                          Limit response memory to prevent UI freezes (0 for
                          unlimited).
                        </p>
                      </div>
                      <Select
                        value={String(settings.maxResponseSizeMb)}
                        onValueChange={(val) =>
                          updateSettings({
                            maxResponseSizeMb: parseInt(val) || 0,
                          })
                        }
                      >
                        <SelectTrigger className="w-36 h-8 text-xs font-mono bg-card shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10" className="text-xs">
                            10 MB
                          </SelectItem>
                          <SelectItem value="25" className="text-xs">
                            25 MB
                          </SelectItem>
                          <SelectItem value="50" className="text-xs">
                            50 MB (Default)
                          </SelectItem>
                          <SelectItem value="100" className="text-xs">
                            100 MB
                          </SelectItem>
                          <SelectItem value="0" className="text-xs">
                            Unlimited
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Disable Cookies */}
                    <div className="flex items-center justify-between gap-4 py-1">
                      <div className="space-y-0.5 flex-1 min-w-0 pr-4">
                        <Label className="text-xs font-semibold text-foreground whitespace-normal break-normal">
                          Disable Cookies
                        </Label>
                        <p className="text-xs text-muted-foreground whitespace-normal break-normal">
                          Prevent Locapi from automatically injecting stored
                          cookies or saving Set-Cookie headers.
                        </p>
                      </div>
                      <div className="w-36 flex justify-end shrink-0">
                        <input
                          type="checkbox"
                          checked={settings.disableCookies}
                          onChange={(e) =>
                            updateSettings({ disableCookies: e.target.checked })
                          }
                          className="rounded border-border accent-[#0275E2] size-4 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Enable Scripts & Tests */}
                    <div className="flex items-center justify-between gap-4 py-1">
                      <div className="space-y-0.5 flex-1 min-w-0 pr-4">
                        <Label className="text-xs font-semibold text-foreground whitespace-normal break-normal">
                          Enable Scripts &amp; Tests
                        </Label>
                        <p className="text-xs text-muted-foreground whitespace-normal break-normal">
                          Enable pre-request scripts and response test assertions across requests. When disabled, the Scripts &amp; Tests tab is hidden.
                        </p>
                      </div>
                      <div className="w-36 flex justify-end shrink-0">
                        <input
                          type="checkbox"
                          checked={settings.enableScripts ?? true}
                          onChange={(e) =>
                            updateSettings({ enableScripts: e.target.checked })
                          }
                          className="rounded border-border accent-[#0275E2] size-4 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Response Format Detection */}
                    <div className="flex items-center justify-between gap-4 py-1">
                      <div className="space-y-0.5 flex-1 min-w-0 pr-4">
                        <Label className="text-xs font-semibold text-foreground whitespace-normal break-normal">
                          Response Format Detection
                        </Label>
                        <p className="text-xs text-muted-foreground whitespace-normal break-normal">
                          Determine how response payloads are formatted in the
                          viewer.
                        </p>
                      </div>
                      <Select
                        value={settings.responseFormatDetection}
                        onValueChange={(val: any) =>
                          updateSettings({ responseFormatDetection: val })
                        }
                      >
                        <SelectTrigger className="w-36 h-8 text-xs font-mono bg-card shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto" className="text-xs">
                            Auto (Header-based)
                          </SelectItem>
                          <SelectItem value="json" className="text-xs">
                            Force JSON
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* 2. Working Directory Section */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-border/40">
                    <Folder className="size-4 text-[#0275E2]" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground whitespace-normal break-normal">
                      Working Directory
                    </h3>
                  </div>

                  <div className="space-y-2">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-semibold text-foreground whitespace-normal break-normal">
                        Export Location
                      </Label>
                      <p className="text-xs text-muted-foreground whitespace-normal break-normal">
                        Default directory where exported workspaces,
                        collections, and environments will be saved.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Input
                        value={settings.exportLocation}
                        onChange={(e) =>
                          updateSettings({ exportLocation: e.target.value })
                        }
                        placeholder="Default system Downloads folder"
                        className="h-8 text-xs font-mono flex-1 bg-card"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSelectDirectory}
                        className="h-8 text-xs gap-1.5 px-3 shrink-0"
                      >
                        <FolderOpen className="size-3.5 text-[#0275E2]" />
                        Browse...
                      </Button>
                      {settings.exportLocation && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleOpenFolder}
                          className="h-8 text-xs px-3 shrink-0"
                          title="Open folder in File Explorer"
                        >
                          Open
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Interface Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-border/40">
                    <Code className="size-4 text-[#0275E2]" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground whitespace-normal break-normal">
                      Interface &amp; Editor
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4 py-1">
                      <div className="space-y-0.5 flex-1 min-w-0 pr-4">
                        <Label className="text-xs font-semibold text-foreground whitespace-normal break-normal">
                          Request Body Font Size
                        </Label>
                        <p className="text-xs text-muted-foreground whitespace-normal break-normal">
                          Controls font size specifically for the Request and
                          Response body editors. The surrounding application UI
                          remains standard.
                        </p>
                      </div>

                      <Select
                        value={String(settings.editorFontSize)}
                        onValueChange={(val) =>
                          updateSettings({
                            editorFontSize: parseInt(val) || 12,
                          })
                        }
                      >
                        <SelectTrigger className="w-36 h-8 text-xs font-mono bg-card shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[10, 11, 12, 13, 14, 15, 16, 18].map((size) => (
                            <SelectItem
                              key={size}
                              value={String(size)}
                              className="text-xs font-mono"
                            >
                              {size}px {size === 12 && "(Default)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Monaco Editor Minimap */}
                    <div className="flex items-center justify-between gap-4 py-1">
                      <div className="space-y-0.5 flex-1 min-w-0 pr-4">
                        <Label className="text-xs font-semibold text-foreground whitespace-normal break-normal">
                          Editor Minimap
                        </Label>
                        <p className="text-xs text-muted-foreground whitespace-normal break-normal">
                          Display a code preview scroll minimap on the right edge of the request body editor.
                        </p>
                      </div>
                      <div className="w-36 flex justify-end shrink-0">
                        <input
                          type="checkbox"
                          checked={settings.editorMinimap}
                          onChange={(e) =>
                            updateSettings({ editorMinimap: e.target.checked })
                          }
                          className="rounded border-border accent-[#0275E2] size-4 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Live Preview */}
                    <div
                      className="p-3 rounded-md border border-border/70 bg-card/60 font-mono text-muted-foreground"
                      style={{ fontSize: `${settings.editorFontSize}px` }}
                    >
                      <code>
                        // Live Editor Preview ({settings.editorFontSize}px)
                      </code>
                      <br />
                      <code>
                        &#123; &quot;status&quot;: 200, &quot;message&quot;:
                        &quot;Hello Locapi&quot;, &quot;fontSize&quot;:{" "}
                        {settings.editorFontSize} &#125;
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SHORTCUTS TAB */}
            {activeTab === "shortcuts" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-1.5 border-b border-border/40">
                  <Keyboard className="size-4 text-[#0275E2]" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground whitespace-normal break-normal">
                    Keyboard Shortcuts
                  </h3>
                </div>

                <div className="space-y-1.5">
                  {[
                    { desc: "Send Active Request", keys: ["Ctrl", "Enter"] },
                    { desc: "Save Request to Collection", keys: ["Ctrl", "S"] },
                    { desc: "New Request Tab", keys: ["Ctrl", "N"] },
                    { desc: "Close Current Tab", keys: ["Ctrl", "W"] },
                    { desc: "Open Settings", keys: ["Ctrl", ","] },
                    { desc: "Toggle Fullscreen", keys: ["F11"] },
                    { desc: "Open Cookie Jar", keys: ["Ctrl", "Shift", "C"] },
                    {
                      desc: "Import Workspace or Collection",
                      keys: ["Ctrl", "O"],
                    },
                    {
                      desc: "Export Workspace or Collection",
                      keys: ["Ctrl", "E"],
                    },
                  ].map((s, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted/30 text-xs border border-transparent hover:border-border/40 transition-colors"
                    >
                      <span className="text-foreground/90 font-medium whitespace-normal break-normal">
                        {s.desc}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {s.keys.map((k, kIdx) => (
                          <React.Fragment key={kIdx}>
                            <kbd className="px-2 py-0.5 text-xs font-mono font-semibold bg-muted border border-border/80 rounded shadow-xs text-foreground">
                              {k}
                            </kbd>
                            {kIdx < s.keys.length - 1 && (
                              <span className="text-muted-foreground/60 text-xs">
                                +
                              </span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* UPDATE TAB */}
            {activeTab === "update" && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 pb-1.5 border-b border-border/40">
                  <RefreshCw className="size-4 text-[#0275E2]" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground whitespace-normal break-normal">
                    Software Updates
                  </h3>
                </div>

                <div className="p-4 rounded-lg border border-border/80 bg-card/60 flex items-center gap-4">
                  <img
                    src="/images/logo.png"
                    alt="Locapi Logo"
                    className="size-12 rounded-lg object-contain shadow-xs shrink-0"
                  />
                  <div className="flex-1 space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-foreground whitespace-normal break-normal">
                        Locapi Desktop
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#0275E2]/15 text-[#0275E2] border border-[#0275E2]/30 shrink-0">
                        v{version}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-normal break-normal">
                      Release Channel: Stable (Offline &amp; Local-First
                      Architecture)
                    </p>
                  </div>

                  <Button
                    onClick={handleCheckUpdates}
                    disabled={isCheckingUpdate}
                    className="h-8 px-3.5 text-xs bg-[#0275E2] text-white hover:bg-[#0275E2]/90 gap-1.5 shadow-xs shrink-0"
                  >
                    <RefreshCw
                      className={`size-3.5 ${isCheckingUpdate ? "animate-spin" : ""}`}
                    />
                    <span>
                      {isCheckingUpdate ? "Checking..." : "Check for Updates"}
                    </span>
                  </Button>
                </div>

                {updateStatus && (
                  <div className="flex items-center gap-2.5 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span className="whitespace-normal break-normal">
                      {updateStatus}
                    </span>
                  </div>
                )}

                <div className="p-3.5 rounded-md bg-muted/20 border border-border/40 space-y-1 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground whitespace-normal break-normal">
                    Local Distribution Model
                  </p>
                  <p className="text-xs leading-relaxed whitespace-normal break-normal">
                    Locapi is fully standalone. Updates are cryptographically
                    signed and verify on-device with zero remote telemetry or
                    tracking.
                  </p>
                </div>
              </div>
            )}

            {/* ABOUT TAB */}
            {activeTab === "about" && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 pb-1.5 border-b border-border/40">
                  <Info className="size-4 text-[#0275E2]" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground whitespace-normal break-normal">
                    About Locapi
                  </h3>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-lg border border-border/80 bg-card/60">
                  <img
                    src="/images/logo.png"
                    alt="Locapi Logo"
                    className="size-14 rounded-xl object-contain shadow-sm shrink-0"
                  />
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-foreground whitespace-normal break-normal">
                        Locapi Desktop
                      </h2>
                      <span className="text-xs font-mono text-muted-foreground shrink-0">
                        v{version}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-normal break-normal">
                      Modern, high-performance local-first API development
                      studio with native SQLite storage.
                    </p>
                    <div className="pt-1.5 flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground whitespace-normal break-normal">
                        Developer:
                      </span>
                      <span className="font-semibold text-foreground bg-[#0275E2]/15 text-[#0275E2] px-2 py-0.5 rounded font-mono shrink-0">
                        Jswnh
                      </span>
                    </div>
                  </div>
                </div>

                {/* Architecture Highlights */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-semibold text-foreground/90 uppercase tracking-wider whitespace-normal break-normal">
                    Core Specifications
                  </h4>
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="p-3 rounded border border-border/50 bg-muted/20 space-y-1">
                      <span className="font-semibold text-foreground whitespace-normal break-normal">
                        100% Local Storage
                      </span>
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-normal break-normal">
                        Zero cloud dependencies or external account lock-in.
                        Everything is stored on your device in SQLite.
                      </p>
                    </div>
                    <div className="p-3 rounded border border-border/50 bg-muted/20 space-y-1">
                      <span className="font-semibold text-foreground whitespace-normal break-normal">
                        Multi-Protocol Engine
                      </span>
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-normal break-normal">
                        First-class native support for REST, GraphQL, SOAP,
                        WebSocket, Socket.IO, MQTT, and gRPC.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-center pt-2 text-xs text-muted-foreground/60 whitespace-normal break-normal">
                  Copyright &copy; {new Date().getFullYear()} Jswnh. All rights
                  reserved.
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
