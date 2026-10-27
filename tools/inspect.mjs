import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f); const r = doc.getRoot();
  console.log('==', f.split('/').pop());
  const pr = (n, d) => { const m = n.getMesh(); console.log(' '.repeat(d*2) + n.getName(), 'T', n.getTranslation().map(v=>+v.toFixed(3)), 'R', n.getRotation().map(v=>+v.toFixed(2)), 'S', n.getScale().map(v=>+v.toFixed(2)), m ? 'mesh:' + m.listPrimitives().map(p => (p.getMaterial()?.getName()) + '/' + p.getAttribute('POSITION').getCount()).join(',') : ''); n.listChildren().forEach(c => pr(c, d+1)); };
  r.getDefaultScene().listChildren().forEach(n => pr(n, 1));
  r.listAnimations().forEach(a => console.log(' anim', a.getName(), a.listChannels().length, 'ch', a.listChannels().map(c=>c.getTargetPath()).filter((v,i,s)=>s.indexOf(v)===i).join('/'), 'dur', Math.max(...a.listSamplers().map(s=>{const t=s.getInput().getArray(); return t[t.length-1];})).toFixed(2)));
  r.listMaterials().forEach(m => console.log(' mat', m.getName(), m.getBaseColorFactor().map(v=>+v.toFixed(2)), m.getBaseColorTexture()?.getURI?.() || (m.getBaseColorTexture()? 'tex':'')));
}
