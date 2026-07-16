/**
 * Microsoft Graph API helpers for SharePoint document storage.
 *
 * Required env vars (see SHAREPOINT_SETUP.md):
 *   AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
 *   SHAREPOINT_SITE_ID   — from Graph: GET /v1.0/sites/{hostname}:/sites/{siteName}
 *   SHAREPOINT_DRIVE_ID  — from Graph: GET /v1.0/sites/{siteId}/drives
 *   SHAREPOINT_FOLDER    — optional subfolder path, e.g. "DMS Documents"
 */

const GRAPH = 'https://graph.microsoft.com/v1.0'

export function isSharePointConfigured(): boolean {
  return !!(
    process.env.AZURE_TENANT_ID &&
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET &&
    process.env.SHAREPOINT_SITE_ID &&
    process.env.SHAREPOINT_DRIVE_ID
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
  if (!data.access_token) throw new Error(`Graph token error: ${JSON.stringify(data)}`)
  return data.access_token
}

interface SharePointUploadResult {
  itemId: string
  webUrl: string
  /** Direct download URL (pre-signed, expires) */
  downloadUrl: string | null
}

/**
 * Upload a file buffer to SharePoint.
 * Uses simple PUT for files ≤ 4 MB; large-file upload session for larger files.
 */
export async function uploadToSharePoint(
  fileName: string,
  buffer: Buffer,
  mimeType: string,
): Promise<SharePointUploadResult> {
  const token = await getToken()
  const siteId = process.env.SHAREPOINT_SITE_ID!
  const driveId = process.env.SHAREPOINT_DRIVE_ID!
  const folder = process.env.SHAREPOINT_FOLDER || 'DMS Documents'

  const MB4 = 4 * 1024 * 1024

  if (buffer.length <= MB4) {
    // Simple upload
    const url = `${GRAPH}/sites/${siteId}/drives/${driveId}/root:/${folder}/${fileName}:/content`
    const res = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimeType },
      body: buffer as unknown as BodyInit,
    })
    const item = await res.json()
    if (!res.ok) throw new Error(`SharePoint upload failed (${res.status}): ${JSON.stringify(item)}`)
    return {
      itemId: item.id,
      webUrl: item.webUrl,
      downloadUrl: item['@microsoft.graph.downloadUrl'] ?? null,
    }
  }

  // Large file: create upload session
  const sessionUrl = `${GRAPH}/sites/${siteId}/drives/${driveId}/root:/${folder}/${fileName}:/createUploadSession`
  const sessionRes = await fetch(sessionUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'rename' } }),
  })
  const sessionData = await sessionRes.json()
  if (!sessionRes.ok || !sessionData.uploadUrl) {
    throw new Error(`SharePoint upload session failed (${sessionRes.status}): ${JSON.stringify(sessionData)}`)
  }
  const { uploadUrl } = sessionData

  // Upload in 4 MB chunks
  const chunkSize = MB4
  let start = 0
  let finalItem: Record<string, unknown> = {}
  while (start < buffer.length) {
    const end = Math.min(start + chunkSize, buffer.length)
    const chunk = buffer.slice(start, end)
    const chunkRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': `${chunk.length}`,
        'Content-Range': `bytes ${start}-${end - 1}/${buffer.length}`,
      },
      body: chunk,
    })
    if (chunkRes.status === 200 || chunkRes.status === 201) {
      finalItem = await chunkRes.json()
    }
    start = end
  }

  if (!finalItem.id || !finalItem.webUrl) {
    throw new Error(`SharePoint large-file upload incomplete — no item returned after all chunks`)
  }

  return {
    itemId: finalItem.id as string,
    webUrl: finalItem.webUrl as string,
    downloadUrl: (finalItem['@microsoft.graph.downloadUrl'] as string) ?? null,
  }
}

/**
 * Get a shareable edit link for the document (opens in Office Online / PDF viewer).
 * Returns the webUrl if link creation fails.
 */
export async function getEditLink(itemId: string): Promise<string> {
  try {
    const token = await getToken()
    const siteId = process.env.SHAREPOINT_SITE_ID!
    const driveId = process.env.SHAREPOINT_DRIVE_ID!
    const res = await fetch(
      `${GRAPH}/sites/${siteId}/drives/${driveId}/items/${itemId}/createLink`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'edit', scope: 'organization' }),
      },
    )
    const data = await res.json()
    return data.link?.webUrl ?? ''
  } catch {
    return ''
  }
}

/** Stream a file from SharePoint by item ID. Returns a Response-compatible body. */
export async function downloadFromSharePoint(itemId: string): Promise<{ body: ReadableStream; contentType: string }> {
  const token = await getToken()
  const siteId = process.env.SHAREPOINT_SITE_ID!
  const driveId = process.env.SHAREPOINT_DRIVE_ID!
  const res = await fetch(
    `${GRAPH}/sites/${siteId}/drives/${driveId}/items/${itemId}/content`,
    { headers: { Authorization: `Bearer ${token}` }, redirect: 'follow' },
  )
  if (!res.ok) throw new Error(`SharePoint download failed: ${res.status}`)
  return {
    body: res.body as ReadableStream,
    contentType: res.headers.get('content-type') ?? 'application/octet-stream',
  }
}
