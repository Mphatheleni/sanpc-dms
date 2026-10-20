/**
 * Email notifications via Microsoft Graph API (application permissions).
 *
 * Uses the Azure AD app registration credentials to obtain a client-credentials
 * token and calls /users/{sender}/sendMail — no mailbox password required.
 *
 * Required env vars:
 *   MAIL_SENDER          — M365 mailbox the app sends FROM (needs Mail.Send app permission)
 *   AZURE_TENANT_ID      — Azure AD tenant ID
 *   AZURE_CLIENT_ID      — App registration client ID
 *   AZURE_CLIENT_SECRET  — App registration client secret
 *   APP_URL              — Public base URL of this app (used in email links)
 */

export function isEmailConfigured(): boolean {
  return !!(
    process.env.MAIL_SENDER &&
    process.env.AZURE_TENANT_ID &&
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET
  )
}

async function getGraphToken(): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.AZURE_CLIENT_ID!,
        client_secret: process.env.AZURE_CLIENT_SECRET!,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    },
  )
  if (!res.ok) throw new Error(`[email] token request failed: ${await res.text()}`)
  const data = await res.json()
  return data.access_token as string
}

async function sendViaGraph(
  toEmail: string,
  toName: string,
  subject: string,
  htmlBody: string,
): Promise<void> {
  const sender = process.env.MAIL_SENDER!
  const token = await getGraphToken()
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${sender}/sendMail`,
    {
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
    },
  )
  if (!res.ok) throw new Error(`[email] Graph sendMail failed: ${await res.text()}`)
  console.log(`[email] sent via Graph from ${sender} to ${toEmail}`)
}

/* ── HTML helpers ─────────────────────────────────────────────────────────── */

/**
 * Shared outer wrapper — table-based structure renders correctly in Outlook.
 * MSO conditional comments fix width/centering; VML is used for buttons.
 */
function wrapEmail(content: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#edf0f5;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  bgcolor="#edf0f5" style="background-color:#edf0f5;">
  <tr>
    <td align="center" valign="top" style="padding:36px 16px;">
      <!--[if (gte mso 9)|(IE)]><table role="presentation" align="center" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="max-width:600px;background-color:#ffffff;">

        <!-- ─── HEADER ────────────────────────────────────────── -->
        <tr>
          <td bgcolor="#1C3557" style="background-color:#1C3557;padding:26px 36px 22px;">
            <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;
              font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.3px;line-height:1.2;">SANPC DMS</p>
            <p style="margin:5px 0 0;font-size:10px;font-weight:700;color:#F5A623;
              font-family:Arial,Helvetica,sans-serif;letter-spacing:0.18em;text-transform:uppercase;">
              Powering Your Tomorrow
            </p>
          </td>
        </tr>

        <!-- ─── GOLD ACCENT STRIPE ────────────────────────────── -->
        <tr>
          <td bgcolor="#F5A623" height="4"
            style="background-color:#F5A623;height:4px;line-height:4px;font-size:1px;">&nbsp;</td>
        </tr>

        <!-- ─── BODY ──────────────────────────────────────────── -->
        <tr>
          <td style="padding:36px 36px 32px;background-color:#ffffff;">
            ${content}
          </td>
        </tr>

        <!-- ─── FOOTER ───────────────────────────────────────── -->
        <tr>
          <td bgcolor="#f5f7fa" style="background-color:#f5f7fa;padding:20px 36px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="border-top:1px solid #e0e4ea;padding-top:16px;">
                  <p style="margin:0;font-size:11px;color:#9ca3af;
                    font-family:Arial,Helvetica,sans-serif;line-height:1.7;">
                    This is an automated notification from
                    <strong style="color:#6b7280;">SANPC DMS</strong>.
                    Please do not reply to this email.
                    If you need assistance, contact your Document Controller.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
      <!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`
}

/**
 * Outlook-compatible CTA button.
 * Outlook uses VML (Vector Markup Language) for rounded buttons.
 * All other clients (Gmail, Apple Mail, web) use the standard <a> tag.
 */
function btn(href: string, label: string, bg: string, fg: string): string {
  return `<!--[if mso]>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:8px;"><tr><td>
  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
    href="${href}" style="height:44px;v-text-anchor:middle;width:252px;" arcsize="15%" stroke="f" fillcolor="${bg}">
    <w:anchorlock/>
    <center style="color:${fg};font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;">${label}</center>
  </v:roundrect>
</td></tr></table>
<![endif]-->
<!--[if !mso]><!-->
<a href="${href}" target="_blank"
  style="display:inline-block;margin-top:8px;padding:13px 26px;background-color:${bg};
    color:${fg};font-weight:700;font-size:14px;border-radius:8px;text-decoration:none;
    font-family:Arial,Helvetica,sans-serif;">
  ${label}
</a>
<!--<![endif]-->`
}

/** Document info card — table-based for reliable Outlook rendering */
function infoCard(docTitle: string, rows: Array<[string, string]> = []): string {
  const rowsHtml = rows.map(([label, value]) => `
    <tr>
      <td width="148" valign="top"
        style="padding:5px 16px 5px 0;font-size:12px;color:#9ca3af;
          font-family:Arial,Helvetica,sans-serif;white-space:nowrap;">${label}</td>
      <td valign="top"
        style="padding:5px 0;font-size:13px;color:#374151;
          font-family:Arial,Helvetica,sans-serif;font-weight:600;">${value}</td>
    </tr>`).join('')

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  bgcolor="#f9fafb"
  style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:24px;">
  <tr>
    <td style="padding:18px 20px;">
      <p style="margin:0 0 ${rowsHtml ? '12' : '0'}px;font-size:17px;font-weight:700;color:#1C3557;
        font-family:Arial,Helvetica,sans-serif;line-height:1.3;">${docTitle}</p>
      ${rowsHtml
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rowsHtml}</table>`
        : ''}
    </td>
  </tr>
</table>`
}

/** Coloured status/alert banner with left border accent */
function banner(title: string, message: string, color: string, bg: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="margin-bottom:24px;">
  <tr>
    <td bgcolor="${bg}"
      style="background-color:${bg};padding:14px 18px;border-left:4px solid ${color};">
      <p style="margin:0 0 ${message ? '4' : '0'}px;font-size:14px;font-weight:700;
        color:${color};font-family:Arial,Helvetica,sans-serif;">${title}</p>
      ${message
        ? `<p style="margin:0;font-size:13px;color:#374151;
             font-family:Arial,Helvetica,sans-serif;line-height:1.5;">${message}</p>`
        : ''}
    </td>
  </tr>
</table>`
}

/** Two-column numbered step list — uses table cells for Outlook compatibility */
function steps(items: string[]): string {
  const rows = items.map((item, i) => `
    <tr>
      <td width="22" valign="top"
        style="padding:3px 10px 3px 0;font-size:13px;font-weight:700;color:#1C3557;
          font-family:Arial,Helvetica,sans-serif;">${i + 1}.</td>
      <td valign="top"
        style="padding:3px 0;font-size:13px;color:#374151;
          font-family:Arial,Helvetica,sans-serif;line-height:1.7;">${item}</td>
    </tr>`).join('')

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="margin-bottom:24px;">${rows}</table>`
}

/* ── Review / Approval notification ──────────────────────────────────────── */

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

function buildHtml({
  toName, documentTitle, documentUrl, reviewUrl, deadline, isApprover, uploaderName, isReminder,
}: ReviewEmailProps): string {
  const role = isApprover ? 'approve' : 'review'
  const actionLabel = isApprover ? 'Open Document for Approval' : 'Open Document for Review'
  const primaryUrl = reviewUrl || documentUrl

  const deadlineRow: Array<[string, string]> = deadline
    ? [[
        'Review deadline',
        `<span style="color:#EF4444;font-weight:700;">${
          new Date(deadline).toLocaleDateString('en-ZA', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })
        }</span>`,
      ]]
    : []

  const content = `
    ${isReminder ? banner(
      'Reminder — Action Still Required',
      'This is a follow-up reminder. Your review has been pending for 18 days.',
      '#92400E', '#FEF3C7',
    ) : ''}
    <p style="margin:0 0 6px;font-size:16px;color:#374151;font-family:Arial,Helvetica,sans-serif;">
      Dear <strong>${toName}</strong>,
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#374151;
      font-family:Arial,Helvetica,sans-serif;line-height:1.7;">
      You have been assigned to <strong>${role}</strong> the following document.
      Please open it in SANPC DMS and record your formal decision.
    </p>
    ${infoCard(documentTitle, [['Submitted by', uploaderName], ...deadlineRow])}
    <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#374151;
      font-family:Arial,Helvetica,sans-serif;">
      How to complete your ${role}:
    </p>
    ${steps([
      'Click the button below and sign in with your Microsoft account.',
      'Preview the document and use the Review panel to record your formal decision.',
    ])}
    ${btn(primaryUrl, actionLabel, '#1C3557', '#ffffff')}
  `

  return wrapEmail(content)
}

export async function sendReviewNotification(props: ReviewEmailProps): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(`[email] not configured — would send to ${props.toEmail}`)
    console.log(`  Subject: [SANPC DMS] ${props.isApprover ? 'Approval' : 'Review'} Required: ${props.documentTitle}`)
    console.log(`  Review URL: ${props.reviewUrl}`)
    return
  }
  const reminderPrefix = props.isReminder ? 'REMINDER: ' : ''
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

/* ── Originator outcome notification ─────────────────────────────────────── */

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
    APPROVED:          { label: 'Document Approved',          color: '#16A34A', bg: '#F0FDF4',
      message: 'Your document has been fully approved.' },
    REVIEW_COMPLETE:   { label: 'All Reviews Complete',        color: '#1C3557', bg: '#E8EDF4',
      message: 'All reviewers have completed their review. Please check annotations in Office 365, make any final edits, then send for approval.' },
    REVIEWER_COMPLETE: { label: 'Review Submitted',            color: '#7C3AED', bg: '#F5F3FF',
      message: 'A reviewer has submitted their review. Check the document for comments and annotations.' },
    CHANGES_REQUESTED: { label: 'Changes Requested',          color: '#D97706', bg: '#FFFBEB',
      message: 'A reviewer has requested changes. Please update the document and resubmit.' },
    REJECTED:          { label: 'Document Rejected',           color: '#DC2626', bg: '#FEF2F2',
      message: 'Your document has been rejected. Please review the comments and resubmit if appropriate.' },
  }[p.outcome]

  const commentsBlock = p.reviewerComments
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="margin-bottom:24px;">
        <tr>
          <td bgcolor="#f9fafb" style="background-color:#f9fafb;border:1px solid #e5e7eb;
            border-radius:8px;padding:16px 18px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;
              text-transform:uppercase;color:#9ca3af;font-family:Arial,Helvetica,sans-serif;">
              Reviewer comments
            </p>
            <p style="margin:0;font-size:14px;color:#374151;font-style:italic;
              font-family:Arial,Helvetica,sans-serif;line-height:1.6;">
              &ldquo;${p.reviewerComments}&rdquo;
            </p>
          </td>
        </tr>
      </table>`
    : ''

  const content = `
    ${banner(outcomeConfig.label, outcomeConfig.message, outcomeConfig.color, outcomeConfig.bg)}
    <p style="margin:0 0 6px;font-size:16px;color:#374151;font-family:Arial,Helvetica,sans-serif;">
      Dear <strong>${p.toName}</strong>,
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#374151;
      font-family:Arial,Helvetica,sans-serif;line-height:1.7;">
      <strong>${p.reviewerName}</strong> has reviewed
      <strong>${p.documentTitle}</strong> and recorded the decision:
      <strong style="color:${outcomeConfig.color};">${outcomeConfig.label}</strong>.
    </p>
    ${commentsBlock}
    ${btn(p.documentUrl, 'View Document in SANPC DMS', '#1C3557', '#ffffff')}
  `

  return wrapEmail(content)
}

export async function sendOriginatorNotification(props: OriginatorEmailProps): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(`[email] not configured — would notify originator ${props.toEmail} of ${props.outcome}`)
    return
  }
  const subjectMap = {
    APPROVED:          `[SANPC DMS] Approved: ${props.documentTitle}`,
    REVIEW_COMPLETE:   `[SANPC DMS] All Reviews Complete — Action Required: ${props.documentTitle}`,
    REVIEWER_COMPLETE: `[SANPC DMS] Review Submitted by ${props.reviewerName}: ${props.documentTitle}`,
    CHANGES_REQUESTED: `[SANPC DMS] Changes Requested: ${props.documentTitle}`,
    REJECTED:          `[SANPC DMS] Rejected: ${props.documentTitle}`,
  }
  await sendViaGraph(props.toEmail, props.toName, subjectMap[props.outcome], buildOriginatorHtml(props))
}

/* ── Reviewer removed notification ───────────────────────────────────────── */

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

  const content = `
    ${banner(
      'You have been removed from a review workflow',
      'No further action is required from you on this document.',
      '#6B7280', '#F9FAFB',
    )}
    <p style="margin:0 0 6px;font-size:16px;color:#374151;font-family:Arial,Helvetica,sans-serif;">
      Dear <strong>${props.toName}</strong>,
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#374151;
      font-family:Arial,Helvetica,sans-serif;line-height:1.7;">
      You have been removed from the review workflow for the following document.
      You do not need to take any further action.
    </p>
    ${infoCard(props.documentTitle)}
    ${btn(props.documentUrl, 'View Document', '#1C3557', '#ffffff')}
  `

  await sendViaGraph(
    props.toEmail, props.toName,
    `[SANPC DMS] Removed from review: ${props.documentTitle}`,
    wrapEmail(content),
  )
}

/* ── Approver heads-up when document submitted for review ─────────────────── */

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

  const content = `
    ${banner(
      'For Your Information — Document Submitted for Review',
      'You will be notified when this document reaches the approval stage.',
      '#1C3557', '#E8EDF4',
    )}
    <p style="margin:0 0 6px;font-size:16px;color:#374151;font-family:Arial,Helvetica,sans-serif;">
      Dear <strong>${props.toName}</strong>,
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#374151;
      font-family:Arial,Helvetica,sans-serif;line-height:1.7;">
      <strong>${props.uploaderName}</strong> has submitted the following document for review.
      Once all reviewers have completed their review, you will receive a separate email
      asking you to formally approve it.
    </p>
    ${infoCard(props.documentTitle)}
    ${btn(props.documentUrl, 'View Document in SANPC DMS', '#1C3557', '#ffffff')}
  `

  await sendViaGraph(
    props.toEmail, props.toName,
    `[SANPC DMS] FYI — Under Review: ${props.documentTitle}`,
    wrapEmail(content),
  )
}

/* ── Document Controller stage notifications ──────────────────────────────── */

export type DocControllerStage = 'SUBMITTED' | 'IN_APPROVAL' | 'AUTHORIZED' | 'APPROVED' | 'REJECTED'

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

  const stageConfig: Record<DocControllerStage, { label: string; color: string; bg: string; body: string }> = {
    SUBMITTED:   {
      label: 'Review Workflow Started',
      color: '#1C3557', bg: '#E8EDF4',
      body: 'The document has been submitted for review and the assigned reviewers have been notified. You will receive another notification once all reviews are complete.',
    },
    IN_APPROVAL: {
      label: 'Sent for Approval',
      color: '#7C3AED', bg: '#F5F3FF',
      body: 'All reviewers have completed their review. The document has been sent to the approvers for formal sign-off. You will be notified when a final approval decision is made.',
    },
    AUTHORIZED:  {
      label: 'Document Authorized',
      color: '#0D9488', bg: '#F0FDFA',
      body: 'All approvers have formally approved this document and all authorizers have given their final sign-off. You may now publish it by marking it as Controlled in the SANPC DMS.',
    },
    APPROVED:    {
      label: 'Document Approved',
      color: '#16A34A', bg: '#F0FDF4',
      body: 'All approvers have formally approved this document. You may now publish it by marking it as Controlled in the SANPC DMS.',
    },
    REJECTED:    {
      label: 'Document Rejected',
      color: '#DC2626', bg: '#FEF2F2',
      body: 'This document has been rejected. Please open it in the SANPC DMS to review the feedback, coordinate with the Originator to address the comments, and resubmit when ready.',
    },
  }

  const subjectMap: Record<DocControllerStage, string> = {
    SUBMITTED:   `[SANPC DMS] Workflow Started: ${props.documentTitle}`,
    IN_APPROVAL: `[SANPC DMS] Sent for Approval: ${props.documentTitle}`,
    AUTHORIZED:  `[SANPC DMS] Authorized — Action Required: ${props.documentTitle}`,
    APPROVED:    `[SANPC DMS] Approved — Action Required: ${props.documentTitle}`,
    REJECTED:    `[SANPC DMS] Rejected: ${props.documentTitle}`,
  }

  const cfg = stageConfig[props.stage]

  const content = `
    ${banner(cfg.label, '', cfg.color, cfg.bg)}
    <p style="margin:0 0 6px;font-size:16px;color:#374151;font-family:Arial,Helvetica,sans-serif;">
      Dear <strong>${props.toName}</strong>,
    </p>
    ${infoCard(props.documentTitle)}
    <p style="margin:0 0 28px;font-size:14px;color:#374151;
      font-family:Arial,Helvetica,sans-serif;line-height:1.7;">${cfg.body}</p>
    ${btn(props.documentUrl, 'Open in SANPC DMS', cfg.color, '#ffffff')}
  `

  await sendViaGraph(props.toEmail, props.toName, subjectMap[props.stage], wrapEmail(content))
}

/* ── Review deadline expired ──────────────────────────────────────────────── */

export async function sendDeadlineExpiredEmail(props: {
  toEmail: string
  toName: string
  documentTitle: string
  documentUrl: string
  isDC: boolean
}): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(`[email] not configured — would send deadline-expired notice to ${props.toEmail}`)
    return
  }

  const message = props.isDC
    ? 'The 21-day review window has closed. The document has been returned to Changes Requested — please coordinate with the Originator to update and resubmit.'
    : 'The 21-day review window for this document has closed. The document has been returned to you for updates. Please revise and resubmit when ready.'

  const content = `
    ${banner('Review Deadline Expired', message, '#92400E', '#FEF3C7')}
    <p style="margin:0 0 6px;font-size:16px;color:#374151;font-family:Arial,Helvetica,sans-serif;">
      Dear <strong>${props.toName}</strong>,
    </p>
    ${infoCard(props.documentTitle)}
    ${btn(props.documentUrl, 'View Document in SANPC DMS', '#1C3557', '#ffffff')}
  `

  await sendViaGraph(
    props.toEmail, props.toName,
    `[SANPC DMS] Review Deadline Expired: ${props.documentTitle}`,
    wrapEmail(content),
  )
}

/* ── Document file replaced — notify active reviewers/approvers ───────────── */

export async function sendDocumentUpdatedEmail(props: {
  toEmail: string
  toName: string
  documentTitle: string
  documentUrl: string
  sharePointUrl?: string | null
  uploaderName: string
}): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(`[email] not configured — would send document-updated notice to ${props.toEmail}`)
    return
  }

  const content = `
    ${banner(
      'New Version Available — Please Review Updated File',
      'A new version has been uploaded. Please use the updated file for your review — your existing review link remains valid.',
      '#92400E', '#FEF3C7',
    )}
    <p style="margin:0 0 6px;font-size:16px;color:#374151;font-family:Arial,Helvetica,sans-serif;">
      Dear <strong>${props.toName}</strong>,
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#374151;
      font-family:Arial,Helvetica,sans-serif;line-height:1.7;">
      <strong>${props.uploaderName}</strong> has uploaded a new version of the following document.
    </p>
    ${infoCard(props.documentTitle)}
    ${btn(props.documentUrl, 'View Updated Document', '#1C3557', '#ffffff')}
  `

  await sendViaGraph(
    props.toEmail, props.toName,
    `[SANPC DMS] Document Updated: ${props.documentTitle}`,
    wrapEmail(content),
  )
}

/* ── Manual status change notification ───────────────────────────────────── */

const STATUS_EMAIL_CONFIG: Record<string, { label: string; color: string; bg: string; message: string }> = {
  IN_REVIEW:              { label: 'Document Sent for Review',        color: '#1C3557', bg: '#E8EDF4',
    message: 'Your document has been submitted for review. The assigned reviewers have been notified and will record their decisions.' },
  PENDING_REVIEW:         { label: 'Document Pending Review',         color: '#1C3557', bg: '#E8EDF4',
    message: 'Your document is queued for review.' },
  UPDATING:               { label: 'Review Complete — Action Required', color: '#D97706', bg: '#FFFBEB',
    message: 'All reviewers have completed their review. The Document Controller will coordinate any final edits before sending for approval.' },
  CHANGES_REQUESTED:      { label: 'Changes Requested',               color: '#D97706', bg: '#FFFBEB',
    message: 'Changes have been requested on your document. Please review the reviewer comments and provide an updated version to the Document Controller.' },
  FINAL_DRAFT:            { label: 'Document Sent for Approval',      color: '#7C3AED', bg: '#F5F3FF',
    message: 'Your document has been sent to the approvers for formal sign-off. You will be notified once a decision is made.' },
  PENDING_APPROVAL:       { label: 'Document Pending Approval',       color: '#7C3AED', bg: '#F5F3FF',
    message: 'Your document is awaiting formal approval.' },
  PENDING_AUTHORIZATION:  { label: 'Document Sent for Authorization', color: '#0D9488', bg: '#F0FDFA',
    message: 'All approvers have signed off. Your document has been sent to the authorizer(s) for final sign-off.' },
  APPROVED:               { label: 'Document Approved',               color: '#16A34A', bg: '#F0FDF4',
    message: 'Your document has been fully approved.' },
  CONTROLLED:             { label: 'Document Controlled',             color: '#16A34A', bg: '#F0FDF4',
    message: 'Your document has been officially controlled and published to the document repository.' },
  SUPERSEDED:             { label: 'Document Superseded',             color: '#6B7280', bg: '#F9FAFB',
    message: 'Your document has been superseded by a newer revision and is no longer the current version.' },
  CANCELLED:              { label: 'Document Cancelled',              color: '#DC2626', bg: '#FEF2F2',
    message: 'Your document has been cancelled by the Document Controller.' },
  REJECTED:               { label: 'Document Rejected',               color: '#DC2626', bg: '#FEF2F2',
    message: 'Your document has been rejected. Please review the comments and resubmit with the necessary changes.' },
}

export async function sendStatusChangeEmail(props: {
  toEmail: string
  toName: string
  documentTitle: string
  documentUrl: string
  newStatus: string
  reason?: string | null
}): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(`[email] not configured — would send status-change notice (${props.newStatus}) to ${props.toEmail}`)
    return
  }

  const cfg = STATUS_EMAIL_CONFIG[props.newStatus]
  if (!cfg) return

  const reasonBlock = props.reason
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="margin-bottom:24px;">
        <tr>
          <td bgcolor="#f9fafb" style="background-color:#f9fafb;border:1px solid #e5e7eb;
            border-radius:8px;padding:16px 18px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.08em;
              text-transform:uppercase;color:#9ca3af;font-family:Arial,Helvetica,sans-serif;">
              Reason
            </p>
            <p style="margin:0;font-size:14px;color:#374151;
              font-family:Arial,Helvetica,sans-serif;line-height:1.6;">${props.reason}</p>
          </td>
        </tr>
      </table>`
    : ''

  const content = `
    ${banner(cfg.label, cfg.message, cfg.color, cfg.bg)}
    <p style="margin:0 0 6px;font-size:16px;color:#374151;font-family:Arial,Helvetica,sans-serif;">
      Dear <strong>${props.toName}</strong>,
    </p>
    ${infoCard(props.documentTitle)}
    ${reasonBlock}
    ${btn(props.documentUrl, 'View Document in SANPC DMS', cfg.color, '#ffffff')}
  `

  await sendViaGraph(
    props.toEmail, props.toName,
    `[SANPC DMS] ${cfg.label}: ${props.documentTitle}`,
    wrapEmail(content),
  )
}

// ── Role change notification ───────────────────────────────────────────────

export async function sendRoleChangedEmail(props: {
  toEmail: string
  toName: string
  newRole: string
  newRoleLabel: string
  appUrl: string
}): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(`[email] not configured — would send role-change email to ${props.toEmail} (${props.newRoleLabel})`)
    return
  }

  const content = `
    ${banner('Your Account Role Has Been Updated', '', '#1C3557', '#E8EDF4')}
    <p style="margin:0 0 16px;font-size:16px;color:#374151;font-family:Arial,Helvetica,sans-serif;">
      Dear <strong>${props.toName}</strong>,
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#374151;font-family:Arial,Helvetica,sans-serif;line-height:1.6;">
      Your account role in the SANPC Document Management System has been updated by an administrator.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="margin-bottom:24px;">
      <tr>
        <td bgcolor="#f0fdf4"
          style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 18px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;
            color:#9ca3af;font-family:Arial,Helvetica,sans-serif;">New Role</p>
          <p style="margin:0;font-size:20px;font-weight:700;color:#166534;
            font-family:Arial,Helvetica,sans-serif;">${props.newRoleLabel}</p>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 24px;font-size:14px;color:#374151;font-family:Arial,Helvetica,sans-serif;line-height:1.6;">
      Your permissions have been updated accordingly. If you believe this change was made in error,
      please contact your system administrator.
    </p>
    ${btn(props.appUrl, 'Open SANPC DMS', '#1C3557', '#ffffff')}
  `

  await sendViaGraph(
    props.toEmail, props.toName,
    `[SANPC DMS] Your account role has been updated to ${props.newRoleLabel}`,
    wrapEmail(content),
  )
}
