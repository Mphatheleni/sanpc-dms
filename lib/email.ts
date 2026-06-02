/**
 * Email notifications via Microsoft Graph API (send-as application).
 *
 * Required env vars:
 *   AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET  (same app as SharePoint)
 *   MAIL_SENDER   — licensed M365 user UPN, e.g. noreply@sanpc.com
 *   APP_URL       — public base URL of this app, e.g. https://dms.sanpc.com
 */

const GRAPH = 'https://graph.microsoft.com/v1.0'

export function isEmailConfigured(): boolean {
  return !!(
    process.env.AZURE_TENANT_ID &&
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET &&
    process.env.MAIL_SENDER
  )
}

async function getToken(): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.AZURE_CLIENT_ID!,
        client_secret: process.env.AZURE_CLIENT_SECRET!,
        scope: 'https://graph.microsoft.com/.default',
      }),
    },
  )
  const data = await res.json()
  if (!data.access_token) throw new Error(`Mail token error: ${JSON.stringify(data)}`)
  return data.access_token
}

function deadlineHtml(deadline: string | null | undefined): string {
  if (!deadline) return ''
  const d = new Date(deadline).toLocaleDateString('en-ZA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  return `<tr><td style="padding:4px 0;color:#6b7280;font-size:13px;">Review deadline</td>
           <td style="padding:4px 0;font-weight:600;color:#EF4444;">${d}</td></tr>`
}

function btn(href: string, label: string, bg: string, fg: string): string {
  return `<a href="${href}" style="display:inline-block;margin:8px 6px 0 0;padding:10px 22px;
    background:${bg};color:${fg};font-weight:700;font-size:14px;border-radius:8px;
    text-decoration:none;">${label}</a>`
}

function buildHtml({
  toName, documentTitle, documentUrl, reviewUrl, sharePointUrl, deadline, isApprover, uploaderName,
}: ReviewEmailProps): string {
  const role = isApprover ? 'approve' : 'review'
  const actionLabel = isApprover ? '✅ Approve / Reject Document' : '✅ Mark Review Complete'
  const primaryUrl = reviewUrl || documentUrl

  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;
    box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <!-- Header -->
    <div style="background:#1C3557;padding:28px 32px;">
      <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.3px;">SANPC DMS</div>
      <div style="font-size:11px;font-weight:600;letter-spacing:.18em;color:#F5A623;margin-top:2px;">
        POWERING YOUR TOMORROW
      </div>
    </div>
    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 8px;font-size:16px;color:#374151;">Dear <strong>${toName}</strong>,</p>
      <p style="margin:0 0 20px;font-size:15px;color:#374151;">
        You have been assigned to <strong>${role}</strong> the following document:
      </p>
      <!-- Document card -->
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
        <div style="font-size:17px;font-weight:700;color:#1C3557;margin-bottom:12px;">${documentTitle}</div>
        <table style="border-collapse:collapse;width:100%;">
          <tr><td style="padding:4px 0;color:#6b7280;font-size:13px;">Uploaded by</td>
              <td style="padding:4px 0;font-size:13px;">${uploaderName}</td></tr>
          ${deadlineHtml(deadline)}
        </table>
      </div>
      <!-- How to review -->
      <p style="margin:0 0 12px;font-size:14px;color:#374151;font-weight:600;">How to complete your ${role}:</p>
      <ol style="margin:0 0 20px;padding-left:20px;font-size:14px;color:#374151;line-height:2;">
        ${sharePointUrl ? `<li>Click <strong>"Open &amp; Annotate"</strong> to read and add comments or track changes directly in Office Online.</li>` : ''}
        <li>Click <strong>"${actionLabel.replace(/✅ /, '')}"</strong> below to record your formal decision — no login required.</li>
      </ol>
      <!-- Primary CTA -->
      <div style="margin-bottom:12px;">
        ${sharePointUrl ? btn(sharePointUrl, '📄 Open &amp; Annotate in Office Online', '#0078D4', '#fff') : ''}
        ${btn(primaryUrl, actionLabel, '#1C3557', '#fff')}
      </div>
      <!-- Secondary link -->
      <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">
        Or <a href="${documentUrl}" style="color:#1C3557;">view the full document in SANPC DMS</a> (requires login).
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px;" />
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        This is a secure, personalized link. Do not forward this email.
        Automated notification from SANPC DMS.
      </p>
    </div>
  </div>
</body></html>`
}

interface ReviewEmailProps {
  toEmail: string
  toName: string
  documentTitle: string
  documentUrl: string
  reviewUrl?: string | null
  sharePointUrl?: string | null
  deadline?: string | null
  isApprover: boolean
  uploaderName: string
}

export async function sendReviewNotification(props: ReviewEmailProps): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(`[email] not configured — would send review notification to ${props.toEmail}`)
    return
  }
  const token = await getToken()
  const subject = `[SANPC DMS] ${props.isApprover ? 'Approval' : 'Review'} Required: ${props.documentTitle}`
  await fetch(`${GRAPH}/users/${process.env.MAIL_SENDER}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: buildHtml(props) },
        toRecipients: [{ emailAddress: { address: props.toEmail, name: props.toName } }],
      },
      saveToSentItems: false,
    }),
  })
}

/** Send to multiple reviewers/approvers at once (fire-and-forget) */
export function sendBulkReviewNotifications(notifications: ReviewEmailProps[]): void {
  for (const n of notifications) {
    sendReviewNotification(n).catch((err) =>
      console.error(`[email] failed to send to ${n.toEmail}:`, err)
    )
  }
}

export type OriginatorOutcome = 'CHANGES_REQUESTED' | 'REJECTED' | 'APPROVED' | 'REVIEW_COMPLETE'

interface OriginatorEmailProps {
  toEmail: string
  toName: string
  documentTitle: string
  documentUrl: string
  outcome: OriginatorOutcome
  reviewerName: string
  reviewerComments?: string | null
}

function buildOriginatorHtml(p: OriginatorEmailProps): string {
  const outcomeConfig = {
    APPROVED: { label: 'Approved', color: '#16A34A', bg: '#F0FDF4', message: 'Your document has been fully approved.' },
    REVIEW_COMPLETE: { label: 'Review Complete', color: '#1C3557', bg: '#E8EDF4', message: 'All reviewers have approved. Please review the annotated document, make any final edits, then send it for approval.' },
    CHANGES_REQUESTED: { label: 'Changes Requested', color: '#D97706', bg: '#FFFBEB', message: 'A reviewer has requested changes. Please update the document and resubmit.' },
    REJECTED: { label: 'Rejected', color: '#DC2626', bg: '#FEF2F2', message: 'Your document has been rejected. Please review the comments and resubmit if appropriate.' },
  }[p.outcome]

  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;
    box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="background:#1C3557;padding:28px 32px;">
      <div style="font-size:22px;font-weight:800;color:#fff;">SANPC DMS</div>
      <div style="font-size:11px;font-weight:600;letter-spacing:.18em;color:#F5A623;margin-top:2px;">POWERING YOUR TOMORROW</div>
    </div>
    <div style="padding:32px;">
      <div style="background:${outcomeConfig.bg};border-left:4px solid ${outcomeConfig.color};border-radius:6px;padding:14px 18px;margin-bottom:24px;">
        <div style="font-size:15px;font-weight:700;color:${outcomeConfig.color};">${outcomeConfig.label}</div>
        <div style="font-size:13px;color:#374151;margin-top:4px;">${outcomeConfig.message}</div>
      </div>
      <p style="margin:0 0 8px;font-size:15px;color:#374151;">Dear <strong>${p.toName}</strong>,</p>
      <p style="margin:0 0 16px;font-size:14px;color:#374151;">
        <strong>${p.reviewerName}</strong> has reviewed your document <strong>${p.documentTitle}</strong>
        and recorded the decision: <strong style="color:${outcomeConfig.color};">${outcomeConfig.label}</strong>.
      </p>
      ${p.reviewerComments ? `
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 18px;margin-bottom:20px;">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin-bottom:6px;">Reviewer comments</div>
        <div style="font-size:14px;color:#374151;font-style:italic;">"${p.reviewerComments}"</div>
      </div>` : ''}
      ${btn(p.documentUrl, 'View Document in SANPC DMS', '#1C3557', '#fff')}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px;" />
      <p style="margin:0;font-size:12px;color:#9ca3af;">This is an automated notification from SANPC DMS.</p>
    </div>
  </div>
</body></html>`
}

export async function sendOriginatorNotification(props: OriginatorEmailProps): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(`[email] not configured — would notify originator ${props.toEmail} of ${props.outcome}`)
    return
  }
  const token = await getToken()
  const subjectMap = {
    APPROVED: `[SANPC DMS] ✅ Approved: ${props.documentTitle}`,
    REVIEW_COMPLETE: `[SANPC DMS] 📋 Review Complete — Action Required: ${props.documentTitle}`,
    CHANGES_REQUESTED: `[SANPC DMS] ✏️ Changes Requested: ${props.documentTitle}`,
    REJECTED: `[SANPC DMS] ❌ Rejected: ${props.documentTitle}`,
  }
  await fetch(`${GRAPH}/users/${process.env.MAIL_SENDER}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject: subjectMap[props.outcome],
        body: { contentType: 'HTML', content: buildOriginatorHtml(props) },
        toRecipients: [{ emailAddress: { address: props.toEmail, name: props.toName } }],
      },
      saveToSentItems: false,
    }),
  })
}
