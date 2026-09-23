import {readFile,writeFile} from 'node:fs/promises';
import {createCanvas,DOMMatrix,Path2D,ImageData} from '@napi-rs/canvas';
Object.assign(globalThis,{DOMMatrix,Path2D,ImageData});
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
const doc=await pdfjs.getDocument({data:new Uint8Array(await readFile('dist/samples/invitation-with-mistakes.pdf')),standardFontDataUrl:process.cwd()+'/node_modules/pdfjs-dist/standard_fonts/'}).promise;
const p=await doc.getPage(1),v=p.getViewport({scale:2});const c=createCanvas(v.width,v.height);await p.render({canvasContext:c.getContext('2d'),viewport:v}).promise;await writeFile('dist/samples/invitation-preview.jpg',c.toBuffer('image/jpeg'));await doc.destroy();
