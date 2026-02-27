# cltv-scan Frontend Implementation

## Overview
This is a React + TypeScript frontend for the cltv-scan Rust/Axum backend API. It provides 5 tabs to analyze Bitcoin transactions, blocks, security alerts, Lightning Network activity, and real-time mempool monitoring.

## Architecture

### API Client (`src/lib/api.ts`)
- Typed API client with methods for all 5 endpoints
- Error handling with custom `ApiError` class
- Configurable via `VITE_API_URL` environment variable
- Default: `http://localhost:3001`

### TypeScript Types (`src/types/api.ts`)
Complete type definitions for:
- Transaction timelock analysis
- Lightning classification
- Security alerts (4 detection types)
- Block analysis responses
- Scan results
- Lightning statistics
- SSE monitor events

### Components

#### 1. Transaction Analyzer (`src/components/TxAnalyzer.tsx`)
**Endpoint:** `GET /api/tx/:txid`

**Test IDs:**
- `txid-input` - Transaction ID input field
- `analyze-btn` - Submit button
- `tx-txid` - Displays analyzed txid
- `nlocktime-value` - Shows nLocktime value
- `nlocktime-enforced` - Shows if enforced/disabled
- `sequences-list` - Notable sequence values
- `script-timelocks-list` - CLTV/CSV timelocks
- `ln-type` - Lightning tx type
- `ln-confidence` - Lightning confidence level
- `alerts-count` - Number of alerts
- `alert-item` - Individual alert (multiple)
- `critical-banner` - Critical alert warning
- `tx-error` - Error message

**Features:**
- Analyzes single transactions by txid
- Displays timelock information (nLocktime, sequences, script timelocks)
- Shows Lightning Network classification
- Lists security alerts with severity highlighting
- Critical alert banner for urgent issues

#### 2. Block Explorer (`src/components/BlockExplorer.tsx`)
**Endpoint:** `GET /api/block/:height?filter=timelocks|alerts|all&offset=N&limit=N`

**Test IDs:**
- `block-height` - Block height input
- `block-filter` - Filter dropdown (timelocks/alerts/all)
- `block-limit` - Result limit input
- `scan-block-btn` - Submit button
- `block-total` - Total transactions count
- `block-returned` - Returned transactions count
- `tx-row` - Transaction row (collapsible, multiple)
- `block-error` - Error message

**Features:**
- Scans entire blocks for transactions
- Filters by timelocks, alerts, or all
- Collapsible transaction details
- Shows alerts and Lightning info per tx
- Configurable result limit

#### 3. Security Scanner (`src/components/SecurityScanner.tsx`)
**Endpoint:** `GET /api/scan?start=N&end=N&severity=...&detection_type=...`

**Test IDs:**
- `scan-start` - Start block height
- `scan-end` - End block height (optional)
- `scan-severity` - Severity filter dropdown
- `scan-detection-type` - Detection type filter
- `scan-btn` - Submit button
- `scan-total` - Total alerts count
- `scan-critical-count` - Critical alerts
- `scan-warning-count` - Warning alerts
- `scan-info-count` - Informational alerts
- `scan-current-tip` - Current blockchain tip
- `alert-item` - Individual alert (multiple)
- `clustering-detail` - HTLC clustering details
- `cltv-detail` - Short CLTV delta details
- `scan-error` - Error message

**Features:**
- Scans block ranges for security alerts
- Filters by severity (critical/warning/informational)
- Filters by detection type (timelock_mixing, short_cltv_delta, htlc_clustering, anomalous_sequence)
- Displays statistics and detailed alert information
- Shows references to academic papers/research

#### 4. Lightning Dashboard (`src/components/LightningDashboard.tsx`)
**Endpoint:** `GET /api/lightning?start=N&end=N`

**Test IDs:**
- `ln-start` - Start block height
- `ln-end` - End block height (optional)
- `ln-btn` - Submit button
- `ln-total-scanned` - Total transactions scanned
- `ln-commitments` - Commitment transaction count
- `ln-htlc-timeouts` - HTLC timeout count
- `ln-htlc-successes` - HTLC success count
- `ln-tx-row` - Lightning transaction row (multiple)
- `expiry-chart` - CLTV expiry distribution chart
- `ln-error` - Error message

**Features:**
- Analyzes Lightning Network activity in block ranges
- Statistics on commitment/HTLC transactions
- Bar chart of CLTV expiry distribution (using recharts)
- Lists Lightning transactions with type and confidence

#### 5. Mempool Monitor (`src/components/MempoolMonitor.tsx`)
**Endpoint:** `GET /api/monitor?interval=N&min_severity=info|warning|critical` (SSE)

**Test IDs:**
- `monitor-interval` - Polling interval input (seconds)
- `monitor-min-severity` - Minimum severity filter
- `monitor-start-btn` - Start monitoring button
- `monitor-stop-btn` - Stop monitoring button
- `monitor-clear-btn` - Clear events button
- `monitor-status` - Connection status (disconnected/connected/error)
- `monitor-event-count` - Total events received
- `monitor-feed` - Event feed container
- `monitor-event` - Individual event (multiple)
- `monitor-event-txid` - Event transaction ID
- `monitor-event-ln-type` - Lightning type if present
- `monitor-event-alerts-count` - Alert count
- `monitor-event-severity` - Maximum severity
- `monitor-event-timelocks` - Active timelocks indicator

**Features:**
- Real-time mempool monitoring via Server-Sent Events (SSE)
- Configurable polling interval and severity threshold
- Live feed with up to 200 events (FIFO buffer)
- Connection status indicator
- EventSource properly closed on component unmount
- Event deduplication handled by backend

## Configuration

### Environment Variables
Create `.env` in project root:
```
VITE_API_URL=http://localhost:3001
```

### Vite Proxy
Configured in `vite.config.ts` to proxy `/api/*` requests to `http://localhost:3001`:
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:3001',
    changeOrigin: true,
  },
}
```

This enables:
- CORS-free development
- SSE connections without CORS issues
- Consistent API URLs in dev and production

## Running the Application

### Development
```bash
npm run dev
```
Access at: `http://localhost:8080`

### Build
```bash
npm run build
```
Output: `/dist` directory

### Test
```bash
npm run test
```
Runs TypeScript compilation, ESLint, Vitest, and build.

## E2E Testing

All components include `data-testid` attributes as specified in the requirements. Test scenarios:

### Transaction Analyzer
- Valid txid → All outputs render
- Invalid txid → Error visible
- Critical alerts → Banner visible
- No active timelocks → Empty lists

### Block Explorer
- Filter by alerts → Subset returned
- Click tx-row → Expands details
- Second click → Collapses
- Invalid height → Error visible

### Security Scanner
- Single block scan → Total ≥ 0
- Filter severity → Matches filter
- Filter detection type → Shows specific details
- Invalid start → Error visible

### Lightning Dashboard
- Query range → Statistics present
- Distribution data → Chart visible
- No Lightning txs → Empty list
- No data → Zero counters

### Mempool Monitor
- Click start → Status "connected", EventSource open
- Receive event → Event in feed, counter increments
- Click stop → Status "disconnected", EventSource closed
- Click clear → Feed empty, counter = 0
- Component unmount → EventSource closed
- Server unavailable → Status "error"

## Dependencies

Key additions:
- `recharts` - For CLTV expiry distribution chart
- All UI components use shadcn/ui (already in MKStack template)

## Notes

- No authentication required
- All API calls use typed error handling
- Loading states disable input controls
- SSE stream management follows best practices (cleanup on unmount)
- Maximum 200 events in mempool monitor buffer
- All test IDs match specification exactly
