# Image for Glama / registry healthchecks and stdio MCP usage.
# The server starts with no token and answers discovery (initialize,
# tools/list, ping); a CONTEXTBOLT_TOKEN is only needed to call tools.
FROM node:20-slim
WORKDIR /app
COPY package.json index.js ./
ENTRYPOINT ["node", "index.js"]
