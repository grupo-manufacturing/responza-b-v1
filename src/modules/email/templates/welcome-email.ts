type WelcomeEmailContent = {
  readonly recipientName: string
  readonly appUrl: string
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function buildWelcomeEmail({ recipientName, appUrl }: WelcomeEmailContent): {
  subject: string
  html: string
  text: string
} {
  const safeName = escapeHtml(recipientName)
  const authUrl = `${appUrl}/auth?mode=login`

  const subject = 'Welcome to Responza'

  const text = [
    `Hi ${recipientName},`,
    '',
    'Welcome to Responza — your workspace for WhatsApp and Instagram conversations.',
    '',
    'Here is how to get started:',
    '1. Set up your business profile',
    '2. Connect WhatsApp or Instagram',
    '3. Let Responza AI draft replies while you stay in control',
    '',
    `Open Responza: ${authUrl}`,
    '',
    'Your 3-day free trial is active. No credit card required.',
    '',
    'Questions? Reply to this email or write to contact@responza.in.',
    '',
    '— The Responza team',
  ].join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1f1e;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f6f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e9e7;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 12px;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#5b8a85;">Responza AI</p>
                <h1 style="margin:0;font-size:28px;line-height:1.25;font-weight:600;color:#1a1f1e;">Welcome to Responza</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 8px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#4b5754;">Hi ${safeName},</p>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#4b5754;">
                  Thanks for joining Responza. You now have one workspace for WhatsApp and Instagram — with AI draft replies, translation, and a dashboard that shows what needs attention.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 8px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7faf9;border:1px solid #e4e9e7;border-radius:12px;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#1a1f1e;">Get started in 3 steps</p>
                      <ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;color:#4b5754;">
                        <li>Set up your business profile</li>
                        <li>Connect WhatsApp or Instagram</li>
                        <li>Review AI drafts and reply from one inbox</li>
                      </ol>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 8px;">
                <a href="${authUrl}" style="display:inline-block;background:#1a1f1e;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:999px;">
                  Open Responza
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 28px;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7773;">
                  Your 3-day free trial is active. Questions? Email us at
                  <a href="mailto:contact@responza.in" style="color:#5b8a85;">contact@responza.in</a>.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return { subject, html, text }
}
