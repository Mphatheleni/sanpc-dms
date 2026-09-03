import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { isEmailConfigured } from '@/lib/email'
import nodemailer from 'nodemailer'

/**
 * GET /api/test-email?to=someone@example.com
 * Sends a real test email via SMTP (smtp.office365.com:587) and returns diagnostics.
 * ADMIN only.
 */
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const to = req.nextUrl.searchParams.get('to') || session.email
  const diag: Record<string, unknown> = {}

  // 1. Env check
  diag.env = {
    MAIL_SENDER:   process.env.MAIL_SENDER   ? '✓ set' : '✗ MISSING',
    MAIL_PASSWORD: process.env.MAIL_PASSWORD ? '✓ set' : '✗ MISSING',
    APP_URL:       process.env.APP_URL        ?? '✗ MISSING',
  }
  diag.isEmailConfigured = isEmailConfigured()

  if (!isEmailConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'Email not configured — MAIL_SENDER or MAIL_PASSWORD missing', diag },
      { status: 500 }
    )
  }

  const sender = process.env.MAIL_SENDER!
  const appUrl = process.env.APP_URL || 'http://localhost:3000'

  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="background:#1C3557;padding:28px 32px;">
      <div style="font-size:22px;font-weight:800;color:#fff;">SANPC DMS</div>
      <div style="font-size:11px;font-weight:600;letter-spacing:.18em;color:#F5A623;margin-top:2px;">POWERING YOUR TOMORROW</div>
    </div>
    <div style="padding:32px;">
      <div style="background:#F0FDF4;border-left:4px solid #16A34A;border-radius:6px;padding:14px 18px;margin-bottom:24px;">
        <div style="font-size:15px;font-weight:700;color:#16A34A;">Email Test Successful</div>
        <div style="font-size:13px;color:#374151;margin-top:4px;">SMTP (Office 365) is working correctly.</div>
      </div>
      <p style="margin:0 0 12px;font-size:14px;color:#374151;">Sent at: <strong>${new Date().toISOString()}</strong></p>
      <p style="margin:0 0 12px;font-size:14px;color:#374151;">From: <strong>${sender}</strong><br/>To: <strong>${to}</strong></p>
      <p style="margin:0 0 12px;font-size:14px;color:#374151;">Auth flow: <strong>SMTP / smtp.office365.com:587 (STARTTLS)</strong></p>
      <a href="${appUrl}" style="display:inline-block;margin-top:8px;padding:10px 22px;background:#1C3557;color:#fff;font-weight:700;font-size:14px;border-radius:8px;text-decoration:none;">Open SANPC DMS</a>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px;" />
      <p style="margin:0;font-size:12px;color:#9ca3af;">Automated test — you can ignore this email.</p>
    </div>
  </div>
</body></html>`

  try {
    const transport = nodemailer.createTransport({
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      auth: { user: sender, pass: process.env.MAIL_PASSWORD! },
      tls: { ciphers: 'SSLv3' },
    })

    await transport.sendMail({
      from: `"SANPC DMS" <${sender}>`,
      to,
      subject: `[SANPC DMS] Test Email — ${new Date().toLocaleTimeString()}`,
      html,
    })

    return NextResponse.json({
      ok: true,
      message: `Test email sent to ${to} via SMTP. Check inbox (and junk folder).`,
      diag: { ...diag, sendOk: true, transport: 'smtp.office365.com:587' },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    diag.smtpError = message
    return NextResponse.json(
      {
        ok: false,
        step: 'smtp_send',
        error: message,
        hint: 'Check MAIL_SENDER / MAIL_PASSWORD. Ensure Basic Auth is not blocked for this mailbox in M365 admin.',
        diag,
      },
      { status: 500 }
    )
  }
}
