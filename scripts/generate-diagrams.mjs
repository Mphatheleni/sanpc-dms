/**
 * SANPC DMS — Technical Documentation Generator v3
 * Pure SVG · No external CDN · Visio-style professional diagrams
 */
import puppeteer from 'puppeteer';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const DOCS  = resolve(__dir, '../docs');
const OUT   = resolve(DOCS, 'output/diagrams');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const LOGO_B64 = readFileSync(resolve(DOCS, 'sanpc-logo.png')).toString('base64');
const LOGO_SRC = `data:image/png;base64,${LOGO_B64}`;

// ─── Colour palette ──────────────────────────────────────────────────────────
const N  = '#1C3557';  // navy
const G  = '#C8860A';  // gold
const LT = '#F0F4F8';  // light bg
const BD = '#7A9BC0';  // border / muted blue
const TX = '#1A1A2E';  // body text
const GR = '#5A6475';  // secondary text

// ─── Utilities ───────────────────────────────────────────────────────────────
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function wrapSvg(w, h, inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Arial,Calibri,sans-serif">\n${inner}\n</svg>`;
}

// ─── Renderer ────────────────────────────────────────────────────────────────
async function render(browser, svgStr, title, filename) {
  const wm = svgStr.match(/width="(\d+)"/);
  const hm = svgStr.match(/height="(\d+)"/);
  const sw = wm ? +wm[1] : 1100;
  const sh = hm ? +hm[1] : 800;

  const page = await browser.newPage();
  await page.setViewport({ width: sw + 72, height: sh + 96, deviceScaleFactor: 2 });

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#fff;padding:24px 32px;font-family:Arial,Calibri,sans-serif}
  .hdr{border-bottom:2px solid ${G};padding-bottom:7px;margin-bottom:14px}
  .hdr h2{font-size:12pt;font-weight:700;color:${N};letter-spacing:0.01em}
  .hdr p{font-size:7pt;color:${GR};margin-top:2px}
</style></head><body>
<div class="hdr">
  <h2>${esc(title)}</h2>
  <p>SANPC Policy Repository DMS &mdash; Technical Documentation &nbsp;|&nbsp; DMS-TECH-001 Rev 00 &nbsp;|&nbsp; September 2026 &nbsp;|&nbsp; Internal Confidential</p>
</div>
${svgStr}
</body></html>`;

  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 200));
  const path = resolve(OUT, filename);
  await page.screenshot({ path, type: 'png', fullPage: true });
  await page.close();
  console.log('  ✓', filename);
  return path;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEQUENCE DIAGRAM GENERATOR (pure SVG, no dependencies)
// ═══════════════════════════════════════════════════════════════════════════════
function seqSvg(participants, steps) {
  const P   = participants.length;
  const W   = 1060;
  const MAR = 42;
  const PW  = Math.min(128, Math.floor((W - MAR * 2) / P) - 6);
  const COL = Math.floor((W - MAR * 2) / P);
  const cx  = participants.map((_, i) => MAR + i * COL + COL / 2);
  const ROW = 42;
  const PHH = 36;  // participant header height

  // Pre-calculate total height ────────────────────────────────────────────────
  function rowCount(list) {
    let n = 0;
    list.forEach(s => {
      if (s.alt) {
        n += 0.5;
        s.branches.forEach((b, bi) => {
          n += (bi > 0 ? 0.65 : 0.45);
          n += b.msgs.length;
          n += 0.15;
        });
        n += 0.4;
      } else { n += 1; }
    });
    return n;
  }
  const TOTAL_ROWS = rowCount(steps) + 1.2;
  const LIFETOP    = PHH + 8;
  const LIFEBOT    = LIFETOP + TOTAL_ROWS * ROW;
  const H          = LIFEBOT + PHH + 14;

  const p = []; // SVG parts

  // ── Markers ─────────────────────────────────────────────────────────────────
  p.push(`<defs>
    <marker id="fwd" viewBox="0 0 9 7" refX="8" refY="3.5" markerWidth="9" markerHeight="7" orient="auto"><polygon points="0,0 9,3.5 0,7" fill="${N}"/></marker>
    <marker id="ret" viewBox="0 0 9 7" refX="8" refY="3.5" markerWidth="9" markerHeight="7" orient="auto"><polygon points="0,0 9,3.5 0,7" fill="${BD}"/></marker>
  </defs>`);

  // ── Background grid (subtle) ─────────────────────────────────────────────────
  p.push(`<rect width="${W}" height="${H}" fill="white"/>`);

  // ── Lifelines ────────────────────────────────────────────────────────────────
  cx.forEach(x => {
    p.push(`<line x1="${x}" y1="${LIFETOP}" x2="${x}" y2="${LIFEBOT}" stroke="${BD}" stroke-width="0.9" stroke-dasharray="6,4"/>`);
  });

  // ── Participant boxes ─────────────────────────────────────────────────────────
  function partBox(i, y) {
    const x   = cx[i] - PW / 2;
    const lns = participants[i].label.split('\n');
    p.push(`<rect x="${x}" y="${y}" width="${PW}" height="${PHH}" fill="${N}" stroke="${N}" rx="2"/>`);
    lns.forEach((ln, li) => {
      const baseY = y + PHH / 2 + (li - (lns.length - 1) / 2) * 11;
      p.push(`<text x="${cx[i]}" y="${baseY}" text-anchor="middle" dominant-baseline="middle" font-size="8" font-weight="700" fill="white">${esc(ln)}</text>`);
    });
  }
  participants.forEach((_, i) => { partBox(i, 0); partBox(i, LIFEBOT); });

  // ── Draw a single message ─────────────────────────────────────────────────────
  let stepNum = 1;
  function drawMsg(msg, msgY) {
    if (msg.note) {
      const x1 = cx[0] - PW / 2 + 12, x2 = cx[P - 1] + PW / 2 - 12;
      p.push(`<rect x="${x1}" y="${msgY - 10}" width="${x2 - x1}" height="19" fill="#FFFBEA" stroke="${G}" stroke-width="0.8" rx="2"/>`);
      p.push(`<text x="${(x1 + x2) / 2}" y="${msgY + 0.5}" text-anchor="middle" dominant-baseline="middle" font-size="7.5" fill="#7A4800" font-style="italic">${esc(msg.label)}</text>`);
      return;
    }
    const fi = participants.findIndex(q => q.id === msg.from);
    const ti = participants.findIndex(q => q.id === msg.to);
    if (fi < 0 || ti < 0) return;
    const fx = cx[fi], tx = cx[ti];
    const isRet = !!msg.ret;
    const dir   = tx >= fx ? 1 : -1;

    const numStr = msg.noNum ? '' : `${stepNum}. `;
    if (!msg.noNum) stepNum++;
    const lbl = esc(numStr + msg.label);

    if (!isRet) {
      // Activation box on sender
      p.push(`<rect x="${fx - 4}" y="${msgY - 15}" width="8" height="28" fill="white" stroke="${N}" stroke-width="0.9"/>`);
    }

    const x1 = fx + dir * 4, x2 = tx - dir * 6;
    const col  = isRet ? BD : N;
    const dash = isRet ? 'stroke-dasharray="5,3"' : '';
    const mk   = isRet ? 'ret' : 'fwd';
    p.push(`<line x1="${x1}" y1="${msgY}" x2="${x2}" y2="${msgY}" stroke="${col}" stroke-width="${isRet ? 1 : 1.5}" ${dash} marker-end="url(#${mk})"/>`);

    const mx  = (fx + tx) / 2;
    const lw  = Math.max(60, Math.abs(tx - fx) - 16);
    p.push(`<rect x="${mx - lw / 2}" y="${msgY - 14}" width="${lw}" height="12" fill="white"/>`);
    p.push(`<text x="${mx}" y="${msgY - 7}" text-anchor="middle" dominant-baseline="middle" font-size="7.5" fill="${isRet ? GR : TX}" font-style="${isRet ? 'italic' : 'normal'}">${lbl}</text>`);
  }

  // ── Render steps ─────────────────────────────────────────────────────────────
  let y = LIFETOP + ROW * 0.8;

  steps.forEach(step => {
    if (step.alt) {
      // Pre-compute fragment height (must mirror the rendering logic exactly)
      let fh = ROW * 0.5;
      step.branches.forEach((b, bi) => {
        fh += (bi > 0 ? ROW * 0.65 : ROW * 0.45);
        fh += b.msgs.length * ROW;
        fh += ROW * 0.15;
      });
      fh += ROW * 0.4;

      const fx1 = cx[0] - PW / 2 + 6;
      const fx2 = cx[P - 1] + PW / 2 - 6;
      const fY  = y - ROW * 0.3;
      p.push(`<rect x="${fx1}" y="${fY}" width="${fx2 - fx1}" height="${fh + ROW * 0.3}" fill="rgba(240,245,252,0.55)" stroke="${BD}" stroke-width="1"/>`);
      p.push(`<path d="M${fx1},${fY} h46 l7,14 h-53 z" fill="${LT}" stroke="${BD}" stroke-width="1"/>`);
      p.push(`<text x="${fx1 + 24}" y="${fY + 8}" text-anchor="middle" dominant-baseline="middle" font-size="8.5" font-weight="700" fill="${N}">${esc(step.keyword || 'alt')}</text>`);

      y += ROW * 0.5;
      step.branches.forEach((branch, bi) => {
        if (bi > 0) {
          p.push(`<line x1="${fx1}" y1="${y - ROW * 0.3}" x2="${fx2}" y2="${y - ROW * 0.3}" stroke="${BD}" stroke-width="0.8" stroke-dasharray="4,3"/>`);
          y += ROW * 0.2;
        }
        p.push(`<text x="${fx1 + 8}" y="${y + 2}" text-anchor="start" dominant-baseline="middle" font-size="7.5" fill="${GR}" font-style="italic">[${esc(branch.cond)}]</text>`);
        y += ROW * 0.45;
        branch.msgs.forEach(msg => { drawMsg(msg, y); y += ROW; });
        y += ROW * 0.15;
      });
      y += ROW * 0.4;
    } else {
      drawMsg(step, y);
      y += ROW;
    }
  });

  return wrapSvg(W, H, p.join('\n'));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1 ─ SYSTEM ARCHITECTURE
// ═══════════════════════════════════════════════════════════════════════════════
function archSvg() {
  const W = 1020, H = 660;
  const p = [];

  // Zones
  const zones = [
    { x: 0,   y: 0, w: 180, h: H, fill: '#EEF3F9', bc: '#90AAC8', label: 'CLIENT LAYER' },
    { x: 196, y: 0, w: 240, h: H, fill: '#EAF1FA', bc: '#5580B0', label: 'APPLICATION LAYER' },
    { x: 452, y: 0, w: 260, h: H, fill: '#FEF9EE', bc: '#D4A030', label: 'MICROSOFT 365' },
    { x: 728, y: 0, w: 292, h: H, fill: '#EDFAF3', bc: '#3A9A5C', label: 'GOOGLE CLOUD (FIREBASE)' },
  ];
  zones.forEach(z => {
    p.push(`<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" fill="${z.fill}" stroke="${z.bc}" stroke-width="1.5" stroke-dasharray="6,3" rx="4"/>`);
    p.push(`<text x="${z.x + z.w / 2}" y="18" text-anchor="middle" dominant-baseline="middle" font-size="7.5" font-weight="700" letter-spacing="0.08em" fill="${z.bc}" font-family="Arial">${esc(z.label)}</text>`);
  });

  // ── Box helper ──────────────────────────────────────────────────────────────
  function box(x, y, w, h, title, sub1, sub2, fill, bc) {
    p.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${bc}" stroke-width="1.2" rx="3"/>`);
    p.push(`<text x="${x + w / 2}" y="${y + (sub1 ? 16 : h / 2)}" text-anchor="middle" dominant-baseline="middle" font-size="9" font-weight="700" fill="${bc === N ? 'white' : N}">${esc(title)}</text>`);
    if (sub1) p.push(`<text x="${x + w / 2}" y="${y + 30}" text-anchor="middle" dominant-baseline="middle" font-size="7" fill="${GR}">${esc(sub1)}</text>`);
    if (sub2) p.push(`<text x="${x + w / 2}" y="${y + 41}" text-anchor="middle" dominant-baseline="middle" font-size="7" fill="${GR}">${esc(sub2)}</text>`);
  }

  // ── Client boxes ────────────────────────────────────────────────────────────
  box(12,  42,  156, 52, 'Web Browser',    'Chrome / Edge / Safari',   null,            'white', N);
  box(12, 116,  156, 52, 'Email Client',   'Review & approval token links', null,        'white', N);
  box(12, 190,  156, 52, 'Mobile Browser', 'Responsive PWA-compatible', null,            'white', N);

  // ── App boxes ───────────────────────────────────────────────────────────────
  box(206,  42, 220, 56, 'Next.js 16 Frontend', 'React 19  ·  TypeScript  ·  Tailwind CSS 4', 'App Router  ·  Server Components', N, N);
  box(206, 118, 220, 56, 'API Routes',           'REST endpoints  ·  Prisma ORM',              'JWT session middleware', N, N);
  box(206, 194, 220, 50, 'Auth Layer',           'JWT (HS256, 8 h)  ·  bcryptjs',              'SSO callback handler',   N, N);
  box(206, 264, 220, 50, 'Email Service',        'Nodemailer  ·  SMTP (Office 365)',           'Review token generation', N, N);
  box(206, 334, 220, 50, 'File Handler',         'SharePoint primary  →  GCS fallback',        '→  Local filesystem fallback', N, N);

  // ── MS 365 boxes ─────────────────────────────────────────────────────────────
  box(462,  42, 236, 60, 'SharePoint Online',   'Document storage  ·  DMS-Archive folder',  'File versioning  ·  Office Online', '#FEF3D8', G);
  box(462, 124, 236, 56, 'Microsoft Entra ID',  'SSO  ·  OAuth 2.0 / OIDC',                 'User auto-provisioning', '#FEF3D8', G);
  box(462, 202, 236, 52, 'Power Automate',       'HTTP webhook flows',                        'Email notifications  ·  Reminders', '#FEF3D8', G);
  box(462, 276, 236, 50, 'Microsoft Graph API', 'v1.0  ·  SharePoint  ·  User profile',      'Drives  ·  Files  ·  Me endpoint', '#FFF8E5', G);
  box(462, 348, 236, 46, 'Office 365 SMTP',     'smtp.office365.com:587  ·  STARTTLS',       null,                                '#FFF8E5', G);

  // ── GCloud boxes ─────────────────────────────────────────────────────────────
  box(738,  42, 272, 56, 'Firebase App Hosting',  'Google Cloud Run  ·  Auto-scaling',       'Min 0 instances  ·  HTTPS', '#D8F2E4', '#2E7D52');
  box(738, 120, 272, 56, 'PostgreSQL — Neon',     'Serverless Postgres',                     'Prisma ORM  ·  Connection pooling', '#D8F2E4', '#2E7D52');
  box(738, 198, 272, 52, 'Cloud Secret Manager',  'JWT_SECRET  ·  DATABASE_URL',             'AZURE_CLIENT_SECRET  ·  GCS keys', '#D8F2E4', '#2E7D52');
  box(738, 272, 272, 50, 'GCS Bucket (Fallback)', 'sanpc-dms.appspot.com',                   'Used when SharePoint unavailable', '#E8F5ED', '#2E7D52');

  // ── Arrows ────────────────────────────────────────────────────────────────────
  p.push(`<defs>
    <marker id="a"  viewBox="0 0 8 6" refX="7" refY="3" markerWidth="8" markerHeight="6" orient="auto"><polygon points="0,0 8,3 0,6" fill="${N}"/></marker>
    <marker id="ag" viewBox="0 0 8 6" refX="7" refY="3" markerWidth="8" markerHeight="6" orient="auto"><polygon points="0,0 8,3 0,6" fill="${G}"/></marker>
    <marker id="av" viewBox="0 0 8 6" refX="7" refY="3" markerWidth="8" markerHeight="6" orient="auto"><polygon points="0,0 8,3 0,6" fill="#2E7D52"/></marker>
  </defs>`);
  function arr(x1, y1, x2, y2, m, dash) {
    p.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${m==='a'?N:m==='ag'?G:'#2E7D52'}" stroke-width="1.4" ${dash?'stroke-dasharray="5,3"':''} marker-end="url(#${m})"/>`);
  }

  // Client → App
  arr(168, 68, 204, 68, 'a');
  arr(168, 142, 204, 146, 'a');
  arr(168, 216, 204, 216, 'a');
  // App verticals
  arr(316, 98, 316, 116, 'a');
  arr(316, 174, 316, 192, 'a');
  arr(316, 244, 316, 262, 'a');
  arr(316, 314, 316, 332, 'a');
  // App → MS365
  arr(426, 70,  460, 70,  'ag');
  arr(426, 152, 460, 152, 'ag');
  arr(426, 222, 460, 226, 'ag');
  arr(426, 290, 460, 300, 'ag');
  arr(426, 358, 460, 370, 'ag');
  // MS365 internal
  arr(580, 278, 580, 202+26, 'ag');
  // App → GCloud
  arr(426, 76,  736, 76,  'av');
  arr(426, 148, 736, 148, 'av');
  arr(426, 224, 736, 224, 'av');
  arr(426, 360, 736, 296, 'av', true);

  return wrapSvg(W, H, p.join('\n'));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2 ─ USE CASE DIAGRAM
// ═══════════════════════════════════════════════════════════════════════════════
function useCaseSvg() {
  const W = 1060, H = 820;
  const p = [];

  p.push(`<rect width="${W}" height="${H}" fill="white"/>`);

  // ── Actor helper (UML stick figure) ──────────────────────────────────────────
  function actor(cx, y, label) {
    const r = 10;
    p.push(`<circle cx="${cx}" cy="${y + r}" r="${r}" fill="white" stroke="${N}" stroke-width="1.5"/>`);
    p.push(`<line x1="${cx}" y1="${y + r*2}" x2="${cx}" y2="${y + r*2 + 22}" stroke="${N}" stroke-width="1.5"/>`);
    p.push(`<line x1="${cx - 14}" y1="${y + r*2 + 9}" x2="${cx + 14}" y2="${y + r*2 + 9}" stroke="${N}" stroke-width="1.5"/>`);
    p.push(`<line x1="${cx}" y1="${y + r*2 + 22}" x2="${cx - 10}" y2="${y + r*2 + 38}" stroke="${N}" stroke-width="1.5"/>`);
    p.push(`<line x1="${cx}" y1="${y + r*2 + 22}" x2="${cx + 10}" y2="${y + r*2 + 38}" stroke="${N}" stroke-width="1.5"/>`);
    label.split('\n').forEach((ln, li) => {
      p.push(`<text x="${cx}" y="${y + r*2 + 52 + li * 11}" text-anchor="middle" dominant-baseline="middle" font-size="8.5" font-weight="600" fill="${N}">${esc(ln)}</text>`);
    });
  }

  // ── Use case ellipse ──────────────────────────────────────────────────────────
  function uc(cx, cy, rx, ry, label, fill, bc) {
    p.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill||'white'}" stroke="${bc||N}" stroke-width="1.2"/>`);
    label.split('\n').forEach((ln, li) => {
      p.push(`<text x="${cx}" y="${cy + (li - (label.split('\n').length - 1) / 2) * 11}" text-anchor="middle" dominant-baseline="middle" font-size="7.5" fill="${TX}">${esc(ln)}</text>`);
    });
  }

  // ── Association line ──────────────────────────────────────────────────────────
  function assoc(x1, y1, x2, y2) {
    p.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${BD}" stroke-width="1"/>`);
  }

  // ── System boundary ───────────────────────────────────────────────────────────
  const SX = 145, SY = 10, SW = 860, SH = 800;
  p.push(`<rect x="${SX}" y="${SY}" width="${SW}" height="${SH}" fill="${LT}" stroke="${N}" stroke-width="1.8" rx="4"/>`);
  p.push(`<text x="${SX + SW / 2}" y="${SY + 18}" text-anchor="middle" dominant-baseline="middle" font-size="10" font-weight="700" fill="${N}">SANPC Policy Repository DMS</text>`);

  // ── Actors ────────────────────────────────────────────────────────────────────
  actor(58,  56,  'Admin');
  actor(58,  210, 'Document\nController');
  actor(58,  400, 'Reviewer');
  actor(58,  540, 'Approver');
  actor(58,  680, 'Originator');

  // ── Section headers inside boundary ──────────────────────────────────────────
  function secHeader(y, label) {
    p.push(`<text x="${SX + 14}" y="${y}" text-anchor="start" dominant-baseline="middle" font-size="8" font-weight="700" letter-spacing="0.07em" fill="${G}">${esc(label)}</text>`);
    p.push(`<line x1="${SX + 14}" y1="${y + 8}" x2="${SX + SW - 14}" y2="${y + 8}" stroke="${G}" stroke-width="0.7"/>`);
  }

  // ── Authentication ─────────────────────────────────────────────────────────
  secHeader(50, 'AUTHENTICATION');
  uc(280, 76,  88, 16, 'Login via Microsoft Entra ID (SSO)');
  uc(480, 76,  70, 16, 'Login with Local Credentials');
  uc(660, 76,  60, 16, 'View Dashboard');
  uc(840, 76,  60, 16, 'View Notifications');
  assoc(80, 75, 192, 76); assoc(80, 75, 410, 76); assoc(80, 75, 600, 76); assoc(80, 75, 780, 76);

  // ── Document Management ────────────────────────────────────────────────────
  secHeader(112, 'DOCUMENT MANAGEMENT');
  uc(230, 140, 70, 16, 'Upload Document');
  uc(390, 140, 70, 16, 'Enter Metadata');
  uc(560, 140, 85, 16, 'Configure Reviewers / Approvers');
  uc(750, 140, 65, 16, 'Auto-generate Doc Number');
  uc(230, 175, 70, 16, 'Submit for Review');
  uc(390, 175, 65, 16, 'Amend Document File');
  uc(560, 175, 70, 16, 'Upload Signed Page');
  uc(750, 175, 75, 16, 'Upload Board Resolution');
  uc(370, 210, 80, 16, 'Release as Controlled Document');
  uc(570, 210, 60, 16, 'Submit to EXCO');
  uc(750, 210, 55, 16, 'Cancel Document');
  [230,390,560,750,230,390,560,750,370,570,750].forEach(x => assoc(80, 248, x, x > 450 ? 200 : 175));

  // ── Review Workflow ─────────────────────────────────────────────────────────
  secHeader(238, 'REVIEW WORKFLOW');
  uc(250, 268, 80, 16, 'Receive Review Email Notification');
  uc(460, 268, 82, 16, 'View Document via Token Link / Portal');
  uc(680, 268, 50, 16, 'Approve Document');
  uc(790, 268, 55, 16, 'Request Changes');
  uc(880, 268, 40, 16, 'Reject Document');
  uc(460, 304, 50, 16, 'Add Comment');
  [250,460,680,790,880,460].forEach(x => assoc(80, 448, x, x > 400 ? 290 : 268));

  // ── Approval Workflow ───────────────────────────────────────────────────────
  secHeader(336, 'APPROVAL WORKFLOW');
  uc(300, 365, 88, 16, 'Receive Approval Notification Email');
  uc(530, 365, 78, 16, 'Review Document (Approval Context)');
  uc(720, 365, 55, 16, 'Formally Approve');
  uc(850, 365, 50, 16, 'Formally Reject');
  [300,530,720,850].forEach(x => assoc(80, 580, x, 365));

  // ── Document Controller extra ────────────────────────────────────────────────
  secHeader(398, 'DOCUMENT CONTROLLER');
  uc(250, 428, 72, 16, 'Advance to Approval Stage');
  uc(420, 428, 55, 16, 'Replace Reviewer');
  uc(560, 428, 55, 16, 'Remove Reviewer');
  uc(700, 428, 60, 16, 'View Version History');
  uc(840, 428, 60, 16, 'View Activity Log');
  uc(300, 463, 65, 16, 'Generate Reports');
  uc(460, 463, 50, 16, 'Export CSV');
  [250,420,560,700,840,300,460].forEach(x => assoc(80, 248, x, 440));

  // ── Admin Only ──────────────────────────────────────────────────────────────
  secHeader(494, 'ADMINISTRATION (ADMIN)');
  uc(280, 524, 80, 16, 'Create / Edit / Delete Users', '#FFF0F0', '#8B1A1A');
  uc(480, 524, 65, 16, 'Assign User Roles',             '#FFF0F0', '#8B1A1A');
  uc(670, 524, 92, 16, 'Configure Mandatory Reviewers per Type', '#FFF0F0', '#8B1A1A');
  uc(870, 524, 65, 16, 'View Superseded Documents',     '#FFF0F0', '#8B1A1A');
  [280,480,670,870].forEach(x => assoc(80, 75, x, 524));

  // ── Originator ──────────────────────────────────────────────────────────────
  secHeader(556, 'ORIGINATOR');
  uc(340, 584, 80, 16, 'View Own Documents (Read-Only)');
  uc(560, 584, 70, 16, 'Track Document Status');
  uc(750, 584, 65, 16, 'Receive Status Notifications');
  [340,560,750].forEach(x => assoc(80, 710, x, 584));

  // ── Legend ───────────────────────────────────────────────────────────────────
  const LY = H - 36;
  const items = [
    { fill: 'white',   bc: N,       label: 'All Roles / Common' },
    { fill: '#FFF0F0', bc: '#8B1A1A', label: 'Admin Only' },
  ];
  let lx = SX + 16;
  items.forEach(it => {
    p.push(`<ellipse cx="${lx + 22}" cy="${LY}" rx="22" ry="10" fill="${it.fill}" stroke="${it.bc}" stroke-width="1"/>`);
    p.push(`<text x="${lx + 50}" y="${LY}" dominant-baseline="middle" font-size="7.5" fill="${GR}">${esc(it.label)}</text>`);
    lx += 160;
  });

  return wrapSvg(W, H, p.join('\n'));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3–7 ─ SEQUENCE DIAGRAMS (data)
// ═══════════════════════════════════════════════════════════════════════════════

// 3 ─ Document Upload & Submission
const SEQ3_P = [
  { id:'dc', label:'Document\nController' },
  { id:'ui', label:'Next.js UI' },
  { id:'api', label:'API Routes' },
  { id:'sp', label:'SharePoint\n(Graph API)' },
  { id:'db', label:'PostgreSQL' },
  { id:'pa', label:'Power Automate\n(Email)' },
  { id:'rv', label:'Reviewer(s)' },
];
const SEQ3_S = [
  { from:'dc', to:'ui',  label:'Upload .docx file' },
  { from:'ui', to:'api', label:'POST /api/upload' },
  { from:'api',to:'sp',  label:'PUT /drives/{id}/root:/{path}:/content' },
  { from:'sp', to:'api', label:'{ itemId, webUrl }', ret:true },
  { from:'api',to:'ui',  label:'{ storedName, sharePointUrl }', ret:true },
  { from:'dc', to:'ui',  label:'Fill metadata, select reviewers & deadline' },
  { from:'ui', to:'api', label:'POST /api/documents' },
  { from:'api',to:'db',  label:'INSERT Document (status: REGISTERED)' },
  { from:'api',to:'db',  label:'INSERT DocumentReview records (PENDING)' },
  { from:'db', to:'api', label:'Document created { id }', ret:true },
  { from:'api',to:'ui',  label:'{ documentId }', ret:true },
  { from:'dc', to:'ui',  label:'Click "Submit for Review"' },
  { from:'ui', to:'api', label:'POST /api/documents/{id}/submit' },
  { from:'api',to:'db',  label:'UPDATE Document → IN_REVIEW' },
  { from:'api',to:'db',  label:'UPDATE Reviews → startedAt, deadline' },
  { from:'api',to:'db',  label:'INSERT DocumentActivity (SUBMITTED)' },
  { from:'api',to:'db',  label:'INSERT Notifications for reviewers' },
  { from:'api',to:'pa',  label:'POST /email-flow — bulk reviewer emails' },
  { from:'pa', to:'rv',  label:'Review assignment email with token link' },
  { from:'api',to:'ui',  label:'{ status: IN_REVIEW }', ret:true },
];

// 4 ─ Review Decision
const SEQ4_P = [
  { id:'rv',  label:'Reviewer' },
  { id:'el',  label:'Email Token\nLink / Portal' },
  { id:'api', label:'API Routes' },
  { id:'db',  label:'PostgreSQL' },
  { id:'pa',  label:'Power Automate\n(Email)' },
  { id:'dc',  label:'Document\nController' },
];
const SEQ4_S = [
  { from:'rv', to:'el',  label:'Click review link in email (no login required)' },
  { from:'el', to:'api', label:'GET /api/review-token/{token}' },
  { from:'api',to:'db',  label:'Verify JWT token, fetch document + review' },
  { from:'db', to:'api', label:'Document data + review context', ret:true },
  { from:'api',to:'el',  label:'Document details + current status', ret:true },
  { from:'rv', to:'el',  label:'Read document, enter comment' },
  { from:'el', to:'api', label:'POST /api/review-token/{token}  { decision, comment }' },
  { from:'api',to:'db',  label:'UPDATE DocumentReview → status, comments, reviewedAt' },
  { from:'api',to:'db',  label:'INSERT DocumentActivity' },
  { alt:true, keyword:'alt', branches:[
    { cond:'All reviewers approved', msgs:[
      { from:'api',to:'db', label:'UPDATE Document → REVIEW_COMPLETE' },
      { from:'api',to:'db', label:'INSERT Notification for Document Controller' },
      { from:'api',to:'pa', label:'POST /email-flow — Review Complete to DC' },
      { from:'pa', to:'dc', label:'All reviews complete — please advance to approval' },
    ]},
    { cond:'Reviewer requested changes', msgs:[
      { from:'api',to:'db', label:'UPDATE Document → CHANGES_REQUESTED' },
      { from:'api',to:'db', label:'UPDATE other reviews → paused' },
      { from:'pa', to:'dc', label:'Changes requested by reviewer — notification sent' },
    ]},
    { cond:'Reviewer rejected', msgs:[
      { from:'api',to:'db', label:'UPDATE Document → REJECTED' },
      { from:'api',to:'db', label:'UPDATE all other reviews → halted' },
      { from:'pa', to:'dc', label:'Document rejected — reason provided' },
    ]},
  ]},
  { from:'api',to:'el',  label:'{ success: true }', ret:true },
  { from:'el', to:'rv',  label:'"Your decision has been recorded"', ret:true },
];

// 5 ─ Approval & Controlled Release
const SEQ5_P = [
  { id:'dc',  label:'Document\nController' },
  { id:'ui',  label:'Next.js UI' },
  { id:'api', label:'API Routes' },
  { id:'db',  label:'PostgreSQL' },
  { id:'sp',  label:'SharePoint' },
  { id:'pa',  label:'Power Automate' },
  { id:'ap',  label:'Approver(s)' },
];
const SEQ5_S = [
  { from:'dc', to:'ui',  label:'Click "Send Final Draft for Approval"' },
  { from:'ui', to:'api', label:'POST /api/documents/{id}/advance' },
  { from:'api',to:'db',  label:'UPDATE Document → FINAL_DRAFT' },
  { from:'api',to:'db',  label:'UPDATE approver reviews → IN_PROGRESS + deadline' },
  { from:'api',to:'pa',  label:'POST /email-flow — Approval request email' },
  { from:'pa', to:'ap',  label:'Approval request with document link' },
  { from:'ap', to:'api', label:'POST /api/review-token/{token}  { decision: APPROVED }' },
  { from:'api',to:'db',  label:'UPDATE DocumentReview → APPROVED' },
  { alt:true, keyword:'alt', branches:[
    { cond:'All approvers approved', msgs:[
      { from:'api',to:'db', label:'UPDATE Document → APPROVED' },
      { from:'pa', to:'dc', label:'All approvers approved — notification' },
      { from:'dc', to:'ui', label:'Click "Mark as Controlled"' },
      { from:'ui', to:'api',label:'POST /api/documents/{id}/control' },
      { from:'api',to:'db', label:'UPDATE Document → CONTROLLED  controlledAt  retentionDate (+40 yr)' },
      { from:'api',to:'db', label:'UPDATE previous CONTROLLED version → SUPERSEDED' },
      { from:'api',to:'sp', label:'Update SharePoint metadata (optional)' },
      { from:'api',to:'ui', label:'{ status: CONTROLLED }', ret:true },
    ]},
    { cond:'An approver rejects', msgs:[
      { from:'api',to:'db', label:'UPDATE Document → REJECTED' },
      { from:'api',to:'db', label:'Halt all other approvals' },
      { from:'pa', to:'dc', label:'Document rejected — reason provided' },
    ]},
  ]},
];

// 6 ─ EXCO Policy Workflow
const SEQ6_P = [
  { id:'dc',  label:'Document\nController' },
  { id:'ui',  label:'Next.js UI' },
  { id:'api', label:'API Routes' },
  { id:'db',  label:'PostgreSQL' },
  { id:'sp',  label:'SharePoint' },
];
const SEQ6_S = [
  { note:true, label:'Policy (PO) documents only — status must be APPROVED before this step' },
  { from:'dc', to:'ui',  label:'Click "Submit to EXCO"' },
  { from:'ui', to:'api', label:'POST /api/documents/{id}/exco  { action: "submit" }' },
  { from:'api',to:'db',  label:'UPDATE Document → EXCO_PENDING' },
  { from:'api',to:'ui',  label:'{ status: EXCO_PENDING }', ret:true },
  { note:true, label:'Board / EXCO meeting takes place offline' },
  { from:'dc', to:'ui',  label:'Upload Board resolution PDF + resolution number' },
  { from:'ui', to:'api', label:'POST /api/documents/{id}/exco  { action: "resolve", file }' },
  { from:'api',to:'sp',  label:'Upload resolution PDF to SharePoint DMS-Archive' },
  { from:'sp', to:'api', label:'{ itemId, webUrl }', ret:true },
  { from:'api',to:'db',  label:'UPDATE Document → CONTROLLED  excoResolutionUrl  controlledAt' },
  { from:'api',to:'db',  label:'UPDATE Document retentionDate (+40 years from controlled date)' },
  { from:'api',to:'db',  label:'UPDATE previous CONTROLLED version with same number → SUPERSEDED' },
  { from:'api',to:'db',  label:'INSERT DocumentActivity (CONTROLLED)' },
  { from:'api',to:'ui',  label:'{ status: CONTROLLED }', ret:true },
];

// 7 ─ SSO Authentication Flow
const SEQ7_P = [
  { id:'u',     label:'User' },
  { id:'ui',    label:'Browser' },
  { id:'app',   label:'Next.js App\n(Server)' },
  { id:'entra', label:'Microsoft\nEntra ID' },
  { id:'graph', label:'Microsoft\nGraph API' },
  { id:'db',    label:'PostgreSQL' },
];
const SEQ7_S = [
  { from:'u',     to:'ui',    label:'Click "Continue with Microsoft"' },
  { from:'ui',    to:'app',   label:'GET /api/auth/entra/login' },
  { from:'app',   to:'app',   label:'Generate random state (CSRF token)' },
  { from:'app',   to:'ui',    label:'Set oauth_state cookie (10 min)  →  302 redirect to Entra' },
  { from:'ui',    to:'entra', label:'GET /oauth2/v2.0/authorize?client_id=...&state=...' },
  { from:'entra', to:'u',     label:'Microsoft login page rendered', ret:true },
  { from:'u',     to:'entra', label:'Enter SANPC credentials' },
  { from:'entra', to:'ui',    label:'302 Redirect → /api/auth/entra/callback?code=...&state=...' },
  { from:'ui',    to:'app',   label:'GET /api/auth/entra/callback' },
  { from:'app',   to:'app',   label:'Verify state cookie matches (CSRF check)', noNum:true },
  { from:'app',   to:'entra', label:'POST /oauth2/v2.0/token  (exchange code for token)' },
  { from:'entra', to:'app',   label:'{ access_token }', ret:true },
  { from:'app',   to:'graph', label:'GET /v1.0/me  (fetch user profile)' },
  { from:'graph', to:'app',   label:'{ email, displayName, id }', ret:true },
  { from:'app',   to:'db',    label:'SELECT user WHERE email = ...' },
  { alt:true, keyword:'alt', branches:[
    { cond:'User exists in system', msgs:[
      { from:'app', to:'db', label:'UPDATE User — refresh displayName if changed' },
    ]},
    { cond:'New user (first login)', msgs:[
      { from:'app', to:'db', label:'INSERT User  { role: REVIEWER by default }' },
    ]},
  ]},
  { from:'db',    to:'app',   label:'User record returned', ret:true },
  { from:'app',   to:'app',   label:'Sign JWT session (8 h expiry, HS256, Cloud Secret)', noNum:true },
  { from:'app',   to:'ui',    label:'Set session cookie (httpOnly)  →  302 redirect /dashboard' },
  { from:'ui',    to:'u',     label:'Dashboard loaded', ret:true },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 8 ─ ENTITY RELATIONSHIP DIAGRAM
// ═══════════════════════════════════════════════════════════════════════════════
function erdSvg() {
  const W = 1100, H = 850;
  const p = [];
  p.push(`<rect width="${W}" height="${H}" fill="white"/>`);
  p.push(`<defs>
    <marker id="m1"  viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><polygon points="0,0 6,3 0,6" fill="${BD}"/></marker>
    <marker id="m1n" viewBox="0 0 6 6" refX="1" refY="3" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><polygon points="0,0 6,3 0,6" fill="${BD}"/></marker>
  </defs>`);

  // ── Entity box helper ─────────────────────────────────────────────────────────
  function entity(x, y, name, fields) {
    const EW = 190, RH = 17;
    const totalH = 28 + fields.length * RH + 4;
    p.push(`<rect x="${x}" y="${y}" width="${EW}" height="${totalH}" fill="white" stroke="${N}" stroke-width="1.4" rx="2"/>`);
    p.push(`<rect x="${x}" y="${y}" width="${EW}" height="28" fill="${N}" rx="2"/>`);
    p.push(`<rect x="${x}" y="${y + 22}" width="${EW}" height="6" fill="${N}"/>`);
    p.push(`<text x="${x + EW/2}" y="${y + 15}" text-anchor="middle" dominant-baseline="middle" font-size="9.5" font-weight="700" fill="white">${esc(name)}</text>`);
    fields.forEach((f, i) => {
      const fy = y + 28 + i * RH + RH / 2 + 2;
      if (i % 2 === 1) p.push(`<rect x="${x + 1}" y="${y + 28 + i * RH + 1}" width="${EW - 2}" height="${RH}" fill="#F8F9FB"/>`);
      const tag = f.pk ? '🔑 ' : f.fk ? '🔗 ' : '';
      const ftag = f.pk ? 'PK  ' : f.fk ? 'FK  ' : '       ';
      p.push(`<text x="${x + 8}" y="${fy}" dominant-baseline="middle" font-size="7.5" font-weight="${f.pk||f.fk?'700':'400'}" fill="${f.pk?G:f.fk?'#3A6EA5':TX}">${esc(ftag)}${esc(f.name)}</text>`);
      if (f.type) p.push(`<text x="${x + EW - 6}" y="${fy}" text-anchor="end" dominant-baseline="middle" font-size="6.5" fill="${GR}">${esc(f.type)}</text>`);
    });
    return { x, y, w: EW, h: totalH, cx: x + EW/2, cy: y + totalH/2 };
  }

  // ── Relationship line ─────────────────────────────────────────────────────────
  function rel(x1, y1, x2, y2, label) {
    p.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${BD}" stroke-width="1" marker-end="url(#m1)"/>`);
    if (label) {
      const mx = (x1+x2)/2, my = (y1+y2)/2;
      p.push(`<rect x="${mx-22}" y="${my-8}" width="44" height="14" fill="white"/>`);
      p.push(`<text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="middle" font-size="6.5" fill="${GR}">${esc(label)}</text>`);
    }
  }

  // ── Entities (positioned on grid) ─────────────────────────────────────────────
  const User = entity(18, 30, 'User', [
    { name:'id',             type:'cuid',     pk:true },
    { name:'name',           type:'string' },
    { name:'email',          type:'string UK' },
    { name:'password',       type:'string?' },
    { name:'role',           type:'enum' },
    { name:'departmentRole', type:'string?' },
    { name:'createdAt',      type:'datetime' },
  ]);

  const Document = entity(250, 30, 'Document', [
    { name:'id',                type:'cuid',  pk:true },
    { name:'title',             type:'string' },
    { name:'documentNumber',    type:'string?' },
    { name:'documentTypeCode',  type:'string' },
    { name:'status',            type:'enum' },
    { name:'version',           type:'int' },
    { name:'revision',          type:'string' },
    { name:'fileUrl',           type:'string' },
    { name:'sharePointItemId',  type:'string?' },
    { name:'isExcoRequired',    type:'bool' },
    { name:'controlledAt',      type:'datetime?' },
    { name:'retentionDate',     type:'datetime?' },
    { name:'uploadedById',      type:'cuid', fk:true },
    { name:'createdAt',         type:'datetime' },
  ]);

  const DocumentReview = entity(490, 30, 'DocumentReview', [
    { name:'id',          type:'cuid', pk:true },
    { name:'documentId',  type:'cuid', fk:true },
    { name:'reviewerId',  type:'cuid', fk:true },
    { name:'order',       type:'int' },
    { name:'isApprover',  type:'bool' },
    { name:'isMandatory', type:'bool' },
    { name:'status',      type:'enum' },
    { name:'comments',    type:'string?' },
    { name:'deadline',    type:'datetime?' },
    { name:'reviewedAt',  type:'datetime?' },
  ]);

  const DocumentVersion = entity(730, 30, 'DocumentVersion', [
    { name:'id',           type:'cuid', pk:true },
    { name:'documentId',   type:'cuid', fk:true },
    { name:'versionNumber',type:'int' },
    { name:'fileUrl',      type:'string' },
    { name:'uploadedById', type:'cuid', fk:true },
    { name:'createdAt',    type:'datetime' },
  ]);

  const DocumentAttachment = entity(730, 210, 'DocumentAttachment', [
    { name:'id',           type:'cuid', pk:true },
    { name:'documentId',   type:'cuid', fk:true },
    { name:'fileName',     type:'string' },
    { name:'fileUrl',      type:'string' },
    { name:'label',        type:'string?' },
    { name:'uploadedById', type:'cuid', fk:true },
    { name:'createdAt',    type:'datetime' },
  ]);

  const DocumentActivity = entity(250, 420, 'DocumentActivity', [
    { name:'id',         type:'cuid', pk:true },
    { name:'documentId', type:'cuid', fk:true },
    { name:'userId',     type:'cuid', fk:true },
    { name:'action',     type:'enum' },
    { name:'details',    type:'string?' },
    { name:'createdAt',  type:'datetime' },
  ]);

  const DocumentComment = entity(490, 420, 'DocumentComment', [
    { name:'id',         type:'cuid', pk:true },
    { name:'documentId', type:'cuid', fk:true },
    { name:'authorId',   type:'cuid', fk:true },
    { name:'content',    type:'string' },
    { name:'createdAt',  type:'datetime' },
  ]);

  const DocumentMetadata = entity(730, 420, 'DocumentMetadata', [
    { name:'id',         type:'cuid', pk:true },
    { name:'documentId', type:'cuid', fk:true },
    { name:'key',        type:'string' },
    { name:'value',      type:'string' },
  ]);

  const MandatoryReviewerConfig = entity(18, 420, 'MandatoryReviewerConfig', [
    { name:'id',           type:'cuid', pk:true },
    { name:'documentType', type:'string' },
    { name:'userId',       type:'cuid', fk:true },
    { name:'createdAt',    type:'datetime' },
  ]);

  const Notification = entity(18, 650, 'Notification', [
    { name:'id',         type:'cuid', pk:true },
    { name:'userId',     type:'cuid', fk:true },
    { name:'type',       type:'string' },
    { name:'title',      type:'string' },
    { name:'message',    type:'string' },
    { name:'documentId', type:'string?' },
    { name:'read',       type:'bool' },
    { name:'createdAt',  type:'datetime' },
  ]);

  // ── Relationship lines ──────────────────────────────────────────────────────
  // User → Document
  rel(User.x + User.w, User.cy - 10, Document.x, Document.cy - 10, '1..*');
  // User → DocumentReview
  rel(User.x + User.w, User.cy + 10, DocumentReview.x, DocumentReview.cy - 20, '1..*');
  // Document → DocumentReview
  rel(Document.x + Document.w, Document.cy, DocumentReview.x, DocumentReview.cy + 10, '1..*');
  // Document → DocumentVersion
  rel(Document.x + Document.w, 90, DocumentVersion.x, 90, '1..*');
  // Document → DocumentAttachment
  rel(Document.x + Document.w, 140, DocumentAttachment.x, DocumentAttachment.cy - 10, '1..*');
  // Document → DocumentActivity
  rel(Document.cx, Document.y + Document.h, DocumentActivity.cx, DocumentActivity.y, '1..*');
  // Document → DocumentComment
  rel(Document.x + Document.w, 360, DocumentComment.x, DocumentComment.cy - 10, '1..*');
  // Document → DocumentMetadata
  rel(Document.x + Document.w, 380, DocumentMetadata.x, DocumentMetadata.cy - 10, '1..*');
  // User → MandatoryReviewerConfig
  rel(User.cx, User.y + User.h, MandatoryReviewerConfig.cx, MandatoryReviewerConfig.y, '1..*');
  // User → Notification
  rel(User.x, User.y + User.h, Notification.x + 40, Notification.y, '1..*');

  // ── Cardinality labels ────────────────────────────────────────────────────────
  p.push(`<text x="530" y="${H - 16}" text-anchor="middle" font-size="7.5" fill="${GR}">PK = Primary Key  ·  FK = Foreign Key  ·  UK = Unique  ·  ? = nullable  ·  Lines indicate one-to-many (1..*) relationships</text>`);

  return wrapSvg(W, H, p.join('\n'));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9 ─ DOCUMENT STATUS FLOW
// ═══════════════════════════════════════════════════════════════════════════════
function statusFlowSvg() {
  const W = 1040, H = 780;
  const p = [];
  p.push(`<rect width="${W}" height="${H}" fill="white"/>`);
  p.push(`<defs>
    <marker id="sa" viewBox="0 0 8 6" refX="7" refY="3" markerWidth="8" markerHeight="6" orient="auto"><polygon points="0,0 8,3 0,6" fill="${N}"/></marker>
    <marker id="sr" viewBox="0 0 8 6" refX="7" refY="3" markerWidth="8" markerHeight="6" orient="auto"><polygon points="0,0 8,3 0,6" fill="#C62828"/></marker>
    <marker id="sc" viewBox="0 0 8 6" refX="7" refY="3" markerWidth="8" markerHeight="6" orient="auto"><polygon points="0,0 8,3 0,6" fill="#9E9E9E"/></marker>
  </defs>`);

  function stateBox(x, y, label, fill, bc, textColor) {
    const W = 138, H = 32;
    p.push(`<rect x="${x}" y="${y}" width="${W}" height="${H}" fill="${fill}" stroke="${bc}" stroke-width="1.5" rx="14"/>`);
    label.split('\n').forEach((ln, li) => {
      p.push(`<text x="${x+W/2}" y="${y+H/2+(li-(label.split('\n').length-1)/2)*11}" text-anchor="middle" dominant-baseline="middle" font-size="9" font-weight="700" fill="${textColor||TX}">${esc(ln)}</text>`);
    });
    return { cx: x + W/2, cy: y + H/2, top: y, bot: y+H, left: x, right: x+W };
  }

  function arrow(x1, y1, x2, y2, label, mk, curved) {
    mk = mk || 'sa';
    const stroke = mk === 'sr' ? '#C62828' : mk === 'sc' ? '#9E9E9E' : N;
    if (curved) {
      const mx = (x1+x2)/2, my = (y1+y2)/2;
      const cx1 = mx + curved.dx, cy1 = curved.dy ? my + curved.dy : y1;
      p.push(`<path d="M${x1},${y1} C${cx1},${cy1} ${cx1},${cy1} ${x2},${y2}" fill="none" stroke="${stroke}" stroke-width="1.3" marker-end="url(#${mk})"/>`);
    } else {
      p.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="1.3" marker-end="url(#${mk})"/>`);
    }
    if (label) {
      const mx = (x1+x2)/2 + (curved?.lox||0);
      const my = (y1+y2)/2 + (curved?.loy||0);
      p.push(`<rect x="${mx-28}" y="${my-8}" width="56" height="14" fill="white"/>`);
      p.push(`<text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="middle" font-size="7" fill="${stroke}">${esc(label)}</text>`);
    }
  }

  // ── Main flow ─────────────────────────────────────────────────────────────────
  const REG = stateBox(16,  36,  'REGISTERED',       LT,         N);
  const DFT = stateBox(204, 36,  'DRAFT',            LT,         N);
  const INR = stateBox(392, 36,  'IN_REVIEW',        '#DBEAFE',  '#1E40AF', '#1E40AF');
  const UPD = stateBox(580, 36,  'UPDATING',         '#FEF9C3',  '#A16207', '#7C5E06');
  const RVC = stateBox(770, 36,  'REVIEW_COMPLETE',  '#D1FAE5',  '#065F46', '#065F46');
  const FDR = stateBox(770, 120, 'FINAL_DRAFT',      '#D1FAE5',  '#065F46', '#065F46');
  const PA  = stateBox(580, 120, 'PENDING_APPROVAL', '#D1FAE5',  '#065F46', '#065F46');
  const APR = stateBox(392, 120, 'APPROVED',         '#A7F3D0',  '#047857', '#065F46');
  const EXC = stateBox(580, 220, 'EXCO_PENDING',     '#FEF3C7',  G,         '#7C4A00');
  const CTL = stateBox(392, 220, 'CONTROLLED',       N,          '#0F1E2E',  'white');
  const SUP = stateBox(204, 220, 'SUPERSEDED',       '#F3F4F6',  '#9CA3AF', '#6B7280');

  const CHG = stateBox(204, 370, 'CHANGES_REQUESTED','#FEE2E2',  '#DC2626', '#B91C1C');
  const REJ = stateBox(392, 370, 'REJECTED',         '#FEE2E2',  '#DC2626', '#B91C1C');
  const CAN = stateBox(580, 370, 'CANCELLED',        '#F9FAFB',  '#9CA3AF', '#6B7280');

  // ── Initial node ──────────────────────────────────────────────────────────────
  p.push(`<circle cx="${REG.left - 20}" cy="${REG.cy}" r="8" fill="${N}"/>`);
  arrow(REG.left - 12, REG.cy, REG.left, REG.cy, '');

  // ── Main path ──────────────────────────────────────────────────────────────────
  arrow(REG.right,  REG.cy,   DFT.left,  DFT.cy,   'upload');
  arrow(DFT.right,  DFT.cy,   INR.left,  INR.cy,   'submit');
  arrow(INR.right,  INR.cy,   UPD.left,  UPD.cy,   'all approved');
  arrow(UPD.right,  UPD.cy,   RVC.left,  RVC.cy,   '');
  arrow(RVC.cx,     RVC.bot,  FDR.cx,    FDR.top,  '');
  arrow(FDR.left,   FDR.cy,   PA.right,  PA.cy,    'advance');
  arrow(PA.left,    PA.cy,    APR.right, APR.cy,   'approved');
  arrow(APR.cx,     APR.bot,  CTL.cx,    CTL.top,  'non-policy');
  arrow(CTL.left,   CTL.cy,   SUP.right, SUP.cy,   'next version');

  // Policy EXCO path
  arrow(APR.cx + 30, APR.bot + 2, EXC.cx - 10, EXC.top, 'policy (PO)', 'sa', { dx: 80, lox: 50, loy: 0 });
  arrow(EXC.left,    EXC.cy,   CTL.right, CTL.cy,   'board resolution', 'sa');

  // Changes requested flow
  arrow(INR.cx,  INR.bot, CHG.cx,  CHG.top, 'changes req.', 'sr');
  arrow(CHG.cx,  CHG.bot + 5, CHG.cx - 40, CHG.bot + 40, '', 'sa');
  // Return to IN_REVIEW from changes
  p.push(`<path d="M${CHG.left - 8},${CHG.cy} Q ${CHG.left - 80},${INR.bot + 80} ${INR.left + 30},${INR.bot}" fill="none" stroke="${N}" stroke-width="1.3" marker-end="url(#sa)"/>`);
  p.push(`<rect x="${CHG.left - 95}" y="${INR.bot + 62}" width="64" height="13" fill="white"/>`);
  p.push(`<text x="${CHG.left - 63}" y="${INR.bot + 69}" text-anchor="middle" dominant-baseline="middle" font-size="7" fill="${N}">resubmit</text>`);

  // Rejected flow
  arrow(INR.cx + 30, INR.bot + 2, REJ.cx - 20, REJ.top, 'rejected', 'sr');
  arrow(PA.cx,   PA.bot + 2,  REJ.cx + 20, REJ.top, 'rejected', 'sr');
  // Resubmit from rejected
  p.push(`<path d="M${REJ.right + 4},${REJ.cy - 10} Q ${REJ.right + 60},${INR.cy + 40} ${INR.right - 10},${INR.cy + 14}" fill="none" stroke="${N}" stroke-width="1.3" marker-end="url(#sa)"/>`);
  p.push(`<rect x="${REJ.right + 22}" y="${INR.cy + 16}" width="60" height="13" fill="white"/>`);
  p.push(`<text x="${REJ.right + 52}" y="${INR.cy + 23}" text-anchor="middle" dominant-baseline="middle" font-size="7" fill="${N}">new version</text>`);

  // Cancelled
  arrow(DFT.cx,   DFT.bot + 2, CAN.left,  CAN.cy,   'cancel', 'sc');
  arrow(INR.cx,   INR.bot + 2, CAN.cx - 10, CAN.top + 1, '', 'sc');
  arrow(PA.right + 2,  PA.cy + 10,  CAN.cx + 20,  CAN.top + 1, '', 'sc');

  // ── Legend ────────────────────────────────────────────────────────────────────
  const LY = H - 52;
  const legendItems = [
    { fill: LT,       bc: N,        label: 'Registered / Draft', tc: TX },
    { fill: '#DBEAFE', bc: '#1E40AF', label: 'Under Review', tc: '#1E40AF' },
    { fill: '#D1FAE5', bc: '#065F46', label: 'Review / Approval Complete', tc: '#065F46' },
    { fill: N,        bc: '#0F1E2E', label: 'CONTROLLED', tc: 'white' },
    { fill: '#FEE2E2', bc: '#DC2626', label: 'Rejected / Changes', tc: '#B91C1C' },
    { fill: '#F3F4F6', bc: '#9CA3AF', label: 'Superseded / Cancelled', tc: '#6B7280' },
    { fill: '#FEF3C7', bc: G,        label: 'EXCO Pending', tc: '#7C4A00' },
  ];
  let lx = 20;
  legendItems.forEach(it => {
    p.push(`<rect x="${lx}" y="${LY}" width="16" height="16" fill="${it.fill}" stroke="${it.bc}" stroke-width="1.2" rx="3"/>`);
    p.push(`<text x="${lx + 22}" y="${LY + 9}" dominant-baseline="middle" font-size="7.5" fill="${GR}">${esc(it.label)}</text>`);
    lx += it.label.length * 5.5 + 32;
  });

  return wrapSvg(W, H, p.join('\n'));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PDF COMPILER
// ═══════════════════════════════════════════════════════════════════════════════
async function compilePdf(browser, imagePaths) {
  const titles = [
    'System Architecture',
    'Use Case Diagram',
    'Sequence Diagram — Document Upload & Submission',
    'Sequence Diagram — Review Decision Workflow',
    'Sequence Diagram — Approval & Controlled Release',
    'Sequence Diagram — Policy EXCO Workflow',
    'Sequence Diagram — SSO Authentication Flow',
    'Entity Relationship Diagram (ERD)',
    'Document Status Flow',
  ];

  const images = imagePaths.map(pt => `data:image/png;base64,${readFileSync(pt).toString('base64')}`);

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,Calibri,sans-serif;background:#fff}
    .cover{background:linear-gradient(160deg,#0f1e2e,${N});padding:60px;min-height:190mm;display:flex;flex-direction:column;justify-content:center;align-items:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .cover img{width:110px;height:110px;object-fit:contain;background:#fff;border-radius:12px;padding:8px;margin-bottom:24px}
    .cover h1{color:#fff;font-size:22pt;font-weight:700;text-align:center;margin-bottom:6px}
    .cover .sub{color:${G};font-size:12pt;font-weight:600;text-align:center;margin-bottom:4px}
    .cover .sub2{color:rgba(255,255,255,0.65);font-size:9pt;text-align:center;margin-bottom:32px}
    .cover table{border-collapse:collapse}
    .cover td{color:#d8e8f5;border:1px solid rgba(255,255,255,0.12);padding:5px 16px;font-size:8.5pt}
    .cover td:first-child{font-weight:700;color:${G};width:140px}
    .toc{padding:40px 50px;page-break-before:always}
    .toc h2{font-size:14pt;color:${N};border-bottom:2px solid ${G};padding-bottom:7px;margin-bottom:20px}
    .toc-item{display:flex;align-items:baseline;gap:6px;padding:8px 0;border-bottom:1px dotted #ddd;font-size:9.5pt}
    .toc-n{color:${G};font-weight:700;width:28px;flex-shrink:0}
    .toc-t{color:${N};font-weight:500;flex:1}
    .dpage{page-break-before:always;padding:20px 28px}
    .dpage img{width:100%;height:auto;border:1px solid #e0e5ec;display:block}
    .footer{font-size:6.5pt;color:#aaa;text-align:center;margin-top:10px;border-top:1px solid #eee;padding-top:6px}
    @page{size:A4 landscape;margin:10mm}
  </style></head><body>

  <div class="cover">
    <img src="${LOGO_SRC}" alt="SANPC"/>
    <h1>SANPC Policy Repository DMS</h1>
    <div class="sub">Technical Documentation</div>
    <div class="sub2">System Architecture &nbsp;&bull;&nbsp; Use Cases &nbsp;&bull;&nbsp; Sequence Diagrams &nbsp;&bull;&nbsp; ERD &nbsp;&bull;&nbsp; Status Flow</div>
    <table>
      <tr><td>Organisation</td><td>South African National Petroleum Company (SANPC)</td></tr>
      <tr><td>Document Ref</td><td>DMS-TECH-001 &nbsp;|&nbsp; Rev 00</td></tr>
      <tr><td>Date</td><td>September 2026</td></tr>
      <tr><td>Prepared By</td><td>ICT Department</td></tr>
      <tr><td>Classification</td><td>Internal — Confidential</td></tr>
    </table>
  </div>

  <div class="toc">
    <h2>Table of Contents</h2>
    ${titles.map((t,i) => `<div class="toc-item"><span class="toc-n">${i+1}.</span><span class="toc-t">${t}</span></div>`).join('')}
  </div>

  ${images.map((src,i) => `
  <div class="dpage">
    <img src="${src}" alt="${titles[i]}"/>
    <div class="footer">SANPC Policy Repository DMS &nbsp;|&nbsp; DMS-TECH-001 &nbsp;|&nbsp; ${titles[i]} &nbsp;|&nbsp; Page ${i+3} of ${titles.length+2}</div>
  </div>`).join('')}

  </body></html>`;

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  const pdfPath = resolve(OUT, '../SANPC_DMS_Technical_Documentation.pdf');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    landscape: true,
    printBackground: true,
    margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    displayHeaderFooter: false,
  });
  await page.close();
  console.log('\n  ✓ PDF compiled:', pdfPath);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('Launching browser...\n');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox'],
  });

  const paths = [];
  console.log('Rendering diagrams...');

  paths.push(await render(browser, archSvg(),       '1. System Architecture',                          '01-architecture.png'));
  paths.push(await render(browser, useCaseSvg(),    '2. Use Case Diagram',                             '02-use-cases.png'));
  paths.push(await render(browser, seqSvg(SEQ3_P, SEQ3_S), '3. Sequence: Document Upload & Submission','03-seq-upload.png'));
  paths.push(await render(browser, seqSvg(SEQ4_P, SEQ4_S), '4. Sequence: Review Decision Workflow',   '04-seq-review.png'));
  paths.push(await render(browser, seqSvg(SEQ5_P, SEQ5_S), '5. Sequence: Approval & Controlled Release','05-seq-approve.png'));
  paths.push(await render(browser, seqSvg(SEQ6_P, SEQ6_S), '6. Sequence: Policy EXCO Workflow',       '06-seq-exco.png'));
  paths.push(await render(browser, seqSvg(SEQ7_P, SEQ7_S), '7. Sequence: SSO Authentication Flow',    '07-seq-auth.png'));
  paths.push(await render(browser, erdSvg(),        '8. Entity Relationship Diagram',                  '08-erd.png'));
  paths.push(await render(browser, statusFlowSvg(), '9. Document Status Flow',                         '09-status-flow.png'));

  console.log('\nCompiling PDF...');
  await compilePdf(browser, paths);

  await browser.close();
  console.log('\n✅ Done — docs/output/SANPC_DMS_Technical_Documentation.pdf');
}

main().catch(err => { console.error(err); process.exit(1); });
