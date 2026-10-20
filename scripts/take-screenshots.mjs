import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const BASE = 'http://localhost:3002';
const SCREENSHOTS_DIR = './docs/screenshots';
const EMAIL = 'mphatheleni.matidze@sa-npc.co.za';
const PASSWORD = 'Shudu@207';

async function shot(page, name, description) {
  const path = `${SCREENSHOTS_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`✓ ${name} — ${description}`);
}

async function main() {
  if (!existsSync(SCREENSHOTS_DIR)) {
    await mkdir(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 }
  });

  const page = await browser.newPage();

  try {
    // ── 1. Login Page ────────────────────────────────────────────────────────
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    await shot(page, '01-login', 'Login page');

    // ── 2. Authenticate via API to get session cookie ────────────────────────
    const loginResp = await page.evaluate(async (email, password, base) => {
      const res = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });
      return { status: res.status, ok: res.ok };
    }, EMAIL, PASSWORD, BASE);

    console.log('Login API response:', loginResp);

    if (!loginResp.ok) {
      console.error('Login failed!');
      await browser.close();
      return;
    }

    // ── 3. Dashboard ─────────────────────────────────────────────────────────
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2500));
    await shot(page, '02-dashboard', 'Dashboard — top overview cards');

    // Scroll to charts
    await page.evaluate(() => window.scrollTo(0, 420));
    await new Promise(r => setTimeout(r, 800));
    await shot(page, '03-dashboard-charts', 'Dashboard — status distribution chart');

    // ── 4. Documents List ────────────────────────────────────────────────────
    await page.goto(`${BASE}/documents`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2500));
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, '04-documents-list', 'Documents list page');

    // ── 5. New Document Wizard ───────────────────────────────────────────────
    await page.goto(`${BASE}/documents/new`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2500));
    await shot(page, '05-new-document-step1', 'New document — Step 1: Upload file');

    // ── 6. Admin Panel ───────────────────────────────────────────────────────
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2500));
    await shot(page, '06-admin-panel', 'Admin — User management');

    // Scroll down for mandatory reviewers section
    await page.evaluate(() => window.scrollTo(0, 600));
    await new Promise(r => setTimeout(r, 600));
    await shot(page, '07-admin-mandatory-reviewers', 'Admin — Mandatory reviewers configuration');

    // ── 7. Reports ───────────────────────────────────────────────────────────
    await page.goto(`${BASE}/reports`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));
    await shot(page, '08-reports', 'Reports and analytics page');

    // ── 8. First Document Detail — fetch ID via API ──────────────────────────
    const docsJson = await page.evaluate(async (base) => {
      const res = await fetch(`${base}/api/documents?limit=1`, { credentials: 'include' });
      return res.ok ? res.json() : null;
    }, BASE);

    // API returns array directly
    const firstDocId = Array.isArray(docsJson) ? docsJson[0]?.id : (docsJson?.documents?.[0]?.id ?? null);
    console.log('First doc id:', firstDocId);

    // Use a document in an active workflow state for richer screenshots
    const allDocs = Array.isArray(docsJson) ? docsJson : [];
    const activeDoc = allDocs.find(d => ['IN_REVIEW','REVIEW_COMPLETE','PENDING_APPROVAL','FINAL_DRAFT','APPROVED'].includes(d.status)) ?? allDocs[0];
    const detailDocId = activeDoc?.id ?? firstDocId;
    console.log('Detail doc:', detailDocId, activeDoc?.status);

    if (detailDocId) {
      // Overview tab
      await page.goto(`${BASE}/documents/${detailDocId}`, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 3500));
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot(page, '09-document-detail-overview', 'Document detail — Overview tab (file + metadata)');

      // Click Workflow tab
      const workflowTab = await page.$('button::-p-text(Workflow), [role="tab"]::-p-text(Workflow), a::-p-text(Workflow)');
      if (workflowTab) {
        await workflowTab.click();
        await new Promise(r => setTimeout(r, 1200));
        await shot(page, '10-document-detail-workflow', 'Document detail — Workflow tab (reviewers & approvers)');
      } else {
        // fallback: try text content match
        const tabs = await page.$$('[role="tab"], button');
        for (const tab of tabs) {
          const text = await tab.evaluate(el => el.textContent?.trim());
          if (text?.startsWith('Workflow')) { await tab.click(); break; }
        }
        await new Promise(r => setTimeout(r, 1200));
        await shot(page, '10-document-detail-workflow', 'Document detail — Workflow tab');
      }

      // Click History tab
      const historyTab = await page.$('button::-p-text(History), [role="tab"]::-p-text(History), a::-p-text(History)');
      if (historyTab) {
        await historyTab.click();
        await new Promise(r => setTimeout(r, 1200));
        await shot(page, '11-document-detail-history', 'Document detail — History tab (activity log)');
      } else {
        const tabs = await page.$$('[role="tab"], button');
        for (const tab of tabs) {
          const text = await tab.evaluate(el => el.textContent?.trim());
          if (text?.startsWith('History')) { await tab.click(); break; }
        }
        await new Promise(r => setTimeout(r, 1200));
        await shot(page, '11-document-detail-history', 'Document detail — History tab');
      }
    } else {
      console.log('(could not retrieve document ID — skipping detail screenshots)');
    }

    console.log('\n✅ All screenshots saved to', SCREENSHOTS_DIR);

  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  } finally {
    await browser.close();
  }
}

main();
