/**
 * Generates a Power Automate importable package ZIP
 * Run: node scripts/generate-pa-flow.js
 * Output: sanpc-dms-sharepoint-flow.zip
 */
const JSZip = require('jszip')
const fs = require('fs')
const path = require('path')

const FLOW_ID = 'a1b2c3d4-e5f6-7890-abcd-sanpcdmsflow1'

const manifest = {
  schema: '1.0',
  details: {
    displayName: 'SANPC DMS - SharePoint Upload',
    description: 'Receives a file from SANPC DMS and saves it to SharePoint, returns the file URL.',
    createdTime: new Date().toISOString(),
    lastModifiedTime: new Date().toISOString(),
    packageTelemetryId: FLOW_ID,
    publisher: 'SANPC',
    packageSourceEnvironmentId: FLOW_ID,
  },
  resources: {
    [FLOW_ID]: {
      type: 'Microsoft.Flow/flows',
      id: FLOW_ID,
      name: FLOW_ID,
      displayName: 'SANPC DMS - SharePoint Upload',
      description: 'Receives file from SANPC DMS and uploads to SharePoint',
      createdTime: new Date().toISOString(),
      lastModifiedTime: new Date().toISOString(),
      designerMetadata: { filesize: 0 },
      dependencies: {
        sharepointonline: {
          type: 'ApiConnection',
          suggestedCreationType: 'Existing',
          displayName: 'SharePoint',
          description: 'SharePoint connection',
          authentication: { type: 'OAuth' },
        },
      },
    },
  },
}

const definition = {
  $schema: 'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#',
  contentVersion: '1.0.0.0',
  parameters: {
    $connections: { defaultValue: {}, type: 'Object' },
    $authentication: { defaultValue: {}, type: 'SecureObject' },
  },
  triggers: {
    manual: {
      type: 'Request',
      kind: 'Http',
      inputs: {
        method: 'POST',
        schema: {
          type: 'object',
          properties: {
            fileName: { type: 'string' },
            fileContent: { type: 'string', description: 'Base64 encoded file content' },
            mimeType: { type: 'string' },
          },
          required: ['fileName', 'fileContent'],
        },
      },
    },
  },
  actions: {
    Create_file: {
      runAfter: {},
      type: 'ApiConnection',
      inputs: {
        host: {
          connection: { name: "@parameters('$connections')['shared_sharepointonline']['connectionId']" },
        },
        method: 'post',
        path: "/datasets/@{encodeURIComponent(encodeURIComponent('https://sanpc00.sharepoint.com/sites/intranet-document-management-system'))}/files",
        body: "@base64ToBinary(triggerBody()?['fileContent'])",
        queries: {
          folderPath: '/Shared Documents/DMS Documents',
          name: "@triggerBody()?['fileName']",
          queryParametersSingleEncoded: true,
        },
      },
    },
    Get_file_properties: {
      runAfter: { Create_file: ['Succeeded'] },
      type: 'ApiConnection',
      inputs: {
        host: {
          connection: { name: "@parameters('$connections')['shared_sharepointonline']['connectionId']" },
        },
        method: 'get',
        path: "/datasets/@{encodeURIComponent(encodeURIComponent('https://sanpc00.sharepoint.com/sites/intranet-document-management-system'))}/tables/@{encodeURIComponent(encodeURIComponent('Shared Documents'))}/items/@{encodeURIComponent(body('Create_file')?['ID'])}",
      },
    },
    Response_Success: {
      runAfter: { Get_file_properties: ['Succeeded'] },
      type: 'Response',
      kind: 'Http',
      inputs: {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          webUrl: "@body('Get_file_properties')?['{Link}']",
          itemId: "@{body('Create_file')?['ID']}",
          fileName: "@triggerBody()?['fileName']",
        },
      },
    },
    Response_Error: {
      runAfter: {
        Create_file: ['Failed', 'TimedOut'],
      },
      type: 'Response',
      kind: 'Http',
      inputs: {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: { error: 'SharePoint upload failed' },
      },
    },
  },
  outputs: {},
}

async function generateZip() {
  const zip = new JSZip()

  zip.file('manifest.json', JSON.stringify(manifest, null, 2))

  const flowFolder = `Microsoft.Flow/flows/${FLOW_ID}`
  zip.file(`${flowFolder}/definition.json`, JSON.stringify(definition, null, 2))

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  const outputPath = path.join(process.cwd(), 'sanpc-dms-sharepoint-flow.zip')
  fs.writeFileSync(outputPath, buffer)
  console.log(`\n✅ Created: sanpc-dms-sharepoint-flow.zip`)
  console.log(`\nTo import:`)
  console.log(`  1. Go to make.powerautomate.com`)
  console.log(`  2. My flows → Import → Import Package (Legacy)`)
  console.log(`  3. Upload the ZIP file`)
  console.log(`  4. Connect your SharePoint account when prompted`)
  console.log(`  5. Click Import`)
  console.log(`  6. Copy the HTTP trigger URL and add to .env.local as POWER_AUTOMATE_URL`)
}

generateZip().catch(console.error)
