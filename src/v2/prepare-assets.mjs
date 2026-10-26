import { createRequire } from 'node:module';
import { stat } from 'node:fs/promises';
// Optional maintenance utility: install sharp locally, or point this variable at
// a resolver file beneath a Node runtime whose node_modules contains sharp.
const require=createRequire(process.env.COOLPLAN_SHARP_RESOLVER || import.meta.url);
const sharp=require('sharp');
await sharp('public/room/references/room-original.png').resize({width:1672,withoutEnlargement:true}).webp({quality:87,effort:6}).toFile('public/v2/assets/room-hero.webp');
await sharp('public/room/references/room-original.png').resize({width:780,withoutEnlargement:true}).webp({quality:85,effort:6}).toFile('public/v2/assets/room-mobile.webp');
const patches=[[1,[46,115,186,791]],[7,[91,135,178,900]],[5,[78,122,174,660]],[2,[77,144,166,731]],[6,[90,137,147,697]],[3,[81,122,185,826]]];
for(let i=0;i<patches.length;i++){
 const [id,[left,top,width,height]]=patches[i];
 await sharp(`public/website/assets/material-${id}.jpg`).extract({left,top,width,height}).webp({quality:90,effort:6}).toFile(`public/v2/assets/finish-${i+1}.webp`);
}
for(const file of ['room-hero.webp','room-mobile.webp',...patches.map((_,i)=>`finish-${i+1}.webp`)])console.log(file,(await stat(`public/v2/assets/${file}`)).size);
