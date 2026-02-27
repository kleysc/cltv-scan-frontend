import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { api, ApiError } from '@/lib/api';
import type { BlockAnalysisResponse, TxAnalysisResponse } from '@/types/api';

export function BlockExplorer() {
  const [height, setHeight] = useState('');
  const [filter, setFilter] = useState<'timelocks' | 'alerts' | 'all'>('timelocks');
  const [limit, setLimit] = useState('100');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BlockAnalysisResponse | null>(null);
  const [expandedTxs, setExpandedTxs] = useState<Set<string>>(new Set());

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const heightNum = parseInt(height, 10);
    const limitNum = parseInt(limit, 10);

    if (!heightNum || heightNum < 0) return;

    setLoading(true);
    setError(null);
    setData(null);
    setExpandedTxs(new Set());

    try {
      const result = await api.getBlock(heightNum, {
        filter,
        offset: 0,
        limit: limitNum || 100,
      });
      setData(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleTx = (txid: string) => {
    setExpandedTxs((prev) => {
      const next = new Set(prev);
      if (next.has(txid)) {
        next.delete(txid);
      } else {
        next.add(txid);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Block Explorer</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleScan} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Block Height</label>
                <Input
                  data-testid="block-height"
                  type="number"
                  placeholder="Block height"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Filter</label>
                <Select value={filter} onValueChange={(v) => setFilter(v as 'timelocks' | 'alerts' | 'all')}>
                  <SelectTrigger data-testid="block-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="timelocks">Timelocks</SelectItem>
                    <SelectItem value="alerts">Alerts</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Limit</label>
                <Input
                  data-testid="block-limit"
                  type="number"
                  placeholder="Limit"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
            <Button data-testid="scan-block-btn" type="submit" disabled={loading || !height}>
              {loading ? 'Scanning...' : 'Scan Block'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" data-testid="block-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {data && (
        <Card>
          <CardHeader>
            <CardTitle>Block {data.height}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">Total Transactions: </span>
                <span data-testid="block-total" className="font-mono">{data.total_transactions}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Returned: </span>
                <span data-testid="block-returned" className="font-mono">{data.returned_transactions}</span>
              </div>
            </div>

            {data.transactions.length === 0 ? (
              <div className="text-sm text-muted-foreground">No transactions match the selected filter</div>
            ) : (
              <div className="space-y-2">
                {data.transactions.map((tx: TxAnalysisResponse) => (
                  <Collapsible key={tx.timelock.txid} open={expandedTxs.has(tx.timelock.txid)}>
                    <Card>
                      <CollapsibleTrigger
                        data-testid="tx-row"
                        className="w-full"
                        onClick={() => toggleTx(tx.timelock.txid)}
                      >
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="font-mono text-sm truncate">{tx.timelock.txid}</div>
                            <div className="flex items-center gap-2 text-xs">
                              {tx.alerts.length > 0 && (
                                <span className="bg-red-100 text-red-800 px-2 py-1 rounded">
                                  {tx.alerts.length} alerts
                                </span>
                              )}
                              {tx.lightning.tx_type && (
                                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  ⚡ {tx.lightning.tx_type}
                                </span>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="space-y-3 pt-0">
                          <div className="border-t pt-3">
                            <div className="text-sm font-semibold mb-2">Timelock Info</div>
                            <div className="text-xs space-y-1">
                              <div>nLocktime: {tx.timelock.nlocktime.human_readable}</div>
                              {tx.timelock.sequences.length > 0 && (
                                <div>Sequences: {tx.timelock.sequences.length} inputs</div>
                              )}
                              {tx.timelock.script_timelocks.length > 0 && (
                                <div>Script Timelocks: {tx.timelock.script_timelocks.length}</div>
                              )}
                            </div>
                          </div>

                          {tx.lightning.tx_type && (
                            <div className="border-t pt-3">
                              <div className="text-sm font-semibold mb-2">Lightning</div>
                              <div className="text-xs space-y-1">
                                <div>Type: {tx.lightning.tx_type}</div>
                                <div>Confidence: {tx.lightning.confidence}</div>
                              </div>
                            </div>
                          )}

                          {tx.alerts.length > 0 && (
                            <div className="border-t pt-3">
                              <div className="text-sm font-semibold mb-2">Alerts</div>
                              <div className="space-y-1">
                                {tx.alerts.map((alert) => (
                                  <div key={alert.id} className="text-xs p-2 bg-red-50 rounded">
                                    <div className="font-bold uppercase">{alert.severity}</div>
                                    <div>{alert.description}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
