export type ChainId = "TRON" | "ETHEREUM" | "BSC";
export interface ChainConfig {
 id: ChainId; network: "TRC20" | "ERC20" | "BEP20"; tokenSymbol: "USDT";
 tokenContract: string; confirmationsRequired: number; decimals: number;
}
// Intentionally unconfigured until independently verified against official sources.
export const CHAIN_CONFIG: Record<ChainId, ChainConfig> = {
 TRON: { id:"TRON", network:"TRC20", tokenSymbol:"USDT", tokenContract:"CONFIGURE_VERIFIED_TRON_USDT_CONTRACT", confirmationsRequired:20, decimals:6 },
 ETHEREUM: { id:"ETHEREUM", network:"ERC20", tokenSymbol:"USDT", tokenContract:"CONFIGURE_VERIFIED_ETHEREUM_USDT_CONTRACT", confirmationsRequired:12, decimals:6 },
 BSC: { id:"BSC", network:"BEP20", tokenSymbol:"USDT", tokenContract:"CONFIGURE_VERIFIED_BSC_USDT_CONTRACT", confirmationsRequired:15, decimals:18 }
};