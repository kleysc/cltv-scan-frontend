// API Types for cltv-scan backend

export type TimelocktDomain = "block_height" | "unix_timestamp";
export type LightningTxType = "commitment" | "htlc_timeout" | "htlc_success" | null;
export type LightningConfidence = "none" | "possible" | "highly_likely";
export type AlertSeverity = "critical" | "warning" | "informational";
export type DetectionType = "timelock_mixing" | "short_cltv_delta" | "htlc_clustering" | "anomalous_sequence";

export interface NLocktimeInfo {
  raw_value: number;
  is_enforced: boolean;
  domain: TimelocktDomain;
  human_readable: string;
}

export interface SequenceInfo {
  input_index: number;
  raw_hex: string;
  is_final: boolean;
  rbf_signaling: boolean;
  relative_timelock: number | null;
  is_lightning_sequence: boolean;
  human_readable: string;
}

export interface ScriptTimelockInfo {
  field: string;
  opcode: string;
  threshold_value: number;
  domain: TimelocktDomain;
  human_readable: string;
}

export interface TimelocktSummary {
  has_active_timelocks: boolean;
  has_script_timelocks: boolean;
  has_lightning_sequence: boolean;
  timelock_types_count: number;
}

export interface TransactionAnalysis {
  txid: string;
  nlocktime: NLocktimeInfo;
  sequences: SequenceInfo[];
  script_timelocks: ScriptTimelockInfo[];
  summary: TimelocktSummary;
}

export interface CommitmentSignals {
  locktime_match: boolean;
  sequence_match: boolean;
  has_anchor_outputs: boolean;
  anchor_output_count: number;
}

export interface HtlcSignals {
  locktime_value: number | null;
  has_preimage: boolean;
  preimage: string | null;
  script_has_cltv: boolean;
  script_has_csv: boolean;
}

export interface LightningParams {
  commitment_number: number | null;
  htlc_output_count: number;
  cltv_expiry: number | null;
  csv_delays: number[];
  preimage_revealed: boolean;
  preimage: string | null;
}

export interface LightningClassification {
  tx_type: LightningTxType;
  confidence: LightningConfidence;
  commitment_signals: CommitmentSignals;
  htlc_signals: HtlcSignals;
  params: LightningParams;
}

export interface Reference {
  name: string;
  authors: string;
  year: number;
  url: string;
}

export interface TimelocktMixingDetails {
  type: "timelock_mixing";
  nlocktime_domain: TimelocktDomain;
  sequence_domain: TimelocktDomain;
}

export interface ShortCltvDeltaDetails {
  type: "short_cltv_delta";
  cltv_expiry: number;
  current_height: number;
  blocks_remaining: number;
}

export interface HtlcClusteringDetails {
  type: "htlc_clustering";
  window_start: number;
  window_end: number;
  count: number;
  threshold: number;
}

export interface AnomalousSequenceDetails {
  type: "anomalous_sequence";
  input_index: number;
  sequence_value: number;
  expected_range: string;
}

export type AlertDetails = 
  | TimelocktMixingDetails 
  | ShortCltvDeltaDetails 
  | HtlcClusteringDetails 
  | AnomalousSequenceDetails;

export interface Alert {
  id: string;
  severity: AlertSeverity;
  detection_type: DetectionType;
  txid: string;
  input_index: number | null;
  description: string;
  details: AlertDetails;
  reference: Reference | null;
}

export interface TxAnalysisResponse {
  timelock: TransactionAnalysis;
  lightning: LightningClassification;
  alerts: Alert[];
}

export interface BlockAnalysisResponse {
  height: number;
  total_transactions: number;
  returned_transactions: number;
  transactions: TxAnalysisResponse[];
}

export interface ScanResponse {
  start_height: number;
  end_height: number;
  current_tip: number;
  total_alerts: number;
  alerts: Alert[];
}

export interface LightningTransaction {
  txid: string;
  classification: LightningClassification;
}

export interface CltvExpiryDistribution {
  block_height: number;
  count: number;
}

export interface LightningResponse {
  start_height: number;
  end_height: number;
  total_transactions_scanned: number;
  commitments: number;
  htlc_timeouts: number;
  htlc_successes: number;
  transactions: LightningTransaction[];
  cltv_expiry_distribution: CltvExpiryDistribution[];
}

export interface MonitorEvent {
  txid: string;
  timelock: TransactionAnalysis;
  lightning: LightningClassification;
  alerts: Alert[];
}
