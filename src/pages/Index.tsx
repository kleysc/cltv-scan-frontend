import { useState, useCallback } from 'react';
import { useSeoMeta } from '@unhead/react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TxAnalyzer } from '@/components/TxAnalyzer';
import { BlockExplorer } from '@/components/BlockExplorer';
import { SecurityScanner } from '@/components/SecurityScanner';
import { LightningDashboard } from '@/components/LightningDashboard';
import { MempoolMonitor } from '@/components/MempoolMonitor';

type TabId = 'tx-analyzer' | 'block-explorer' | 'security-scanner' | 'lightning-dashboard' | 'mempool-monitor';

const TABS: { value: TabId; label: string; hidden?: boolean }[] = [
  { value: 'tx-analyzer',       label: 'Transaction' },
  { value: 'block-explorer',    label: 'Block' },
  { value: 'security-scanner',  label: 'Security', hidden: true },
  { value: 'lightning-dashboard', label: 'Lightning' },
  { value: 'mempool-monitor',   label: 'Monitor' },
];

const VISIBLE_TABS = TABS.filter((t) => !t.hidden);

const Index = () => {
  useSeoMeta({
    title: 'cltv-scan — Bitcoin Timelock & Lightning Analysis',
    description: 'Analyze Bitcoin transactions for timelocks, Lightning Network patterns, and security vulnerabilities.',
  });

  const [activeTab, setActiveTab] = useState<TabId>('tx-analyzer');
  const [selectedTxid, setSelectedTxid] = useState<string | undefined>();
  const [headerSearch, setHeaderSearch] = useState('');

  const handleTxClick = useCallback((txid: string) => {
    setSelectedTxid(txid);
    setActiveTab('tx-analyzer');
  }, []);

  const handleHeaderSearch = useCallback(() => {
    const trimmed = headerSearch.trim();
    if (trimmed.length >= 32) {
      handleTxClick(trimmed);
      setHeaderSearch('');
    }
  }, [headerSearch, handleTxClick]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Header ── */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-[1200px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center shrink-0">
              <span className="font-mono text-xs font-bold text-background">CT</span>
            </div>
            <div>
              <div className="font-mono font-bold text-sm tracking-wide text-foreground">
                cltv-scan
              </div>
              <div className="font-mono text-[10px] text-muted-foreground tracking-wide">
                Bitcoin Timelock Security Analyzer
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search txid…"
                value={headerSearch}
                onChange={(e) => setHeaderSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleHeaderSearch()}
                className="w-72 bg-background border border-border rounded px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
              />
              <button
                onClick={handleHeaderSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs transition-colors"
                aria-label="Search"
              >
                ↵
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-[1200px] mx-auto px-6 py-5">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabId)}
          className="space-y-0"
        >
          <TabsList className={`w-full grid grid-cols-${VISIBLE_TABS.length} h-auto rounded-none border-b border-border bg-transparent p-0 gap-0`}>
            {VISIBLE_TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary py-2.5 font-mono text-xs font-medium text-muted-foreground hover:text-foreground transition-colors tracking-wide"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="tx-analyzer" className="mt-0 pt-5 focus-visible:ring-0 focus-visible:outline-none">
            <TxAnalyzer initialTxid={selectedTxid} />
          </TabsContent>

          <TabsContent value="block-explorer" className="mt-0 pt-5 focus-visible:ring-0 focus-visible:outline-none">
            <BlockExplorer onTxClick={handleTxClick} />
          </TabsContent>

          <TabsContent value="security-scanner" className="mt-0 pt-5 focus-visible:ring-0 focus-visible:outline-none">
            <SecurityScanner onTxClick={handleTxClick} />
          </TabsContent>

          <TabsContent value="lightning-dashboard" className="mt-0 pt-5 focus-visible:ring-0 focus-visible:outline-none">
            <LightningDashboard onTxClick={handleTxClick} />
          </TabsContent>

          <TabsContent value="mempool-monitor" className="mt-0 pt-5 focus-visible:ring-0 focus-visible:outline-none">
            <MempoolMonitor onTxClick={handleTxClick} />
          </TabsContent>
        </Tabs>
      </main>

      {/* ── Footer ── */}
      <footer className="mt-16 py-5 border-t border-border text-center">
        <p className="font-mono text-[11px] text-muted-foreground/50">
          Powered by{' '}
          <a
            href="https://shakespeare.diy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-muted-foreground transition-colors"
          >
            Shakespeare
          </a>
        </p>
      </footer>
    </div>
  );
};

export default Index;
