export interface MailMessage { to: string; subject: string; html: string; }
export interface Mailer { send(message: MailMessage): Promise<{ id: string }>; }

export class ResendMailer implements Mailer {
  constructor(private readonly apiKey: string, private readonly from: string) {}
  async send(message: MailMessage): Promise<{ id: string }> {
    if (!this.apiKey || !this.from) throw new Error("Email provider is not configured");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: this.from, to: [message.to], subject: message.subject, html: message.html })
    });
    const result = await response.json().catch(() => null) as { id?: string } | null;
    if (!response.ok || !result?.id) throw new Error("Email delivery failed");
    return { id: result.id };
  }
}
