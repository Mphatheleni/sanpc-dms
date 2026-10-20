import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DOCS = resolve(ROOT, 'docs');
const OUT = resolve(DOCS, 'output');

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

// ── Helpers ──────────────────────────────────────────────────────────────────

function mdToHtml(md, title) {
  // Basic markdown → HTML conversion sufficient for our structured docs
  let html = md
    // Headings
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Images — resolve to absolute file path
    .replace(/!\[([^\]]*)\]\(screenshots\/([^)]+)\)/g, (_, alt, file) => {
      const imgPath = resolve(DOCS, 'screenshots', file);
      const ext = file.split('.').pop().toLowerCase();
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
      try {
        const b64 = readFileSync(imgPath).toString('base64');
        return `<figure><img src="data:${mime};base64,${b64}" alt="${alt}" /><figcaption>${alt}</figcaption></figure>`;
      } catch {
        return `<figure><p><em>[Image: ${alt}]</em></p></figure>`;
      }
    })
    // Horizontal rule
    .replace(/^---$/gm, '<hr />')
    // Blockquote
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Unordered list items
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Ordered list items
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Tables — handled below
    ;

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`);

  // Tables
  html = html.replace(/((?:^\|.+\|\n?)+)/gm, (tableBlock) => {
    const lines = tableBlock.trim().split('\n').filter(l => l.trim());
    // separator line
    const rows = lines.filter(l => !/^\|[-| :]+\|$/.test(l.trim()));
    if (rows.length < 1) return tableBlock;
    const header = rows[0];
    const body = rows.slice(1);
    const parseCells = line =>
      line.split('|').slice(1, -1).map(c => c.trim());

    const headerCells = parseCells(header).map(c => `<th>${c}</th>`).join('');
    const bodyRows = body.map(r =>
      `<tr>${parseCells(r).map(c => `<td>${c}</td>`).join('')}</tr>`
    ).join('\n');

    return `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  });

  // Paragraphs — wrap lines that are not already block elements
  const lines = html.split('\n');
  const result = [];
  let inPre = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { result.push(''); continue; }
    if (/^<(h[1-6]|ul|ol|li|table|thead|tbody|tr|th|td|hr|blockquote|figure|pre|code)/.test(trimmed)) {
      result.push(line);
    } else {
      result.push(`<p>${line}</p>`);
    }
  }

  const body = result.join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
    font-size: 10.5pt;
    color: #1a1a2e;
    line-height: 1.6;
    background: #fff;
  }

  /* Cover strip */
  .cover {
    background: linear-gradient(135deg, #0f1e2e 0%, #1C3557 100%);
    color: #fff;
    padding: 48px 56px 40px;
    margin-bottom: 0;
  }
  .cover h1 { font-size: 26pt; font-weight: 700; color: #fff; border: none; padding: 0; margin-bottom: 6px; }
  .cover .sub { font-size: 13pt; color: #F5A623; font-weight: 600; margin-bottom: 20px; }
  .cover table { background: rgba(255,255,255,0.08); border-radius: 6px; }
  .cover table td { color: #e0e8f0; border-color: rgba(255,255,255,0.15); padding: 6px 14px; font-size: 9.5pt; }
  .cover table th { color: #F5A623; border-color: rgba(255,255,255,0.15); padding: 6px 14px; font-size: 9.5pt; }

  .content { padding: 36px 56px; }

  h1 { font-size: 20pt; font-weight: 700; color: #1C3557; border-bottom: 3px solid #F5A623; padding-bottom: 8px; margin: 32px 0 16px; page-break-after: avoid; }
  h2 { font-size: 14pt; font-weight: 700; color: #1C3557; border-left: 4px solid #F5A623; padding-left: 12px; margin: 28px 0 12px; page-break-after: avoid; }
  h3 { font-size: 11.5pt; font-weight: 600; color: #1C3557; margin: 22px 0 8px; page-break-after: avoid; }
  h4 { font-size: 10.5pt; font-weight: 600; color: #2c4a6e; margin: 16px 0 6px; page-break-after: avoid; }

  p { margin: 8px 0; }
  ul, ol { margin: 8px 0 8px 24px; }
  li { margin: 3px 0; }

  code { background: #f0f4f8; border-radius: 3px; padding: 1px 5px; font-family: 'Courier New', monospace; font-size: 9pt; color: #c0392b; }
  pre { background: #f0f4f8; border-radius: 6px; padding: 12px 16px; margin: 12px 0; overflow-x: auto; }
  pre code { background: none; color: #1a1a2e; }

  blockquote {
    border-left: 4px solid #F5A623;
    background: #fffbf0;
    margin: 12px 0;
    padding: 10px 16px;
    border-radius: 0 6px 6px 0;
    font-style: italic;
    color: #555;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 14px 0;
    font-size: 9.5pt;
    page-break-inside: avoid;
  }
  th {
    background: #1C3557;
    color: #fff;
    padding: 8px 10px;
    text-align: left;
    font-weight: 600;
  }
  td {
    border: 1px solid #d0d9e8;
    padding: 7px 10px;
    vertical-align: top;
  }
  tr:nth-child(even) td { background: #f5f7fb; }

  hr { border: none; border-top: 1px solid #d0d9e8; margin: 20px 0; }

  figure {
    margin: 18px 0;
    text-align: center;
    page-break-inside: avoid;
  }
  figure img {
    max-width: 100%;
    border: 1px solid #d0d9e8;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.10);
  }
  figcaption {
    font-size: 8.5pt;
    color: #666;
    margin-top: 6px;
    font-style: italic;
  }

  strong { font-weight: 600; color: #1C3557; }

  /* Signature blocks */
  .sig-block { border: 1px solid #d0d9e8; border-radius: 8px; padding: 16px 20px; margin: 12px 0; page-break-inside: avoid; }

  @page {
    size: A4;
    margin: 15mm 15mm 18mm 15mm;
    @bottom-center {
      content: "SANPC DMS — Confidential | Page " counter(page) " of " counter(pages);
      font-size: 8pt;
      color: #888;
    }
  }

  @media print {
    .cover { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    tr:nth-child(even) td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

async function htmlToPdf(html, outPath) {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: outPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '15mm', bottom: '18mm', left: '15mm', right: '15mm' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `
      <div style="font-size:8pt;color:#888;width:100%;text-align:center;padding:0 15mm;">
        SANPC DMS — Confidential &nbsp;|&nbsp; Page <span class="pageNumber"></span> of <span class="totalPages"></span>
      </div>`,
  });
  await browser.close();
  console.log('✓ PDF:', outPath);
}

async function htmlToDocx(html, outPath, docTitle) {
  // Use docx library to build a proper .docx
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
          WidthType, AlignmentType, BorderStyle, ImageRun, PageBreak, HorizontalPositionAlign } = await import('docx');

  // Parse the HTML into a simple token list
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const children = [];
  const SANPC_BLUE = '1C3557';
  const SANPC_GOLD = 'F5A623';

  function parseInline(el) {
    const runs = [];
    for (const node of el.childNodes) {
      if (node.nodeType === 3) { // text
        if (node.textContent.trim()) runs.push(new TextRun({ text: node.textContent }));
      } else if (node.nodeName === 'STRONG' || node.nodeName === 'B') {
        runs.push(new TextRun({ text: node.textContent, bold: true }));
      } else if (node.nodeName === 'EM' || node.nodeName === 'I') {
        runs.push(new TextRun({ text: node.textContent, italics: true }));
      } else if (node.nodeName === 'CODE') {
        runs.push(new TextRun({ text: node.textContent, font: 'Courier New', size: 18 }));
      } else {
        const t = node.textContent;
        if (t.trim()) runs.push(new TextRun({ text: t }));
      }
    }
    return runs;
  }

  function processNode(el) {
    const tag = el.nodeName;

    if (tag === 'H1') {
      children.push(new Paragraph({ text: el.textContent, heading: HeadingLevel.HEADING_1,
        thematicBreak: true,
        run: { color: SANPC_BLUE, bold: true } }));
    } else if (tag === 'H2') {
      children.push(new Paragraph({ text: el.textContent, heading: HeadingLevel.HEADING_2,
        run: { color: SANPC_BLUE } }));
    } else if (tag === 'H3') {
      children.push(new Paragraph({ text: el.textContent, heading: HeadingLevel.HEADING_3 }));
    } else if (tag === 'H4') {
      children.push(new Paragraph({ text: el.textContent, heading: HeadingLevel.HEADING_4 }));
    } else if (tag === 'P') {
      const runs = parseInline(el);
      if (runs.length) children.push(new Paragraph({ children: runs }));
    } else if (tag === 'BLOCKQUOTE') {
      children.push(new Paragraph({
        children: [new TextRun({ text: el.textContent, italics: true, color: '555555' })],
        indent: { left: 720 },
        border: { left: { style: BorderStyle.SINGLE, size: 6, color: SANPC_GOLD } },
      }));
    } else if (tag === 'HR') {
      children.push(new Paragraph({ thematicBreak: true }));
    } else if (tag === 'UL' || tag === 'OL') {
      for (const li of el.querySelectorAll('li')) {
        children.push(new Paragraph({
          children: parseInline(li),
          bullet: { level: 0 },
        }));
      }
    } else if (tag === 'TABLE') {
      const rows = [];
      const allRows = el.querySelectorAll('tr');
      allRows.forEach((tr, ri) => {
        const cells = [];
        tr.querySelectorAll('th, td').forEach(cell => {
          cells.push(new TableCell({
            children: [new Paragraph({
              children: [new TextRun({
                text: cell.textContent.replace(/\\+_/g, '').trim(),
                bold: cell.nodeName === 'TH',
                color: cell.nodeName === 'TH' ? 'FFFFFF' : '1a1a2e',
                size: 18,
              })],
            })],
            shading: cell.nodeName === 'TH' ? { fill: SANPC_BLUE } : (ri % 2 === 0 ? {} : { fill: 'F5F7FB' }),
          }));
        });
        if (cells.length) rows.push(new TableRow({ children: cells }));
      });
      if (rows.length) {
        children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
        children.push(new Paragraph({}));
      }
    } else if (tag === 'FIGURE') {
      const img = el.querySelector('img');
      const caption = el.querySelector('figcaption');
      if (img) {
        const src = img.getAttribute('src') || '';
        const b64match = src.match(/^data:image\/\w+;base64,(.+)$/);
        if (b64match) {
          const imgBuf = Buffer.from(b64match[1], 'base64');
          children.push(new Paragraph({
            children: [new ImageRun({ data: imgBuf, transformation: { width: 500, height: 310 }, type: 'png' })],
            alignment: AlignmentType.CENTER,
          }));
        }
      }
      if (caption) {
        children.push(new Paragraph({
          children: [new TextRun({ text: caption.textContent, italics: true, color: '666666', size: 17 })],
          alignment: AlignmentType.CENTER,
        }));
      }
      children.push(new Paragraph({}));
    } else {
      // recurse into children
      for (const child of el.children) processNode(child);
    }
  }

  // Title page paragraphs
  children.push(new Paragraph({
    children: [new TextRun({ text: 'SANPC', bold: true, size: 52, color: SANPC_BLUE })],
    alignment: AlignmentType.CENTER,
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: docTitle, bold: true, size: 36, color: SANPC_BLUE })],
    alignment: AlignmentType.CENTER,
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: 'South African National Planning Commission', size: 22, color: '555555' })],
    alignment: AlignmentType.CENTER,
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: 'September 2026', size: 22, color: SANPC_GOLD })],
    alignment: AlignmentType.CENTER,
  }));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  const body = doc.querySelector('body');
  for (const child of body.children) processNode(child);

  const wordDoc = new Document({
    creator: 'SANPC ICT',
    title: docTitle,
    description: 'SANPC Document Management System',
    sections: [{ children }],
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 21 } },
      },
    },
  });

  const buf = await Packer.toBuffer(wordDoc);
  writeFileSync(outPath, buf);
  console.log('✓ DOCX:', outPath);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const files = [
    {
      md: 'SANPC_DMS_Training_Manual.md',
      title: 'SANPC DMS — User Training Manual',
      pdfOut: 'SANPC_DMS_Training_Manual.pdf',
      docxOut: 'SANPC_DMS_Training_Manual.docx',
    },
    {
      md: 'SANPC_DMS_UAT_Signoff.md',
      title: 'SANPC DMS — UAT Sign-Off Certificate',
      pdfOut: 'SANPC_DMS_UAT_Signoff.pdf',
      docxOut: 'SANPC_DMS_UAT_Signoff.docx',
    },
  ];

  for (const f of files) {
    console.log(`\nProcessing: ${f.md}`);
    const md = readFileSync(resolve(DOCS, f.md), 'utf-8');
    const html = mdToHtml(md, f.title);

    // Save intermediate HTML for debugging
    writeFileSync(resolve(OUT, f.md.replace('.md', '.html')), html);

    await htmlToPdf(html, resolve(OUT, f.pdfOut));
    await htmlToDocx(html, resolve(OUT, f.docxOut), f.title);
  }

  console.log('\n✅ All files saved to docs/output/');
}

run().catch(console.error);
