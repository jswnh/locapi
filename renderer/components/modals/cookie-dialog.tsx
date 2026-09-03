import { useState } from 'react';
import {
  Cookie as CookieIcon,
  Trash2,
  Plus,
  Globe,
  Lock,
  ShieldCheck,
  Check,
  Copy,
  AlertTriangle,
} from 'lucide-react';
import { useCookieStore } from '@/stores/cookie-store';
import { useSettingsStore } from '@/stores/settings-store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export function CookieDialog() {
  const {
    cookies,
    isCookieModalOpen,
    closeCookieModal,
    saveCookie,
    deleteCookie,
    clearCookies,
  } = useCookieStore();
  const disableCookies = useSettingsStore((s) => s.settings.disableCookies);

  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form fields for adding new cookie
  const [newDomain, setNewDomain] = useState('');
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newPath, setNewPath] = useState('/');

  // Extract unique domains
  const domainMap = new Map<string, typeof cookies>();
  for (const c of cookies) {
    const list = domainMap.get(c.domain) || [];
    list.push(c);
    domainMap.set(c.domain, list);
  }

  const domains = Array.from(domainMap.keys());
  const activeDomain = selectedDomain || domains[0] || '';
  const currentDomainCookies = domainMap.get(activeDomain) || [];

  const handleAddCookie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newValue.trim()) {
      toast.error('Cookie Name and Value are required');
      return;
    }

    const domainToUse = (newDomain.trim() || activeDomain || 'localhost').toLowerCase();

    try {
      await saveCookie({
        domain: domainToUse,
        path: newPath.trim() || '/',
        name: newName.trim(),
        value: newValue.trim(),
        expires: null,
        http_only: false,
        secure: false,
      });

      toast.success(`Cookie "${newName.trim()}" added to ${domainToUse}`);
      setSelectedDomain(domainToUse);
      setIsAdding(false);
      setNewName('');
      setNewValue('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add cookie');
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied cookie value');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Dialog open={isCookieModalOpen} onOpenChange={(open) => !open && closeCookieModal()}>
      <DialogContent className="sm:max-w-[720px] max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-border/70 select-none">
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <CookieIcon className="size-4 text-[#0275E2]" />
              <span>Manage Cookies (Cookie Jar)</span>
              {disableCookies && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold tracking-tight bg-amber-500/15 text-amber-500 border border-amber-500/30 uppercase">
                  Disabled
                </span>
              )}
            </DialogTitle>
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                setIsAdding(!isAdding);
                setNewDomain(activeDomain);
              }}
              className="h-7 text-xs gap-1.5 border-border/80 hover:border-[#0275E2]"
            >
              <Plus className="size-3 text-[#0275E2]" />
              Add Cookie
            </Button>
          </div>
        </DialogHeader>

        {/* Disabled State Banner */}
        {disableCookies && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center gap-2 text-xs text-amber-500 shrink-0">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>
              <strong>Cookie Store is disabled in Settings.</strong> Existing cookies will not be sent with requests, and incoming Set-Cookie headers will not be saved.
            </span>
          </div>
        )}

        {/* Add Cookie Form Panel */}
        {isAdding && (
          <form onSubmit={handleAddCookie} className="p-3.5 bg-muted/20 border-b border-border/70 space-y-2.5">
            <div className="text-xs font-semibold text-foreground/80">Add Cookie Manually</div>
            <div className="grid grid-cols-4 gap-2">
              <Input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="Domain (e.g. localhost)"
                className="h-7 text-xs font-mono bg-background"
              />
              <Input
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder="Path (e.g. /)"
                className="h-7 text-xs font-mono bg-background"
              />
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name"
                className="h-7 text-xs font-mono bg-background"
              />
              <Input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Value"
                className="h-7 text-xs font-mono bg-background"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setIsAdding(false)}
                className="h-6 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="xs"
                className="h-6 text-xs bg-[#0275E2] hover:bg-[#0275E2]/90 text-white"
              >
                Save to Jar
              </Button>
            </div>
          </form>
        )}

        {/* Main Content Split: Domain sidebar & Cookie list */}
        <div className="flex-1 flex overflow-hidden min-h-[320px]">
          {/* Domains Column */}
          <div className="w-48 border-r border-border/70 bg-card/30 flex flex-col shrink-0">
            <div className="p-2 border-b border-border/50 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Domains ({domains.length})
            </div>
            <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
              {domains.map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedDomain(d)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-mono flex items-center justify-between transition-colors ${
                    (selectedDomain || activeDomain) === d
                      ? 'bg-[#0275E2]/15 text-[#0275E2] font-semibold'
                      : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                  }`}
                >
                  <span className="truncate flex items-center gap-1.5">
                    <Globe className="size-3 shrink-0" />
                    {d}
                  </span>
                  <span className="text-[10px] opacity-70">
                    {domainMap.get(d)?.length || 0}
                  </span>
                </button>
              ))}

              {domains.length === 0 && (
                <div className="p-4 text-center text-xs text-muted-foreground/60 italic">
                  No domains with cookies yet.
                </div>
              )}
            </div>

            {domains.length > 0 && (
              <div className="p-2 border-t border-border/50">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    clearCookies();
                    toast.info('Cleared all cookies');
                  }}
                  className="w-full h-7 text-[11px] text-destructive hover:bg-destructive/10 gap-1"
                >
                  <Trash2 className="size-3" />
                  Clear All
                </Button>
              </div>
            )}
          </div>

          {/* Cookies in selected domain */}
          <div className="flex-1 flex flex-col overflow-hidden bg-background">
            <div className="p-2 border-b border-border/50 flex items-center justify-between bg-muted/10">
              <span className="text-xs font-mono text-foreground font-semibold flex items-center gap-1.5">
                <Globe className="size-3 text-[#0275E2]" />
                {activeDomain || 'No Domain Selected'}
              </span>

              {currentDomainCookies.length > 0 && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    clearCookies(activeDomain);
                    toast.info(`Cleared cookies for ${activeDomain}`);
                  }}
                  className="h-6 text-[10px] text-muted-foreground hover:text-destructive"
                >
                  Clear Domain
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {currentDomainCookies.map((c) => (
                <div
                  key={c.id}
                  className="p-2.5 rounded-lg border border-border/70 bg-card/40 space-y-1.5 text-xs font-mono"
                >
                  <div className="flex items-center justify-between pb-1 border-b border-border/40">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{c.name}</span>
                      <span className="text-[10px] text-muted-foreground">path: {c.path}</span>
                      {c.http_only && (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 text-[9px] border border-amber-500/20">
                          <Lock className="size-2.5" />
                          HttpOnly
                        </span>
                      )}
                      {c.secure && (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 text-[9px] border border-emerald-500/20">
                          <ShieldCheck className="size-2.5" />
                          Secure
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopy(c.id, c.value)}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        title="Copy value"
                      >
                        {copiedId === c.id ? (
                          <Check className="size-3 text-emerald-400" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          deleteCookie(c.id);
                          toast.info(`Deleted cookie "${c.name}"`);
                        }}
                        className="p-1 text-muted-foreground hover:text-destructive"
                        title="Delete cookie"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>

                  <div className="text-foreground/90 break-all select-text text-[11px] bg-background/50 p-1.5 rounded border border-border/40">
                    {c.value}
                  </div>

                  {c.expires && (
                    <div className="text-[10px] text-muted-foreground">
                      Expires: {new Date(c.expires).toUTCString()}
                    </div>
                  )}
                </div>
              ))}

              {currentDomainCookies.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground/60 py-12 text-xs">
                  <CookieIcon className="size-8 stroke-[1.2] mb-2 opacity-30 text-[#0275E2]" />
                  <p className="font-semibold text-foreground/70">No Cookies in Jar</p>
                  <p className="text-[11px] mt-0.5 max-w-[260px]">
                    Responses returning <code className="text-[#0275E2]">Set-Cookie</code> will automatically be stored here and sent on subsequent requests.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
