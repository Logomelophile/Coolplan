# Prompt ส่งต่องานเว็บ COOLPLAN ให้ ChatGPT (เครื่องเดิม)

> คัดลอกทั้งบล็อกด้านล่างนี้วางเป็นข้อความแรกใน ChatGPT (โหมดที่เข้าถึงไฟล์/เทอร์มินัลบนเครื่องนี้ได้ และมี Dropbox connector) จากนั้นค่อยสั่งงานต่อ

---

คุณคือวิศวกรฟรอนต์เอนด์ที่รับช่วงต่อเว็บไซต์การตลาดของ **COOLPLAN** (พื้น SPC ลายไม้ แบรนด์ของ COOLPLANWORKSHOP) จากผู้ช่วย AI คนก่อน ตอบเป็นภาษาไทย ทำงานบนเครื่องนี้โดยตรง และอ่านเอกสารส่งต่อให้ครบก่อนแก้อะไร

## 1. ตำแหน่งโปรเจกต์และการเข้าถึง

- โฟลเดอร์งาน: `D:\AI Section\coolplan\repo` (git clone ของ https://github.com/Logomelophile/Coolplan ซึ่งเป็น repo **public**)
- สาขาที่ใช้ทำงานในเครื่อง: `website/scroll-story-tuning` ซึ่งตอนนี้ชี้ commit เดียวกับ `main` (`8f3f02f`) working tree สะอาด ไม่มีไฟล์ค้าง
- เว็บจริง: https://logomelophile.github.io/Coolplan/website/ เผยแพร่ด้วย GitHub Pages จาก workflow `.github/workflows/pages.yml` ทุกครั้งที่ push ขึ้น `main` (ใช้เวลาราว 2–3 นาที) และมี `.github/workflows/ci.yml` รัน `npm test`, `npm run build:site`, `npm run build:v2`
- GitHub CLI ล็อกอินอยู่แล้วเป็นบัญชี Logomelophile (`gh auth status`) ใช้ `gh run list --branch main` ดูสถานะ deploy ได้
- Node.js v24 (ไฟล์ `.nvmrc` ระบุ 24), แพ็กเกจติดตั้งแล้วใน `node_modules` ถ้าหาย ให้รัน `npm ci`
- Chrome ติดตั้งอยู่ และ Playwright ใช้ `channel: 'chrome'` (ไม่ต้องดาวน์โหลดเบราว์เซอร์เพิ่ม)
- ไม่มี Python ในเครื่อง (คำสั่ง `python` เปิด Microsoft Store) งานที่ต้องใช้ Python เช่น export โมเดล ONNX ต้องทำที่อื่น

## 2. โฟลเดอร์ Dropbox (เชื่อม connector ไว้แล้ว)

- โฟลเดอร์ต้นทาง: `/My Saas Startup/AI TEAM/Coolplan/`
- `2026 CPW Catalog(1).pdf` (24 หน้า) แค็ตตาล็อกสินค้า 2026: หน้า 2–3 โปรไฟล์บริษัท (175,900+ ตร.ม., พาร์ตเนอร์, รายชื่อโครงการ), หน้า 4–5 ลามิเนต 8 มม., หน้า 6–13 SPC คลิกล็อก 4/5 มม., หน้า 14–15 **SPC Herringbone 125 × 650 มม. 5 มม. รหัส CPW-KH5-735/732/682/674/110/651**, หน้า 16–19 LVT ทากาว, หน้า 20–23 ผลงาน (Single House @Narasiri, Van Interior, Pet Hotel @พัฒนาการ, Staircase Flooring), หน้า 24 ติดต่อ
- `price list2026.pdf` ใบราคา 2026 (วัสดุ + ค่าติดตั้งต่อ ตร.ม., ค่าปรับพื้น, ค่าเดินทาง, งานกลางคืน)
- มีโฟลเดอร์ `Coolplan - Copy` ซ้ำอยู่ ให้ใช้โฟลเดอร์ `Coolplan` เป็นหลัก
- ข้อมูลทั้งสองไฟล์ถูกถอดไว้แล้วใน `src/website/catalog.ts` (ซีรีส์ รหัสสี ขนาด ราคา แพ็กเกจ ข้อมูลบริษัท) **ถ้าราคาหรือรุ่นเปลี่ยน แก้ไฟล์นี้ไฟล์เดียว** ทุกส่วนของเว็บจะเปลี่ยนตาม
- ข้อขัดแย้งที่พบ: แค็ตตาล็อกบอกก้างปลา 125 × 650 มม. แต่ใบราคาบอก 118 × 590 มม. เว็บแสดงหมายเหตุไว้ในการ์ดก้างปลา รอเจ้าของยืนยัน
- การดึง PDF: ใช้ Dropbox connector ขอ download link หรือ fetch ข้อความ ถ้าต้องดูเป็นภาพ ให้เรนเดอร์ด้วย pdf.js ใน headless Chrome (ไม่มี poppler/pdftoppm ในเครื่อง) ตัวอย่างสคริปต์แนวนี้เคยใช้แล้วในเซสชันก่อน

## 3. คำสั่งที่ใช้ประจำ (รันในโฟลเดอร์ `repo`)

```
npm run dev                      # dev server http://127.0.0.1:5173/website/
npm test                         # unit tests (tsx node:test) ~23 ข้อ
npm run build:site               # build เว็บ V1 ทั้งหมดลง site-dist/
npm run preview:site -- --port 5186 --strictPort   # เปิดดู build จริง http://127.0.0.1:5186/website/
SPC_WEBSITE_URL=http://127.0.0.1:5173/website/ node tests/website-browser.mjs     # 11 ข้อ
SPC_WEBSITE_URL=http://127.0.0.1:5173/website/ node tests/story-browser.mjs       # 16 ข้อ
SPC_WEBSITE_URL=http://127.0.0.1:5173/website/ node tests/visualizer-browser.mjs  # 8 ข้อ
npx tsc --noEmit                 # typecheck
```

ชุดทดสอบเบราว์เซอร์ใช้เวลาข้อละหลายนาที (มีการอัปโหลดรูปและโหลดโมเดล AI) ให้รันแบบ background และรันทั้ง 3 ชุดก่อน push ทุกครั้ง ผลและภาพหน้าจออยู่ที่ `test-results/`

ก่อน push ให้ตรวจเสมอว่า `git status` สะอาด, `npm test` ผ่าน, `npm run build:site` ผ่าน และ push ด้วย `git push origin website/scroll-story-tuning:main` (หรือทำงานบน `main` โดยตรงก็ได้) แล้วตามดู `gh run list --branch main --limit 3`

## 4. เอกสารที่ต้องอ่านก่อนแก้ (ตามลำดับ)

1. `docs/WEBSITE-HANDOFF.md` ภาพรวมเว็บ V1 ทุกหน้า ไฟล์ไหนดูแลอะไร วิธีรัน/ทดสอบ หัวข้อ "ประสิทธิภาพการโหลดฉาก 3D" และตาราง "จุดแก้ไขหลัก"
2. `docs/floor-visualizer-design.md` เอกสารออกแบบตัวจำลองพื้นด้วย AI (ภาษาไทย) พร้อมสถานะที่ทำไปแล้ว (§7.1–7.2) และงานที่เหลือก่อนปล่อยจริง
3. `docs/LOCAL-HANDOFF.md`, `docs/architecture.md` สำหรับไลบรารี viewer 3D เดิม
4. `server/README.md` ส่วนเสริมฝั่งเซิร์ฟเวอร์ (ยังไม่ได้ deploy)

## 5. โครงสร้างหน้าแรกตอนนี้ (บนลงล่าง) และไฟล์ที่เกี่ยวข้อง

| ส่วน | ไฟล์หลัก |
| --- | --- |
| Hero + scroll story ชั้นวัสดุ 3D (three.js) | `website/index.html`, `src/website/FloorScrollStory.ts`, `FloorStoryScene.ts`, `storyTimeline.ts`, `HeroRoomFloor.ts`, `story.css`, `home.css` |
| ช่วงเล่าเรื่องแบบพิมพ์ + กองรูปผลงาน + ผลงานเด่น 2 ชิ้น + แถบตัวเลข/วงแหวน/เช็คมาร์ก | `src/website/experience.ts`, `experience.css` (ข้อความใน `INTRO_LINES`, `FEATURED`) |
| แกลเลอรีผลงานเลื่อนซ้าย | `src/website/showcase.ts`, `showcase.css`, รูปใน `public/website/showcase/` |
| สินค้าทุกซีรีส์จากแค็ตตาล็อก | `src/website/collections.ts`, `collections.css`, `src/website/catalog.ts`, swatch ใน `public/website/catalog/` |
| ลายก้างปลา | `src/website/herringbone.ts`, `herringbone.css`, `public/website/herringbone/` |
| ป้ายคำนวณราคา + ตารางราคา + แพ็กเกจ 30/100/1,000 ตร.ม. | `src/website/collections.ts` (คลาส `Pricing`), ข้อมูลใน `catalog.ts` |
| ตัวจำลองห้อง: เลือกสี/ลายปู, ห้องตัวอย่าง 7 ห้อง, อัปโหลดรูปห้องแล้ว AI หาพื้นให้ | `src/website/visualizer/` (ดู `index.ts`, `vision.worker.ts`, `render/`, `ui/Toolbar.ts`, `samplePhotos.ts`) |
| ส่วนแนะนำตัว CEO, footer, header, dialog ติดต่อ | `brand-introduction.css`, `src/website/shared.ts` |
| หน้าอื่น | `calculator/` + `src/website/calculator.ts`, `ceo/` + `ceo.ts`, `next-gen/` |

ทุกส่วนใหม่เปิดเผยสถานะไว้ที่ `window.websiteDemo.diagnostics` (เช่น `.viewer.timings`, `.preview`, `.showcase`, `.experience`, `.pricing`) ใช้ตรวจจากคอนโซลหรือ Playwright ได้

## 6. สิ่งที่ควรรู้ก่อนแตะโค้ด

- **เส้นทางไฟล์ต้องผ่าน `sitePath()`** (ใน `src/sitePath.ts`) เพราะเว็บจริงอยู่ใต้ `/Coolplan/` ไม่ใช่ราก โดเมน: URL ใน HTML/CSS ให้ Vite จัดการ แต่สตริงใน TypeScript ต้องห่อ `sitePath('/website/...')` เสมอ ไม่งั้นบนเว็บจริงจะ 404
- **ประสิทธิภาพ hero 3D** เพิ่งแก้ไปแล้ว (ภาพแรกขึ้นใน ~1–2 วินาที): สร้างสีแรกก่อน, ลายไม้สร้างใน Web Worker (`src/textures/texture.worker.ts`, `textureWorkerPool.ts`), environment แสง (PMREM) สร้างหลังเฟรมแรก (`createStudio(..., {deferEnvironment: true})`), รูปใช้ WebP อย่าเพิ่มงานหนักกลับเข้าไปก่อนภาพแรก และอย่าอ้างถึง `material-*.jpg` / `room-original.png` / `prototype-home.png` จากหน้าเว็บอีก (ยังเก็บไฟล์ไว้เพราะชุดทดสอบและสคริปต์ V2 ใช้)
- **ตัวจำลอง AI หาพื้น** รันบนเครื่องผู้ใช้ด้วย ONNX Runtime Web ใน worker โมเดลโหลดจาก Hugging Face CDN (URL ใน `src/website/visualizer/models.ts` เปลี่ยนด้วยตัวแปร `VITE_MODEL_*` ได้) น้ำหนัก SegFormer ของ NVIDIA ที่ใช้อยู่เป็นสัญญาอนุญาตเพื่อวิจัยเท่านั้น ก่อนใช้ขายของจริงต้อง export EfficientViT-Seg (Apache-2.0) มาแทน (ต้องใช้ Python) รายละเอียดใน `docs/floor-visualizer-design.md` §3.1 และ §7.2
- **OpenRouter**: ใช้ได้เฉพาะโมเดลฟรี และโมเดลฟรีหมุนเวียนบ่อย (ต.ค. 2026 Kimi/DeepSeek/Qwen-VL ไม่ฟรีแล้ว) ปุ่ม "แนะนำสีด้วย AI" จะปรากฏต่อเมื่อตั้ง `VITE_ROOM_ADVICE_URL` ชี้ไป Cloudflare Worker ใน `server/edge/room-advice.ts` ซึ่งยังไม่ได้ deploy
- **แถบนำทางของ scroll story ถูกซ่อน** ด้วย CSS ใน `experience.css` (`#floor-story .story-rail{display:none}`) ปุ่มยังอยู่ใน DOM เพื่อให้ชุดทดสอบใช้ได้ ถ้าจะลบออกจริงต้องแก้ `tests/story-browser.mjs` ด้วย
- **ชื่อผลงานในแกลเลอรี**: ชื่อโครงการ 3 ชื่อ (Narasiri, Pet Hotel @พัฒนาการ, Staircase Flooring) มาจากแค็ตตาล็อก แต่คำบรรยายใต้รูปและชื่อรูปที่เจ้าของส่งมาเอง (ทางเดินเชฟรอน คาเฟ่ บันได) เป็นข้อความที่ AI แต่งขึ้นจากภาพ เจ้าของอาจอยากแก้ให้ตรงความจริง
- **ราคาแพ็กเกจ 30/100/1,000 ตร.ม.** (23,700 / 70,000 / 550,000 บาท) มาจากรูปที่เจ้าของส่งมา ไม่ได้อยู่ในใบราคา PDF
- **อย่าแตะโฟลเดอร์ V2** (`v2/`, `src/v2/`) เจ้าของสนใจเฉพาะเว็บ V1 (`website/`, `src/website/`)
- เบอร์โทรและอีเมลติดต่อปรากฏหลายที่ (`shared.ts`, `calculator.ts`, metadata ใน HTML) ถ้าเปลี่ยนต้องแก้ให้ครบ
- ข้อมูลส่วนตัว/รูปห้องของผู้ใช้ไม่ถูกส่งขึ้นเซิร์ฟเวอร์ (ประมวลผลบนเครื่องทั้งหมด) ให้รักษาหลักการนี้ไว้
- เวลาทดสอบเรื่องเวลาหรือแอนิเมชัน ใช้ headless Chrome ผ่าน Playwright ไม่ใช่แผง preview ที่ซ่อนอยู่ (timer จะหยุด) และ Git Bash บน Windows จะแปลงอาร์กิวเมนต์ที่ขึ้นต้นด้วย `/` เป็นพาธ ถ้าต้องส่งค่าเช่น `COOLPLAN_BASE_PATH=/Coolplan/` ให้ตั้ง `MSYS_NO_PATHCONV=1`

## 7. สถานะงานและสิ่งที่ค้าง

ทำเสร็จและอยู่บนเว็บจริงแล้ว: ตัวจำลองพื้นด้วย AI (เฟส 0–3 ตามเอกสาร), แกลเลอรีผลงาน, ลายก้างปลา, ช่วงเล่าเรื่อง, ส่วนสินค้า/ราคา/แพ็กเกจ, การเร่งความเร็ว hero 3D

ยังค้าง (เรียงตามความสำคัญ):
1. ยืนยันข้อมูลกับเจ้าของ: ขนาดแผ่นก้างปลา (125×650 vs 118×590), คำบรรยายผลงาน, ชื่อโทนสีเฉดก้างปลา
2. ก่อนใช้ตัวจำลอง AI เชิงพาณิชย์: export EfficientViT-Seg-B1 เป็น ONNX q8, โฮสต์ไฟล์โมเดลเอง, ตั้ง `VITE_MODEL_FLOOR_SEG`
3. ชุดภาพทดสอบห้องไทยจริง 30 รูปสำหรับวัดคุณภาพการหาพื้น
4. deploy `server/edge/room-advice.ts` ถ้าต้องการปุ่มแนะนำสีด้วย AI และ/หรือ `server/floor-api/` (FastAPI ยังไม่เคยรัน)
5. ถ้าต้องการให้ hero เร็วขึ้นอีก: สร้างลายไม้ล่วงหน้าตอน build เป็นไฟล์ภาพ (มี plugin `virtual:spc-texture-manifest` และโฟลเดอร์ `public/textures/` รองรับอยู่แล้ว) และแยก bundle three.js

## 8. สิ่งที่ต้องทำเป็นอย่างแรกในเซสชันนี้

1. เปิด `D:\AI Section\coolplan\repo` รัน `git status` และ `git log --oneline -5` ยืนยันว่าอยู่ที่ `8f3f02f` หรือใหม่กว่า และ working tree สะอาด
2. รัน `npm run dev` แล้วเปิด http://127.0.0.1:5173/website/ เลื่อนดูทั้งหน้าให้ครบ
3. อ่าน `docs/WEBSITE-HANDOFF.md` และ `docs/floor-visualizer-design.md` §7
4. รัน `npm test` ให้ผ่าน แล้วรายงานสรุปสั้น ๆ ว่าพร้อมรับงาน และถามเจ้าของว่าจะแก้ส่วนไหนต่อ

---

*สร้างเมื่อ 28 ต.ค. 2026 หลัง commit `8f3f02f`*
