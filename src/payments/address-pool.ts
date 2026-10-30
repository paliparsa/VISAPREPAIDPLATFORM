import type { ChainId } from "./chains";
export interface DepositAddress { id: string; chain: ChainId; address: string; }
export interface AddressAllocator {
 reserveForOrder(orderId: string, chain: ChainId): Promise<DepositAddress>;
 releaseIfUnused(addressId: string): Promise<void>;
}
// Addresses are imported from a separately secured offline process.
// Never place private keys or seed phrases in this Worker, D1, R2, or GitHub.