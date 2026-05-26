#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ts = require('typescript');

function usage() {
  console.log(`Usage:
  graphify query "<question>"
  graphify explain "<concept>"
  graphify path "<A>" "<B>"
  graphify update .
  graphify wiki
`);
}

function findGraphDir(startDir) {
  let current = path.resolve(startDir);

  while (true) {
    const graphDir = path.join(current, 'graphify-out');
    if (fs.existsSync(path.join(graphDir, 'graph.json'))) {
      return graphDir;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function readGraph() {
  const graphDir = findGraphDir(process.cwd());
  if (!graphDir) {
    throw new Error('graphify-out/graph.json not found from current directory');
  }

  const graph = JSON.parse(fs.readFileSync(path.join(graphDir, 'graph.json'), 'utf8'));
  const nodes = graph.nodes || [];
  const links = graph.links || graph.edges || [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  return { graphDir, nodes, links, nodeById };
}

function normalize(value) {
  return String(value || '').toLowerCase();
}

function nodeText(node) {
  return [
    node.label,
    node.id,
    node.norm_label,
    node.source_file,
    node.source_location,
    node.file_type,
    node.community,
  ].map(normalize).join(' ');
}

function scoreNode(node, terms) {
  const text = nodeText(node);
  let score = 0;

  for (const term of terms) {
    if (text.includes(term)) {
      score += term.length;
    }
  }

  const label = normalize(node.label);
  if (terms.some((term) => label === term)) {
    score += 100;
  }

  return score;
}

function formatNode(node) {
  const location = node.source_file
    ? `${node.source_file}${node.source_location ? ':' + node.source_location : ''}`
    : 'unknown source';
  return `${node.label} [${node.id}] (${location}, community ${node.community ?? 'n/a'})`;
}

function neighborsFor(nodeId, links, nodeById, limit = 12) {
  return links
    .filter((link) => link.source === nodeId || link.target === nodeId)
    .slice(0, limit)
    .map((link) => {
      const otherId = link.source === nodeId ? link.target : link.source;
      const other = nodeById.get(otherId);
      const direction = link.source === nodeId ? '->' : '<-';
      return `  ${direction} ${link.relation || 'related'} ${other ? formatNode(other) : otherId}`;
    });
}

function query(question) {
  const { nodes, links, nodeById } = readGraph();
  const terms = normalize(question).split(/[^a-z0-9_.-]+/).filter((term) => term.length > 1);

  if (!terms.length) {
    throw new Error('query text is empty');
  }

  const matches = nodes
    .map((node) => ({ node, score: scoreNode(node, terms) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  if (!matches.length) {
    console.log('No matching graph nodes found.');
    return;
  }

  for (const { node } of matches) {
    console.log(formatNode(node));
    for (const neighbor of neighborsFor(node.id, links, nodeById, 5)) {
      console.log(neighbor);
    }
  }
}

function findNode(nodes, label) {
  const wanted = normalize(label);
  return nodes.find((node) => normalize(node.label) === wanted || normalize(node.id) === wanted)
    || nodes.find((node) => nodeText(node).includes(wanted));
}

function explain(concept) {
  const { nodes, links, nodeById } = readGraph();
  const node = findNode(nodes, concept);

  if (!node) {
    console.log(`No graph node found for "${concept}".`);
    return;
  }

  console.log(formatNode(node));
  for (const neighbor of neighborsFor(node.id, links, nodeById, 20)) {
    console.log(neighbor);
  }
}

function shortestPath(from, to) {
  const { nodes, links, nodeById } = readGraph();
  const start = findNode(nodes, from);
  const end = findNode(nodes, to);

  if (!start || !end) {
    console.log(`Missing node: ${!start ? from : to}`);
    return;
  }

  const adjacency = new Map();
  for (const link of links) {
    if (!adjacency.has(link.source)) adjacency.set(link.source, []);
    if (!adjacency.has(link.target)) adjacency.set(link.target, []);
    adjacency.get(link.source).push({ next: link.target, link });
    adjacency.get(link.target).push({ next: link.source, link });
  }

  const queue = [start.id];
  const seen = new Set([start.id]);
  const previous = new Map();

  while (queue.length) {
    const current = queue.shift();
    if (current === end.id) break;

    for (const edge of adjacency.get(current) || []) {
      if (seen.has(edge.next)) continue;
      seen.add(edge.next);
      previous.set(edge.next, { node: current, link: edge.link });
      queue.push(edge.next);
    }
  }

  if (!seen.has(end.id)) {
    console.log(`No path found between "${from}" and "${to}".`);
    return;
  }

  const steps = [];
  let current = end.id;
  while (current !== start.id) {
    const prev = previous.get(current);
    steps.push({ from: prev.node, to: current, link: prev.link });
    current = prev.node;
  }
  steps.reverse();

  console.log(formatNode(start));
  for (const step of steps) {
    const target = nodeById.get(step.to);
    console.log(`  -> ${step.link.relation || 'related'} ${target ? formatNode(target) : step.to}`);
  }
}

function slug(value) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 90) || 'node';
}

function hash(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

function walkFiles(rootDir) {
  const ignoredDirs = new Set([
    '.expo',
    '.git',
    '.opencode',
    'android',
    'dist',
    'dist-ios',
    'graphify-out',
    'ios',
    'node_modules',
  ]);
  const allowed = new Set(['.js', '.jsx', '.ts', '.tsx', '.json']);
  const files = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name)) {
          walk(path.join(dir, entry.name));
        }
        continue;
      }

      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name);
      if (allowed.has(ext) && entry.name !== 'package-lock.json') {
        files.push(path.join(dir, entry.name));
      }
    }
  }

  walk(rootDir);
  return files.sort();
}

function lineFor(sourceFile, position) {
  return `L${sourceFile.getLineAndCharacterOfPosition(position).line + 1}`;
}

function createGraphBuilder(rootDir) {
  const nodes = [];
  const links = [];
  const nodeIds = new Set();
  const linkIds = new Set();

  function relative(filePath) {
    return path.relative(rootDir, filePath).replace(/\\/g, '/');
  }

  function addNode({ id, label, fileType, sourceFile, sourceLocation, community }) {
    let uniqueId = id;
    let suffix = 2;
    while (nodeIds.has(uniqueId)) {
      uniqueId = `${id}_${suffix++}`;
    }
    nodeIds.add(uniqueId);
    nodes.push({
      label,
      file_type: fileType,
      source_file: sourceFile,
      source_location: sourceLocation,
      id: uniqueId,
      community,
      norm_label: normalize(label),
    });
    return uniqueId;
  }

  function addLink(source, target, relation, sourceFile, sourceLocation) {
    const id = `${source}|${target}|${relation}`;
    if (linkIds.has(id)) return;
    linkIds.add(id);
    links.push({
      relation,
      confidence: 'EXTRACTED',
      source_file: sourceFile,
      source_location: sourceLocation,
      weight: 1,
      source,
      target,
      confidence_score: 1,
    });
  }

  return { nodes, links, addNode, addLink, relative };
}

const FIRESTORE_COLLECTION_RE = /(?:collection|doc)\(\w+\s*,\s*['"`]([a-z][a-z0-9_/-]+)['"`]/gi;
const NAV_TERNARY_RE = /(['"`])([^'"`]+)\1\s*[?:]/g;

function extractFirestoreCollections(filePath, builder, community) {
  const rel = builder.relative(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const relId = slug(rel);
  const fileNode = builder.nodes.find((n) => n.id === relId);
  if (!fileNode) return;

  let match;
  while ((match = FIRESTORE_COLLECTION_RE.exec(content)) !== null) {
    const name = match[1];
    const safe = name.replace(/[^a-z0-9_/-]/gi, '_').toLowerCase();
    const nodeId = `fs_col_${safe}`;
    let existing = builder.nodes.find((n) => n.id === nodeId);
    if (!existing) {
      builder.addNode({
        id: nodeId,
        label: `Firestore: ${name}`,
        fileType: 'firestore_collection',
        sourceFile: rel,
        sourceLocation: `L${lineAt(content, match.index)}`,
        community: 800,
      });
    }
    builder.addLink(relId, nodeId, 'reads_writes', rel, `L${lineAt(content, match.index)}`);
  }
}

function lineAt(content, index) {
  return content.slice(0, index).split('\n').length;
}

const FIREBASE_COLLECTIONS = new Set([
  'users', 'videos', 'stories', 'highlights', 'messages', 'notifications', 'usernames',
]);

function extractFirestoreRelations(builder) {
  const colNodes = builder.nodes.filter((n) => n.file_type === 'firestore_collection');
  const byName = new Map();
  for (const node of colNodes) {
    const name = node.label.replace('Firestore: ', '');
    byName.set(name, node);
  }

  const relations = [
    ['users', 'videos', 'owns'],
    ['users', 'stories', 'owns'],
    ['users', 'highlights', 'owns'],
    ['users', 'notifications', 'owns'],
    ['users', 'messages', 'participates_in'],
    ['videos', 'comments', 'contains'],
    ['comments', 'replies', 'contains'],
    ['highlights', 'stories', 'references'],
    ['users', 'usernames', 'maps_to'],
  ];

  for (const [parent, child, relation] of relations) {
    const p = byName.get(parent);
    const c = byName.get(child);
    if (p && c) {
      builder.addLink(p.id, c.id, relation, 'graphify-out/roles', 'L1');
    }
  }
}

const HOOK_USAGE_RE = /use\w+\(/g;

function extractHookCalls(filePath, builder, community) {
  const rel = builder.relative(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const relId = slug(rel);

  let match;
  while ((match = HOOK_USAGE_RE.exec(content)) !== null) {
    const hookName = match[0].slice(0, -1);
    if (hookName.startsWith('use') && hookName !== 'useEffect' && hookName !== 'useState' && hookName !== 'useCallback' && hookName !== 'useMemo' && hookName !== 'useRef' && hookName !== 'useContext' && hookName !== 'useReducer' && hookName !== 'useLayoutEffect' && hookName !== 'useImperativeHandle' && hookName !== 'useDebugValue') {
      const safeName = slug(hookName);
      const hookNodeId = `hook_${safeName}`;
      const localHook = builder.nodes.find((n) => n.id === `hook_${safeName}`);
      if (localHook || builder.nodes.find((n) => n.id === hookNodeId)) {
        builder.addLink(relId, hookNodeId, 'uses_hook', rel, `L${lineAt(content, match.index)}`);
      }
    }
  }
}

const STORE_COLLECTION_RE = /collection\(['"`]([^'"`]+)['"`]\)/g;
const STORE_DOC_RE = /doc\(['"`]([^'"`]+)['"`]\)/g;

function extractJson(filePath, builder, community) {
  const rel = builder.relative(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const rootId = builder.addNode({
    id: slug(rel),
    label: rel,
    fileType: 'code',
    sourceFile: rel,
    sourceLocation: 'L1',
    community,
  });

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return;
  }

  function visit(value, parentId, keyPath, depth) {
    if (!value || typeof value !== 'object' || depth > 3) return;
    const entries = Array.isArray(value)
      ? value.slice(0, 20).map((item, index) => [String(index), item])
      : Object.entries(value);

    for (const [key, child] of entries) {
      const label = Array.isArray(value) ? `${keyPath}[${key}]` : key;
      const childId = builder.addNode({
        id: slug(`${rel}_${keyPath}_${key}`),
        label,
        fileType: 'code',
        sourceFile: rel,
        sourceLocation: 'L1',
        community,
      });
      builder.addLink(parentId, childId, 'contains', rel, 'L1');
      visit(child, childId, `${keyPath}_${key}`, depth + 1);
    }
  }

  visit(parsed, rootId, path.basename(rel), 0);
}

function extractTs(filePath, builder, community) {
  const rel = builder.relative(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(rel, content, ts.ScriptTarget.Latest, true);
  const rootId = builder.addNode({
    id: slug(rel),
    label: rel,
    fileType: 'code',
    sourceFile: rel,
    sourceLocation: 'L1',
    community,
  });

  function addSymbol(label, node, relation = 'contains') {
    const childId = builder.addNode({
      id: slug(`${rel}_${label}_${node.pos}`),
      label,
      fileType: 'code',
      sourceFile: rel,
      sourceLocation: lineFor(sourceFile, node.getStart(sourceFile)),
      community,
    });
    builder.addLink(rootId, childId, relation, rel, lineFor(sourceFile, node.getStart(sourceFile)));
    return childId;
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      addSymbol(node.moduleSpecifier.text, node, 'imports');
    } else if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && node.name) {
      addSymbol(node.name.text, node);
    } else if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          addSymbol(declaration.name.text, declaration);
        }
      }
    } else if (ts.isExportAssignment(node)) {
      addSymbol('default export', node);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  extractFirestoreCollections(filePath, builder, community);
  extractHookCalls(filePath, builder, community);
}

function writeReport(graphDir, graph) {
  const degree = new Map();
  for (const link of graph.links) {
    degree.set(link.source, (degree.get(link.source) || 0) + 1);
    degree.set(link.target, (degree.get(link.target) || 0) + 1);
  }
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const hubs = [...degree.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([id, count], index) => `${index + 1}. \`${nodeById.get(id)?.label || id}\` - ${count} edges`)
    .join('\n');
  const communities = new Set(graph.nodes.map((node) => node.community));
  const firestoreCols = graph.nodes.filter((n) => n.file_type === 'firestore_collection').map((n) => `- \`${n.label.replace('Firestore: ', '')}\``);

  const report = `# Graph Report - .  (${new Date().toISOString().slice(0, 10)})

## Corpus Check
- local update mode - Enhanced architectural extraction

## Summary
- ${graph.nodes.length} nodes
- ${graph.links.length} edges
- ${communities.size} communities
- ${firestoreCols.length} Firestore collections
- Extraction: 100% EXTRACTED
- Token cost: 0 input - 0 output

## God Nodes
${hubs || '- none'}

## Firestore Collections
${firestoreCols.length ? firestoreCols.join('\n') : '- none detected'}

## Notes
- Generated by scripts/graphify-cli.js.
- Use \`graphify query "<question>"\`, \`graphify explain "<concept>"\`, and \`graphify path "<A>" "<B>"\`.
- Use \`graphify wiki\` to read graphify-out/wiki/index.md for full architectural memory.
`;

  fs.writeFileSync(path.join(graphDir, 'GRAPH_REPORT.md'), report, 'utf8');
}

function addCrossReferences(builder) {
  const byLabel = new Map();

  for (const node of builder.nodes) {
    if (!node.norm_label || node.norm_label.length < 2) continue;
    if (!byLabel.has(node.norm_label)) {
      byLabel.set(node.norm_label, []);
    }
    byLabel.get(node.norm_label).push(node);
  }

  for (const group of byLabel.values()) {
    const uniqueFiles = new Set(group.map((node) => node.source_file));
    if (group.length < 2 || uniqueFiles.size < 2 || group.length > 25) {
      continue;
    }

    const hub = group.find((node) => node.source_file === 'package.json') || group[0];
    for (const node of group) {
      if (node.id !== hub.id) {
        builder.addLink(hub.id, node.id, 'same_label', node.source_file, node.source_location);
      }
    }
  }
}

function update(target = '.') {
  const rootDir = path.resolve(process.cwd(), target);
  const graphDir = path.join(rootDir, 'graphify-out');
  fs.mkdirSync(graphDir, { recursive: true });

  const builder = createGraphBuilder(rootDir);
  const files = walkFiles(rootDir);
  const manifest = {};

  files.forEach((filePath, index) => {
    const rel = builder.relative(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const stats = fs.statSync(filePath);
    manifest[filePath] = {
      mtime: stats.mtimeMs / 1000,
      ast_hash: hash(content),
      semantic_hash: hash(content),
    };

    const ext = path.extname(filePath);
    if (ext === '.json') {
      extractJson(filePath, builder, index);
    } else {
      extractTs(filePath, builder, index);
    }
  });

  addCrossReferences(builder);
  extractFirestoreRelations(builder);

  const graph = {
    directed: false,
    multigraph: false,
    graph: {},
    nodes: builder.nodes,
    links: builder.links,
    hyperedges: [],
  };

  fs.writeFileSync(path.join(graphDir, 'graph.json'), `${JSON.stringify(graph, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(graphDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    path.join(graphDir, '.graphify_labels.json'),
    `${JSON.stringify(Object.fromEntries(files.map((file, index) => [index, builder.relative(file)])), null, 2)}\n`,
    'utf8',
  );
  writeReport(graphDir, graph);

  console.log(`Updated ${path.relative(process.cwd(), graphDir) || graphDir}`);
  console.log(`${graph.nodes.length} nodes, ${graph.links.length} edges, ${files.length} files`);
}

function wiki() {
  const graphDir = findGraphDir(process.cwd());
  if (!graphDir) {
    throw new Error('graphify-out not found');
  }
  const wikiPath = path.join(graphDir, 'wiki', 'index.md');
  if (!fs.existsSync(wikiPath)) {
    console.log('[graphify] wiki/index.md not found. Run `graphify update .` first.');
    return;
  }
  const content = fs.readFileSync(wikiPath, 'utf8');
  const MAX_WIKI_LINES = 200;
  const lines = content.split('\n');
  if (lines.length > MAX_WIKI_LINES) {
    console.log('[graphify] Architecture Wiki (premieres ' + MAX_WIKI_LINES + ' lignes sur ' + lines.length + ')');
    console.log(lines.slice(0, MAX_WIKI_LINES).join('\n'));
    console.log('... [' + (lines.length - MAX_WIKI_LINES) + ' lignes supplementaires. Voir graphify-out/wiki/index.md]');
  } else {
    console.log('[graphify] Architecture Wiki');
    console.log(content);
  }
}

function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === '--help' || command === '-h') {
    usage();
    return;
  }

  if (command === 'query') return query(args.join(' '));
  if (command === 'explain') return explain(args.join(' '));
  if (command === 'path') return shortestPath(args[0], args[1]);
  if (command === 'update') return update(args[0] || '.');
  if (command === 'wiki') return wiki();

  usage();
  process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(`[graphify] ${error.message}`);
  process.exitCode = 1;
}
