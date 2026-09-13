export type RegistrationOtpEmailParams = {
	otp: string;
	expiresInMinutes: number;
};

export function buildRegistrationOtpEmail(params: RegistrationOtpEmailParams) {
	const appUrl = (
		process.env.NEXT_PUBLIC_APP_URL ?? "https://riaya.omaratri.com"
	).replace(/\/$/, "");
	const logoUrl = `${appUrl}/logo.png`;

	const subject = "Your Riaya verification code";
	const text = [
		"Riaya",
		"",
		`Your verification code is ${params.otp}.`,
		`This code expires in ${params.expiresInMinutes} minutes.`,
		"",
		"If you did not request this, you can ignore this email.",
	].join("\n");

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
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
                Verify your email
              </h1>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#3f5a4a;">
                Use this one-time code to finish creating your Riaya account.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;">
                <tr>
                  <td style="padding:18px 28px;font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#15803d;text-align:center;">
                    ${params.otp}
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6b7f73;">
                Expires in ${params.expiresInMinutes} minutes
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7f73;">
                If you didn’t request this code, you can safely ignore this email.
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
