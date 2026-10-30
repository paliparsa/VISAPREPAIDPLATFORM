export interface IssueCardInput {
 orderId: string; externalId: string; recipientName: string;
 recipientEmail: string; amount: number; currency: "USD";
}
export interface IssueCardResult {
 providerOrderId: string; status: "pending" | "issued" | "failed"; deliveryUrl?: string;
}
export interface CardProvider {
 issue(input: IssueCardInput): Promise<IssueCardResult>;
 getStatus(providerOrderId: string): Promise<IssueCardResult>;
}
// Live Tremendous issuance stays disabled pending written approval for reseller
// eligibility, recipient countries, name-on-card semantics, and delivery model.