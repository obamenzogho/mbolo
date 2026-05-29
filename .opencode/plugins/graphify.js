// graphify OpenCode plugin — Architectural Memory
// Injects a knowledge graph reminder before bash tool calls when the graph exists.
import { existsSync } from "fs";
import { join } from "path";

export const GraphifyPlugin = async ({ directory }) => {
  let reminded = false;

  return {
    "tool.execute.before": async (input, output) => {
      if (reminded) return;

      const graphDir = join(directory, "graphify-out");
      const graphPath = join(graphDir, "graph.json");
      const wikiPath = join(graphDir, "wiki", "index.md");

      if (!existsSync(graphPath)) return;

      const hasWiki = existsSync(wikiPath);
      const wikiHint = hasWiki
        ? ' Read graphify-out/wiki/index.md (full architectural memory). Use `graphify wiki` to display inline.'
        : '';

      if (input.tool === "bash") {
        output.args.command =
          `echo "[graphify] Knowledge graph: gameplan graphify-out/graph.html. Commands: query, explain, path, wiki${wikiHint}" && ` +
          output.args.command;
        reminded = true;
      }
    },
  };
};
