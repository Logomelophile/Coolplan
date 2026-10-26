# COOLPLAN — ทำงานต่อบนเครื่องใหม่

อัปเดตส่งต่องาน: **26 ตุลาคม 2026**

Repository: https://github.com/Logomelophile/Coolplan (private)
Branch หลัก: `main`
เว็บไซต์ที่เผยแพร่: https://coolplan-material-studio.vitethap-n.chatgpt.site/website/

## 1. เตรียมเครื่องและ clone

ใช้ Git และ Node.js **22.12 ขึ้นไป** พร้อม npm โดย `.nvmrc` กำหนด Node 24 ตรวจได้ด้วย `git --version`, `node --version` และ `npm --version` ใช้ Terminal, PowerShell, VS Code หรือ Codex ได้

```sh
git clone https://github.com/Logomelophile/Coolplan.git
cd Coolplan
npm ci
npm run dev:website
```

Repository เป็น private จึงต้องลงชื่อเข้าใช้บัญชี GitHub ที่มีสิทธิ์ อ่าน/เขียนตามงานที่ต้องการ สามารถ clone ผ่าน GitHub Desktop ได้เช่นกัน โดยเลือก repository นี้แล้วเปิด terminal ในโฟลเดอร์ที่ clone มา

โปรเจกต์อยู่ที่ราก `Coolplan/` ไม่ต้องเข้าโฟลเดอร์ `spc-plank-viewer` ซ้ำ และไม่ต้องมีไฟล์จาก Dropbox ของเครื่องเดิม ไฟล์ที่ V1 ใช้งาน ภาพบุคคล ภาพห้อง ภาพวัสดุ และฟอนต์อยู่ใน repository แล้ว

ถ้า PowerShell บล็อก `npm.ps1` ให้ใช้ `npm.cmd ci` และ `npm.cmd run dev:website` หรือเปิด Command Prompt ไม่จำเป็นต้องเปลี่ยนนโยบายทั้งเครื่อง

## 2. เปิดหน้า local

Vite แสดง URL ของเครื่องนี้ ค่าเริ่มต้นคือ `http://127.0.0.1:5173` หากพอร์ตไม่ว่างให้ใช้พอร์ตที่แสดงจริง

| URL หลังพอร์ต | หน้าที่ |
| --- | --- |
| `/website/` | เว็บไซต์ V1 หลักและ Motion Scrolling |
| `/calculator/` | เครื่องคำนวณและใบประมาณราคา |
| `/ceo/` | CEO และ Next Gen ต่อกันในหน้าเดียว |
| `/ceo/#next-gen` | ข้ามไปยังเนื้อหาคะน้า |
| `/next-gen/` | เปลี่ยนทางไปส่วน Next Gen บนหน้า CEO |
| `/` | Material Studio ดั้งเดิม |
| `/room/` | Room Motion ห้อง 3D |
| `/v2/` | V2 ทดลอง ยังไม่ต่อ Spline export |

`npm run dev` ใช้เซิร์ฟเวอร์เดียวกันโดยไม่เปิด browser ให้อัตโนมัติ แก้ไฟล์แล้ว Vite จะอัปเดตหน้าให้ หยุดด้วย `Ctrl+C` ไม่ควรเปิดหน้าแอป ES module ด้วย `file://`; ให้ใช้ local HTTP server นี้

## 3. จุดแก้ไขสำคัญ

| ไฟล์/โฟลเดอร์ | งาน |
| --- | --- |
| `website/index.html`, `src/website/home.css` | เนื้อหาและหน้าตา V1 |
| `src/website/main.ts` | เลือกสี ห้อง และการทำงานหน้าแรก |
| `src/website/FloorScrollStory.ts`, `storyTimeline.ts`, `story.css` | เรื่องราวเลื่อน 12 ขั้น |
| `src/website/FloorStoryScene.ts`, `HeroRoomFloor.ts` | ชิ้น 3D และเปลี่ยนสีเฉพาะพื้นในภาพห้อง |
| `ceo/index.html` | เนื้อหา CEO และ Next Gen ทั้งหมด |
| `src/website/ceo.css`, `next-gen.css`, `ceo.ts` | รูปแบบและการเริ่มหน้า CEO รวม |
| `next-gen/index.html`, `src/website/next-gen.ts` | ลิงก์เก่าที่เปลี่ยนทางไปหน้า CEO |
| `src/website/shared.ts`, `shared.css` | เมนู footer ข้อมูลติดต่อ และ dialog |
| `calculator/index.html`, `src/website/calculator.ts`, `calculator.css` | ราคาและแบบฟอร์มประมาณราคา |
| `src/room/`, `room/index.html` | เดโมห้อง Three.js |
| `src/data/products.json`, `src/SPCPlankViewer.ts` | ข้อมูลและ viewer แผ่นพื้นดั้งเดิม |
| `public/website/assets/`, `public/room/references/` | ภาพและฟอนต์ที่ใช้รันจริง |
| `v2/`, `src/v2/`, `public/v2/` | งาน V2 ทดลอง เก็บแยกจาก V1 |
| `deliverables/coolplan-v2-preview.html` | แบบร่าง V2 ไฟล์เดียว ไม่ใช่ Spline runtime |

ผู้ติดต่อ: **คุณคะน้า · 0846707551 · coolplanworkshop@gmail.com** โทรศัพท์/อีเมลอยู่ทั้งในส่วนร่วม เครื่องคำนวณ และ metadata จึงควรค้นทั้งโปรเจกต์เมื่อเปลี่ยนข้อมูล

## 4. ตรวจงานก่อนส่งกลับ

```sh
npm test
npm run build:site
npm run preview:site -- --port 5185 --strictPort
```

เปิด `http://127.0.0.1:5185/website/` และ `/ceo/#next-gen` เพื่อตรวจผล build จริง ตรวจเมนู รูป ปุ่มติดต่อ เครื่องคำนวณ และมือถือ ผลรวมพร้อมโฮสต์อยู่ใน `site-dist/` สร้างใหม่ได้จากซอร์ส จึงไม่ต้อง commit build หรือ `node_modules/`

Build แยกยังใช้ได้: `npm run build` (library + Studio), `npm run build:room`, `npm run build:website` และ `npm run build:v2` โดย V2 ไม่รวมใน build V1

Browser integration checks เป็นขั้นเสริม ใช้ Chrome ผ่าน Playwright และเซิร์ฟเวอร์ที่รันอยู่ ตัวอย่างสำหรับเว็บไซต์ที่ preview บนพอร์ต 5185:

```sh
npm run test:website
npm run test:story
```

URL เริ่มต้นของสองชุดนี้คือ `http://127.0.0.1:5185/website/` เปลี่ยนได้ผ่าน `SPC_WEBSITE_URL` รายงานและภาพอยู่ใน `test-results/` ซึ่งไม่ติด Git

## 5. รับและส่งงานด้วย Git

ก่อนเริ่มงาน ตรวจสถานะและดึงงานล่าสุด:

```sh
git status
git pull --ff-only
```

หากมีงานค้าง ให้ commit งานของตนก่อนดึง หาก Git แจ้ง branch แยกทาง ให้ตรวจ commit และแก้ merge/rebase อย่างตั้งใจ ห้ามใช้ force push เพื่อทับงานอีกเครื่อง

เมื่อ `package-lock.json` เปลี่ยน ให้รัน `npm ci` ใหม่ หลังแก้และตรวจงานแล้ว ให้เลือกไฟล์ที่เปลี่ยนจริง ตัวอย่าง:

```sh
git diff
git add ceo/index.html src/website/ceo.css
git commit -m "Update CEO and Next Gen content"
git push origin main
```

เปลี่ยนรายการหลัง `git add` ให้ตรงงานของตน ตรวจไฟล์ที่จัดเตรียมด้วย `git diff --cached --stat` ก่อน commit หากทำหลายเครื่อง ให้ pull ก่อนเริ่มและ push หลังจบแต่ละช่วงงาน

## 6. ขอบเขตและสถานะที่ต้องรักษา

- V1 ทำงานใน browser ไม่ต้องมี API key, ฐานข้อมูล, Spline, Codex หรือ Dropbox เพื่อรัน local การติดตั้ง dependencies ครั้งแรกต้องใช้อินเทอร์เน็ต
- CEO และ Next Gen อยู่หน้าเดียวกัน โดย Next Gen อยู่ด้านล่าง การแก้เนื้อหาคะน้าทำใน `ceo/index.html`
- เรื่องราว 20 ปีมาจากผู้ใช้ ส่วนแนวทางของคะน้าเป็นความตั้งใจของแบรนด์ ไม่ใช่คำรับประกันผลลัพธ์
- หน้าแรกใช้ภาพห้องพร้อม mask และชิ้นแผ่นพื้น WebGL; `/room/` คือห้อง geometry 3D แยกต่างหาก
- 5 MM ในหน้าแรกเป็นชิ้นตัวอย่างอธิบายโครงสร้าง Material Studio เดิมมีข้อมูล 5.3 มม. ของตน อย่าสลับความหมายโดยไม่ยืนยันข้อมูลผลิตภัณฑ์
- V2 ยังไม่เชื่อม Spline export จริง URL ใน config ยังว่าง ดู `docs/v2-handoff.md` ก่อนทำต่อ งานร่างยังเก็บไว้ครบ แต่ไม่รวมในเว็บ V1 ที่เผยแพร่
- รูปอัปโหลดทดลองห้องประมวลผลใน browser ไม่มีฐานข้อมูลรับลูกค้าหรือระบบส่งอีเมลอัตโนมัติ ปุ่มอีเมลเปิดฉบับร่างในแอปของผู้ใช้

## 7. GitHub กับเว็บไซต์ที่เผยแพร่

GitHub เก็บซอร์สและประวัติสำหรับทำงานข้ามเครื่อง **push เข้า GitHub ไม่ได้เปลี่ยนเว็บไซต์ Sites ที่ออนไลน์อยู่โดยอัตโนมัติ** หากต้องการอัปเดตเว็บจริง ให้ build และใช้ขั้นตอนเผยแพร่ Sites ของ project เดิม พร้อมคงเส้นทางและ assets เดิม

URL ปัจจุบัน: https://coolplan-material-studio.vitethap-n.chatgpt.site
Site project ID (ข้อมูลระบุตัวตน ไม่ใช่ credential): `appgprj_6acca5096d108191816721f8af6a6d7e`

ผล `site-dist/` ใช้ URL จากรากโดเมน จึงต้องเสิร์ฟที่รากของ host; การนำไปวางใต้ path เช่น GitHub Pages `/Coolplan/` ต้องปรับ routing/assets ก่อน ห้ามนำ token หรือ credential การเผยแพร่ลง repository

ซอร์สใช้ MIT ภาพบุคคล ภาพห้อง และเอกสารอ้างอิงของผู้ใช้ไม่ถูกเปลี่ยนเป็น MIT ฟอนต์และ dependencies คง license ของตนตามไฟล์ notices ที่แนบ
