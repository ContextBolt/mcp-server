#!/usr/bin/env node
/**
 * ContextBolt MCP server — stdio transport.
 *
 * Bridges a local MCP client (Claude Desktop, Claude Code, etc.) to the
 * ContextBolt HTTP endpoint at https://api.contextbolt.app/mcp/<token>.
 * Reads JSON-RPC on stdin, writes responses on stdout.
 *
 * Auth: set CONTEXTBOLT_TOKEN (from the ContextBolt extension under
 * Settings -> Pro Features). With a token, every request is proxied to your
 * account. Without a token the server still starts and answers discovery
 * requests (initialize, tools/list, ping) from a static manifest, so clients
 * and registries can introspect the available tools; calling a tool then
 * requires the token.
 */

const PROTOCOL_VERSION = '2024-11-05'
const SERVER_NAME = 'contextbolt'
const SERVER_VERSION = '0.2.0'

const ENDPOINT_BASE = process.env.CONTEXTBOLT_ENDPOINT ?? 'https://api.contextbolt.app/mcp'
const TOKEN = process.env.CONTEXTBOLT_TOKEN
const url = TOKEN ? `${ENDPOINT_BASE}/${TOKEN}` : null

// Static tool manifest, used only for tokenless discovery. When a token is
// present the live list is served by the ContextBolt API instead.
const TOOLS = [
  {
    name: 'search_bookmarks',
    description: 'Semantic search across your saved bookmarks from X, Reddit, LinkedIn, and the web.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural-language search query.' },
        limit: { type: 'number', description: 'Maximum results to return (default 10).' },
        platform: { type: 'string', description: "Optional source filter, e.g. 'twitter', 'reddit', 'linkedin', 'web'." },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_clusters',
    description: 'List your topic clusters with their bookmark counts.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_cluster_bookmarks',
    description: 'Get all bookmarks in one topic cluster.',
    inputSchema: {
      type: 'object',
      properties: {
        cluster_id: { type: 'string', description: 'Cluster identifier from list_clusters.' },
        limit: { type: 'number', description: 'Maximum bookmarks to return.' },
      },
      required: ['cluster_id'],
    },
  },
  {
    name: 'get_recent_bookmarks',
    description: 'Get your most recently saved bookmarks.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum bookmarks to return (default 10).' },
        platform: { type: 'string', description: 'Optional source filter.' },
      },
    },
  },
  {
    name: 'save_bookmark',
    description: 'Save a new bookmark to your ContextBolt collection while chatting.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL of the page or post to save.' },
        content: { type: 'string', description: 'Main text content to index.' },
        title: { type: 'string', description: 'Optional title.' },
        author: { type: 'string', description: 'Optional author or handle.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags.' },
      },
      required: ['url', 'content'],
    },
  },
]

function send(payload) {
  process.stdout.write(JSON.stringify(payload) + '\n')
}

function sendResult(id, value) {
  send({ jsonrpc: '2.0', id: id ?? null, result: value })
}

function sendError(id, code, message) {
  send({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })
}

// Line-buffered JSON-RPC over stdio. Each message is a single line of JSON.
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

  // Without a token, answer discovery locally so clients and registries can
  // introspect the server; defer anything that needs data to the token.
  if (!TOKEN) {
    handleLocal(request)
    return
  }

  // With a token, proxy the request to the ContextBolt API unchanged.
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    const text = await response.text()
    if (!response.ok) {
      sendError(request.id, -32000, `ContextBolt API error ${response.status}: ${text.slice(0, 200)}`)
      return
    }
    process.stdout.write(text.endsWith('\n') ? text : text + '\n')
  } catch (err) {
    sendError(request.id, -32000, `Network error: ${err.message ?? String(err)}`)
  }
}

function handleLocal(request) {
  const { method, id } = request

  // Notifications carry no id and require no response.
  if (id === undefined || id === null) {
    return
  }

  switch (method) {
    case 'initialize':
      sendResult(id, {
        protocolVersion: request.params?.protocolVersion ?? PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      })
      return
    case 'ping':
      sendResult(id, {})
      return
    case 'tools/list':
      sendResult(id, { tools: TOOLS })
      return
    case 'tools/call':
      sendError(id, -32001, 'CONTEXTBOLT_TOKEN is not set. Set it (ContextBolt extension -> Settings -> Pro Features) to call tools. See https://contextbolt.com/support/')
      return
    default:
      sendError(id, -32601, `Method not available without a token: ${method}. Set CONTEXTBOLT_TOKEN to use it.`)
      return
  }
}

process.on('SIGINT', () => process.exit(0))
process.on('SIGTERM', () => process.exit(0))
