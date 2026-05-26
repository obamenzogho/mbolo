#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GRAPH_DIR = path.join(ROOT, 'graphify-out');
const GRAPH_PATH = path.join(GRAPH_DIR, 'graph.json');
const REPORT_PATH = path.join(GRAPH_DIR, 'GRAPH_REPORT.md');
const HTML_PATH = path.join(GRAPH_DIR, 'graph.html');

const COLORS = [
  '#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F',
  '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC',
  '#86BCB6', '#D37295', '#FABFD2', '#B6992D', '#499894',
];

const FEATURES = [
  { id: 'feature_auth', label: 'Feature: Auth & Onboarding', patterns: ['app/(auth)/login', 'app/(auth)/register', 'app/(auth)/_layout', 'app/index.tsx', 'login.tsx', 'register.tsx'] },
  { id: 'feature_feed', label: 'Feature: Feed & Discovery', patterns: ['app/(tabs)/feed', 'app/(tabs)/explore', 'usevideofeed', 'usevideopreloader', 'feed.ts', 'scoring.ts'] },
  { id: 'feature_camera', label: 'Feature: Camera & Capture', patterns: ['app/(tabs)/camera', 'usecamera', 'usevisioncamera', 'config/modules'] },
  { id: 'feature_upload', label: 'Feature: Upload & Editing', patterns: ['video-editor', 'reel-upload', 'story-upload', 'upload.tsx', 'post.tsx', 'ffmpeg', 'filters', 'usegallery', 'gallerypicker', 'cloudinary', 'storage.ts'] },
  { id: 'feature_stories', label: 'Feature: Stories & Highlights', patterns: ['stories.tsx', 'highlight/', 'usestories', 'usehighlights', 'highlightpickermodal'] },
  { id: 'feature_profile', label: 'Feature: Profile & Users', patterns: ['profile.tsx', 'edit-profile', 'user/[userid]', 'usefollow', 'usesuggestions', 'followbutton'] },
  { id: 'feature_messages', label: 'Feature: Messages', patterns: ['messages.tsx', 'conversation'] },
  { id: 'feature_notifications', label: 'Feature: Notifications', patterns: ['notifications.tsx', 'notificationservice', 'notifications.ts', 'lib/notifications'] },
  { id: 'feature_comments', label: 'Feature: Comments & Sharing', patterns: ['commentmodal', 'usecomments', 'sharesheet', 'sharemodal', 'qrcode', 'socialshare'] },
  { id: 'feature_ui', label: 'Feature: UI System & Theme', patterns: ['src/components/', 'usetheme', 'useanimations', 'usepageanimation', 'theme.ts', 'pagewrapper', 'icons.tsx'] },
  { id: 'feature_i18n', label: 'Feature: Localization', patterns: ['src/i18n/'] },
];

const CONVENTIONS = [
  { id: 'convention_routing', label: 'Convention: File-based Routing (expo-router)', patterns: ['app/(tabs)/', 'app/(auth)/', 'app/settings/', 'app/_layout', 'app/post'] },
  { id: 'convention_hooks', label: 'Convention: Custom Hooks pattern (src/hooks/)', patterns: ['src/hooks/'] },
  { id: 'convention_components', label: 'Convention: Reusable Components (src/components/)', patterns: ['src/components/'] },
  { id: 'convention_services', label: 'Convention: API Services (src/services/)', patterns: ['src/services/'] },
  { id: 'convention_lib', label: 'Convention: Core Lib (src/lib/)', patterns: ['src/lib/'] },
  { id: 'convention_types', label: 'Convention: Shared Types (src/types/)', patterns: ['src/types/'] },
  { id: 'convention_utils', label: 'Convention: Utilities (utils/)', patterns: ['utils/'] },
  { id: 'convention_i18n', label: 'Convention: i18n Translations (src/i18n/)', patterns: ['src/i18n/'] },
  { id: 'convention_firestore', label: 'Convention: Firestore Data Layer', patterns: ['firestore.', 'firebase.', 'firebase.ts', 'storage.rules'] },
  { id: 'convention_styles', label: 'Convention: NativeWind + Tailwind + Dark Theme', patterns: ['nativewind', 'tailwind', 'theme.ts', 'colors'] },
];

const MISC_ROLE = { id: 'role_misc', label: 'Role: Miscellaneous', patterns: [] };
const MISC_FEATURE = { id: 'feature_misc', label: 'Feature: Miscellaneous', patterns: [] };

const ROLE_RULES = [
  { id: 'role_app_shell', label: 'Role: App Shell & Routing', patterns: ['app/_layout', 'app/index', 'app/(tabs)/_layout', 'app/(auth)/_layout', 'index.ts'] },
  { id: 'role_auth', label: 'Role: Auth', patterns: ['app/(auth)/login', 'app/(auth)/register'] },
  { id: 'role_feed', label: 'Role: Feed & Discovery', patterns: ['app/(tabs)/feed', 'app/(tabs)/explore', 'usevideofeed', 'usevideopreloader'] },
  { id: 'role_camera', label: 'Role: Camera & Capture', patterns: ['app/(tabs)/camera', 'usecamera', 'usevisioncamera', 'visioncamera', 'mocks/visioncamera'] },
  { id: 'role_creation', label: 'Role: Upload & Editing', patterns: ['video-editor', 'reel-upload', 'story-upload', 'upload.tsx', 'post.tsx', 'ffmpeg', 'filters', 'gallerypicker', 'usegallery'] },
  { id: 'role_stories', label: 'Role: Stories & Highlights', patterns: ['stories.tsx', 'highlight/', 'usestories', 'usehighlights', 'highlightpickermodal'] },
  { id: 'role_profile', label: 'Role: Profile & Users', patterns: ['profile.tsx', 'edit-profile', 'user/[userid]', 'usefollow'] },
  { id: 'role_messages', label: 'Role: Messages', patterns: ['messages.tsx', 'conversation', 'message'] },
  { id: 'role_notifications', label: 'Role: Notifications', patterns: ['notifications.tsx', 'notificationservice'] },
  { id: 'role_comments', label: 'Role: Comments & Sharing', patterns: ['commentmodal', 'commentsheet', 'usecomments', 'sharesheet', 'qrcode'] },
  { id: 'role_settings', label: 'Role: Settings & About', patterns: ['settings/'] },
  { id: 'role_data', label: 'Role: Data, Firebase & Storage', patterns: ['src/lib/firebase', 'src/lib/storage', 'src/lib/cloudinary', 'src/lib/env', 'firebase.json', 'firestore.', 'storage.rules', 'tenorservice', 'gifservice'] },
  { id: 'role_ui', label: 'Role: UI Components & Theme', patterns: ['src/components/', 'src/lib/theme', 'useanimations', 'mbololoader', 'splashscreen', 'icons.tsx'] },
  { id: 'role_i18n', label: 'Role: Localization', patterns: ['src/i18n/'] },
  { id: 'role_types', label: 'Role: Domain Types', patterns: ['src/types/'] },
  { id: 'role_config', label: 'Role: Config & Build', patterns: ['app.json', 'package.json', 'tsconfig', 'babel.config', 'metro.config', 'eas.json', 'nativewind', 'tailwind', 'config/'] },
  { id: 'role_scripts', label: 'Role: Scripts & Tooling', patterns: ['scripts/'] },
];

function normalizeFile(value) {
  return String(value || '').replace(/\\/g, '/').toLowerCase();
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function roleForFile(file) {
  const normalized = normalizeFile(file);
  return ROLE_RULES.find((role) => role.patterns.some((pattern) => normalized.includes(pattern.toLowerCase())))
    || MISC_ROLE;
}

function linkKey(link) {
  return `${link.source}|${link.target}|${link.relation}`;
}

function isFileRoot(node) {
  const source = normalizeFile(node.source_file);
  const label = normalizeFile(node.label);
  return source && (
    source === label
    || (node.source_location === 'L1' && source.endsWith(label))
  );
}

function enrichGraph(graph) {
  const nodes = (graph.nodes || []).filter((node) => !String(node.id).startsWith('role_') && !String(node.id).startsWith('feature_') && !String(node.id).startsWith('convention_'));
  const links = (graph.links || graph.edges || []).filter((link) => link.relation !== 'role_group' && link.relation !== 'feature_group' && link.relation !== 'convention_group');
  const existingNodeIds = new Set(nodes.map((node) => node.id));
  const existingLinks = new Set(links.map(linkKey));
  const existingLinkObjs = new Map(links.map((l) => [linkKey(l), l]));

  function addNodeIfMissing(id, label, fileType, community) {
    if (!existingNodeIds.has(id)) {
      nodes.push({ id, label, norm_label: label.toLowerCase(), file_type: fileType, source_file: 'graphify-out/roles', source_location: 'L1', community });
      existingNodeIds.add(id);
    }
  }

  function addLinkIfMissing(source, target, relation) {
    const key = `${source}|${target}|${relation}`;
    if (!existingLinks.has(key) && existingNodeIds.has(source) && existingNodeIds.has(target)) {
      const link = { source, target, relation, confidence: 'INFERRED', confidence_score: 0.85, source_file: 'graphify-out/roles', source_location: 'L1', weight: 1.2 };
      links.push(link);
      existingLinks.add(key);
      return true;
    }
    return false;
  }

  const roles = [...ROLE_RULES, MISC_ROLE];
  for (const [index, role] of roles.entries()) {
    addNodeIfMissing(role.id, role.label, 'role', 900 + index);
  }

  const features = [...FEATURES, MISC_FEATURE];
  for (const [index, feature] of features.entries()) {
    addNodeIfMissing(feature.id, feature.label, 'feature', 800 + index);
  }

  const conventions = CONVENTIONS;
  for (const [index, convention] of conventions.entries()) {
    addNodeIfMissing(convention.id, convention.label, 'convention', 700 + index);
  }

  const fileRoots = nodes.filter(isFileRoot);
  for (const node of fileRoots) {
    const role = roleForFile(node.source_file);
    addLinkIfMissing(role.id, node.id, 'role_group');

    const feature = featureForFile(node.source_file);
    addLinkIfMissing(feature.id, node.id, 'feature_group');

    const convention = conventionForFile(node.source_file);
    addLinkIfMissing(convention.id, node.id, 'convention_group');
  }

  graph.nodes = nodes;
  graph.links = links;
  return graph;
}

function featureForFile(file) {
  const normalized = normalizeFile(file);
  return FEATURES.find((f) => f.patterns.some((p) => normalized.includes(p.toLowerCase())))
    || MISC_FEATURE;
}

const MISC_CONVENTION = { id: 'convention_misc', label: 'Convention: Other', patterns: [] };

function conventionForFile(file) {
  const normalized = normalizeFile(file);
  return CONVENTIONS.find((c) => c.patterns.some((p) => normalized.includes(p.toLowerCase())))
    || MISC_CONVENTION;
}

function writeReport(graph) {
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

  const roles = graph.nodes.filter((node) => node.file_type === 'role');
  const features = graph.nodes.filter((node) => node.file_type === 'feature');
  const conventions = graph.nodes.filter((node) => node.file_type === 'convention');
  const firestoreCols = graph.nodes.filter((n) => n.file_type === 'firestore_collection');

  const report = `# Graph Report - .  (${new Date().toISOString().slice(0, 10)})

## Corpus Check
- Enhanced architectural enrichment (roles + features + conventions)

## Summary
- ${graph.nodes.length} nodes
- ${graph.links.length} edges
- ${roles.length} roles
- ${features.length} features
- ${conventions.length} conventions
- ${firestoreCols.length} Firestore collections
- Extraction: EXTRACTED + INFERRED links
- Token cost: 0 input - 0 output

## God Nodes
${hubs || '- none'}

## Features
${features.map((f) => `- \`${f.label}\``).join('\n')}

## Conventions
${conventions.map((c) => `- \`${c.label}\``).join('\n')}

## Firestore Collections
${firestoreCols.map((c) => `- \`${c.label.replace('Firestore: ', '')}\``).join('\n')}

## Notes
- Enriched with role, feature, and convention groupings.
- Use \`graphify query "<question>"\`, \`graphify explain "<concept>"\`, and \`graphify path "<A>" "<B>"\`.
- Use \`graphify wiki\` to read graphify-out/wiki/index.md for full architectural memory.
`;

  fs.writeFileSync(REPORT_PATH, report, 'utf8');
}

function writeHtml(graph) {
  const degree = new Map();
  for (const link of graph.links) {
    degree.set(link.source, (degree.get(link.source) || 0) + 1);
    degree.set(link.target, (degree.get(link.target) || 0) + 1);
  }

  const htmlNodes = graph.nodes.map((node) => {
    const deg = degree.get(node.id) || 0;
    const isRole = node.file_type === 'role';
    const color = isRole ? '#FFFFFF' : COLORS[Math.abs(Number(node.community || 0)) % COLORS.length];
    return {
      id: node.id,
      label: node.label,
      title: `${node.label}\n${node.source_file || ''}${node.source_location ? ':' + node.source_location : ''}`,
      source_file: node.source_file,
      file_type: node.file_type,
      community: node.community,
      degree: deg,
      role: isRole,
      color: {
        background: isRole ? '#111827' : color,
        border: isRole ? '#FFFFFF' : color,
        highlight: { background: '#FFFFFF', border: color },
      },
      size: isRole ? 32 : Math.max(8, Math.min(30, 7 + Math.sqrt(deg) * 4)),
      font: { size: isRole || deg > 8 ? 13 : 0, color: '#F8FAFC' },
    };
  });

  const htmlEdges = graph.links.map((link) => ({
    from: link.source,
    to: link.target,
    label: link.relation,
    title: `${link.relation} [${link.confidence || 'EXTRACTED'}]`,
    dashes: link.confidence === 'INFERRED',
    width: link.relation === 'role_group' ? 3 : 1.5,
    color: { opacity: link.relation === 'role_group' ? 0.95 : 0.45 },
  }));

  const roles = htmlNodes.filter((node) => node.role);
  const stats = `${htmlNodes.length} nodes &middot; ${htmlEdges.length} edges &middot; ${roles.length} roles`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Mbolo Graphify</title>
<script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #0F172A; color: #E5E7EB; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; display: flex; height: 100vh; overflow: hidden; }
  #graph { flex: 1; min-width: 0; }
  #sidebar { width: 320px; background: #111827; border-left: 1px solid #263244; display: flex; flex-direction: column; }
  #search-wrap, #info, #roles, #stats { padding: 12px; border-bottom: 1px solid #263244; }
  h3 { margin: 0 0 8px; font-size: 12px; color: #9CA3AF; text-transform: uppercase; letter-spacing: .08em; }
  input { width: 100%; background: #0B1120; border: 1px solid #334155; color: #E5E7EB; padding: 8px 10px; border-radius: 6px; outline: none; }
  button { background: #1F2937; border: 1px solid #374151; color: #E5E7EB; padding: 6px 8px; border-radius: 6px; cursor: pointer; }
  button:hover { background: #263244; }
  #results, #roles-list, #neighbors { max-height: 220px; overflow-y: auto; }
  .item { display: block; width: 100%; text-align: left; margin: 4px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .muted { color: #9CA3AF; font-size: 12px; line-height: 1.5; }
  .field { margin: 6px 0; font-size: 13px; line-height: 1.4; word-break: break-word; }
  .role-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; border: 1px solid #fff; margin-right: 6px; }
  #stats { margin-top: auto; border-bottom: 0; border-top: 1px solid #263244; color: #9CA3AF; font-size: 12px; }
</style>
</head>
<body>
<div id="graph"></div>
<aside id="sidebar">
  <div id="search-wrap">
    <h3>Search</h3>
    <input id="search" type="text" placeholder="File, symbol, role..." autocomplete="off">
    <div id="results"></div>
  </div>
  <div id="info">
    <h3>Selection</h3>
    <div id="info-content" class="muted">Click a node to inspect its role and neighbors.</div>
    <div id="neighbors"></div>
  </div>
  <div id="roles">
    <h3>Roles</h3>
    <button onclick="showAll()">Show all</button>
    <button onclick="showOnlyRoles()">Roles only</button>
    <div id="roles-list"></div>
  </div>
  <div id="stats">${stats}</div>
</aside>
<script>
const RAW_NODES = ${JSON.stringify(htmlNodes)};
const RAW_EDGES = ${JSON.stringify(htmlEdges)};
const nodes = new vis.DataSet(RAW_NODES);
const edges = new vis.DataSet(RAW_EDGES.map((edge, id) => ({ id, ...edge, arrows: { to: { enabled: true, scaleFactor: .45 } }, label: '' })));
const network = new vis.Network(document.getElementById('graph'), { nodes, edges }, {
  physics: { solver: 'forceAtlas2Based', stabilization: { iterations: 250 }, forceAtlas2Based: { gravitationalConstant: -85, centralGravity: .006, springLength: 130, springConstant: .05, damping: .45, avoidOverlap: .9 } },
  interaction: { hover: true, tooltipDelay: 80, hideEdgesOnDrag: true },
  nodes: { shape: 'dot', borderWidth: 1.5 },
  edges: { smooth: { type: 'continuous', roundness: .15 } },
});
const byId = new Map(RAW_NODES.map(n => [n.id, n]));
const incident = new Map();
RAW_EDGES.forEach(e => {
  if (!incident.has(e.from)) incident.set(e.from, []);
  if (!incident.has(e.to)) incident.set(e.to, []);
  incident.get(e.from).push({ id: e.to, relation: e.label });
  incident.get(e.to).push({ id: e.from, relation: e.label });
});
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function selectNode(id) { network.selectNodes([id]); network.focus(id, { scale: 1.2, animation: true }); renderInfo(id); }
function renderInfo(id) {
  const n = byId.get(id);
  if (!n) return;
  document.getElementById('info-content').innerHTML =
    '<div class="field"><b>' + escapeHtml(n.label) + '</b></div>' +
    '<div class="field muted">' + escapeHtml(n.source_file || '') + '</div>' +
    '<div class="field">Type: ' + escapeHtml(n.file_type) + '</div>' +
    '<div class="field">Degree: ' + escapeHtml(n.degree) + '</div>';
  const neighbors = (incident.get(id) || []).slice(0, 30).map(x => {
    const other = byId.get(x.id);
    return '<button class="item" onclick="selectNode(\\'' + escapeHtml(x.id) + '\\')">' + escapeHtml(x.relation + ' -> ' + (other?.label || x.id)) + '</button>';
  }).join('');
  document.getElementById('neighbors').innerHTML = neighbors || '<div class="muted">No neighbors.</div>';
}
network.on('click', params => { if (params.nodes.length) renderInfo(params.nodes[0]); });
document.getElementById('search').addEventListener('input', event => {
  const q = event.target.value.toLowerCase().trim();
  const results = q ? RAW_NODES.filter(n => (n.label + ' ' + n.source_file + ' ' + n.id).toLowerCase().includes(q)).slice(0, 30) : [];
  document.getElementById('results').innerHTML = results.map(n => '<button class="item" onclick="selectNode(\\'' + escapeHtml(n.id) + '\\')">' + escapeHtml(n.label) + '</button>').join('');
});
function showAll() {
  nodes.update(RAW_NODES.map(n => ({ id: n.id, hidden: false })));
  edges.update(RAW_EDGES.map((e, id) => ({ id, hidden: false })));
}
function showOnlyRoles() {
  const roleIds = new Set(RAW_NODES.filter(n => n.role).map(n => n.id));
  nodes.update(RAW_NODES.map(n => ({ id: n.id, hidden: !roleIds.has(n.id) })));
  edges.update(RAW_EDGES.map((e, id) => ({ id, hidden: !(roleIds.has(e.from) && roleIds.has(e.to)) })));
}
function showRole(roleId) {
  const visible = new Set([roleId]);
  RAW_EDGES.forEach(e => { if (e.from === roleId) visible.add(e.to); if (e.to === roleId) visible.add(e.from); });
  nodes.update(RAW_NODES.map(n => ({ id: n.id, hidden: !visible.has(n.id) })));
  edges.update(RAW_EDGES.map((e, id) => ({ id, hidden: !(visible.has(e.from) && visible.has(e.to)) })));
  selectNode(roleId);
}
document.getElementById('roles-list').innerHTML = RAW_NODES.filter(n => n.role).map(n => '<button class="item" onclick="showRole(\\'' + escapeHtml(n.id) + '\\')"><span class="role-dot"></span>' + escapeHtml(n.label) + '</button>').join('');
</script>
</body>
</html>
`;

  fs.writeFileSync(HTML_PATH, html, 'utf8');
}

function writeInteractiveHtml(graph) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const TYPES = ['role', 'feature', 'convention'];
  const typeLabels = { role: 'Roles', feature: 'Features', convention: 'Conventions' };
  const typeColors = { role: '#4E79A7', feature: '#F28E2B', convention: '#76B7B2' };
  const typeGroups = {};
  const typeLinks = {};

  for (const t of TYPES) {
    typeGroups[t] = graph.nodes.filter((node) => node.file_type === t);
    const rel = `${t}_group`;
    typeLinks[t] = graph.links.filter((link) => link.relation === rel);
  }

  const allFileRoots = new Set();
  const rootToType = new Map();
  for (const t of TYPES) {
    const rel = `${t}_group`;
    for (const link of typeLinks[t]) {
      allFileRoots.add(link.target);
      if (!rootToType.has(link.target)) rootToType.set(link.target, []);
      rootToType.get(link.target).push(t);
    }
  }
  const childrenByFile = new Map();
  const importsByFile = new Map();

  for (const link of graph.links) {
    const source = nodeById.get(link.source);
    const target = nodeById.get(link.target);
    if (!source || !target) continue;

    if (link.relation === 'contains' && allFileRoots.has(link.source)) {
      if (!childrenByFile.has(link.source)) childrenByFile.set(link.source, []);
      childrenByFile.get(link.source).push({
        id: target.id,
        label: target.label,
        location: target.source_location,
        relation: link.relation,
      });
    }

    if ((link.relation === 'imports' || link.relation === 'imports_from') && allFileRoots.has(link.source)) {
      if (!importsByFile.has(link.source)) importsByFile.set(link.source, []);
      importsByFile.get(link.source).push({
        id: target.id,
        label: target.label,
        location: target.source_location,
        relation: link.relation,
      });
    }
  }

  function buildGroup(nodes, links, prefix, colorFn) {
    return nodes.map((node, index) => ({
      id: node.id,
      label: node.label.replace(new RegExp(`^${prefix}:\\s*`), ''),
      color: colorFn(index),
      file_type: node.file_type,
      files: links
        .filter((l) => l.source === node.id)
        .map((l) => nodeById.get(l.target))
        .filter(Boolean)
        .sort((a, b) => String(a.source_file).localeCompare(String(b.source_file)))
        .map((f) => ({
          id: f.id,
          label: f.label,
          source_file: f.source_file,
          degree: graph.links.filter((l) => l.source === f.id || l.target === f.id).length,
        })),
    }));
  }

  const roles = buildGroup(typeGroups['role'], typeLinks['role'], 'Role', (i) => COLORS[i % COLORS.length]);
  const features = buildGroup(typeGroups['feature'], typeLinks['feature'], 'Feature', (i) => COLORS[(i + 5) % COLORS.length]);
  const conventions = buildGroup(typeGroups['convention'], typeLinks['convention'], 'Convention', (i) => COLORS[(i + 10) % COLORS.length]);

  const files = [...allFileRoots]
    .map((id) => nodeById.get(id))
    .filter(Boolean)
    .map((file) => ({
      id: file.id,
      label: file.label,
      source_file: file.source_file,
      types: rootToType.get(file.id) || [],
      symbols: childrenByFile.get(file.id) || [],
      imports: importsByFile.get(file.id) || [],
    }));

  const allGroups = [...roles, ...features, ...conventions];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Mbolo Graphify</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; height: 100vh; overflow: hidden; display: grid; grid-template-columns: 340px 1fr 380px; background: #0f172a; color: #e5e7eb; font-family: Arial, sans-serif; }
  aside, main { min-height: 0; }
  #left, #right { background: #111827; border-color: #263244; overflow: auto; }
  #left { border-right: 1px solid #263244; }
  #right { border-left: 1px solid #263244; }
  header, section { padding: 14px; border-bottom: 1px solid #263244; }
  h1 { margin: 0 0 4px; font-size: 18px; }
  h2 { margin: 0 0 10px; color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
  input { width: 100%; padding: 9px 10px; color: #e5e7eb; background: #0b1120; border: 1px solid #334155; border-radius: 6px; outline: none; }
  button { width: 100%; text-align: left; margin: 4px 0; padding: 8px 9px; color: #e5e7eb; background: #1f2937; border: 1px solid #374151; border-radius: 6px; cursor: pointer; }
  button:hover, button.active { background: #263244; border-color: #60a5fa; }
  #canvas { position: relative; overflow: auto; background: radial-gradient(circle at 20% 10%, #172554 0, #0f172a 32%, #0b1120 100%); }
  #board { position: relative; min-width: 1150px; min-height: 900px; }
  .group-node { position: absolute; width: 180px; min-height: 70px; padding: 10px; border-radius: 8px; border: 2px solid var(--c); background: #111827; box-shadow: 0 10px 30px rgba(0,0,0,.25); cursor: pointer; }
  .group-node strong { display: block; font-size: 14px; margin-bottom: 5px; }
  .group-node span { color: #9ca3af; font-size: 12px; }
  .file { position: absolute; width: 160px; padding: 7px 8px; border-radius: 6px; border: 1px solid #334155; background: #172033; cursor: pointer; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .file:hover, .file.active { border-color: #facc15; background: #243047; }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  line { stroke: #64748b; stroke-width: 1.4; opacity: .55; }
  .muted { color: #9ca3af; font-size: 12px; line-height: 1.5; }
  .meta { color: #9ca3af; font-size: 12px; overflow-wrap: anywhere; }
  .pill { display: inline-block; margin: 3px 4px 3px 0; padding: 3px 7px; border-radius: 999px; background: #263244; color: #cbd5e1; font-size: 11px; }
  .list { max-height: 260px; overflow: auto; }
  .row { padding: 7px 0; border-bottom: 1px solid #263244; font-size: 13px; }
  .small { font-size: 11px; color: #94a3b8; }
  .tabs { display: flex; gap: 4px; margin-bottom: 8px; }
  .tab { flex: 1; text-align: center; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; background: #1f2937; border: 1px solid #374151; color: #9ca3af; padding: 6px; border-radius: 6px; cursor: pointer; }
  .tab.active { background: #263244; border-color: #60a5fa; color: #e5e7eb; }
</style>
</head>
<body>
<aside id="left">
  <header>
    <h1>Mbolo Graphify</h1>
    <div class="muted">${roles.length} roles, ${features.length} features, ${conventions.length} conventions</div>
  </header>
  <section>
    <h2>Recherche</h2>
    <input id="search" placeholder="role, feature, fichier..." autocomplete="off">
    <div id="results" class="list"></div>
  </section>
  <section>
    <div class="tabs">
      <div class="tab active" data-tab="roles" onclick="switchTab('roles')">Roles</div>
      <div class="tab" data-tab="features" onclick="switchTab('features')">Features</div>
      <div class="tab" data-tab="conventions" onclick="switchTab('conventions')">Conventions</div>
    </div>
    <div id="groupList"></div>
  </section>
</aside>
<main id="canvas"><div id="board"><svg id="edges"></svg></div></main>
<aside id="right">
  <section>
    <h2>Selection</h2>
    <div id="details" class="muted">Clique sur un element.</div>
  </section>
</aside>
<script>
const GROUPS = ${JSON.stringify(allGroups)};
const FILES = ${JSON.stringify(files)};
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function groupPosition(i, total) {
  const cols = 3;
  return { x: 80 + (i % cols) * 340, y: 60 + Math.floor(i / cols) * 145 };
}
function filePosition(pos, i) {
  const col = i % 2;
  const row = Math.floor(i / 2);
  return { x: pos.x + 210 + col * 175, y: pos.y + row * 42 };
}
function groupButton(g) {
  const active = g.id === selectedGroup ? 'active' : '';
  return '<button class="' + active + '" onclick="selectGroup(\\'' + g.id + '\\')">' + esc(g.label) + ' <span class="small">(' + g.files.length + ')</span></button>';
}
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  const groups = getCurrentGroups();
  if (selectedGroup && !groups.some(g => g.id === selectedGroup)) {
    selectedGroup = groups[0]?.id || null;
  }
  if (!selectedGroup && groups.length) selectedGroup = groups[0].id;
  selectedFile = null;
  renderSidebar();
  renderBoard();
  if (selectedGroup) renderGroup(selectedGroup);
}
function renderSidebar() {
  document.getElementById('groupList').innerHTML = getCurrentGroups().map(groupButton).join('');
}
function renderBoard() {
  const board = document.getElementById('board');
  board.querySelectorAll('.group-node,.file').forEach(el => el.remove());
  const svg = document.getElementById('edges');
  svg.innerHTML = '';
  const groups = getCurrentGroups();
  groups.forEach((g, i) => {
    const pos = groupPosition(i, groups.length);
    const node = document.createElement('div');
    node.className = 'group-node' + (g.id === selectedGroup ? ' active' : '');
    node.style.left = pos.x + 'px';
    node.style.top = pos.y + 'px';
    node.style.setProperty('--c', g.color);
    node.onclick = () => selectGroup(g.id);
    node.innerHTML = '<strong>' + esc(g.label) + '</strong><span>' + g.files.length + ' fichiers</span>';
    board.appendChild(node);
    if (g.id !== selectedGroup) return;
    g.files.forEach((file, fi) => {
      const fp = filePosition(pos, fi);
      const fnode = document.createElement('div');
      fnode.className = 'file' + (file.id === selectedFile ? ' active' : '');
      fnode.style.left = fp.x + 'px';
      fnode.style.top = fp.y + 'px';
      fnode.title = file.source_file;
      fnode.onclick = (event) => { event.stopPropagation(); selectFile(file.id); };
      fnode.textContent = file.source_file;
      board.appendChild(fnode);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', pos.x + 180);
      line.setAttribute('y1', pos.y + 35);
      line.setAttribute('x2', fp.x);
      line.setAttribute('y2', fp.y + 16);
      svg.appendChild(line);
    });
  });
}
function renderGroup(groupId) {
  const g = byGroup.get(groupId);
  if (!g) return;
  document.getElementById('details').innerHTML =
    '<div><b>' + esc(g.label) + '</b></div>' +
    '<p class="meta">' + g.files.length + ' fichiers connectes.</p>' +
    '<div class="list">' + g.files.map(f => '<button onclick="selectFile(\\'' + f.id + '\\')">' + esc(f.source_file) + '</button>').join('') + '</div>';
}
function renderFile(fileId) {
  const file = byFile.get(fileId);
  if (!file) return;
  const symbols = file.symbols.map(s => '<div class="row">' + esc(s.label) + ' <span class="small">' + esc(s.location || '') + '</span></div>').join('');
  const imports = file.imports.map(s => '<span class="pill">' + esc(s.label) + '</span>').join('');
  document.getElementById('details').innerHTML =
    '<div><b>' + esc(file.label) + '</b></div>' +
    '<p class="meta">' + esc(file.source_file) + '</p>' +
    '<h2>Imports</h2><div>' + (imports || '<span class="muted">Aucun import direct.</span>') + '</div>' +
    '<h2 style="margin-top:14px">Symboles</h2><div class="list">' + (symbols || '<div class="muted">Aucun symbole extrait.</div>') + '</div>';
}
function selectGroup(groupId) {
  selectedGroup = groupId;
  selectedFile = null;
  renderSidebar();
  renderBoard();
  renderGroup(groupId);
}
function selectFile(fileId) {
  const file = byFile.get(fileId);
  if (!file) return;
  selectedGroup = file.types[0] || null;
  selectedFile = fileId;
  renderSidebar();
  renderBoard();
  renderFile(fileId);
}
document.getElementById('search').addEventListener('input', event => {
  const q = event.target.value.trim().toLowerCase();
  if (!q) { document.getElementById('results').innerHTML = ''; return; }
  const groupResults = GROUPS.filter(g => g.label.toLowerCase().includes(q)).map(g => ({ id: g.id, label: g.label }));
  const fileResults = FILES.filter(f => (f.source_file + ' ' + f.label).toLowerCase().includes(q)).map(f => ({ id: f.id, label: f.source_file }));
  const symbolResults = FILES.flatMap(f => f.symbols.filter(s => s.label.toLowerCase().includes(q)).map(s => ({ id: f.id, label: s.label + ' - ' + f.source_file })));
  document.getElementById('results').innerHTML = [...groupResults, ...fileResults, ...symbolResults].slice(0, 40).map(r => {
    const fn = byGroup.has(r.id) ? 'selectGroup' : 'selectFile';
    return '<button onclick="' + fn + '(\\'' + r.id + '\\')">' + esc(r.label) + '</button>';
  }).join('');
});
switchTab('roles');
</script>
</body>
</html>
`;

  fs.writeFileSync(HTML_PATH, html, 'utf8');
}

function main() {
  if (!fs.existsSync(GRAPH_PATH)) {
    throw new Error('graphify-out/graph.json not found');
  }

  const graph = enrichGraph(JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8')));
  fs.writeFileSync(GRAPH_PATH, `${JSON.stringify(graph, null, 2)}\n`, 'utf8');
  writeReport(graph);
  writeInteractiveHtml(graph);

  const roleLinks = graph.links.filter((link) => link.relation === 'role_group').length;
  console.log(`[graphify] enriched ${graph.nodes.length} nodes, ${graph.links.length} edges, ${roleLinks} role links`);
  console.log(`[graphify] wrote ${path.relative(ROOT, HTML_PATH)}`);
}

try {
  main();
} catch (error) {
  console.error(`[graphify] ${error.message}`);
  process.exitCode = 1;
}
