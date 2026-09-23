import {test} from 'node:test';
import assert from 'node:assert/strict';
import {imageDpi,multiply,boxMargins,MM,sizeMatches,inspectDates,safeHttpUrl,escapeHtml,textRectangle,nearTrim} from '../dist/checks.js';
test('effective DPI respects physical placement, rotation and UserUnit',()=>{
 assert.equal(imageDpi(600,600,[144,0,0,144,0,0]),300);
 assert.equal(imageDpi(600,600,[0,144,-144,0,0,0]),300);
 assert.equal(imageDpi(600,600,[144,0,0,144,0,0],2),150);
 assert.equal(imageDpi(96,96,[100,0,0,100,0,0]),69.12);
 assert.equal(imageDpi(96,96,[0,0,0,0,0,0]),null);
 assert.deepEqual(multiply([2,0,0,2,10,10],[100,0,0,100,5,5]),[200,0,0,200,20,20]);
});
test('bleed is bounded by actual media and size accepts rotated equivalent',()=>{
 const trim={x:3*MM,y:3*MM,width:100*MM,height:100*MM},box={x:0,y:0,width:106*MM,height:106*MM};
 assert.ok(boxMargins(trim,box,box).every(v=>Math.abs(v-3)<.001));
 assert.ok(boxMargins(trim,box,trim).every(v=>Math.abs(v)<.001));
 assert.ok(sizeMatches([297,210],[210,297]));assert.ok(!sizeMatches([200,297],[210,297]));
});
test('dates flag wrong weekdays and impossible dates without assuming numeric locale',()=>{
 assert.equal(inspectDates('Friday, 26 September 2026')[0].mismatch,true);
 assert.equal(inspectDates('Saturday, 26 September 2026')[0].mismatch,false);
 assert.equal(inspectDates('31 February 2026')[0].valid,false);
 assert.equal(inspectDates('29 Feb 2024')[0].valid,true);
 assert.equal(inspectDates('29 Feb 2025')[0].valid,false);
 assert.equal(inspectDates('04/05/2026')[0].ambiguous,true);
});
test('PDF text and QR content cannot inject markup or executable URLs',()=>{
 assert.equal(safeHttpUrl('javascript:alert(1)'),null);assert.equal(safeHttpUrl('data:text/html,hello'),null);assert.equal(safeHttpUrl('https://user:pass@example.com'),null);
 assert.equal(safeHttpUrl('https://example.com'), 'https://example.com/');
 assert.equal(escapeHtml('<script>"x"</script>'),'&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
});
test('text safety detects bottom text and handles rotated spans',()=>{
 const trim={x:0,y:0,width:360,height:504};
 const rect=textRectangle({transform:[8,0,0,8,50,2],width:200,fontName:'font'},{});
 assert.ok(nearTrim(rect,trim,3));
 assert.ok(!nearTrim(textRectangle({transform:[12,0,0,12,50,100],width:200,fontName:'font'},{}),trim,3));
 const rotated=textRectangle({transform:[0,10,-10,0,100,100],width:50,fontName:'font'},{});
 assert.ok(rotated[3]>=150);
 assert.equal(textRectangle({transform:[1,0,0,1,0,0],width:5,fontName:'v'},{v:{vertical:true}}),null);
});
