# contextbolt-mcp

MCP server for [ContextBolt](https://contextbolt.com/). Lets Claude Desktop and Claude Code search and save your bookmarks.

Pro plan required. Get your token from the ContextBolt extension under Settings → Pro Features.

Looking for other servers to pair with this one? Browse the [MCP server directory](https://contextbolt.com/tools/mcp-server-directory/).

## Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "contextbolt": {
      "command": "npx",
      "args": ["-y", "contextbolt-mcp"],
      "env": {
        "CONTEXTBOLT_TOKEN": "your_token_here"
      }
    }
  }
}
```

Restart Claude Desktop. The bookmarks tools appear automatically.

## Claude Code

Add to `.mcp.json` in any project, or `~/.claude/mcp.json` for global use. The URL form is simpler than the stdio form here:

```json
{
  "mcpServers": {
    "contextbolt": {
      "url": "https://api.contextbolt.app/mcp/your_token_here"
    }
  }
}
```

## Tools

- `search_bookmarks(query, limit?, platform?)`: semantic search across your saved content
- `list_clusters()`: your topic clusters with bookmark counts
- `get_cluster_bookmarks(cluster_id, limit?)`: all bookmarks in one cluster
- `get_recent_bookmarks(limit?, platform?)`: most recently saved bookmarks
- `save_bookmark(url, content, title?, author?, tags?)`: create a new bookmark while chatting

The server lists its tools without a token, so clients and registries can discover them. A Pro token (`CONTEXTBOLT_TOKEN`) is only required to actually call a tool.

## Troubleshooting

If Claude Desktop says the server failed to start, check:

1. `CONTEXTBOLT_TOKEN` is set in the `env` block
2. Your ContextBolt account is on the Pro plan
3. Node 18+ is installed (`node --version`)

For support: https://contextbolt.com/support/
