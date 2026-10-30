export interface IssueCardInput {
  /** Stable platform order ID. Used as Tremendous external_id for idempotency. */
  orderId: string;
  externalId: string;
  recipientName: string;
  recipientEmail: string;
  /** Face value in major currency units, e.g. 25.00 USD. */
  amount: number;
  currency: "USD";
}

export type CardIssueStatus = "pending" | "issued" | "failed";

export interface IssueCardResult {
  providerOrderId: string;
  status: CardIssueStatus;
  providerStatus?: string;
  deliveryUrl?: string;
}

export interface CardProvider {
  issue(input: IssueCardInput): Promise<IssueCardResult>;
  getStatus(providerOrderId: string): Promise<IssueCardResult>;
}

export class CardProviderError extends Error {
  constructor(message: string, readonly code: string, readonly httpStatus?: number) {
    super(message);
    this.name = "CardProviderError";
  }
}
