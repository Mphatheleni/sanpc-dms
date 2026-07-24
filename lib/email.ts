/**
 * Email notifications via Microsoft Graph API (delegated / ROPC flow).
 *
 * Uses the mail sender's own credentials to obtain a delegated access token,
 * then sends via /me/sendMail — requires only Mail.Send Delegated permission.
 *
 * Required env vars:
 *   AZURE_TENANT_ID     — Azure AD tenant ID
 *   AZURE_CLIENT_ID     — App registration client ID
 *   AZURE_CLIENT_SECRET — App registration client secret
 *   MAIL_SENDER         — M365 mailbox to send FROM (e.g. noreply@sa-npc.co.za)
 *   MAIL_PASSWORD       — Password for that mailbox
 *   APP_URL             — Public base URL of this app (used in email links)
 */

const GRAPH = 'https://graph.microsoft.com/v1.0'

export function isEmailConfigured(): boolean {
  return !!(
    process.env.AZURE_TENANT_ID &&
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET &&
    process.env.MAIL_SENDER &&
    process.env.MAIL_PASSWORD
  )
}

async function getGraphToken(): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'password',
        client_id:     process.env.AZURE_CLIENT_ID!,
        client_secret: process.env.AZURE_CLIENT_SECRET!,
        username:      process.env.MAIL_SENDER!,
        password:      process.env.MAIL_PASSWORD!,
        scope:         'https://graph.microsoft.com/Mail.Send offline_access',
      }),
    },
  )
  const data = await res.json()
  if (!data.access_token) {
    throw new Error(`Graph token error: ${data.error_description ?? JSON.stringify(data)}`)
  }
  return data.access_token
}

async function sendViaGraph(
  toEmail: string,
  toName: string,
  subject: string,
  htmlBody: string,
): Promise<void> {
  const sender = process.env.MAIL_SENDER!
  const token = await getGraphToken()

  const res = await fetch(`${GRAPH}/me/sendMail`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: htmlBody },
        toRecipients: [{ emailAddress: { address: toEmail, name: toName } }],
        from: { emailAddress: { address: sender, name: 'SANPC DMS' } },
      },
      saveToSentItems: false,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Graph sendMail failed (${res.status}): ${text}`)
  }

  console.log(`[email] sent via Graph API from ${sender} to ${toEmail}`)
}

/* ── HTML helpers ────────────────────────────────────────────────────────── */

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
  toName, documentTitle, documentUrl, reviewUrl, sharePointUrl, deadline, isApprover, uploaderName, isReminder,
}: ReviewEmailProps): string {
  const role = isApprover ? 'approve' : 'review'
  const actionLabel = isApprover ? '✅ Approve / Reject Document' : '✅ Mark Review Complete'
  const primaryUrl = reviewUrl || documentUrl

  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;
    box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="background:#1C3557;padding:28px 32px;">
      <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.3px;">SANPC DMS</div>
      <div style="font-size:11px;font-weight:600;letter-spacing:.18em;color:#F5A623;margin-top:2px;">
        POWERING YOUR TOMORROW
      </div>
    </div>
    <div style="padding:32px;">
      ${isReminder ? `<div style="background:#FEF3C7;border-left:4px solid #F59E0B;border-radius:6px;padding:10px 16px;margin-bottom:20px;">
        <div style="font-size:13px;font-weight:700;color:#92400E;">⏰ Reminder — Action Required</div>
        <div style="font-size:12px;color:#78350F;margin-top:2px;">This is a reminder. Your review has been pending for 18 days.</div>
      </div>` : ''}
      <p style="margin:0 0 8px;font-size:16px;color:#374151;">Dear <strong>${toName}</strong>,</p>
      <p style="margin:0 0 20px;font-size:15px;color:#374151;">
        You have been assigned to <strong>${role}</strong> the following document:
      </p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
        <div style="font-size:17px;font-weight:700;color:#1C3557;margin-bottom:12px;">${documentTitle}</div>
        <table style="border-collapse:collapse;width:100%;">
          <tr><td style="padding:4px 0;color:#6b7280;font-size:13px;">Uploaded by</td>
              <td style="padding:4px 0;font-size:13px;">${uploaderName}</td></tr>
          ${deadlineHtml(deadline)}
        </table>
      </div>
      <p style="margin:0 0 12px;font-size:14px;color:#374151;font-weight:600;">How to complete your ${role}:</p>
      <ol style="margin:0 0 20px;padding-left:20px;font-size:14px;color:#374151;line-height:2;">
        ${sharePointUrl ? `<li>Click <strong>"Open &amp; Annotate in Office 365"</strong> to read, comment, and track changes directly in Word or Excel Online.</li>` : ''}
        <li>Once done annotating, click <strong>"${actionLabel.replace(/✅ /, '')}"</strong> below to record your formal decision — <em>no DMS login required</em>.</li>
      </ol>
      <div style="margin-bottom:16px;">
        ${sharePointUrl ? btn(sharePointUrl, '📄 Open &amp; Annotate in Office 365', '#0078D4', '#fff') : ''}
        ${btn(primaryUrl, actionLabel, '#1C3557', '#fff')}
      </div>
      <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">
        Or <a href="${documentUrl}" style="color:#1C3557;">view the document in SANPC DMS</a> (requires login).
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px;" />
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        This is a secure, personalised link. Do not forward this email.
        Automated notification from SANPC DMS.
      </p>
    </div>
  </div>
</body></html>`
}

/* ── Public interfaces ───────────────────────────────────────────────────── */

export interface ReviewEmailProps {
  toEmail: string
  toName: string
  documentTitle: string
  documentUrl: string
  reviewUrl?: string | null
  sharePointUrl?: string | null
  deadline?: string | null
  isApprover: boolean
  uploaderName: string
  isReminder?: boolean
}

export async function sendReviewNotification(props: ReviewEmailProps): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(`[email] not configured — would send to ${props.toEmail}`)
    console.log(`  Subject: [SANPC DMS] ${props.isApprover ? 'Approval' : 'Review'} Required: ${props.documentTitle}`)
    console.log(`  Review URL: ${props.reviewUrl}`)
    return
  }
  const reminderPrefix = props.isReminder ? '⏰ REMINDER: ' : ''
  const subject = `[SANPC DMS] ${reminderPrefix}${props.isApprover ? 'Approval' : 'Review'} Required: ${props.documentTitle}`
  await sendViaGraph(props.toEmail, props.toName, subject, buildHtml(props))
}

export function sendBulkReviewNotifications(notifications: ReviewEmailProps[]): void {
  for (const n of notifications) {
    sendReviewNotification(n).catch((err) =>
      console.error(`[email] failed to send to ${n.toEmail}:`, err)
    )
  }
}

/** Awaitable version — use in API routes so emails complete before the response returns. */
export async function sendBulkReviewNotificationsAsync(notifications: ReviewEmailProps[]): Promise<void> {
  await Promise.all(
    notifications.map((n) =>
      sendReviewNotification(n).catch((err) =>
        console.error(`[email] failed to send to ${n.toEmail}:`, err)
      )
    )
  )
}

export type OriginatorOutcome = 'CHANGES_REQUESTED' | 'REJECTED' | 'APPROVED' | 'REVIEW_COMPLETE' | 'REVIEWER_COMPLETE'

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
    APPROVED:           { label: 'Approved',             color: '#16A34A', bg: '#F0FDF4', message: 'Your document has been fully approved.' },
    REVIEW_COMPLETE:    { label: 'All Reviews Complete',  color: '#1C3557', bg: '#E8EDF4', message: 'All reviewers have completed their review. Please check annotations in Office 365, make any final edits, then send for approval.' },
    REVIEWER_COMPLETE:  { label: 'Review Submitted',      color: '#7C3AED', bg: '#F5F3FF', message: 'A reviewer has submitted their review. Check the document for comments and annotations.' },
    CHANGES_REQUESTED:  { label: 'Changes Requested',    color: '#D97706', bg: '#FFFBEB', message: 'A reviewer has requested changes. Please update the document and resubmit.' },
    REJECTED:           { label: 'Rejected',              color: '#DC2626', bg: '#FEF2F2', message: 'Your document has been rejected. Please review the comments and resubmit if appropriate.' },
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
        <strong>${p.reviewerName}</strong> has reviewed <strong>${p.documentTitle}</strong>
        and recorded the decision: <strong style="color:${outcomeConfig.color};">${outcomeConfig.label}</strong>.
      </p>
      ${p.reviewerComments ? `
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 18px;margin-bottom:20px;">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin-bottom:6px;">Reviewer comments</div>
        <div style="font-size:14px;color:#374151;font-style:italic;">"${p.reviewerComments}"</div>
      </div>` : ''}
      ${btn(p.documentUrl, 'View Document in SANPC DMS', '#1C3557', '#fff')}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px;" />
      <p style="margin:0;font-size:12px;color:#9ca3af;">Automated notification from SANPC DMS.</p>
    </div>
  </div>
</body></html>`
}

export async function sendOriginatorNotification(props: OriginatorEmailProps): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(`[email] not configured — would notify originator ${props.toEmail} of ${props.outcome}`)
    return
  }
  const subjectMap = {
    APPROVED:           `[SANPC DMS] Approved: ${props.documentTitle}`,
    REVIEW_COMPLETE:    `[SANPC DMS] All Reviews Complete — Action Required: ${props.documentTitle}`,
    REVIEWER_COMPLETE:  `[SANPC DMS] Review Submitted by ${props.reviewerName}: ${props.documentTitle}`,
    CHANGES_REQUESTED:  `[SANPC DMS] Changes Requested: ${props.documentTitle}`,
    REJECTED:           `[SANPC DMS] Rejected: ${props.documentTitle}`,
  }
  await sendViaGraph(props.toEmail, props.toName, subjectMap[props.outcome], buildOriginatorHtml(props))
}

/* ── S8: Reviewer removed notification ──────────────────────────────────── */

export async function sendReviewerRemovedEmail(props: {
  toEmail: string
  toName: string
  documentTitle: string
  documentUrl: string
}): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(`[email] not configured — would notify removed reviewer ${props.toEmail}`)
    return
  }
  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;
    box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="background:#1C3557;padding:28px 32px;">
      <div style="font-size:22px;font-weight:800;color:#fff;">SANPC DMS</div>
      <div style="font-size:11px;font-weight:600;letter-spacing:.18em;color:#F5A623;margin-top:2px;">POWERING YOUR TOMORROW</div>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;font-size:15px;color:#374151;">Dear <strong>${props.toName}</strong>,</p>
      <p style="margin:0 0 16px;font-size:14px;color:#374151;">
        You have been <strong>removed from the review workflow</strong> for the following document:
      </p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
        <div style="font-size:17px;font-weight:700;color:#1C3557;">${props.documentTitle}</div>
      </div>
      <p style="margin:0 0 16px;font-size:14px;color:#374151;">No further action is required from you on this document.</p>
      ${btn(props.documentUrl, 'View Document', '#1C3557', '#fff')}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px;" />
      <p style="margin:0;font-size:12px;color:#9ca3af;">Automated notification from SANPC DMS.</p>
    </div>
  </div>
</body></html>`
  await sendViaGraph(props.toEmail, props.toName, `[SANPC DMS] Removed from review: ${props.documentTitle}`, html)
}

/* ── S11: Approver heads-up when document submitted for review ──────────── */

export async function sendApproverHeadsUpEmail(props: {
  toEmail: string
  toName: string
  documentTitle: string
  documentUrl: string
  uploaderName: string
}): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(`[email] not configured — would send approver heads-up to ${props.toEmail}`)
    return
  }
  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;
    box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="background:#1C3557;padding:28px 32px;">
      <div style="font-size:22px;font-weight:800;color:#fff;">SANPC DMS</div>
      <div style="font-size:11px;font-weight:600;letter-spacing:.18em;color:#F5A623;margin-top:2px;">POWERING YOUR TOMORROW</div>
    </div>
    <div style="padding:32px;">
      <div style="background:#E8EDF4;border-left:4px solid #1C3557;border-radius:6px;padding:14px 18px;margin-bottom:24px;">
        <div style="font-size:14px;font-weight:700;color:#1C3557;">For Your Information — Document Submitted for Review</div>
        <div style="font-size:13px;color:#374151;margin-top:4px;">You will be notified when this document reaches the approval stage.</div>
      </div>
      <p style="margin:0 0 8px;font-size:15px;color:#374151;">Dear <strong>${props.toName}</strong>,</p>
      <p style="margin:0 0 16px;font-size:14px;color:#374151;">
        <strong>${props.uploaderName}</strong> has submitted the following document for review.
        Once all reviewers have completed their review, you will receive a separate notification to approve it.
      </p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
        <div style="font-size:17px;font-weight:700;color:#1C3557;">${props.documentTitle}</div>
      </div>
      ${btn(props.documentUrl, 'View Document in SANPC DMS', '#1C3557', '#fff')}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px;" />
      <p style="margin:0;font-size:12px;color:#9ca3af;">Automated notification from SANPC DMS.</p>
    </div>
  </div>
</body></html>`
  await sendViaGraph(props.toEmail, props.toName, `[SANPC DMS] FYI — Under Review: ${props.documentTitle}`, html)
}

/* ── S12: Document Controller stage notifications ───────────────────────── */

export type DocControllerStage = 'SUBMITTED' | 'IN_APPROVAL' | 'APPROVED' | 'REJECTED'

export async function sendDocControllerNotification(props: {
  toEmail: string
  toName: string
  documentTitle: string
  documentUrl: string
  stage: DocControllerStage
}): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(`[email] not configured — would send doc controller notification to ${props.toEmail} stage=${props.stage}`)
    return
  }
  const stageConfig: Record<DocControllerStage, { label: string; color: string; bg: string; message: string }> = {
    SUBMITTED:   { label: 'Document Submitted for Review',  color: '#1C3557', bg: '#E8EDF4', message: 'The document has been submitted and the review workflow has started.' },
    IN_APPROVAL: { label: 'Document Sent for Approval',     color: '#7C3AED', bg: '#F5F3FF', message: 'All reviewers have completed their review. The Final Draft has been sent for formal approval.' },
    APPROVED:    { label: 'Document Approved',              color: '#16A34A', bg: '#F0FDF4', message: 'The document has been formally approved by all approvers.' },
    REJECTED:    { label: 'Document Rejected',              color: '#DC2626', bg: '#FEF2F2', message: 'The document has been rejected. Please review the feedback and coordinate with the Originator.' },
  }
  const cfg = stageConfig[props.stage]
  const subjectMap: Record<DocControllerStage, string> = {
    SUBMITTED:   `[SANPC DMS] Workflow Started: ${props.documentTitle}`,
    IN_APPROVAL: `[SANPC DMS] Sent for Approval: ${props.documentTitle}`,
    APPROVED:    `[SANPC DMS] Approved: ${props.documentTitle}`,
    REJECTED:    `[SANPC DMS] Rejected: ${props.documentTitle}`,
  }
  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;
    box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="background:#1C3557;padding:28px 32px;">
      <div style="font-size:22px;font-weight:800;color:#fff;">SANPC DMS</div>
      <div style="font-size:11px;font-weight:600;letter-spacing:.18em;color:#F5A623;margin-top:2px;">POWERING YOUR TOMORROW</div>
    </div>
    <div style="padding:32px;">
      <div style="background:${cfg.bg};border-left:4px solid ${cfg.color};border-radius:6px;padding:14px 18px;margin-bottom:24px;">
        <div style="font-size:15px;font-weight:700;color:${cfg.color};">${cfg.label}</div>
        <div style="font-size:13px;color:#374151;margin-top:4px;">${cfg.message}</div>
      </div>
      <p style="margin:0 0 8px;font-size:15px;color:#374151;">Dear <strong>${props.toName}</strong>,</p>
      <p style="margin:0 0 16px;font-size:14px;color:#374151;">
        Document: <strong>${props.documentTitle}</strong>
      </p>
      ${btn(props.documentUrl, 'View Document in SANPC DMS', cfg.color, '#fff')}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px;" />
      <p style="margin:0;font-size:12px;color:#9ca3af;">Automated notification from SANPC DMS.</p>
    </div>
  </div>
</body></html>`
  await sendViaGraph(props.toEmail, props.toName, subjectMap[props.stage], html)
}
