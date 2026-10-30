import type { ChainId } from "./chains";

export interface ObservedTransfer {
  chain: ChainId;
  txHash: string;
  logIndex: string;
  fromAddress: string;
  toAddress: string;
  tokenContract: string;
  amountAtomic: string;
  blockNumber: string;
  confirmations: number;
}

export interface ChainMonitor {
  scan(addresses: string[], fromBlock?: string): Promise<ObservedTransfer[]>;
  getCurrentBlock(): Promise<string>;
}

/**
 * Production adapters must verify network identity and configured token
 * contract, paginate bounded block ranges, handle chain reorganizations,
 * and deduplicate by (chain, txHash, logIndex). Never trust client-submitted
 * transaction hashes as payment proof.
 */