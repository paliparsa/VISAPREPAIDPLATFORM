import type { Env } from "../types";
import { CardProviderError, type CardProvider, type IssueCardInput, type IssueCardResult } from "./card-provider";

const SANDBOX_API = "https://testflight.tremendous.com/api/v2";
const LIVE_API = "https://www.tremendous.com/api/v2";
const DEFAULT_VIRTUAL_VISA_PRODUCT = "V4QZ00F554D3";

interface TremendousReward { id?: string; delivery?: { method?: string; status?: string; link?: string }; }
interface TremendousOrder { id?: string; external_id?: string; status?: string; rewards?: TremendousReward[]; }
interface TremendousOrderResponse { order?: TremendousOrder; }

function mapStatus(status = ""): IssueCardResult["status"] {
  switch (status.toUpperCase()) {
    case "EXECUTED": return "issued";
    case "FAILED":
    case "CANCELED": return "failed";
    default: return "pending";
  }
}

export class TremendousProvider implements CardProvider {
  private readonly baseUrl: string;
  constructor(private readonly env: Env) {
    this.baseUrl = env.TREMENDOUS_MODE === "live" ? LIVE_API : SANDBOX_API;
  }

  private async request(path: string, init: RequestInit = {}): Promise<TremendousOrder> {
    if (!this.env.TREMENDOUS_API_KEY) {
      throw new CardProviderError("Tremendous API key is not configured", "PROVIDER_NOT_CONFIGURED");
    }
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.env.TREMENDOUS_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...init.headers
      }
    });
    const payload = await response.json().catch(() => null) as
      | TremendousOrderResponse
      | { errors?: { message?: string }; error?: { message?: string } }
      | null;
    if (!response.ok) {
      const message = payload && "errors" in payload ? payload.errors?.message
        : payload && "error" in payload ? payload.error?.message : undefined;
      throw new CardProviderError(
        message || `Tremendous request failed (${response.status})`,
        response.status === 401 ? "PROVIDER_AUTH_FAILED"
          : response.status === 402 ? "PROVIDER_INSUFFICIENT_FUNDS"
            : response.status === 409 ? "PROVIDER_IDEMPOTENCY_CONFLICT" : "PROVIDER_REQUEST_FAILED",
        response.status
      );
    }
    if (!payload || !("order" in payload) || !payload.order) {
      throw new CardProviderError("Tremendous returned an invalid order response", "PROVIDER_INVALID_RESPONSE");
    }
    return payload.order;
  }

  async issue(input: IssueCardInput): Promise<IssueCardResult> {
    if (this.env.TREMENDOUS_MODE !== "sandbox" && this.env.TREMENDOUS_MODE !== "live") {
      throw new CardProviderError("Tremendous issuance is disabled. Set TREMENDOUS_MODE explicitly.", "ISSUANCE_DISABLED");
    }
    if (!this.env.TREMENDOUS_FUNDING_SOURCE_ID) {
      throw new CardProviderError("Tremendous funding source is not configured", "FUNDING_SOURCE_NOT_CONFIGURED");
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new CardProviderError("Card amount must be a positive USD value", "INVALID_AMOUNT");
    }
    const productId = this.env.TREMENDOUS_VISA_PRODUCT_ID || DEFAULT_VIRTUAL_VISA_PRODUCT;
    const order = await this.request("/orders", {
      method: "POST",
      body: JSON.stringify({
        external_id: input.externalId || input.orderId,
        payment: { funding_source_id: this.env.TREMENDOUS_FUNDING_SOURCE_ID },
        reward: {
          value: { denomination: input.amount, currency_code: "USD" },
          delivery: { method: "EMAIL" },
          recipient: { name: input.recipientName, email: input.recipientEmail },
          products: [productId]
        }
      })
    });
    return this.toResult(order);
  }

  async getStatus(providerOrderId: string): Promise<IssueCardResult> {
    if (!providerOrderId || !/^[A-Za-z0-9_-]{4,80}$/.test(providerOrderId)) {
      throw new CardProviderError("Invalid provider order identifier", "INVALID_PROVIDER_ORDER_ID");
    }
    return this.toResult(await this.request(`/orders/${encodeURIComponent(providerOrderId)}`));
  }

  private toResult(order: TremendousOrder): IssueCardResult {
    if (!order.id) throw new CardProviderError("Tremendous order response did not include an ID", "PROVIDER_INVALID_RESPONSE");
    const reward = order.rewards?.[0];
    return {
      providerOrderId: order.id,
      status: mapStatus(order.status),
      providerStatus: order.status,
      ...(reward?.delivery?.link ? { deliveryUrl: reward.delivery.link } : {})
    };
  }
}
