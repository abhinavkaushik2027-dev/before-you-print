import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as PDFLib from 'pdf-lib';
import {readFile} from 'node:fs/promises';
import nspell from 'nspell';
import dictionary from 'dictionary-en-gb';
import {comparePhrase,expectedDateResult,spellingCandidates} from '../dist/content-checks.js';
import {inspectProduction,contentTokens} from '../dist/preflight.js';
import {pixelToPdfRect} from '../dist/advanced.js';
const {PDFDocument,PDFName,StandardFonts,rgb,cmyk}=PDFLib;globalThis.PDFLib=PDFLib;
test('reference checks distinguish selectable text, OCR, close spelling and missing values',()=>{
 assert.equal(comparePhrase('Aarav Sharma','AARAV SHARMA').status,'match');
 assert.equal(comparePhrase('Aarav Sharma','Aarav Sharmma').closest,'aarav sharmma');
 assert.equal(comparePhrase('Garden Room','','Garden Room').status,'ocr-match');
 assert.equal(comparePhrase('Ann','Joanne').status,'missing');
 assert.equal(expectedDateResult('2026-09-26','Saturday, 26 September 2026').status,'match');
 assert.equal(expectedDateResult('2026-09-26','','26 September 2026').status,'ocr-match');
 assert.equal(expectedDateResult('2026-05-04','04/05/2026').status,'ambiguous');
 assert.equal(expectedDateResult('2026-09-26','27 September 2026').status,'missing');
});
test('spelling flags a real typo but honours names and approved words',()=>{
 const spell=nspell(dictionary);const entries=spellingCandidates('Welcomme to the ceremony. Aarav Sharma. QR RSVP colour. https://example.com',spell,['Aarav Sharma']);
 assert.ok(entries.some(e=>e.word==='Welcomme'&&e.suggestions.includes('welcome')));
 assert.ok(!entries.some(e=>['Aarav','Sharma','colour','RSVP'].includes(e.word)));
});
test('PDF colour tokens ignore strings, names, comments and inline-image bytes',()=>{
 const tokens=[...contentTokens('(text rg and k) /rg % RG\n 1 0 0 rg <5247> BI /W 1 ID fake k data EI 0 0 0 1 k')];
 assert.equal(tokens.filter(t=>t==='rg').length,1);assert.equal(tokens.filter(t=>t==='k').length,1);assert.ok(tokens.includes('BI'));
});
test('production check detects unembedded fonts and genuine RGB / CMYK operators',async()=>{
 const doc=await PDFDocument.create(),p=doc.addPage();const font=await doc.embedFont(StandardFonts.Helvetica);p.drawText('Hello',{font,color:rgb(1,0,0)});p.drawRectangle({x:10,y:20,width:20,height:20,color:cmyk(0,1,1,0)});
 const loaded=await PDFDocument.load(await doc.save());const r=inspectProduction(loaded,loaded.getPage(0));
 assert.equal(r.fonts.length,1);assert.equal(r.fonts[0].embedded,false);assert.ok(r.spaces.includes('DeviceRGB'));assert.ok(r.spaces.includes('DeviceCMYK'));
});
test('font descriptor streams and output profile presence are inspected structurally',async()=>{
 const doc=await PDFDocument.create(),p=doc.addPage();const font=await doc.embedFont(StandardFonts.Helvetica);p.drawText('Hello',{font});await doc.flush();
 const fontDict=doc.context.lookup(font.ref);const fontFile=doc.context.register(doc.context.stream(await readFile(new URL('../node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf',import.meta.url))));
 fontDict.set(PDFName.of('FontDescriptor'),doc.context.obj({Type:'FontDescriptor',FontName:'Helvetica',FontFile2:fontFile}));
 doc.catalog.set(PDFName.of('OutputIntents'),doc.context.obj([{Type:'OutputIntent',S:'GTS_PDFX',DestOutputProfile:doc.context.register(doc.context.stream(new Uint8Array([1,2,3])))}]));
 const loaded=await PDFDocument.load(await doc.save());const r=inspectProduction(loaded,loaded.getPage(0));assert.equal(r.fonts[0].embedded,true);assert.equal(r.intents[0].hasProfile,true);
 // Deliberately tests presence only: this is not a font/ICC validity certificate.
});
test('OCR bounding boxes map back to PDF coordinates, including rotation',()=>{
 assert.deepEqual(pixelToPdfRect({x0:20,y0:40,x1:60,y1:80},[2,0,0,-2,0,200]),[10,60,30,80]);
 assert.deepEqual(pixelToPdfRect({x0:20,y0:40,x1:60,y1:80},[0,2,2,0,0,0]),[20,10,40,30]);
});
