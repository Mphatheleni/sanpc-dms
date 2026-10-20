/**
 * Generates SANPC DMS UAT Sign-Off Certificate
 * Outputs: SANPC_DMS_UAT_Signoff.docx  +  SANPC_DMS_UAT_Signoff.pdf
 */
import puppeteer from 'puppeteer';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT   = resolve(__dir, '../docs/output');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const BLUE  = '1C3557';
const GOLD  = 'F5A623';
const WHITE = 'FFFFFF';
const LIGHT = 'F5F7FB';
const BORDER= 'D0D9E8';
const ORG   = 'South African National Petroleum Company (SANPC)';
const LOGO_B64 = readFileSync(resolve(__dir, '../docs/sanpc-logo.png')).toString('base64');
const LOGO_SRC = `data:image/png;base64,${LOGO_B64}`;

const tick = '☑';
const box  = '☐';

const scopeItems = [
  'User login — Microsoft Entra ID (SSO)',
  'Dashboard — statistics and navigation',
  'Document upload (file, metadata, workflow setup)',
  'Document number auto-generation',
  'Mandatory reviewer auto-population',
  'Submission for review — email notifications sent',
  'Reviewer access via email token link (no login required)',
  'Reviewer decision — Approve',
  'Reviewer decision — Request Changes',
  'Reviewer decision — Reject',
  'Reviewer replacement mid-workflow',
  'Document Controller advancing to approval',
  'Approver decision — Approve',
  'Approver decision — Reject',
  'Approver access via email token link',
  'Document release — CONTROLLED (non-policy)',
  'Document release — EXCO process (Policy document)',
  'Board / EXCO resolution upload',
  'Auto-superseding of previous controlled version',
  'Signed page upload',
  'Attachment upload and download',
  'Document amendment (file replacement)',
  'Version history view',
  'Activity log / audit trail',
  'Document search and filter',
  'Document viewer (PDF, Word, Excel)',
  'Reports and analytics',
  'CSV data export',
  'User management (create, edit, delete)',
  'Role assignment',
  'Mandatory reviewer configuration per document type',
  'Email reminder for overdue reviews (SLA)',
  'Cancellation of document',
  'Resubmission after rejection',
  'Superseded document visibility rules',
  'SLA deadline enforcement (21-day minimum)',
  'Notification bell / in-app notifications',
];

// ── 1. PDF ────────────────────────────────────────────────────────────────────
async function makePdf() {
  const half = Math.ceil(scopeItems.length / 2);

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:9.5pt;color:#1a1a2e;background:#fff}

  .cover{background:linear-gradient(135deg,#0f1e2e 0%,#1C3557 100%);color:#fff;padding:44px 56px 44px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .cover-top{display:flex;align-items:center;gap:28px;margin-bottom:28px}
  .cover-logo{width:110px;height:110px;object-fit:contain;background:#fff;border-radius:12px;padding:8px;flex-shrink:0}
  .cover-text{}
  .cover .sub{font-size:15pt;color:#F5A623;font-weight:700;margin-bottom:4px}
  .cover .sub2{font-size:11pt;color:rgba(255,255,255,0.8);font-weight:400;margin-bottom:0}
  .cover table{border-collapse:collapse;background:rgba(255,255,255,0.07);border-radius:5px}
  .cover td{color:#dce8f5;border:1px solid rgba(255,255,255,0.12);padding:5px 14px;font-size:9pt}
  .cover td:first-child{font-weight:600;color:#F5A623;width:160px}

  .content{padding:18px 40px 28px}
  h1{font-size:12pt;font-weight:700;color:#1C3557;border-bottom:2.5px solid #F5A623;padding-bottom:4px;margin:20px 0 9px;page-break-after:avoid}
  h2{font-size:10.5pt;font-weight:600;color:#1C3557;margin:15px 0 6px;page-break-after:avoid}
  p{margin:5px 0;line-height:1.5}
  ul{margin:5px 0 5px 18px}
  li{margin:2px 0}

  table{width:100%;border-collapse:collapse;margin:7px 0;font-size:8.5pt;page-break-inside:avoid}
  th{background:#1C3557;color:#fff;padding:6px 9px;font-weight:600;text-align:left;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  td{border:1px solid #d0d9e8;padding:5px 9px;vertical-align:top}
  tr:nth-child(even) td{background:#F5F7FB;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .pass{color:#1a7a3a;font-weight:700;text-align:center;background:#E8F5E9!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .tick{color:#1a7a3a;font-weight:700;text-align:center}
  .c{text-align:center}

  blockquote{border-left:4px solid #F5A623;background:#fffbf0;padding:10px 16px;margin:10px 0;border-radius:0 5px 5px 0;font-style:italic;color:#444;-webkit-print-color-adjust:exact;print-color-adjust:exact}

  .resolved-badge{background:#E8F5E9;color:#1a7a3a;font-weight:700;padding:7px 14px;border-radius:4px;display:inline-block;margin:6px 0;font-size:9pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}

  /* Single signature block */
  .sig-block{border:1.5px solid #1C3557;border-radius:7px;overflow:hidden;margin:14px 0;page-break-inside:avoid}
  .sig-header{background:#1C3557;color:#fff;padding:8px 16px;font-weight:700;font-size:10pt;letter-spacing:0.02em;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sig-grid{display:grid;grid-template-columns:1fr 1fr}
  .sig-field{padding:8px 16px;border-top:1px solid #d0d9e8}
  .sig-field:nth-child(odd){border-right:1px solid #d0d9e8}
  .sig-label{font-size:7pt;color:#888;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px}
  .sig-line{border-bottom:1.5px solid #1C3557;min-height:20px;margin-top:2px}
  .sig-space{padding:12px 16px;border-top:1px solid #d0d9e8;height:80px}
  .sig-space-label{font-size:7pt;color:#888;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px}

  .footer-note{color:#888;font-size:7.5pt;font-style:italic;margin-top:16px;border-top:1px solid #d0d9e8;padding-top:8px}

  @page{size:A4;margin:14mm 14mm 14mm 14mm}
</style>
</head><body>

<div class="cover">
  <div class="cover-top">
    <img src="${LOGO_SRC}" class="cover-logo" alt="SANPC Logo" />
    <div class="cover-text">
      <div class="sub">Document Management System</div>
      <div class="sub2">User Acceptance Testing — Sign-Off Certificate</div>
    </div>
  </div>
  <table>
    <tr><td>Organisation</td><td>${ORG}</td></tr>
    <tr><td>Document Ref</td><td>DMS-UAT-001 &nbsp;|&nbsp; Rev 00</td></tr>
    <tr><td>Date</td><td>September 2026</td></tr>
    <tr><td>Classification</td><td>Internal — Confidential</td></tr>
  </table>
</div>

<div class="content">

<h1>1. Project Information</h1>
<table>
  <tr><th>Field</th><th>Details</th></tr>
  <tr><td><strong>System Name</strong></td><td>SANPC Document Management System (DMS)</td></tr>
  <tr><td><strong>Organisation</strong></td><td>${ORG}</td></tr>
  <tr><td><strong>Environment Tested</strong></td><td>Production</td></tr>
  <tr><td><strong>Testing Period (From)</strong></td><td>&nbsp;</td></tr>
  <tr><td><strong>Testing Period (To)</strong></td><td>&nbsp;</td></tr>
  <tr><td><strong>UAT Coordinator</strong></td><td>&nbsp;</td></tr>
</table>

<h1>2. Purpose</h1>
<p>This UAT Sign-Off Certificate confirms that the SANPC Document Management System has been tested against all agreed functional requirements and is accepted for production use.</p>
<p style="margin-top:7px"><strong>By signing, the signatory confirms that:</strong></p>
<ul>
  <li>All functionality has been tested and verified</li>
  <li>The system operates in accordance with agreed requirements</li>
  <li>All defects identified during testing have been resolved</li>
  <li>The system is accepted and ready for production go-live</li>
</ul>

<h1>3. Scope of Testing</h1>
<p><strong style="color:#1a7a3a">${tick} All ${scopeItems.length} functional areas tested and confirmed passed.</strong></p>
<table style="margin-top:7px">
  <tr><th>#</th><th>Area</th><th>#</th><th>Area</th></tr>
  ${scopeItems.slice(0, half).map((item, i) => `
  <tr>
    <td class="tick">${tick} ${i+1}</td><td>${item}</td>
    <td class="tick">${scopeItems[i+half] ? `${tick} ${i+half+1}` : ''}</td>
    <td>${scopeItems[i+half] ?? ''}</td>
  </tr>`).join('')}
</table>

<h1>4. Test Results Summary</h1>

<h2>4.1 &nbsp;Core Workflow — Document Created to Controlled</h2>
<table>
  <tr><th>#</th><th>Test Action</th><th>Expected Outcome</th><th style="width:55px">Result</th></tr>
  <tr><td class="c">1</td><td>Log in as Document Controller</td><td>Dashboard displays with correct role menu</td><td class="pass">PASS</td></tr>
  <tr><td class="c">2</td><td>Upload document with full metadata</td><td>Document saved with REGISTERED status</td><td class="pass">PASS</td></tr>
  <tr><td class="c">3</td><td>Set reviewers, approver and review deadline</td><td>Workflow configured correctly; 21-day minimum enforced</td><td class="pass">PASS</td></tr>
  <tr><td class="c">4</td><td>Submit for review</td><td>Status → IN_REVIEW; reviewer emails received</td><td class="pass">PASS</td></tr>
  <tr><td class="c">5</td><td>Reviewers approve via email link (no login)</td><td>Status shows APPROVED per reviewer; overall → REVIEW_COMPLETE</td><td class="pass">PASS</td></tr>
  <tr><td class="c">6</td><td>Document Controller advances to approval</td><td>Status → PENDING_APPROVAL; approver notified</td><td class="pass">PASS</td></tr>
  <tr><td class="c">7</td><td>Approver approves via email link</td><td>Status → APPROVED</td><td class="pass">PASS</td></tr>
  <tr><td class="c">8</td><td>Document Controller marks as Controlled</td><td>Status → CONTROLLED; retention date set; previous version superseded</td><td class="pass">PASS</td></tr>
</table>

<h2>4.2 &nbsp;Policy Document — EXCO Workflow</h2>
<table>
  <tr><th>#</th><th>Test Action</th><th>Expected Outcome</th><th style="width:55px">Result</th></tr>
  <tr><td class="c">1</td><td>Upload a Policy (PO) document</td><td>EXCO Required flag automatically enabled</td><td class="pass">PASS</td></tr>
  <tr><td class="c">2</td><td>Complete full review and approval workflow</td><td>Status → APPROVED</td><td class="pass">PASS</td></tr>
  <tr><td class="c">3</td><td>Submit to EXCO</td><td>Status → EXCO_PENDING</td><td class="pass">PASS</td></tr>
  <tr><td class="c">4</td><td>Upload Board / EXCO resolution document</td><td>Status → CONTROLLED</td><td class="pass">PASS</td></tr>
</table>

<h2>4.3 &nbsp;Changes Requested &amp; Rejection Workflows</h2>
<table>
  <tr><th>#</th><th>Test Action</th><th>Expected Outcome</th><th style="width:55px">Result</th></tr>
  <tr><td class="c">1</td><td>Reviewer requests changes</td><td>Status → CHANGES_REQUESTED; other reviews paused</td><td class="pass">PASS</td></tr>
  <tr><td class="c">2</td><td>Document Controller amends and resubmits</td><td>Status → IN_REVIEW; reviewers reset to PENDING</td><td class="pass">PASS</td></tr>
  <tr><td class="c">3</td><td>Reviewer rejects document</td><td>Status → REJECTED; all reviews halted</td><td class="pass">PASS</td></tr>
  <tr><td class="c">4</td><td>Document Controller resubmits as new version</td><td>Version snapshot created; status → IN_REVIEW</td><td class="pass">PASS</td></tr>
</table>

<h2>4.4 &nbsp;Role-Based Access</h2>
<table>
  <tr><th>Role</th><th>Test</th><th>Expected Outcome</th><th style="width:55px">Result</th></tr>
  <tr><td><strong>Originator</strong></td><td>Can only see their own documents</td><td>No other documents visible</td><td class="pass">PASS</td></tr>
  <tr><td><strong>Reviewer</strong></td><td>Cannot access New Document or Reports</td><td>Menu items absent from sidebar</td><td class="pass">PASS</td></tr>
  <tr><td><strong>Reviewer</strong></td><td>Cannot see superseded documents</td><td>Superseded documents not in list</td><td class="pass">PASS</td></tr>
  <tr><td><strong>Admin</strong></td><td>Can see all documents including superseded</td><td>Full document list visible</td><td class="pass">PASS</td></tr>
</table>

<h1>5. Defects</h1>
<div class="resolved-badge">✓ All defects identified during testing have been fully resolved. No open issues remain.</div>

<h1>6. Sign-Off</h1>
<blockquote>"I confirm that I have reviewed the results of the User Acceptance Testing for the SANPC Document Management System. The system has been tested against agreed requirements, all defects have been resolved, and I formally accept this system for production use on behalf of ${ORG}."</blockquote>

<div class="sig-block">
  <div class="sig-header">Authorised Signatory</div>
  <div class="sig-grid">
    <div class="sig-field">
      <div class="sig-label">Full Name</div>
      <div class="sig-line"></div>
    </div>
    <div class="sig-field">
      <div class="sig-label">Job Title</div>
      <div class="sig-line"></div>
    </div>
    <div class="sig-field">
      <div class="sig-label">Department</div>
      <div class="sig-line"></div>
    </div>
    <div class="sig-field">
      <div class="sig-label">Date</div>
      <div class="sig-line"></div>
    </div>
  </div>
  <div class="sig-space">
    <div class="sig-space-label">Signature</div>
  </div>
</div>

<p class="footer-note">This document serves as formal evidence of system acceptance. A signed copy must be retained by the ICT Department. &nbsp;|&nbsp; DMS-UAT-001 &nbsp;|&nbsp; Rev 00 &nbsp;|&nbsp; September 2026 &nbsp;|&nbsp; CONFIDENTIAL</p>

</div>
</body></html>`;

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdfPath = resolve(OUT, 'SANPC_DMS_UAT_Signoff.pdf');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' },
    displayHeaderFooter: false,
  });
  await browser.close();
  console.log('✓ PDF saved:', pdfPath);
}

// ── 2. DOCX ───────────────────────────────────────────────────────────────────
async function makeDocx() {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, AlignmentType, BorderStyle, HeadingLevel, Footer,
    PageBreak, ShadingType, VerticalAlign, ImageRun,
  } = await import('docx');

  const children = [];

  const gap = (n = 1) => Array.from({ length: n }, () => new Paragraph({}));

  const cell = (text, opts = {}) => new TableCell({
    children: [new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({
        text: String(text),
        bold:    opts.bold    ?? false,
        italics: opts.italic  ?? false,
        color:   opts.color   ?? '1a1a2e',
        size:    opts.size    ?? 19,
      })],
    })],
    shading: opts.fill ? { type: ShadingType.SOLID, fill: opts.fill } : undefined,
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    verticalAlign: VerticalAlign.CENTER,
    columnSpan: opts.span,
  });

  const hcell = (text, opts = {}) =>
    cell(text, { bold: true, color: WHITE, fill: BLUE, size: 18, ...opts });

  // ── Cover ──
  const logoBuf = readFileSync(resolve(__dir, '../docs/sanpc-logo.png'));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 1200, after: 200 },
    children: [new ImageRun({ data: logoBuf, transformation: { width: 160, height: 160 }, type: 'png' })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [new TextRun({ text: 'Document Management System', bold: true, size: 38, color: BLUE })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [new TextRun({ text: 'User Acceptance Testing', size: 30, color: GOLD, bold: true })],
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 500 },
    children: [new TextRun({ text: 'Sign-Off Certificate', size: 30, color: GOLD, bold: true })],
  }));
  children.push(new Table({
    width: { size: 55, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [cell('Organisation', { bold: true, fill: LIGHT }), cell(ORG)] }),
      new TableRow({ children: [cell('Document Ref', { bold: true, fill: LIGHT }), cell('DMS-UAT-001  |  Rev 00')] }),
      new TableRow({ children: [cell('Date', { bold: true, fill: LIGHT }), cell('September 2026')] }),
      new TableRow({ children: [cell('Classification', { bold: true, fill: LIGHT }), cell('Internal — Confidential')] }),
    ],
  }));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ── Section 1 ──
  children.push(new Paragraph({ text: '1.  Project Information', heading: HeadingLevel.HEADING_1 }));
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [hcell('Field'), hcell('Details')] }),
      new TableRow({ children: [cell('System Name', { bold: true, fill: LIGHT }), cell('SANPC Document Management System (DMS)')] }),
      new TableRow({ children: [cell('Organisation', { bold: true, fill: LIGHT }), cell(ORG)] }),
      new TableRow({ children: [cell('Environment Tested', { bold: true, fill: LIGHT }), cell('Production')] }),
      new TableRow({ children: [cell('Testing Period (From)', { bold: true, fill: LIGHT }), cell('')] }),
      new TableRow({ children: [cell('Testing Period (To)', { bold: true, fill: LIGHT }), cell('')] }),
      new TableRow({ children: [cell('UAT Coordinator', { bold: true, fill: LIGHT }), cell('')] }),
    ],
  }));

  children.push(...gap(1));

  // ── Section 2 ──
  children.push(new Paragraph({ text: '2.  Purpose', heading: HeadingLevel.HEADING_1 }));
  children.push(new Paragraph({
    children: [new TextRun({ text: 'This UAT Sign-Off Certificate confirms that the SANPC Document Management System has been tested against all agreed functional requirements and is accepted for production use.' })],
    spacing: { after: 100 },
  }));
  for (const item of [
    'All functionality has been tested and verified',
    'The system operates in accordance with agreed requirements',
    'All defects identified during testing have been resolved',
    'The system is accepted and ready for production go-live',
  ]) {
    children.push(new Paragraph({ text: item, bullet: { level: 0 }, spacing: { before: 30 } }));
  }

  children.push(...gap(1));

  // ── Section 3: Scope ──
  children.push(new Paragraph({ text: '3.  Scope of Testing', heading: HeadingLevel.HEADING_1 }));
  children.push(new Paragraph({
    spacing: { after: 100 },
    children: [
      new TextRun({ text: `${tick} All ${scopeItems.length} functional areas tested and confirmed passed.`, bold: true, color: '1a7a3a' }),
    ],
  }));
  const half = Math.ceil(scopeItems.length / 2);
  const scopeRows = [
    new TableRow({ children: [hcell('#'), hcell('Area'), hcell('#'), hcell('Area')] }),
  ];
  for (let i = 0; i < half; i++) {
    scopeRows.push(new TableRow({ children: [
      cell(`${tick} ${i+1}`, { fill: i%2===0?WHITE:LIGHT, center:true, color:'1a7a3a', bold:true }),
      cell(scopeItems[i], { fill: i%2===0?WHITE:LIGHT }),
      cell(scopeItems[i+half] ? `${tick} ${i+half+1}` : '', { fill: i%2===0?WHITE:LIGHT, center:true, color:'1a7a3a', bold:true }),
      cell(scopeItems[i+half] ?? '', { fill: i%2===0?WHITE:LIGHT }),
    ]}));
  }
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: scopeRows }));

  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ── Section 4: Test Results ──
  children.push(new Paragraph({ text: '4.  Test Results Summary', heading: HeadingLevel.HEADING_1 }));

  const scenarioTable = (title, rows) => {
    children.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_2, spacing: { before: 200 } }));
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [hcell('#', { span: undefined }), hcell('Test Action'), hcell('Expected Outcome'), hcell('Result', { center: true })] }),
        ...rows.map((r, i) => new TableRow({ children: [
          cell(r[0], { fill: i%2===0?WHITE:LIGHT, center: true }),
          cell(r[1], { fill: i%2===0?WHITE:LIGHT }),
          cell(r[2], { fill: i%2===0?WHITE:LIGHT }),
          cell('PASS', { fill: 'E8F5E9', color:'1a7a3a', bold:true, center:true }),
        ]})),
      ],
    }));
  };

  scenarioTable('4.1  Core Workflow — Document Created to Controlled', [
    ['1','Log in as Document Controller','Dashboard displays with correct role menu'],
    ['2','Upload document with full metadata','Document saved with REGISTERED status'],
    ['3','Set reviewers, approver and review deadline','Workflow configured; 21-day minimum enforced'],
    ['4','Submit for review','Status → IN_REVIEW; reviewer emails received'],
    ['5','Reviewers approve via email link (no login)','Status → REVIEW_COMPLETE'],
    ['6','Document Controller advances to approval','Status → PENDING_APPROVAL; approver notified'],
    ['7','Approver approves via email link','Status → APPROVED'],
    ['8','Document Controller marks as Controlled','Status → CONTROLLED; previous version superseded'],
  ]);

  scenarioTable('4.2  Policy Document — EXCO Workflow', [
    ['1','Upload a Policy (PO) document','EXCO Required flag automatically enabled'],
    ['2','Complete full review and approval workflow','Status → APPROVED'],
    ['3','Submit to EXCO','Status → EXCO_PENDING'],
    ['4','Upload Board / EXCO resolution document','Status → CONTROLLED'],
  ]);

  scenarioTable('4.3  Changes Requested & Rejection Workflows', [
    ['1','Reviewer requests changes','Status → CHANGES_REQUESTED; other reviews paused'],
    ['2','Document Controller amends and resubmits','Status → IN_REVIEW; reviewers reset to PENDING'],
    ['3','Reviewer rejects document','Status → REJECTED; all reviews halted'],
    ['4','Document Controller resubmits as new version','Version snapshot created; status → IN_REVIEW'],
  ]);

  children.push(new Paragraph({ text: '4.4  Role-Based Access', heading: HeadingLevel.HEADING_2, spacing: { before: 200 } }));
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [hcell('Role'), hcell('Test'), hcell('Expected Outcome'), hcell('Result', { center: true })] }),
      ...([
        ['Originator','Can only see their own documents','No other documents visible'],
        ['Reviewer','Cannot access New Document or Reports','Menu items absent from sidebar'],
        ['Reviewer','Cannot see superseded documents','Superseded documents not in list'],
        ['Admin','Can see all documents including superseded','Full document list visible'],
      ]).map((r, i) => new TableRow({ children: [
        cell(r[0], { fill: i%2===0?WHITE:LIGHT, bold: true }),
        cell(r[1], { fill: i%2===0?WHITE:LIGHT }),
        cell(r[2], { fill: i%2===0?WHITE:LIGHT }),
        cell('PASS', { fill: 'E8F5E9', color:'1a7a3a', bold:true, center:true }),
      ]})),
    ],
  }));

  children.push(...gap(1));

  // ── Section 5: Defects ──
  children.push(new Paragraph({ text: '5.  Defects', heading: HeadingLevel.HEADING_1 }));
  children.push(new Paragraph({
    children: [new TextRun({ text: `${tick} All defects identified during testing have been fully resolved. No open issues remain at the time of sign-off.`, color: '1a7a3a', bold: true })],
    spacing: { after: 100 },
  }));

  // ── Section 6: Sign-Off ──
  children.push(new Paragraph({ text: '6.  Sign-Off', heading: HeadingLevel.HEADING_1 }));
  children.push(new Paragraph({
    children: [new TextRun({
      text: `"I confirm that I have reviewed the results of the User Acceptance Testing for the SANPC Document Management System. The system has been tested against agreed requirements, all defects have been resolved, and I formally accept this system for production use on behalf of ${ORG}."`,
      italics: true, color: '444444',
    })],
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: GOLD } },
    indent: { left: 360 },
    spacing: { after: 300 },
  }));

  // ── Single signature block as a table ──
  children.push(new Paragraph({ text: 'Authorised Signatory', heading: HeadingLevel.HEADING_2 }));
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [
        cell('Full Name', { bold: true, fill: LIGHT }),
        cell(''),
        cell('Job Title', { bold: true, fill: LIGHT }),
        cell(''),
      ]}),
      new TableRow({ children: [
        cell('Department', { bold: true, fill: LIGHT }),
        cell(''),
        cell('Date', { bold: true, fill: LIGHT }),
        cell(''),
      ]}),
      // Tall signature row
      new TableRow({ children: [
        cell('Signature', { bold: true, fill: LIGHT }),
        new TableCell({
          columnSpan: 3,
          children: [
            new Paragraph({ spacing: { before: 0, after: 0 } }),
            new Paragraph({ spacing: { before: 0, after: 0 } }),
            new Paragraph({ children: [new TextRun({ text: 'Sign here:', color: 'CCCCCC', size: 16, italics: true })] }),
            new Paragraph({ spacing: { before: 700, after: 0 } }),
          ],
          margins: { top: 100, bottom: 100, left: 140, right: 140 },
        }),
      ]}),
    ],
  }));

  children.push(...gap(2));
  children.push(new Paragraph({
    children: [new TextRun({
      text: `This document serves as formal evidence of system acceptance. A signed copy must be retained by the ICT Department.  |  DMS-UAT-001  |  Rev 00  |  September 2026  |  CONFIDENTIAL`,
      italics: true, color: '888888', size: 16,
    })],
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: BORDER } },
    spacing: { before: 100 },
  }));

  const doc = new Document({
    creator: 'SANPC ICT',
    title: 'SANPC DMS UAT Sign-Off Certificate',
    styles: {
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', run: { size: 26, bold: true, color: BLUE }, paragraph: { spacing: { before: 320, after: 160 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD } } } },
        { id: 'Heading2', name: 'Heading 2', run: { size: 22, bold: true, color: BLUE }, paragraph: { spacing: { before: 240, after: 100 } } },
      ],
      default: { document: { run: { font: 'Calibri', size: 20 } } },
    },
    sections: [{
      properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: BORDER } },
            children: [new TextRun({ text: `SANPC DMS — UAT Sign-Off Certificate  |  DMS-UAT-001  |  Rev 00  |  ${ORG}  |  CONFIDENTIAL`, size: 15, color: '888888' })],
          })],
        }),
      },
      children,
    }],
  });

  const buf = await Packer.toBuffer(doc);
  const path = resolve(OUT, 'SANPC_DMS_UAT_Signoff.docx');
  writeFileSync(path, buf);
  console.log('✓ DOCX saved:', path);
}

await makePdf();
await makeDocx();
console.log('\n✅ Done — docs/output/');
