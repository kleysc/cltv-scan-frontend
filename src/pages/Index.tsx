import { useSeoMeta } from '@unhead/react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TxAnalyzer } from '@/components/TxAnalyzer';
import { BlockExplorer } from '@/components/BlockExplorer';
import { SecurityScanner } from '@/components/SecurityScanner';
import { LightningDashboard } from '@/components/LightningDashboard';
import { MempoolMonitor } from '@/components/MempoolMonitor';

const Index = () => {
  useSeoMeta({
    title: 'cltv-scan - Bitcoin Timelock & Lightning Analysis',
    description: 'Analyze Bitcoin transactions for timelocks, Lightning Network patterns, and security vulnerabilities.',
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-gray-100">
            cltv-scan
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Bitcoin Timelock & Lightning Network Analysis Tool
          </p>
        </div>

        <Tabs defaultValue="tx-analyzer" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="tx-analyzer">Transaction</TabsTrigger>
            <TabsTrigger value="block-explorer">Block</TabsTrigger>
            <TabsTrigger value="security-scanner">Security</TabsTrigger>
            <TabsTrigger value="lightning-dashboard">Lightning</TabsTrigger>
            <TabsTrigger value="mempool-monitor">Mempool</TabsTrigger>
          </TabsList>

          <TabsContent value="tx-analyzer">
            <TxAnalyzer />
          </TabsContent>

          <TabsContent value="block-explorer">
            <BlockExplorer />
          </TabsContent>

          <TabsContent value="security-scanner">
            <SecurityScanner />
          </TabsContent>

          <TabsContent value="lightning-dashboard">
            <LightningDashboard />
          </TabsContent>

          <TabsContent value="mempool-monitor">
            <MempoolMonitor />
          </TabsContent>
        </Tabs>

        <footer className="mt-16 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>
            Powered by{' '}
            <a 
              href="https://shakespeare.diy" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Shakespeare
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
