import { readFileSync } from 'fs'

// Load .env.local manually
const env = readFileSync('.env.local', 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/)
  if (m) process.env[m[1]] = m[2]
}

const GRAPH = 'https://graph.microsoft.com/v1.0'

async function run() {
  // 1. Get token
  console.log('1. Getting Graph token...')
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.AZURE_CLIENT_ID,
        client_secret: process.env.AZURE_CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default',
      }),
    }
  )
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    console.error('Token FAILED:', JSON.stringify(tokenData, null, 2))
    process.exit(1)
  }
  console.log('   OK - token acquired')

  const token = tokenData.access_token
  const siteId = process.env.SHAREPOINT_SITE_ID
  const driveId = process.env.SHAREPOINT_DRIVE_ID
  const folder = process.env.SHAREPOINT_FOLDER || 'DMS-Archive'

  // 2. Upload small test file
  const fileName = `dms-test-${Date.now()}.txt`
  console.log(`2. Uploading "${fileName}" to folder "${folder}"...`)
  const content = Buffer.from('SANPC DMS SharePoint connectivity test ' + new Date().toISOString())
  const url = `${GRAPH}/sites/${siteId}/drives/${driveId}/root:/${folder}/${fileName}:/content`

  const uploadRes = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain',
    },
    body: content,
  })
  const uploadData = await uploadRes.json()

  if (!uploadRes.ok) {
    console.error('Upload FAILED:', uploadRes.status, JSON.stringify(uploadData, null, 2))
    process.exit(1)
  }

  console.log('   OK - file uploaded')
  console.log('   webUrl :', uploadData.webUrl)
  console.log('   itemId :', uploadData.id)

  // 3. Delete test file (cleanup)
  console.log('3. Cleaning up test file...')
  const delRes = await fetch(
    `${GRAPH}/sites/${siteId}/drives/${driveId}/items/${uploadData.id}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  )
  console.log(delRes.status === 204 ? '   OK - deleted' : `   Delete status: ${delRes.status}`)

  console.log('\nSharePoint upload: WORKING')
}

run().catch((err) => { console.error('Error:', err); process.exit(1) })
