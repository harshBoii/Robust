import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "Robust MCP Server",
    version: "0.1.0",
  });

  server.registerTool(
    "hello_miss_robusta",
    {
      title: "Hello from Miss Robusta",
      description: 'Returns the greeting "Hello From Miss Robusta".',
      inputSchema: {},
    },
    async () => {
      return {
        content: [{ type: "text" as const, text: "Hello From Miss Robusta" }],
      };
    },
  );

  return server;
}

