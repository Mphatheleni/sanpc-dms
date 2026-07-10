import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

/**
 * GET /api/test-email
 * Sends a test email via Microsoft Graph to verify everything is working.
 * Sends to the currently logged-in admin's email address.
 */
export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const tenantId     = process.env.AZURE_TENANT_ID
  const clientId     = process.env.AZURE_CLIENT_ID
  const clientSecret = process.env.AZURE_CLIENT_SECRET
  const mailSender   = process.env.MAIL_SENDER
  const appUrl       = process.env.APP_URL || 'http://localhost:3000'

  if (!tenantId || !clientId || !clientSecret || !mailSender) {
    return NextResponse.json({
      ok: false,
      error: 'Missing env vars',
      missing: {
        AZURE_TENANT_ID: !tenantId,
        AZURE_CLIENT_ID: !clientId,
        AZURE_CLIENT_SECRET: !clientSecret,
        MAIL_SENDER: !mailSender,
      },
    }, { status: 500 })
  }

  // Step 1: get Graph token
  let token: string
  try {
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
          scope: 'https://graph.microsoft.com/.default',
        }),
      }
    )
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) {
      return NextResponse.json({
        ok: false,
        step: 'get_token',
        error: tokenData.error_description ?? 'No access_token in response',
        detail: tokenData,
      }, { status: 500 })
    }
    token = tokenData.access_token
  } catch (err) {
    return NextResponse.json({ ok: false, step: 'get_token', error: String(err) }, { status: 500 })
  }

  // Step 2: send email via Graph
  const htmlBody = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="background:#1C3557;padding:28px 32px;">
      <div style="font-size:22px;font-weight:800;color:#fff;">SANPC DMS</div>
      <div style="font-size:11px;font-weight:600;letter-spacing:.18em;color:#F5A623;margin-top:2px;">POWERING YOUR TOMORROW</div>
    </div>
    <div style="padding:32px;">
      <div style="background:#F0FDF4;border-left:4px solid #16A34A;border-radius:6px;padding:14px 18px;margin-bottom:24px;">
        <div style="font-size:15px;font-weight:700;color:#16A34A;">✅ Email Test Successful</div>
        <div style="font-size:13px;color:#374151;margin-top:4px;">
          Your SANPC DMS email service is connected and working correctly.
        </div>
      </div>
      <p style="font-size:14px;color:#374151;">
        This test email was sent from <strong>${mailSender}</strong> via Microsoft Graph API.<br/><br/>
        Reviewer notification emails will deliver correctly.
      </p>
      <p style="font-size:12px;color:#9ca3af;margin-top:24px;">Sent at ${new Date().toLocaleString('en-ZA')} · App URL: ${appUrl}</p>
    </div>
  </div>
</body></html>`

  try {
    const sendRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${mailSender}/sendMail`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject: '[SANPC DMS] ✅ Email Test — Working',
            body: { contentType: 'HTML', content: htmlBody },
            toRecipients: [{ emailAddress: { address: session.email, name: session.name } }],
            from: { emailAddress: { address: mailSender, name: 'SANPC DMS' } },
          },
          saveToSentItems: false,
        }),
      }
    )

    if (!sendRes.ok) {
      const text = await sendRes.text().catch(() => '')
      let hint = ''
      if (sendRes.status === 403) {
        hint = 'Permission denied. Go to Azure portal → App registrations → API permissions → Add "Mail.Send" (Application) → Grant admin consent.'
      } else if (sendRes.status === 404) {
        hint = `Mailbox not found. Check MAIL_SENDER (${mailSender}) is a valid licensed M365 user.`
      }
      return NextResponse.json({
        ok: false,
        step: 'send_email',
        status: sendRes.status,
        error: `Graph sendMail returned ${sendRes.status}`,
        detail: text,
        hint,
      }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      message: `Test email sent from ${mailSender} to ${session.email}`,
      checkYourInbox: session.email,
    })
  } catch (err) {
    return NextResponse.json({ ok: false, step: 'send_email', error: String(err) }, { status: 500 })
  }
}
