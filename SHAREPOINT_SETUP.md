# SharePoint & Email Integration Setup

This guide sets up the Azure AD App Registration needed for:
- Storing documents in SharePoint (Microsoft Graph)
- Sending email notifications to reviewers/approvers (Microsoft Graph)

---

## 1. Register an Azure AD Application

1. Go to [portal.azure.com](https://portal.azure.com) → **Azure Active Directory** → **App registrations** → **New registration**
2. Name: `SANPC DMS`
3. Supported account types: **Accounts in this organizational directory only (Single tenant)**
4. Click **Register**
5. Copy these values to your `.env.local`:
   - **Application (client) ID** → `AZURE_CLIENT_ID`
   - **Directory (tenant) ID** → `AZURE_TENANT_ID`

---

## 2. Configure Authentication & Redirect URI

1. In your app → **Authentication** → **Add a platform** → **Web**
2. Add Redirect URIs:
   - Local dev: `http://localhost:3000`
   - Production: `https://dms.sanpc.com` (or your actual domain)
3. Under **Advanced settings**, set:
   - **Allow public client flows**: No
4. Click **Save**

> **Note:** The app uses the Client Credentials flow (server-to-server) so redirect URIs are not used during token acquisition. However, Azure AD requires at least one platform/redirect URI to be configured for the app registration to be considered complete. The URIs listed here act as the app's registered identity.

---

## 3. Create a Client Secret

1. In your new app → **Certificates & secrets** → **New client secret**
2. Description: `sanpc-dms`, Expires: **24 months**
3. Click **Add** — copy the **Value** immediately (shown once)
4. Set `AZURE_CLIENT_SECRET` in `.env.local`

---

## 4. Grant API Permissions

1. Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Application permissions**
2. Add these permissions:
   | Permission | Purpose |
   |---|---|
   | `Sites.ReadWrite.All` | Upload/download files in SharePoint |
   | `Mail.Send` | Send emails from `MAIL_SENDER` mailbox |
   | `User.Read.All` | Read user profiles (optional, for display names) |
3. Click **Grant admin consent for [your org]** ✓

---

## 5. Get Your SharePoint Site ID

In a browser or Graph Explorer, call:
```
GET https://graph.microsoft.com/v1.0/sites/{your-tenant}.sharepoint.com:/sites/{your-site-name}
```
Copy the `id` field → set `SHAREPOINT_SITE_ID`

**Example:**
```
GET https://graph.microsoft.com/v1.0/sites/sanpc.sharepoint.com:/sites/sanpc-dms
```

---

## 6. Get Your Document Library Drive ID

```
GET https://graph.microsoft.com/v1.0/sites/{siteId}/drives
```
Find the drive named **Documents** (or your preferred library) and copy its `id` → set `SHAREPOINT_DRIVE_ID`

---

## 7. Configure Email Sender

Set `MAIL_SENDER` to an M365 licensed user UPN that will appear as the sender, e.g.:
```
MAIL_SENDER=noreply@sanpc.com
```
This mailbox must exist in your M365 tenant and the app must have `Mail.Send` application permission.

---

## 8. Final .env.local

```env
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_SECRET=your-secret-value
SHAREPOINT_SITE_ID=sanpc.sharepoint.com,xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx,xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
SHAREPOINT_DRIVE_ID=b!xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SHAREPOINT_FOLDER=DMS Documents
MAIL_SENDER=noreply@sanpc.com
APP_URL=https://dms.sanpc.com
```

---

## 9. Verify with Graph Explorer

Visit [graph.microsoft.com](https://developer.microsoft.com/en-us/graph/graph-explorer) and test:
```
GET https://graph.microsoft.com/v1.0/sites/{SHAREPOINT_SITE_ID}/drives/{SHAREPOINT_DRIVE_ID}/root/children
```
You should see the contents of your document library.

---

## How it works in SANPC DMS

| Event | Action |
|---|---|
| Document uploaded | File stored in SharePoint `DMS Documents/` folder |
| Document submitted for review | All reviewers receive an email with: (1) "Open & Annotate in Office Online" button linking to SharePoint, (2) "Approve/Review in SANPC DMS" button |
| All reviewers approve → moves to approvers | All approvers receive the same email |
| Reviewer opens SharePoint link | Word/Excel opens in browser with full collaborative editing, comments, and track changes |
| Reviewer returns to DMS | Formally records Approve / Request Changes / Reject decision |

> **Note:** If SharePoint env vars are not set, the app falls back to local file storage and email notifications are skipped (a log message is printed instead).
