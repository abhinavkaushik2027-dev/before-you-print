import {inspectProduction} from './preflight.js';
import {comparePhrase,expectedDateResult,spellingCandidates,normalizeText} from './content-checks.js';
import {inspectDates,nearTrim,textRectangle} from './checks.js';
const asset=path=>new URL('./vendor/'+path,import.meta.url).href;
function bounded(promise,signal,ms=90000){return new Promise((resolve,reject)=>{let timer;const done=(fn,value)=>{clearTimeout(timer);signal.removeEventListener('abort',abort);fn(value);};const abort=()=>done(reject,new Error('Check cancelled.'));timer=setTimeout(()=>done(reject,new Error('Text recognition timed out.')),ms);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();promise.then(v=>done(resolve,v),e=>done(reject,e));});}
export function pixelToPdfRect(box,m){const determinant=m[0]*m[3]-m[1]*m[2];if(!determinant)return null;const points=[[box.x0,box.y0],[box.x1,box.y0],[box.x0,box.y1],[box.x1,box.y1]].map(([x,y])=>{x-=m[4];y-=m[5];return [(m[3]*x-m[2]*y)/determinant,(-m[1]*x+m[0]*y)/determinant];});return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];}
export function createAdvanced(settings,signal,add){
 let worker=null,workerPromise=null,ocrFailed=false,dictionary=null,spellingFailed=false;
 const originals=[],recognized=[];
 const allowed=[...(settings.references?.names||[]),settings.references?.venue||'',...(settings.allowedWords||[])];
 const abort=()=>{if(worker)void worker.terminate();};signal.addEventListener('abort',abort,{once:true});
 return {
 async page({pdf,raw,canvas,textItems,styles,nativeText,viewport,trim,unit,number,progress}){
  originals.push(nativeText);let ocrText='',ocrAdditionalText='';
  try{
   const production=inspectProduction(pdf,raw);const missing=production.fonts.filter(f=>!f.embedded);
   if(missing.length)add('fonts','warning',`${missing.length} font${missing.length===1?' is':'s are'} not embedded`,`${[...new Set(missing.map(f=>f.name))].join(', ')}. Another computer or printer may substitute these fonts. Export again with fonts embedded (check the font’s licence). Referenced resources can include unused fonts.`,number);
   else if(production.fonts.length)add('fonts',production.partial?'manual':'pass','Referenced fonts have embedded data',`${production.fonts.length} font resource(s) contain font streams or Type 3 glyph definitions. This confirms presence, not validity, licensing, complete glyph coverage or correct shaping.`,number);
   else add('fonts','info','No font resources found','Text may be outlined or rasterised. That avoids font substitution but does not establish that the content is correct or sharp.',number);
   const rgb=production.spaces.some(s=>/RGB|CalRGB/.test(s)),unmanaged=production.spaces.some(s=>/^Device(?:RGB|CMYK)$/.test(s));
   add('colour',settings.colourTarget==='cmyk'&&rgb?'warning':'info',settings.colourTarget==='cmyk'&&rgb?'RGB colour found in a CMYK-targeted file':'Colour spaces identified',`${production.spaces.join(', ')||'No explicit colour spaces identified (PDF defaults may apply)'}. ${settings.colourTarget==='cmyk'&&rgb?'Ask the designer to export using the printer’s requested CMYK profile. Do not blindly convert colours.':'Confirm these match your printer’s workflow.'} This is a resource and content-stream inspection, not a visual colour match.`,number);
   if(unmanaged&&!production.intents.some(i=>i.hasProfile))add('colour','manual','No embedded output profile found','Device-dependent colour was found without an embedded OutputIntent profile. Ask which profile the printer expects; this does not automatically make the file unsuitable.',number);
   else if(production.intents.length)add('colour','info','Output intent declared',production.intents.map(i=>`${i.identifier}: ${i.hasProfile?'profile stream present':'no embedded profile stream'}`).join('; ')+'. Profile presence does not verify colour accuracy or PDF/X compliance.',number);
   if(production.partial)add('colour','manual','Production inspection was partial','Some inline images, large streams or unsupported resources could not be fully inspected. Font and colour results may be incomplete; request a printer preflight.',number);
  }catch{add('fonts','manual','Font inspection could not finish','The PDF’s resource structure could not be fully inspected. Ask your printer to check embedding.',number);add('colour','manual','Colour inspection could not finish','Ask your printer to check source colour spaces and output profiles.',number);}
  if(settings.ocr&&!ocrFailed){
   try{
    if(!worker){progress('Loading local English text recognition…');workerPromise=globalThis.Tesseract.createWorker('eng',1,{workerPath:asset('ocr/worker.min.js'),corePath:asset('ocr/'),langPath:asset('ocr/'),workerBlobURL:false,cacheMethod:'none',gzip:true,errorHandler:()=>{}});worker=await bounded(workerPromise,signal);}
    progress(`Reading text in artwork on page ${number}…`);
    const {data}=await bounded(worker.recognize(canvas,{}, {text:true,blocks:true}),signal);
    ocrText=data.text||'';recognized.push(ocrText);
    const lines=(data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>p.lines||[]));
    const words=lines.flatMap(l=>l.words||[]);
    const nativeRects=textItems.map(t=>textRectangle(t,styles)).filter(Boolean);
    ocrAdditionalText=words.filter(w=>{
     if((w.confidence||0)<65)return false;
     const r=pixelToPdfRect(w.bbox,viewport.transform);if(!r)return false;
     const x=(r[0]+r[2])/2,y=(r[1]+r[3])/2;
     return !nativeRects.some(n=>x>=n[0]-2&&x<=n[2]+2&&y>=n[1]-2&&y<=n[3]+2);
    }).map(w=>w.text).join(' ');

    if(!ocrText.trim())add('ocr','manual','OCR did not recover readable text','Small, decorative, rotated or low-contrast text can be missed. This English recogniser cannot establish that the page has no text.',number);
    else add('ocr',data.confidence<65?'manual':'info','Text read from the rendered artwork',`English OCR recovered approximately ${ocrText.trim().split(/\s+/).length} words. Engine confidence: ${Math.round(data.confidence||0)}/100 (not an accuracy guarantee). Review the OCR text below the preview; names and stylised text can be misread.`,number);
    const nativeWords=new Set(normalizeText(nativeText).split(' '));let edge=0;
    for(const w of words){if((w.confidence||0)<60||nativeWords.has(normalizeText(w.text))||!w.text.trim())continue;const rect=pixelToPdfRect(w.bbox,viewport.transform);if(rect&&nearTrim(rect,trim,settings.margin,unit)&&edge++<8)add('margin','manual','OCR text may be near the cutting edge',`OCR read “${w.text.slice(0,80)}” within the safety margin. Confirm the reading and position visually; OCR bounds are approximate.`,number,rect);}
    const nativeDates=new Set(inspectDates(nativeText).map(d=>normalizeText(d.text)));
    for(const d of inspectDates(ocrText)){if(nativeDates.has(normalizeText(d.text)))continue;if(!d.valid&&!d.ambiguous||d.mismatch){const line=lines.find(l=>(l.text||'').includes(d.text));add('dates','manual','Possible date issue in OCR text',`OCR read “${d.text}”. ${d.mismatch?'The calendar weekday is '+d.weekday+'.':'This is not a valid calendar date.'} First confirm OCR read it correctly, then check your source details.`,number,line?.bbox?pixelToPdfRect(line.bbox,viewport.transform):null);}}
   }catch(error){if(signal.aborted)throw error;ocrFailed=true;if(worker)await worker.terminate();else workerPromise?.then(w=>w.terminate()).catch(()=>{});worker=null;add('ocr','manual','OCR could not complete','Text recognition was unavailable or timed out. The remaining checks continue, but image/outlined text has not been fully read. Try a smaller file or a modern browser, and review artwork text manually.',number);}
  }else if(settings.ocr)add('ocr','manual','OCR skipped after an earlier failure','Image and outlined text on this page was not read.',number);
  else add('ocr','info','Image-text reading is off','Only selectable PDF text is available for spelling and reference checks. Enable English OCR to attempt image and outlined text.',number);
  if(settings.spelling&&!spellingFailed){
   try{
    if(!dictionary){progress('Loading local English spelling dictionary…');const texts=await Promise.all(['index.aff','index.dic'].map(async file=>{const r=await fetch(asset('spelling/'+file),{signal});if(!r.ok)throw new Error('Dictionary unavailable');return r.text();}));dictionary=globalThis.SpellTools.createDictionary(...texts);}
    const candidates=spellingCandidates(nativeText+'\n'+ocrAdditionalText,dictionary,allowed);
    for(const entry of candidates){const native=textItems.find(t=>new RegExp('\\b'+entry.word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(t.str));const source=native?'PDF text':'OCR text';add('spelling','manual',`Check spelling: “${entry.word}”`,`${source}: not recognised by the British English dictionary.${entry.suggestions.length?' Suggestions: '+entry.suggestions.join(', ')+'.':''} ${source==='OCR text'?'First check that OCR read the word correctly. ':''}It may be a valid name, brand or specialist term. Add approved terms in settings; nothing is changed automatically.`,number,native?textRectangle(native,styles):null);}
    if(!candidates.length)add('spelling','info','No dictionary flags in the checked text','This is a British English word check, not grammar or proofreading. Correctly spelled wrong words, omitted words and OCR errors can still be missed.',number);
    if(candidates.length===15)add('spelling','manual','Spelling suggestions are capped','Showing the first 15 unique unrecognised words on this page. Review the rest of the text yourself.',number);
   }catch(error){if(signal.aborted)throw error;spellingFailed=true;add('spelling','manual','Spelling check unavailable','The local dictionary could not be loaded. Review spelling manually.',number);}
  }else if(settings.spelling)add('spelling','manual','Spelling skipped after an earlier failure','Review spelling manually on this page.',number);
  else add('spelling','info','Spelling suggestions are off','Enable the English spelling check in print settings.',number);
  return {ocrText};
 },
 finish(){
  const reference=settings.references||{},native=originals.join('\n'),ocr=recognized.join('\n');
  const phrases=[...(reference.names||[]).map(text=>({label:'Name',text})),...(reference.venue?[{label:'Venue',text:reference.venue}]:[]),...(reference.details||[]).map(text=>({label:'Detail',text}))];
  for(const item of phrases){const result=comparePhrase(item.text,native,ocr);add('reference',result.status==='match'?'pass':'manual',result.status==='match'?`${item.label} matches your reference`:result.status==='ocr-match'?`${item.label} appears in OCR — confirm it`:`${item.label} not found exactly`,result.status==='match'?`“${item.text}” appears in selectable text (case, spacing and punctuation ignored). This only confirms presence somewhere in the document, not correct placement or absence of conflicting details.`:result.status==='ocr-match'?`OCR read “${item.text}”. Confirm the characters visually before printing; recognition can be wrong.`:`Expected “${item.text}”.${result.closest?' Closest extracted wording: “'+result.closest+'”.':''} Check the original artwork; a mismatch can also mean extraction or OCR missed it.`,null);}
  if(reference.date){const result=expectedDateResult(reference.date,native,ocr);add('reference',result.status==='match'?'pass':'manual',result.status==='match'?'Event date matches your reference':result.status==='ocr-match'?'Event date appears in OCR — confirm it':result.status==='ambiguous'?'Numeric date needs confirmation':'Expected event date not found',`Expected ${reference.date}. ${result.status==='match'?'That date appears in selectable text; confirm it is the event date, not another deadline.':result.status==='ocr-match'?'OCR suggests a match, but the printed characters need visual confirmation.':result.status==='ambiguous'?'A numeric date could match, but day/month order is ambiguous.':result.found?.length?'Other recognised dates: '+result.found.join(', ')+'. Review the artwork and reference.':'It may use a different format or be unreadable. Review the artwork and reference.'}`,null);}
  if(!phrases.length&&!reference.date)add('reference','manual','Add the correct names and event details','No reference details were supplied. The tool cannot know the intended names, venue or event date. Add them in print settings and check again.',null);
 },
 async dispose(){signal.removeEventListener('abort',abort);if(worker)await worker.terminate();}
 };
}
