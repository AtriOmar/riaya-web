export type SecretaryInviteEmailParams = {
	doctorName: string;
	inviteUrl: string;
	expiresInDays: number;
};

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export function buildSecretaryInviteEmail(params: SecretaryInviteEmailParams) {
	const appUrl = (
		process.env.NEXT_PUBLIC_APP_URL ?? "https://riaya.omaratri.com"
	).replace(/\/$/, "");
	const logoUrl = `${appUrl}/logo.png`;
	const doctor = escapeHtml(params.doctorName);

	const subject = `${params.doctorName} invited you to Riaya`;
	const text = [
		"Riaya",
		"",
		`${params.doctorName} invited you to manage their practice on Riaya as a secretary.`,
		"",
		`Accept the invitation: ${params.inviteUrl}`,
		`This link expires in ${params.expiresInDays} days.`,
		"",
		"If you weren't expecting this, you can ignore this email.",
	].join("\n");

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f6f4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f6f4;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5ebe7;">
          <tr>
            <td align="center" style="background:linear-gradient(135deg,#16a34a 0%,#166534 100%);padding:28px 24px;">
              <img src="${logoUrl}" alt="Riaya" width="56" height="56" style="display:block;border:0;border-radius:14px;background-color:rgba(255,255,255,0.18);padding:8px;" />
              <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.2px;">
                رعاية · Riaya
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px 8px;font-family:Arial,Helvetica,sans-serif;color:#14532d;">
              <h1 style="margin:0 0 10px;font-size:22px;line-height:1.3;font-weight:700;color:#14532d;">
                You're invited
              </h1>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#3f5a4a;">
                ${doctor} invited you to manage their practice on Riaya as a secretary: appointments, patients and invoices.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 28px;">
              <a href="${params.inviteUrl}" style="display:inline-block;background-color:#16a34a;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px;">
                Accept invitation
              </a>
              <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6b7f73;">
                Expires in ${params.expiresInDays} days
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7f73;">
                If you weren't expecting this, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 22px;border-top:1px solid #eef2ef;font-family:Arial,Helvetica,sans-serif;text-align:center;">
              <p style="margin:0;font-size:12px;color:#8a9a90;">
                © Riaya · Healthcare appointments, simplified
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

	return { subject, text, html };
}
