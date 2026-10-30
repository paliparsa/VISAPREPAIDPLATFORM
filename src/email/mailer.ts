export interface MailMessage { to: string; subject: string; html: string; }
export interface Mailer { send(message: MailMessage): Promise<{ id: string }>; }
// Resend adapter TODO. Never email full PAN, CVV, seed phrases, or private keys.