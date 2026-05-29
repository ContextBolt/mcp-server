#!/usr/bin/env node
/**
 * ContextBolt MCP server — stdio transport.
 *
 * Reads JSON-RPC messages on stdin, proxies them to the ContextBolt HTTP
 * endpoint at https://api.contextbolt.app/mcp/<token>, writes responses to
 * stdout. This is the form Claude Desktop expects (command + args).
 *
 * Token comes from CONTEXTBOLT_TOKEN env var. Get yours from
 * the ContextBolt extension → Settings → Pro Features.
 */

const ENDPOINT_BASE = process.env.CONTEXTBOLT_ENDPOINT ?? 'https://api.contextbolt.app/mcp'
const TOKEN = process.env.CONTEXTBOLT_TOKEN

function fail(message) {
  process.stderr.write(`[contextbolt-mcp] ${message}\n`)
  process.exit(1)
}

if (!TOKEN) {
  fail(
    'CONTEXTBOLT_TOKEN is not set.\n' +
    'Set it in your Claude Desktop config under "env":\n' +
    '  { "CONTEXTBOLT_TOKEN": "your_token_here" }\n' +
    'Get your token from the ContextBolt extension → Settings → Pro Features.'
  )
}

const url = `${ENDPOINT_BASE}/${TOKEN}`

// Line-buffered JSON-RPC over stdio. Each request is a single line of JSON.
let buffer = ''
process.stdin.setEncoding('utf8')

process.stdin.on('data', (chunk) => {
  buffer += chunk
  let newlineIndex
  while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, newlineIndex).trim()
    buffer = buffer.slice(newlineIndex + 1)
    if (line) handleLine(line)
  }
})

process.stdin.on('end', () => {
  if (buffer.trim()) handleLine(buffer.trim())
})

async function handleLine(line) {
  let request
  try {
    request = JSON.parse(line)
  } catch (err) {
    process.stderr.write(`[contextbolt-mcp] bad JSON on stdin: ${err.message}\n`)
    return
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })

    const text = await response.text()
    if (!response.ok) {
      // Surface as a JSON-RPC error so the client sees a clean message
      const errorPayload = {
        jsonrpc: '2.0',
        id: request.id ?? null,
        error: {
          code: -32000,
          message: `ContextBolt API error ${response.status}: ${text.slice(0, 200)}`,
        },
      }
      process.stdout.write(JSON.stringify(errorPayload) + '\n')
      return
    }

    process.stdout.write(text.endsWith('\n') ? text : text + '\n')
  } catch (err) {
    const errorPayload = {
      jsonrpc: '2.0',
      id: request.id ?? null,
      error: {
        code: -32000,
        message: `Network error: ${err.message ?? String(err)}`,
      },
    }
    process.stdout.write(JSON.stringify(errorPayload) + '\n')
  }
}

process.on('SIGINT', () => process.exit(0))
process.on('SIGTERM', () => process.exit(0))
