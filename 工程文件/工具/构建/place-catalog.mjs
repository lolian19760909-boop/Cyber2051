// Build the shared location identity catalog; never regenerate atlas geometry or prose.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../卡片源码/地图');
const engineering = path.resolve(root, '../..');
export const target = path.join(engineering, '.cache/place-catalog.json');
const safeId = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(value)
  && !['constructor', 'prototype', '__proto__'].includes(value);

export function buildCatalog() {
  const sources = [];
  const read = file => {
    const bytes = fs.readFileSync(file);
    sources.push({ file: path.relative(engineering, file).replaceAll('\\', '/'), sha256: createHash('sha256').update(bytes).digest('hex') });
    return bytes.toString('utf8');
  };
  const legacy = JSON.parse(read(path.resolve(root, '数据/legacy-nodes.json')));
  const regions = JSON.parse(read(path.resolve(root, '数据/legacy-regions.json'))).regions;
  const places = legacy.nodes.map(node => ({ id: node.id, name: node.name, district: regions.find(r => r.id === node.group)?.name }));
  assert.equal(places.length, 12, 'Legacy location compatibility requires review');
  const maps = ['central', 'western'].map(name => {
    const source = read(path.join(root, name + '-data.js'));
    // These generated files are data assignments. Parse JSON, never execute them.
    const match = source.match(/^window\.TOKYO_ATLAS\s*=\s*([\s\S]+);\s*$/);
    assert.ok(match, 'Unexpected atlas data envelope: ' + name);
    const data = JSON.parse(match[1]);
    const nodes = [...data.nodes, ...data.services, ...(data.districtExpansion?.places || []), ...(data.terrainContext?.places || [])];
    const entries = nodes.map(node => ({ id: node.id, name: node.name, district: data.regions.find(r => r.id === node.group)?.name }));
    assert.ok(safeId(data.mapId));
    assert.equal(new Set(entries.map(p => p.id)).size, entries.length, 'Duplicate location in ' + data.mapId);
    assert.ok(entries.every(p => safeId(p.id) && p.name && p.district), 'Invalid location identity in ' + data.mapId);
    return { id: data.mapId, name: data.displayName, version: data.mapVersion, places: entries };
  });
  assert.deepEqual(maps.map(m => m.id), ['tokyo-central', 'west-expansion']);
  assert.ok(places.every(p => maps[0].places.some(n => n.id === p.id)), 'Legacy location was removed');
  assert.ok(places.every(p => p.district));
  // The original shape remains the 12-location view for older workshop clients.
  return { format: 1, mapId: 'tokyo-central', sourceSha256: sources[0].sha256, places, catalogVersion: 1, maps, sources };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  assert.ok(args.every(arg => ['--check', '--write'].includes(arg)) && args.length <= 1, 'Use --check (default) or --write');
  const catalog = buildCatalog(), bytes = JSON.stringify(catalog, null, 2) + '\n';
  if (args.includes('--write')) fs.writeFileSync(target, bytes);
  else assert.equal(fs.readFileSync(target, 'utf8'), bytes, 'Shared location catalog is stale; review sources before --write');
  console.log(JSON.stringify({ mode: args.includes('--write') ? 'write' : 'check', target, maps: catalog.maps.map(m => ({ id: m.id, places: m.places.length })), legacy: catalog.places.length }));
}
