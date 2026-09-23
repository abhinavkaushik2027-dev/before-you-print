// Structural PDF inspection. This checks declarations and embedded streams, not PDF/X compliance.
export function inspectProduction(pdf,page){
 const {PDFName,PDFDict,PDFArray,PDFRawStream,decodePDFRawStream}=globalThis.PDFLib;
 const lookup=v=>{try{return pdf.context.lookup(v);}catch{return null;}};
 const get=(d,k)=>d instanceof PDFDict?lookup(d.get(PDFName.of(k))):null;
 const name=v=>v instanceof PDFName?v.decodeText():null;
 const values=v=>v instanceof PDFArray?v.asArray().map(lookup):[];
 const fonts=[],spaces=new Set(),seen=new Set();let partial=false,count=0;
 const addSpace=v=>{
  v=lookup(v);const simple=name(v);if(simple){spaces.add(simple);return;}
  if(v instanceof PDFArray){const entries=values(v),family=name(entries[0]);if(family==='ICCBased'){const profile=entries[1],n=get(profile?.dict,'N')?.asNumber?.();spaces.add(`ICC ${n===3?'RGB':n===4?'CMYK':n===1?'Gray':'unknown'}`);}else if(family){spaces.add(family);if(family==='Indexed')addSpace(entries[1]);}}
 };
 const inspectFont=font=>{
  if(!(font instanceof PDFDict)||seen.has(font))return;seen.add(font);
  const subtype=name(get(font,'Subtype')),base=name(get(font,'BaseFont'))||'Unnamed font';
  if(subtype==='Type0'){const descendants=values(get(font,'DescendantFonts'));if(!descendants.length){fonts.push({name:base,embedded:false,unknown:true});return;}descendants.forEach(inspectFont);return;}
  if(subtype==='Type3'){fonts.push({name:base,embedded:!!get(font,'CharProcs'),type3:true});return;}
  const descriptor=get(font,'FontDescriptor');const embedded=['FontFile','FontFile2','FontFile3'].some(k=>{const file=get(descriptor,k);return file instanceof PDFRawStream&&file.contents.length>0;});
  fonts.push({name:base.replace(/^[A-Z]{6}\+/,''),embedded,subtype});
 };
 const inspectStream=stream=>{
  if(!(stream instanceof PDFRawStream)||seen.has(stream))return;seen.add(stream);if(++count>500){partial=true;return;}
  const dict=stream.dict;const subtype=name(get(dict,'Subtype'));
  if(subtype==='Image'){addSpace(get(dict,'ColorSpace'));return;}
  resources(get(dict,'Resources'));
  try{const data=decodePDFRawStream(stream).decode();if(data.length>4*1024*1024){partial=true;return;}const src=new TextDecoder('latin1').decode(data);for(const token of contentTokens(src)){if(token==='rg'||token==='RG')spaces.add('DeviceRGB');else if(token==='k'||token==='K')spaces.add('DeviceCMYK');else if(token==='g'||token==='G')spaces.add('DeviceGray');else if(token==='BI')partial=true;}}
  catch{partial=true;}
 };
 const resources=res=>{
  if(!(res instanceof PDFDict)||seen.has(res))return;seen.add(res);if(++count>500){partial=true;return;}
  const fs=get(res,'Font');if(fs instanceof PDFDict)fs.values().forEach(f=>inspectFont(lookup(f)));
  const colors=get(res,'ColorSpace');if(colors instanceof PDFDict)colors.values().forEach(addSpace);
  for(const key of ['XObject','Pattern']){const group=get(res,key);if(group instanceof PDFDict)group.values().forEach(v=>inspectStream(lookup(v)));}
  const shade=get(res,'Shading');if(shade instanceof PDFDict)shade.values().forEach(v=>{v=lookup(v);addSpace(get(v?.dict||v,'ColorSpace'));});
 };
 resources(page.node.Resources());const contents=page.node.Contents();if(contents instanceof PDFArray)values(contents).forEach(inspectStream);else inspectStream(contents);
 // Annotation appearance streams can have their own fonts and colour resources.
 for(const annotation of values(page.node.Annots())){const ap=get(annotation,'AP');if(ap instanceof PDFDict)for(const state of ap.values()){const obj=lookup(state);if(obj instanceof PDFRawStream)inspectStream(obj);else if(obj instanceof PDFDict)obj.values().forEach(v=>inspectStream(lookup(v)));}}
 const intents=values(get(pdf.catalog,'OutputIntents')).map(intent=>{const profile=get(intent,'DestOutputProfile');return {identifier:get(intent,'OutputConditionIdentifier')?.decodeText?.()||'Unlabelled output intent',hasProfile:profile instanceof PDFRawStream&&profile.contents.length>0};});
 return {fonts,spaces:[...spaces].filter(Boolean),intents,partial};
}
export function* contentTokens(src){
 let i=0;
 while(i<src.length){const c=src[i];if(/\s/.test(c)){i++;continue;}if(c==='%'){while(i<src.length&&!/[\r\n]/.test(src[i]))i++;continue;}
 if(c==='('){let depth=1;i++;while(i<src.length&&depth){if(src[i]==='\\'){i+=2;continue;}if(src[i]==='(')depth++;if(src[i]===')')depth--;i++;}continue;}
 if(c==='<'&&src[i+1]!=='<'){i++;while(i<src.length&&src[i]!=='>')i++;i++;continue;}
 if(c==='/'){i++;while(i<src.length&&!/[\s[\]<>()/%]/.test(src[i]))i++;continue;}
 if(/[\[\]<>()]/.test(c)){i++;continue;}
 const start=i;while(i<src.length&&!/[\s[\]<>()/%]/.test(src[i]))i++;if(i===start){i++;continue;}const token=src.slice(start,i);yield token;
 if(token==='BI'){const match=/\sEI(?=\s|$)/g;match.lastIndex=i;const end=match.exec(src);i=end?match.lastIndex:src.length;}
 }
}
