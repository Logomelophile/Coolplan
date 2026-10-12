export const STORY_STEPS = [
  { title:'Light Natural Oak',eyebrow:'01 / 06 · THE COLLECTION',description:'ความอบอุ่นที่เป็นธรรมชาติ ให้ทุกมุมบ้านน่าอยู่',finish:0 },
  { title:'Warm Oak',eyebrow:'02 / 06 · THE COLLECTION',description:'โทนโอ๊คอบอุ่น เติมบรรยากาศนุ่มนวลให้พื้นที่',finish:1 },
  { title:'Honey Oak',eyebrow:'03 / 06 · THE COLLECTION',description:'ประกายไม้สีน้ำผึ้ง รับแสงอย่างเป็นธรรมชาติ',finish:2 },
  { title:'Classic Oak',eyebrow:'04 / 06 · THE COLLECTION',description:'เรียบ สว่าง และเข้ากับการตกแต่งได้หลากหลาย',finish:3 },
  { title:'Grey Oak',eyebrow:'05 / 06 · THE COLLECTION',description:'โทนเทาที่สงบ สำหรับพื้นที่ร่วมสมัย',finish:4 },
  { title:'Walnut Brown',eyebrow:'06 / 06 · THE COLLECTION',description:'น้ำตาลเข้มมีมิติ ให้ลายไม้เป็นจุดเด่นของห้อง',finish:5 },
  { title:'เล็กในความหนา\nมากในรายละเอียด',eyebrow:'INSIDE EVERY PLANK',description:'ความหนารวม 5 มม. จากโครงสร้าง 4 ชั้นที่ทำงานร่วมกัน',finish:5 },
  { title:'เริ่มต้นที่ผิวสัมผัส',eyebrow:'01 / 04 · WEAR LAYER',description:'ชั้นเคลือบใสอยู่เหนือฟิล์มลวดลาย เพื่อปกป้องผิวสัมผัส',finish:5 },
  { title:'ลายไม้ที่เป็นตัวคุณ',eyebrow:'02 / 04 · DECOR FILM',description:'ฟิล์มตกแต่งถ่ายทอดสีและรายละเอียดของลายไม้',finish:5 },
  { title:'แข็งแรงจากข้างใน',eyebrow:'03 / 04 · SPC CORE',description:'แกนกลางวัสดุผสมหินและพลาสติก ให้โครงสร้างแผ่นพื้น',finish:5 },
  { title:'ใส่ใจทุกก้าว',eyebrow:'04 / 04 · IXPE BACKING',description:'ชั้นรองพื้นอยู่ด้านล่าง ช่วยรองรับการสัมผัสกับพื้นเดิม',finish:5 },
  { title:'ทุกชั้น เพื่อทุกวันของคุณ',eyebrow:'4 LAYERS · ONE COMPLETE FLOOR',description:'สำรวจครบแล้ว เลื่อนต่อเพื่อเลือกสีและลองพื้นในห้องของคุณ',finish:5 },
] as const;
export const STORY_END=11.75;
export const STORY_UNIT=.78;
const clamp=(n:number,a=0,b=1)=>Math.max(a,Math.min(b,n));
const smooth=(n:number)=>{const t=clamp(n);return t*t*(3-2*t);};
export function sampleStory(value:number){
  const progress=Number.isFinite(value)?clamp(value,0,STORY_END):0;
  const colorPosition=Math.min(5,progress),from=Math.floor(colorPosition),to=Math.min(5,from+1);
  const mix=smooth((colorPosition-from-.18)/.66);
  const step=Math.min(11,Math.floor(progress+.08));
  const detail=smooth((progress-5.25)/.95);
  const explode=progress<6 ? .22*(1-smooth((progress-5.3)/.7)) : smooth((progress-6.2)/3.5);
  const labelsVisible=[7,8,9,10].map(start=>smooth((progress-start+.4)/.4));
  return {progress,step,from,to,mix,finishIndex:mix>=.5?to:from,detail,zoom:detail,profile:smooth((progress-5.35)/.65)*(1-smooth((progress-6.35)/.65)),explode,explosion:explode,focus:progress>=7&&progress<10.75?Math.min(3,Math.floor(progress)-7):-1,labelsVisible,thickness:smooth((progress-5.75)/.25),intro:1-smooth(progress/.55),complete:progress>=11};
}
