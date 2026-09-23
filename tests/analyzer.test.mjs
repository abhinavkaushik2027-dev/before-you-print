import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import * as PDFLib from 'pdf-lib';
import jsQR from 'jsqr';
import {createCanvas,DOMMatrix,Path2D,ImageData} from '@napi-rs/canvas';
globalThis.PDFLib=PDFLib;globalThis.jsQR=jsQR;globalThis.DOMMatrix=DOMMatrix;globalThis.Path2D=Path2D;globalThis.ImageData=ImageData;
globalThis.document={createElement:name=>{assert.equal(name,'canvas');return createCanvas(1,1);}};
process.chdir(fileURLToPath(new URL('../dist/',import.meta.url)));
const {analyzePdf,pdfjs}=await import('../dist/analyzer.js');
pdfjs.GlobalWorkerOptions.workerSrc=fileURLToPath(new URL('../dist/vendor/pdf.worker.mjs',import.meta.url));
const settings={type:'invitation',size:null,dpi:300,margin:3,bleed:true};
const analyze=(bytes,overrides={})=>analyzePdf(new Uint8Array(bytes),{...settings,...overrides},()=>{},new AbortController().signal);
test('real sample yields five known warnings including missing embedded fonts and a decoded QR destination',async()=>{
 const bytes=await readFile(new URL('../dist/samples/invitation-with-mistakes.pdf',import.meta.url));
 const result=await analyze(bytes);
 assert.equal(result.pages.length,1);
 assert.deepEqual(result.findings.filter(f=>f.severity==='warning').map(f=>f.category).sort(),['bleed','dates','fonts','margin','resolution']);
 assert.equal(result.pages[0].codes[0].url,'https://example.com/');
 assert.equal(result.findings.find(f=>f.category==='dates'&&f.severity==='warning').rect.length,4);
 assert.ok(result.pages[0].preview.startsWith('data:image/jpeg'));
});
test('multi-page rotated PDF with valid boxes and high-resolution image passes measurable checks',async()=>{
 const doc=await PDFLib.PDFDocument.create();const font=await doc.embedFont(PDFLib.StandardFonts.Helvetica);
 const canvas=createCanvas(600,600),ctx=canvas.getContext('2d');ctx.fillStyle='#3452dc';ctx.fillRect(0,0,600,600);
 const img=await doc.embedPng(canvas.toBuffer('image/png'));
 for(let i=0;i<2;i++){const p=doc.addPage([378,522]);p.setTrimBox(9,9,360,504);p.setBleedBox(0,0,378,522);p.drawText('Saturday, 26 September 2026',{x:40,y:420,font,size:12});p.drawImage(img,{x:60,y:200,width:100,height:100});if(i===1)p.setRotation(PDFLib.degrees(90));}
 const bytes=await doc.save();await mkdir(new URL('./fixtures/',import.meta.url),{recursive:true});await writeFile(new URL('./fixtures/two-pages.pdf',import.meta.url),bytes);
 const result=await analyze(bytes,{size:[127,177.8]});assert.equal(result.pages.length,2);assert.equal(result.findings.filter(f=>f.severity==='warning'&&f.category!=='fonts').length,0);assert.ok(result.findings.some(f=>f.category==='bleed'&&f.severity==='pass'));
 const mismatch=await analyze(bytes,{size:[210,297]});assert.equal(mismatch.findings.filter(f=>f.category==='size'&&f.severity==='warning').length,2);
});
test('malformed and excessive-page files fail rather than returning a pass',async()=>{
 await assert.rejects(()=>analyze(new TextEncoder().encode('%PDF-not-a-valid-file')),/could not be read as a PDF/);
 const doc=await PDFLib.PDFDocument.create();for(let i=0;i<21;i++)doc.addPage([100,100]);
 await assert.rejects(()=>analyzePdfBytes(doc),/more than 20 pages/);
});
async function analyzePdfBytes(doc){return analyze(await doc.save());}
