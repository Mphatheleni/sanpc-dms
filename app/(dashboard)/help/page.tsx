'use client'

import { useState } from 'react'
import { Download, BookOpen, ChevronRight } from 'lucide-react'
import Image from 'next/image'

const sections = [
  { id: 'intro',        label: '1. Introduction' },
  { id: 'roles',        label: '2. Roles & Permissions' },
  { id: 'login',        label: '3. Logging In' },
  { id: 'lifecycle',    label: '4. Document Lifecycle' },
  { id: 'reviewing',    label: '5. Reviewing & Approving' },
  { id: 'dc-tasks',     label: '6. Document Manager Tasks' },
  { id: 'searching',    label: '7. Searching & Viewing' },
  { id: 'notifications',label: '8. Notifications & Email' },
  { id: 'appendix',     label: 'Appendix: Document Types' },
]

function Screenshot({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <figure className="my-6 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      <Image
        src={src}
        alt={alt}
        width={1280}
        height={800}
        className="w-full"
        unoptimized
      />
      {caption && (
        <figcaption className="bg-gray-50 border-t border-gray-100 px-4 py-2 text-xs text-gray-500 italic">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-14 scroll-mt-6">
      <h2 className="text-xl font-bold text-[#1C3557] mb-4 pb-2 border-b border-gray-200">{title}</h2>
      <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed space-y-4">
        {children}
      </div>
    </section>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 my-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#1C3557] text-white">
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 border-t border-gray-100 align-top">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Steps({ items }: { items: { title: string; body: string }[] }) {
  return (
    <ol className="space-y-3 my-4">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-[#1C3557] text-white text-xs font-bold mt-0.5">
            {i + 1}
          </span>
          <div>
            {item.title && <span className="font-semibold text-gray-800">{item.title} </span>}
            <span className="text-gray-600">{item.body}</span>
          </div>
        </li>
      ))}
    </ol>
  )
}

export default function HelpPage() {
  const [activeSection, setActiveSection] = useState('intro')

  function scrollTo(id: string) {
    setActiveSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex gap-6 h-full min-h-0">

      {/* ── Table of contents ─────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0">
        <div className="sticky top-0 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-[#1C3557]">
            <p className="text-xs font-bold text-white uppercase tracking-widest">Contents</p>
          </div>
          <nav className="py-2">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={`w-full text-left flex items-center gap-2 px-4 py-2 text-xs transition-colors ${
                  activeSection === s.id
                    ? 'text-[#1C3557] font-semibold bg-blue-50'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                {activeSection === s.id && <ChevronRight className="h-3 w-3 flex-shrink-0 text-[#F5A623]" />}
                {activeSection !== s.id && <span className="w-3" />}
                {s.label}
              </button>
            ))}
          </nav>
          <div className="px-4 py-3 border-t border-gray-100">
            <a
              href="/help/training-manual.pdf"
              download="SANPC-DMS-Training-Manual.pdf"
              className="flex items-center gap-2 w-full justify-center rounded-lg px-3 py-2 text-xs font-semibold text-white transition-colors"
              style={{ backgroundColor: '#1C3557' }}
            >
              <Download className="h-3.5 w-3.5" />
              Download PDF
            </a>
          </div>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm px-8 py-6 mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1C3557]">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1C3557]">SANPC DMS — Training Manual</h1>
              <p className="text-sm text-gray-500 mt-0.5">Complete guide for all roles · Document Management System</p>
            </div>
          </div>
          <a
            href="/help/training-manual.pdf"
            download="SANPC-DMS-Training-Manual.pdf"
            className="flex items-center gap-2 flex-shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors"
            style={{ backgroundColor: '#1C3557' }}
          >
            <Download className="h-4 w-4" />
            Download PDF
          </a>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm px-8 py-8">

          {/* ── 1. Introduction ─────────────────────────────────────────────── */}
          <Section id="intro" title="1. Introduction">
            <p>
              The <strong>SANPC Document Management System (DMS)</strong> is the organisation&apos;s central platform
              for creating, reviewing, approving, and controlling documents in line with procedure CSS/PR/CSF/005.
              Every document follows a defined lifecycle — from registration, through a structured review and approval
              workflow, to publication as a Controlled document.
            </p>
            <p>
              The system is hosted on Firebase App Hosting and integrates with Microsoft 365: users log in with their
              Azure AD credentials, documents are stored in SharePoint, and email notifications are sent via Microsoft Graph.
            </p>
            <p><strong>What the DMS manages:</strong></p>
            <ul className="list-disc pl-6 space-y-1 text-gray-600">
              <li>Document registration with metadata (number, type code, revision, originator, authorised-by)</li>
              <li>Reviewer and approver assignment with deadline tracking</li>
              <li>In-system annotation via SharePoint Office Online and a formal Approve / Request Changes / Reject decision workflow</li>
              <li>Automatic next-review-date calculation based on document type</li>
              <li>Version history, activity log, and supersession of old documents</li>
            </ul>

            <Screenshot
              src="/help/screenshots/02-dashboard.png"
              alt="SANPC DMS Dashboard"
              caption="The main dashboard — shows document status summary and recent activity."
            />
          </Section>

          {/* ── 2. Roles ─────────────────────────────────────────────────────── */}
          <Section id="roles" title="2. Roles & Permissions">
            <p>Every user account has one role assigned by an Admin. Roles determine which documents you can see and what actions you can take.</p>
            <Table
              headers={['Role', 'Who holds it', 'Key permissions']}
              rows={[
                ['Admin', 'IT / system owner', 'Full access to all documents, users, and settings. Can do everything a Document Manager can do.'],
                ['Document Controller (DC)', 'Document Control team', 'Upload documents, assign reviewers/approvers, change status, supersede, replace reviewers, see all documents including SUPERSEDED, view full activity log.'],
                ['Originator', 'Staff who author documents', 'Sees only documents they originated. Cannot change status or manage the workflow.'],
                ['Reviewer', 'Subject-matter experts invited to review', 'Sees documents assigned to them. Can open in SharePoint, annotate, and submit a decision (Approve / Request Changes / Reject).'],
                ['Approver', 'Senior staff who give final sign-off', 'Same review interface as Reviewer; their decision is a formal approval. Documents advance only after all approvers agree.'],
              ]}
            />
            <p className="text-sm text-gray-500">
              <strong>Access scope:</strong> Admins and Document Controllers see every document including SUPERSEDED ones.
              Originators see only their own documents. Reviewers/Approvers see documents assigned to them plus any they originated.
            </p>
          </Section>

          {/* ── 3. Logging In ────────────────────────────────────────────────── */}
          <Section id="login" title="3. Logging In">
            <p>The DMS uses your existing Microsoft 365 account — no separate password is required.</p>
            <Steps items={[
              { title: 'Navigate', body: 'Go to the DMS URL in any modern browser (Chrome, Edge, Firefox, Safari).' },
              { title: 'Sign in', body: 'Click Sign in with Microsoft. You are redirected to the Microsoft login page.' },
              { title: 'Authenticate', body: 'Enter your organisational email (e.g. firstname.lastname@sanpc.com), your M365 password, and complete any MFA prompt.' },
              { title: 'First login', body: 'On first login your account is provisioned automatically with the Reviewer role. A Document Controller or Admin assigns your final role.' },
              { title: 'Dashboard', body: 'After authentication you land on the Documents dashboard.' },
            ]} />
            <Screenshot
              src="/help/screenshots/01-login.png"
              alt="SANPC DMS Login page"
              caption="The login page — click 'Sign in with Microsoft' to use your M365 credentials."
            />
            <p className="text-sm bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-800">
              <strong>Troubleshooting:</strong> If you see an empty document list after login, contact a Document Controller to confirm your role has been assigned.
              Guest or external accounts are not supported — you must be in the SANPC Azure AD tenant.
            </p>
          </Section>

          {/* ── 4. Document Lifecycle ────────────────────────────────────────── */}
          <Section id="lifecycle" title="4. Document Lifecycle">
            <p>Every document moves through a series of statuses from initial upload to final Controlled publication. Document Controllers manage these transitions; the system automates status changes when workflow milestones are reached.</p>

            <Table
              headers={['Status', 'Meaning']}
              rows={[
                ['REGISTERED', 'Newly uploaded; metadata saved, workflow not yet started.'],
                ['DRAFT', 'Being prepared; optional intermediate state before submission.'],
                ['IN_REVIEW', 'Reviewers are actively working on the document.'],
                ['UPDATING', 'DC is incorporating reviewer feedback.'],
                ['REVIEW_COMPLETE', 'All reviewers have submitted their decisions.'],
                ['FINAL_DRAFT', 'Revised and ready for formal approval.'],
                ['PENDING_APPROVAL', 'Approvers have been notified and are reviewing.'],
                ['APPROVED', 'All approvers have given final approval.'],
                ['EXCO_PENDING', 'Awaiting ExCo sign-off before publication (Policy documents).'],
                ['CONTROLLED', 'Published and active. The official version.'],
                ['SUPERSEDED', 'Replaced by a newer revision. Hidden from most users.'],
                ['REJECTED', 'Returned by approvers; requires revision and resubmission.'],
                ['CHANGES_REQUESTED', 'Reviewers requested changes; DC must update and resubmit.'],
                ['CANCELLED', 'Withdrawn from the workflow.'],
              ]}
            />

            <p><strong>Typical workflow — step by step:</strong></p>
            <Steps items={[
              { title: 'DC uploads the document', body: 'Completes the upload form (see below). Status becomes REGISTERED.' },
              { title: 'DC submits for review', body: 'Clicks Submit for Review. Status moves to IN_REVIEW. All assigned reviewers receive an email with a secure review link.' },
              { title: 'Reviewers complete their review', body: 'Each reviewer opens the document in Office Online, annotates it, then submits their decision. When all are done, status moves to REVIEW_COMPLETE.' },
              { title: 'DC advances to approval', body: 'If changes were requested, DC updates the file and resubmits. If all reviewers approved, DC advances to PENDING_APPROVAL and approvers are notified.' },
              { title: 'Approvers give final sign-off', body: 'When all approvers approve, status becomes APPROVED.' },
              { title: 'DC publishes', body: 'DC manually marks the document CONTROLLED. It is now the official active version.' },
              { title: 'Superseding', body: 'When a newer revision is controlled under the same document number, the previous revision is automatically superseded.' },
            ]} />

            <Screenshot
              src="/help/screenshots/05-new-document.png"
              alt="New document upload wizard"
              caption="The document upload wizard — three steps: upload file, fill details, assign workflow members."
            />

            <p><strong>Uploading a document (Document Controller):</strong></p>
            <Steps items={[
              { title: 'Click New Document', body: 'From the dashboard or sidebar.' },
              { title: 'Upload file', body: 'Drag-and-drop or browse for a Word (.docx) file. The file uploads to SharePoint automatically.' },
              { title: 'Fill document details', body: 'Title (required), document number, type code, revision, category, originator, authorised by, purpose, and review deadline.' },
              { title: 'Add reviewers', body: 'Search the organisation directory and add reviewers in order.' },
              { title: 'Add approvers', body: 'Search and add approvers in order.' },
              { title: 'Create document', body: 'Click Create Document. Status is set to REGISTERED.' },
              { title: 'Submit for review', body: 'Return to the document and click Submit for Review to start the workflow.' },
            ]} />
          </Section>

          {/* ── 5. Reviewing & Approving ─────────────────────────────────────── */}
          <Section id="reviewing" title="5. Reviewing & Approving Documents">
            <p>When a document is submitted for review, every assigned reviewer receives an email with a secure, single-use review link. You do not need to log in to the DMS to use this link.</p>

            <p><strong>Reviewer workflow:</strong></p>
            <Steps items={[
              { title: 'Open the email', body: 'Sent from SANPC DMS. It contains the document title, an "Open & Annotate in Office Online" button (blue), and a "Review in SANPC DMS" button.' },
              { title: 'Read and annotate', body: 'Click Open & Annotate in Office Online. The document opens in Word/Excel Online. Use Word Comments or Track Changes to record your feedback. Changes save automatically.' },
              { title: 'Submit your decision', body: 'Click the Review in SANPC DMS link. On the review page, optionally type a summary in the comments box, then click Mark Review Complete.' },
              { title: 'Confirmation', body: 'You see a confirmation screen. A link to view the document in the DMS is provided for reference.' },
            ]} />

            <p className="text-sm bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-blue-800">
              <strong>Re-opening a used link</strong> shows a &ldquo;Already completed&rdquo; screen — your decision is recorded and final.
              If the DC has withdrawn the document from that stage, you will see a &ldquo;No Action Required&rdquo; screen.
            </p>

            <p><strong>Approver workflow:</strong></p>
            <p className="text-gray-600">Approvers receive the same email once all reviewers have completed their reviews. The approval page has two buttons:</p>
            <ul className="list-disc pl-6 space-y-1 text-gray-600">
              <li><strong>Final Approve</strong> (green) — the document is formally approved. Add optional notes before clicking.</li>
              <li><strong>Reject</strong> (red) — the document is returned to the DC with your comments. The DC must revise and resubmit.</li>
            </ul>
            <p className="text-gray-600">Once all approvers have approved, the document status moves to <strong>APPROVED</strong> and the DC is notified to publish it.</p>

            <Screenshot
              src="/help/screenshots/09-document-workflow.png"
              alt="Document workflow tab"
              caption="The Workflow tab — shows all reviewers and approvers, their status, and deadline."
            />
          </Section>

          {/* ── 6. DC Tasks ──────────────────────────────────────────────────── */}
          <Section id="dc-tasks" title="6. Document Manager (DC) Tasks">
            <Screenshot
              src="/help/screenshots/08-document-detail.png"
              alt="Document detail page"
              caption="The document detail page — metadata, preview, and control panel for Document Controllers."
            />

            <p><strong>Publishing (Mark as Controlled):</strong> Once all approvers have approved (status = APPROVED), open the document and click <em>Mark as Controlled</em>. A 40-year retention date is set automatically. If another revision with the same document number is already CONTROLLED, it is automatically superseded.</p>

            <p><strong>Superseding:</strong> Retiring a Controlled document is automatic when you publish a new revision under the same document number. Alternatively, open the older document and use <em>Mark as Superseded</em>.</p>

            <p><strong>Replacing a reviewer:</strong></p>
            <Steps items={[
              { title: '', body: 'Open the document\'s Workflow tab.' },
              { title: '', body: 'Find the reviewer\'s row and click Replace.' },
              { title: '', body: 'Search the organisation directory for the replacement.' },
              { title: '', body: 'Click Replace. If the review is active, the old reviewer receives a "removed" email and the new reviewer immediately gets their review notification with a new secure link.' },
            ]} />

            <p><strong>Other DC actions available from the document detail page:</strong></p>
            <ul className="list-disc pl-6 space-y-1 text-gray-600">
              <li><strong>Add reviewer / approver</strong> — from the Workflow tab; active reviews are notified immediately.</li>
              <li><strong>Remove reviewer</strong> — marks their record as REMOVED (kept in audit trail); they are notified if the review was already active.</li>
              <li><strong>Manually set status</strong> — administrative override for edge cases (e.g. moving a document back to DRAFT).</li>
              <li><strong>Cancel document</strong> — freezes the workflow; no further notifications are sent.</li>
              <li><strong>Request Changes (Controlled)</strong> — sends a published Controlled document back to CHANGES_REQUESTED for corrections.</li>
            </ul>

            <Screenshot
              src="/help/screenshots/10-document-history.png"
              alt="Document history / activity log"
              caption="The History tab — complete audit trail of every action on the document."
            />
          </Section>

          {/* ── 7. Searching & Viewing ───────────────────────────────────────── */}
          <Section id="searching" title="7. Searching, Filtering & Viewing Documents">
            <Screenshot
              src="/help/screenshots/04-documents-list.png"
              alt="Documents list page"
              caption="The Documents list — search by title/description, filter by status or category."
            />

            <p><strong>Searching:</strong> Type in the search box at the top of the documents list. Matches document title and description. Results update as you type.</p>
            <p><strong>Filtering:</strong> Use the filter dropdowns to narrow by Status or Category. Filters can be combined with a search term.</p>

            <p><strong>Document detail tabs:</strong></p>
            <Table
              headers={['Tab', 'Contents']}
              rows={[
                ['Overview', 'Document metadata: number, type, revision, originator, authorised by, purpose, next review date, tags, and custom metadata fields.'],
                ['Reviewer Comments', 'All comments left by reviewers and the DC during the workflow.'],
                ['Workflow', 'The list of reviewers and approvers, each with their status and deadline. DCs can replace, add, or remove members here.'],
                ['Attachments', 'Supporting files attached to the document. Each can be previewed or downloaded independently.'],
                ['History', 'Full activity log: every action on the document with user, timestamp, and details.'],
              ]}
            />

            <Screenshot
              src="/help/screenshots/11-document-attachments.png"
              alt="Document attachments tab"
              caption="The Attachments tab — supporting files attached to the document, each with preview and download."
            />

            <p><strong>Viewing the document:</strong> The detail page includes an inline Document Preview panel. Click <strong>View</strong> in the Files section to open the document in a new tab — Word and Excel files stored in SharePoint open in Office Online; PDFs open inline. Click <strong>Download</strong> to save a copy.</p>
          </Section>

          {/* ── 8. Notifications ─────────────────────────────────────────────── */}
          <Section id="notifications" title="8. Notifications & Email">
            <Table
              headers={['Trigger', 'Recipients', 'Content']}
              rows={[
                ['Document submitted for review', 'All activated reviewers', 'Secure review link, SharePoint annotation link, deadline'],
                ['Reviewers activated (approvers exist)', 'All approvers', 'Heads-up: document is under review; you will be notified when it reaches approval stage'],
                ['Workflow started', 'DC (uploader) + Originator', 'Confirmation that the review cycle has begun'],
                ['One reviewer completes', 'DC + Originator', 'Individual completion notice; check annotations'],
                ['All reviewers complete', 'DC + Originator', 'All reviews in; ready to advance to approval'],
                ['Reviewer requests changes or rejects', 'DC + Originator', 'Decision + reviewer comments'],
                ['Approval stage activated', 'All approvers', 'Secure approval link, deadline'],
                ['All approvers approve', 'DC + Originator', 'Document is approved and ready to publish'],
                ['Approver rejects', 'DC + Originator', 'Decision + approver comments'],
                ['Reviewer replaced (mid-review)', 'Old reviewer + New reviewer', 'Old: removed from workflow. New: full notification with fresh token.'],
                ['Review deadline expires', 'DC + Originator', 'Review window closed; document returned to Changes Requested'],
              ]}
            />

            <p><strong>Review token links</strong> are valid for <strong>14 days</strong> from generation. They do not require a DMS login. Re-opening a used link shows a confirmation screen — you cannot submit twice.</p>
            <p><strong>In-app notifications</strong> appear in the bell icon in the navigation bar for review assignments, status changes, and approvals. They link directly to the relevant document.</p>
            <p><strong>Sessions</strong> are valid for 8 hours. After that you are redirected to the login page.</p>
          </Section>

          {/* ── Appendix ─────────────────────────────────────────────────────── */}
          <Section id="appendix" title="Appendix: Full Document Type Code Reference">
            <Table
              headers={['Code', 'Document Type', 'Review Cycle']}
              rows={[
                ['PO', 'Policy', 'EXCO approval required before Controlled'],
                ['PR', 'Procedure', '6 years'],
                ['WP', 'Work Practice', '6 years'],
                ['WI', 'Work Instruction', '6 years'],
                ['ST', 'Strategy & Planning', '1 year'],
                ['RM', 'Risk Matrix', '2 years'],
                ['SD', 'Standard', '6 years'],
                ['GL', 'Guidelines', '3 years'],
                ['TR', 'Training Material', '6 years'],
                ['TS', 'Test Script', '6 years'],
                ['PF', 'Process Flow', '6 years'],
                ['F', 'Form / Template', '6 years'],
                ['COG', 'Corporate Governance', '6 years'],
                ['SP', 'Internal Specification', '6 years'],
                ['BC', 'Business Continuity Plan', '3 years'],
                ['TOR', 'Terms of Reference', '2 years'],
                ['MSM', 'Management System Manual', '6 years'],
              ]}
            />
            <p className="text-sm bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-800">
              <strong>Policy documents (PO):</strong> When marking a PO as Controlled, the system requires an EXCO/Board resolution first.
              The DC must advance the document to EXCO_PENDING status through the EXCO workflow before it can be published.
            </p>
          </Section>

        </div>
      </div>
    </div>
  )
}
