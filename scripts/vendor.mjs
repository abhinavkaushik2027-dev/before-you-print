import {mkdir,copyFile,cp} from 'node:fs/promises';
await mkdir('dist/vendor',{recursive:true});
for (const [from,to] of [['pdfjs-dist/build/pdf.mjs','pdf.mjs'],['pdfjs-dist/build/pdf.worker.mjs','pdf.worker.mjs'],['pdf-lib/dist/pdf-lib.min.js','pdf-lib.min.js'],['jsqr/dist/jsQR.js','jsQR.js'],['pdfjs-dist/LICENSE','PDFJS-LICENSE'],['pdf-lib/LICENSE.md','PDFLIB-LICENSE'],['jsqr/LICENSE','JSQR-LICENSE']]) await copyFile('node_modules/'+from,'dist/vendor/'+to);
for(const dir of ['cmaps','standard_fonts']) await cp('node_modules/pdfjs-dist/'+dir,'dist/vendor/'+dir,{recursive:true});
console.log('Browser libraries copied. Static website ready in dist/.');
await mkdir('dist/vendor/ocr',{recursive:true});
await mkdir('dist/vendor/spelling',{recursive:true});
for(const file of ['tesseract.min.js','worker.min.js'])await copyFile('node_modules/tesseract.js/dist/'+file,'dist/vendor/ocr/'+file);
for(const file of ['tesseract-core-lstm.wasm.js','tesseract-core-lstm.wasm','tesseract-core-simd-lstm.wasm.js','tesseract-core-simd-lstm.wasm'])await copyFile('node_modules/tesseract.js-core/'+file,'dist/vendor/ocr/'+file);
await copyFile('node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz','dist/vendor/ocr/eng.traineddata.gz');
for(const file of ['index.aff','index.dic','license'])await copyFile('node_modules/dictionary-en-gb/'+file,'dist/vendor/spelling/'+file);
await copyFile('node_modules/tesseract.js/LICENSE.md','dist/vendor/ocr/LICENSE');
await copyFile('node_modules/nspell/license','dist/vendor/spelling/NSPELL-LICENSE');
const {build}=await import('esbuild');
await build({entryPoints:['scripts/spell-entry.js'],bundle:true,format:'iife',globalName:'SpellTools',platform:'browser',outfile:'dist/vendor/spelling/spell.js',minify:true});
console.log('Local OCR engine, English language model and spelling dictionary ready.');

await copyFile('node_modules/tesseract.js-core/LICENSE','dist/vendor/ocr/CORE-LICENSE');
for(const file of ['tesseract.min.js.LICENSE.txt','worker.min.js.LICENSE.txt'])await copyFile('node_modules/tesseract.js/dist/'+file,'dist/vendor/ocr/'+file);
