import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import fs from 'fs';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const dir = process.argv[2]; const m = {};
for (const f of fs.readdirSync(dir).filter(f=>f.endsWith('.glb'))) { const d = await io.read(dir+'/'+f); for (const x of d.getRoot().listMaterials()) { const k = x.getName()+' '+x.getBaseColorFactor().slice(0,3).map(v=>v.toFixed(2)).join(','); (m[k] ||= []).push(f.replace('.glb','')); } }
for (const [k,v] of Object.entries(m)) console.log(k, v.length, v.slice(0,6).join(' '));
