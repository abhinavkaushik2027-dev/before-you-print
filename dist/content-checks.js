import {inspectDates} from './checks.js';
export const normalizeText=s=>String(s).normalize('NFKC').toLocaleLowerCase('en-GB').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
export function editDistance(a,b){const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const next=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=next;}}return row[b.length];}
export function comparePhrase(expected,nativeText,ocrText=''){
 const target=normalizeText(expected),native=normalizeText(nativeText),ocr=normalizeText(ocrText);
 if(!target)return {status:'empty'};
 const includes=s=>(' '+s+' ').includes(' '+target+' ');
 if(includes(native))return {status:'match',source:'PDF text'};
 if(includes(ocr))return {status:'ocr-match',source:'OCR'};
 let closest='',best=1;const length=target.split(' ').length;
 for(const source of [native,ocr]){const words=source.split(' ').slice(0,12000);for(let i=0;i<=words.length-length;i++){const candidate=words.slice(i,i+length).join(' ');if(Math.abs(candidate.length-target.length)>Math.max(3,target.length*.25))continue;const score=editDistance(candidate,target)/Math.max(candidate.length,target.length);if(score<best){best=score;closest=candidate;}}}
 return {status:'missing',closest:best<=.3?closest:null};
}
export function expectedDateResult(expected,nativeText,ocrText=''){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(expected||''))return {status:'empty'};
 const direct=inspectDates(nativeText).filter(d=>d.valid),ocr=inspectDates(ocrText).filter(d=>d.valid);
 if(direct.some(d=>d.date===expected)||nativeText.includes(expected))return {status:'match'};
 if(ocr.some(d=>d.date===expected)||ocrText.includes(expected))return {status:'ocr-match'};
 const [y,m,d]=expected.split('-').map(Number),numeric=[`${d}/${m}/${y}`,`${m}/${d}/${y}`,`${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`,`${String(m).padStart(2,'0')}/${String(d).padStart(2,'0')}/${y}`];
 if(numeric.some(s=>(nativeText+' '+ocrText).replace(/-/g,'/').includes(s)))return {status:'ambiguous'};
 return {status:'missing',found:[...new Set([...direct,...ocr].map(v=>v.date))]};
}
export function spellingCandidates(text,dictionary,allowed=[]){
 const ignore=new Set(['rsvp','pdf','dpi','qr','www','https','http','com','gmail',...allowed.flatMap(s=>normalizeText(s).split(' '))]);
 const source=text.replace(/https?:\/\/\S+|\b\S+@\S+\.\S+\b/g,' '),seen=new Set(),results=[];
 for(const match of source.matchAll(/\b[A-Za-z][A-Za-z’'-]{2,39}\b/g)){const word=match[0].replace(/’/g,"'"),lower=word.toLowerCase();if(seen.has(lower)||ignore.has(lower)||(/^[A-Z]{2,5}$/.test(word)))continue;seen.add(lower);if(dictionary.correct(word)||dictionary.correct(lower))continue;results.push({word,suggestions:dictionary.suggest(lower).slice(0,3)});if(results.length>=15)break;}
 return results;
}
