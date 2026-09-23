import {createAdvanced} from './advanced.js';
import * as pdfjs from './vendor/pdf.mjs';
import {MM,multiply,imageDpi,boxMargins,sizeMatches,inspectDates,textRectangle,nearTrim,safeHttpUrl} from './checks.js';
pdfjs.GlobalWorkerOptions.workerSrc='./vendor/pdf.worker.mjs';
const {PDFDocument,PDFName}=globalThis.PDFLib;
export {pdfjs};
export async function analyzePdf(bytes,settings,onProgress,signal){
 const findings=[],pages=[];let nextId=0;
 const add=(category,severity,title,detail,page,rect)=>findings.push({id:'f'+(++nextId),category,severity,title,detail,page,rect});
 const advanced=createAdvanced(settings,signal,add);
 const task=pdfjs.getDocument({data:bytes.slice(),isEvalSupported:false,cMapUrl:'./vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'./vendor/standard_fonts/',useSystemFonts:false,stopAtErrors:true});
 const abort=()=>task.destroy();signal.addEventListener('abort',abort,{once:true});
 let document;
 try{
  document=await task.promise;
  if(signal.aborted)throw new Error('Check cancelled.');
  if(document.numPages>20)throw new Error('This PDF has more than 20 pages. Export a smaller section and try again.');
  const boxes=await PDFDocument.load(bytes,{updateMetadata:false});
  for(let index=0;index<document.numPages;index++){
   if(signal.aborted)throw new Error('Check cancelled.');
   onProgress(index/document.numPages*100,`Checking page ${index+1} of ${document.numPages}…`);
   const page=await document.getPage(index+1),raw=boxes.getPage(index),number=index+1;
   const unit=page.userUnit||1,trim=raw.getTrimBox(),media=raw.getMediaBox(),bleed=raw.getBleedBox();
   const width=trim.width*unit/MM,height=trim.height*unit/MM;
   if(settings.size&&!sizeMatches([width,height],settings.size))add('size','warning','Finished size does not match',`PDF trim is ${width.toFixed(1)} × ${height.toFixed(1)} mm; you selected ${settings.size.join(' × ')} mm. Export at the intended size rather than scaling at print time.`,number);
   else add('size','pass',settings.size?'Finished size matches':'Document size recorded',`${width.toFixed(1)} × ${height.toFixed(1)} mm${settings.size?' (within 1 mm tolerance).':'. Confirm this is the finished size you want.'}`,number);
   if(settings.bleed){
    const declared=!!raw.node.get(PDFName.of('TrimBox'))&&!!raw.node.get(PDFName.of('BleedBox'));
    const margins=boxMargins(trim,bleed,media).map(v=>v*unit);
    if(!declared)add('bleed','warning','Bleed is not explicitly defined','The PDF does not declare both trim and bleed boxes. Ask the designer to export with the printer’s required bleed. A larger page alone does not establish the cutting boundary.',number);
    else if(Math.min(...margins)<2.9)add('bleed','warning','Declared bleed is less than 3 mm',`Available bleed (left, bottom, right, top): ${margins.map(v=>v.toFixed(1)).join(', ')} mm. Extend edge artwork and export with the required bleed.`,number);
    else add('bleed','pass','At least 3 mm of bleed is declared','The page boxes allow bleed. Visually confirm the background actually extends into it; page boxes do not prove artwork coverage.',number);
   }else add('bleed','info','Bleed check skipped','You selected artwork that does not run to the edge. Confirm this with your printer.',number);
   const viewport=page.getViewport({scale:1});
   const scale=Math.min(2.5,1800/Math.max(viewport.width,viewport.height),Math.sqrt(2400000/(viewport.width*viewport.height)));
   const renderViewport=page.getViewport({scale});
   const canvas=documentCanvas(Math.ceil(renderViewport.width),Math.ceil(renderViewport.height));
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   await page.render({canvasContext:ctx,viewport:renderViewport,background:'rgb(255,255,255)'}).promise;
   if(signal.aborted)throw new Error('Check cancelled.');
   const text=await page.getTextContent();
   const textItems=text.items.filter(v=>v.str?.trim());
   const pageText=textItems.map(v=>v.str+(v.hasEOL?'\n':' ')).join('');
   let nearCount=0,vertical=false;
   for(const item of textItems){const rect=textRectangle(item,text.styles);if(!rect){vertical=true;continue;}if(nearTrim(rect,trim,settings.margin,unit)){nearCount++;if(nearCount<=12)add('margin','warning','Text is close to the cutting edge',`“${item.str.slice(0,100)}” may sit within ${settings.margin} mm of the trim edge. Move important text inward. Text bounds are estimated; inspect the highlighted area.`,number,rect);}}
   if(nearCount>12)add('margin','warning',`${nearCount-12} more text spans near the edge`,'Several spans are outside the selected safety margin. Review all page edges before export.',number);
   if(!textItems.length)add('margin','manual','No selectable text for the margin check',settings.ocr?'See the separate OCR findings for estimated image-text bounds. Text recognition can miss words, so inspect the edges visually.':'Enable English OCR to attempt image-text bounds, or review the margins visually.',number);
   else if(!nearCount)add('margin','pass','Selectable text is inside the safety margin',`Checked ${textItems.length} text span${textItems.length===1?'':'s'} against the ${settings.margin} mm margin. Text embedded in pictures or converted to shapes is not included.`,number);
   if(vertical)add('margin','manual','Vertical text needs a visual check','The margin checker does not measure vertical writing.',number);
   const ops=await page.getOperatorList();
   let matrix=[1,0,0,1,0,0],stack=[],images=0,unsupported=0,low=0;
   const inspectImage=(w,h,m)=>{if(!w||!h){unsupported++;return;}images++;const dpi=imageDpi(w,h,m,unit);if(dpi!==null&&dpi<settings.dpi){low++;if(low<=12){const pts=[[0,0],[1,0],[0,1],[1,1]].map(([x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]]);const rect=[Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1])),Math.max(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[1]))];add('resolution','warning',`Image is approximately ${Math.round(dpi)} DPI`,`${w} × ${h} pixels at its placed size; your target is ${settings.dpi} DPI. Use a higher-resolution original or print it smaller. Compression and sharpness still need visual review.`,number,rect);}}};
   for(let i=0;i<ops.fnArray.length;i++){
    const fn=ops.fnArray[i],args=ops.argsArray[i],O=pdfjs.OPS;
    if(fn===O.save)stack.push([...matrix]);
    else if(fn===O.restore)matrix=stack.pop()||[1,0,0,1,0,0];
    else if(fn===O.transform)matrix=multiply(matrix,args);
    else if(fn===O.paintFormXObjectBegin){stack.push([...matrix]);if(args[0])matrix=multiply(matrix,args[0]);}
    else if(fn===O.paintFormXObjectEnd)matrix=stack.pop()||[1,0,0,1,0,0];
    else if(fn===O.paintImageXObject)inspectImage(args[1],args[2],matrix);
    else if(fn===O.paintInlineImageXObject)inspectImage(args[0].width,args[0].height,matrix);
    else if(fn===O.paintImageXObjectRepeat){let img;try{img=(args[0].startsWith('g_')?page.commonObjs:page.objs).get(args[0]);}catch{}for(let j=0;j<args[3].length;j+=2)inspectImage(img?.width,img?.height,multiply(matrix,[args[1],0,0,args[2],args[3][j],args[3][j+1]]));}
    else if(fn===O.paintInlineImageXObjectGroup){for(const entry of args[1])inspectImage(entry.w,entry.h,multiply(matrix,entry.transform));}
    else if([O.paintImageMaskXObject,O.paintImageMaskXObjectGroup,O.paintImageMaskXObjectRepeat].includes(fn))unsupported++;
   }
   if(low>12)add('resolution','warning',`${low-12} more low-resolution image placements`,'Review all raster artwork on this page.',number);
   if(!images)add('resolution','info','No measurable raster images found','Vector artwork does not have a pixel resolution. This is not an assessment of visual sharpness.',number);
   else if(!low)add('resolution','pass',`${images} image placement${images===1?' meets':'s meet'} the resolution target`,`Measured at the current PDF size against ${settings.dpi} DPI. Enlarging the file later reduces effective resolution.`,number);
   if(unsupported)add('resolution','manual','Some image content needs manual review','Image masks or unmeasurable image operations were present. These were not included in the resolution check.',number);
   const dates=inspectDates(pageText);
   for(const date of dates){const dateItem=textItems.find(item=>item.str.includes(date.text));const dateRect=dateItem?textRectangle(dateItem,text.styles):null;if(date.ambiguous)add('dates','manual','Confirm the numeric date format',`“${date.text}” needs a human check. Day/month order can be ambiguous. Write the month in words when possible.`,number);else if(!date.valid)add('dates','warning','This date is not valid',`“${date.text}” is not a valid calendar date. Correct it in the original artwork.`,number,dateRect);else if(date.mismatch)add('dates','warning','The weekday and date disagree',`“${date.text}” falls on ${date.weekday}. Confirm whether the date or weekday should change.`,number,dateRect);else add('dates','info','Calendar date found',`“${date.text}” is a valid calendar date. Confirm it is the intended date; validity does not establish correctness.`,number);}
   if(!dates.length)add('dates','manual','Confirm dates and event details',settings.ocr?'No supported date pattern was found in selectable text. See separate OCR date findings and compare the artwork with your approved details.':'No supported date pattern was found in selectable text. Enable English OCR for image text, or review dates manually.',number);
   const codes=[];
   const image=ctx.getImageData(0,0,canvas.width,canvas.height);
   for(let attempt=0;attempt<6;attempt++){
    const code=globalThis.jsQR(image.data,image.width,image.height,{inversionAttempts:'attemptBoth'});if(!code)break;
    const pts=[code.location.topLeftCorner,code.location.topRightCorner,code.location.bottomLeftCorner,code.location.bottomRightCorner];
    const minX=Math.max(0,Math.floor(Math.min(...pts.map(p=>p.x)))-5),maxX=Math.min(image.width,Math.ceil(Math.max(...pts.map(p=>p.x)))+5),minY=Math.max(0,Math.floor(Math.min(...pts.map(p=>p.y)))-5),maxY=Math.min(image.height,Math.ceil(Math.max(...pts.map(p=>p.y)))+5);
    codes.push({data:code.data,url:safeHttpUrl(code.data)});
    for(let y=minY;y<maxY;y++)for(let x=minX;x<maxX;x++){const j=(y*image.width+x)*4;image.data[j]=image.data[j+1]=image.data[j+2]=image.data[j+3]=255;}
   }
   if(codes.length)add('qr','manual',`${codes.length} QR code${codes.length===1?'':'s'} decoded`,'The code is readable in this digital preview. Its destination has not been checked. Open it below, confirm the content, and scan a printed proof with your phone.',number);
   else add('qr','manual','No QR code detected','This does not prove there is no QR code. Small, stylised or low-contrast codes may be missed. If the page has one, test the original and a printed proof.',number);
   const links=(await page.getAnnotations()).filter(a=>a.subtype==='Link'&&(a.url||a.unsafeUrl)).map(a=>({data:a.url||a.unsafeUrl,url:safeHttpUrl(a.url||a.unsafeUrl)}));
   const advancedResult=await advanced.page({pdf:boxes,raw,canvas,textItems,styles:text.styles,nativeText:pageText,viewport:renderViewport,trim,unit,number,progress:label=>onProgress((index+.5)/document.numPages*100,label)});
   const thumbnail=canvas.toDataURL('image/jpeg',.86);
   pages.push({number,width,height,preview:thumbnail,previewWidth:canvas.width,previewHeight:canvas.height,text:pageText.slice(0,30000),ocrText:advancedResult.ocrText.slice(0,30000),codes,links,dates,viewTransform:renderViewport.transform});
   canvas.width=canvas.height=1;
   page.cleanup();
  }
  const unique=[...new Set(pages.flatMap(p=>p.dates.filter(d=>d.valid).map(d=>d.date)))];
  if(unique.length>1)add('dates','manual','More than one calendar date appears',`${unique.join(', ')}. These may be intentional, such as an RSVP deadline and an event date. Confirm each against your source details.`,null);
  advanced.finish();
  return {pages,findings,settings,checkedAt:new Date().toISOString()};
 }catch(error){if(signal.aborted)throw new Error('Check cancelled.');if(error.name==='PasswordException'||/encrypted/i.test(error.message))throw new Error('This PDF is password-protected. Export an unlocked copy and try again.');if(error.name==='InvalidPDFException')throw new Error('This file could not be read as a PDF. Export a fresh PDF from your design app.');throw error;}
 finally{signal.removeEventListener('abort',abort);await advanced.dispose();await task.destroy();}
}
function documentCanvas(width,height){const canvas=globalThis.document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas;}
