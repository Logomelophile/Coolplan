/** Product indices (the `floors` order in main.ts) shown as the opening colour stops, in scroll order. */
export const STORY_FINISHES=[0,3,4,5] as const;
export const STORY_STEPS = [
  { title:'Light Natural Oak',eyebrow:'01 / 04 · THE COLLECTION',description:'ความอบอุ่นที่เป็นธรรมชาติ ให้ทุกมุมบ้านน่าอยู่',finish:0 },
  { title:'Classic Oak',eyebrow:'02 / 04 · THE COLLECTION',description:'เรียบ สว่าง และเข้ากับการตกแต่งได้หลากหลาย',finish:3 },
  { title:'Grey Oak',eyebrow:'03 / 04 · THE COLLECTION',description:'โทนเทาที่สงบ สำหรับพื้นที่ร่วมสมัย',finish:4 },
  { title:'Walnut Brown',eyebrow:'04 / 04 · THE COLLECTION',description:'น้ำตาลเข้มมีมิติ ให้ลายไม้เป็นจุดเด่นของห้อง',finish:5 },
  { title:'เล็กในความหนา\nมากในรายละเอียด',eyebrow:'INSIDE EVERY PLANK',description:'ความหนารวม 5 มม. จากโครงสร้าง 4 ชั้นที่ทำงานร่วมกัน',finish:5 },
  { title:'เริ่มต้นที่ผิวสัมผัส',eyebrow:'01 / 04 · WEAR LAYER',description:'ชั้นเคลือบใสอยู่เหนือฟิล์มลวดลาย เพื่อปกป้องผิวสัมผัส',finish:5 },
  { title:'ลายไม้ที่เป็นตัวคุณ',eyebrow:'02 / 04 · DECOR FILM',description:'ฟิล์มตกแต่งถ่ายทอดสีและรายละเอียดของลายไม้',finish:5 },
  { title:'แข็งแรงจากข้างใน',eyebrow:'03 / 04 · SPC CORE',description:'แกนกลางวัสดุผสมหินและพลาสติก ให้โครงสร้างแผ่นพื้น',finish:5 },
  { title:'ใส่ใจทุกก้าว',eyebrow:'04 / 04 · IXPE BACKING',description:'ชั้นรองพื้นอยู่ด้านล่าง ช่วยรองรับการสัมผัสกับพื้นเดิม',finish:5 },
  { title:'ทุกชั้น เพื่อทุกวันของคุณ',eyebrow:'4 LAYERS · ONE COMPLETE FLOOR',description:'สำรวจครบแล้ว เลื่อนต่อเพื่อเลือกสีและลองพื้นในห้องของคุณ',finish:5 },
] as const;
/** Scroll position of the 5 MM stop: one unit after the last colour stop. The four layer stops follow it. */
export const DETAIL_STOP=STORY_FINISHES.length;
export const STORY_LAST=STORY_STEPS.length-1;
export const STORY_END=STORY_LAST+.75;
export const STORY_UNIT=1;
const clamp=(n:number,a=0,b=1)=>Math.max(a,Math.min(b,n));
const smooth=(n:number)=>{const t=clamp(n);return t*t*(3-2*t);};
// Quintic ease: zero velocity and acceleration at both ends, so camera moves start and settle without a kick.
const smoother=(n:number)=>{const t=clamp(n);if(t<1e-9)return 0;if(t>1-1e-9)return 1;return t*t*t*(t*(t*6-15)+10);};
export function sampleStory(value:number){
  const progress=Number.isFinite(value)?clamp(value,0,STORY_END):0;
  const colorPosition=Math.min(DETAIL_STOP-1,progress),stop=Math.floor(colorPosition);
  const from:number=STORY_FINISHES[stop],to:number=STORY_FINISHES[Math.min(DETAIL_STOP-1,stop+1)];
  const mix=smooth((colorPosition-stop-.18)/.66);
  const step=Math.min(STORY_LAST,Math.floor(progress+.08));
  const d=DETAIL_STOP;
  // The enlargement uses the whole scroll between the last finish stop and the 5 MM stop as one continuous move.
  const detail=smoother(progress-(d-1));
  const explode=progress<d ? .22*(1-smoother((progress-(d-1))/.75)) : smoother((progress-(d+.25))/3.5);
  const labelsVisible=[0,1,2,3].map(index=>smooth((progress-(d+1+index)+.4)/.4));
  return {progress,step,from,to,mix,finishIndex:mix>=.5?to:from,detail,zoom:detail,profile:smoother((progress-(d-.8))/.8)*(1-smoother((progress-(d+.25))/.75)),explode,explosion:explode,focus:progress>=d+1&&progress<STORY_LAST-.25?Math.min(3,Math.floor(progress)-(d+1)):-1,labelsVisible,thickness:smoother((progress-(d-.3))/.3),intro:1-smooth(progress/.55),complete:progress>=STORY_LAST};
}
