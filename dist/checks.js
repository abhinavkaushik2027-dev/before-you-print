export const MM=72/25.4;
export function multiply(a,b){return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
export function imageDpi(width,height,matrix,userUnit=1){const w=Math.hypot(matrix[0],matrix[1])*userUnit,h=Math.hypot(matrix[2],matrix[3])*userUnit;return w>0&&h>0?Math.min(width*72/w,height*72/h):null;}
export function boxMargins(trim,bleed,media){return [trim.x-Math.max(bleed.x,media.x),trim.y-Math.max(bleed.y,media.y),Math.min(bleed.x+bleed.width,media.x+media.width)-trim.x-trim.width,Math.min(bleed.y+bleed.height,media.y+media.height)-trim.y-trim.height].map(v=>v/MM);}
export function sizeMatches(actual,expected,tolerance=1){return (Math.abs(actual[0]-expected[0])<=tolerance&&Math.abs(actual[1]-expected[1])<=tolerance)||(Math.abs(actual[0]-expected[1])<=tolerance&&Math.abs(actual[1]-expected[0])<=tolerance);}
export function safeHttpUrl(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
export function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const MONTHS=['january','february','march','april','may','june','july','august','september','october','november','december'];
const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export function inspectDates(text){
 const result=[];
 const re=/\b(?:(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sun|Mon|Tue|Wed|Thu|Fri|Sat)[\s,]+)?(\d{1,2})(?:st|nd|rd|th)?[\s./-]+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[\s,./-]+(20\d{2})\b/gi;
 for(const m of text.matchAll(re)){const month=MONTHS.findIndex(v=>v.startsWith(m[3].toLowerCase().slice(0,3)));const d=new Date(Date.UTC(+m[4],month,+m[2]));const valid=d.getUTCFullYear()===+m[4]&&d.getUTCMonth()===month&&d.getUTCDate()===+m[2];const weekday=DAYS[d.getUTCDay()];const mismatch=valid&&m[1]&&!weekday.toLowerCase().startsWith(m[1].toLowerCase().slice(0,3));result.push({text:m[0],valid,weekday,mismatch:!!mismatch,date:`${m[4]}-${String(month+1).padStart(2,'0')}-${m[2].padStart(2,'0')}`});}
 const monthFirst=/\b(?:(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sun|Mon|Tue|Wed|Thu|Fri|Sat)[\s,]+)?(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})(?:st|nd|rd|th)?[\s,]+(20\d{2})\b/gi;
 for(const m of text.matchAll(monthFirst)){const month=MONTHS.findIndex(v=>v.startsWith(m[2].toLowerCase().slice(0,3)));const d=new Date(Date.UTC(+m[4],month,+m[3]));const valid=d.getUTCFullYear()===+m[4]&&d.getUTCMonth()===month&&d.getUTCDate()===+m[3];const weekday=DAYS[d.getUTCDay()];const mismatch=valid&&m[1]&&!weekday.toLowerCase().startsWith(m[1].toLowerCase().slice(0,3));result.push({text:m[0],valid,weekday,mismatch:!!mismatch,date:`${m[4]}-${String(month+1).padStart(2,'0')}-${m[3].padStart(2,'0')}`});}
 const numeric=/\b\d{1,2}[/-]\d{1,2}[/-](?:20)?\d{2}\b/g;
 for(const m of text.matchAll(numeric)) result.push({text:m[0],ambiguous:true});
 return result;
}
export function textRectangle(item,styles){
 const [a,b,c,d,x,y]=item.transform;const height=Math.hypot(c,d)||item.height||Math.hypot(a,b);const angle=Math.atan2(b,a);const style=styles[item.fontName]||{};
 if(style.vertical)return null;
 const ascent=typeof style.ascent==='number'?style.ascent:.85;const descent=typeof style.descent==='number'?style.descent:-.2;
 const ux=Math.cos(angle),uy=Math.sin(angle),vx=-uy,vy=ux;
 const points=[0,item.width].flatMap(w=>[descent,ascent].map(h=>[x+ux*w+vx*h*height,y+uy*w+vy*h*height]));
 return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
}
export function nearTrim(rect,trim,margin,userUnit=1){if(!rect)return false;const safe=margin*MM/userUnit;return rect[0]<trim.x+safe||rect[1]<trim.y+safe||rect[2]>trim.x+trim.width-safe||rect[3]>trim.y+trim.height-safe;}
