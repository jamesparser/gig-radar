import type { Config } from "../config";

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface Mailer {
  name: string;
  send(msg: MailMessage): Promise<{ id?: string }>;
}

/** Resend transactional email over plain HTTPS (no SDK). */
export function resendMailer(apiKey: string, from: string, fetchImpl: typeof fetch = fetch): Mailer {
  return {
    name: "resend",
    async send({ to, subject, html, text }) {
      const res = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ from, to: [to], subject, html, text }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = (await res.json()) as { id?: string };
      return { id: data.id };
    },
  };
}

/** null = no provider configured → digests are stored in the outbox and shown in the dashboard. */
export function createMailer(config: Config, fetchImpl: typeof fetch = fetch): Mailer | null {
  return config.email.resendApiKey ? resendMailer(config.email.resendApiKey, config.email.from, fetchImpl) : null;
}
