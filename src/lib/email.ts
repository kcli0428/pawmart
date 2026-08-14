export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
};

export type SendEmailResult = {
  simulated: boolean;
  id?: string;
};

function recipientsOf(to: string | string[]) {
  return Array.isArray(to) ? to : [to];
}

export function campaignEmailHtml(title: string, body: string) {
  return `
    <div style="font-family: sans-serif; line-height: 1.6; color: #18181b;">
      <h1 style="font-size: 18px;">${title}</h1>
      <p>${body}</p>
      <p style="color: #71717a; font-size: 12px;">PawMart 香港寵物用品</p>
    </div>
  `;
}

/**
 * Send email via Resend when RESEND_API_KEY is set; otherwise log and simulate.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || "PawMart <noreply@pawmart.hk>";
  const to = recipientsOf(input.to).filter(Boolean);

  if (to.length === 0) {
    throw new Error("Missing email recipient");
  }

  if (!key) {
    console.log("[email:simulated]", {
      from,
      to,
      subject: input.subject,
    });
    return { simulated: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`EMAIL_SEND_FAILED: ${detail}`);
  }

  const data = (await res.json()) as { id?: string };
  return { simulated: false, id: data.id };
}
