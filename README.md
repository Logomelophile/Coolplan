# COOLPLAN

ซอร์สเว็บไซต์ COOLPLAN สำหรับ clone แล้วทำงานต่อบนเครื่องอื่นได้ ประกอบด้วยเว็บไซต์ V1, เครื่องคำนวณราคา, หน้า CEO + Next Gen, Material Studio และ Room Motion พร้อมภาพและฟอนต์ที่ใช้จริง

## เริ่มบนเครื่องใหม่

ติดตั้ง Git และ Node.js **22.12 ขึ้นไป** พร้อม npm (ไฟล์ `.nvmrc` เลือก Node 24) แล้วลงชื่อเข้าใช้ GitHub ด้วยบัญชีที่เข้าถึง repository นี้ได้ (repository เป็น private)

```sh
git clone https://github.com/Logomelophile/Coolplan.git
cd Coolplan
npm ci
npm run dev
```

เปิด **[เว็บไซต์หลัก](http://127.0.0.1:5173/website/)** หรือ **[CEO + Next Gen](http://127.0.0.1:5173/ceo/#next-gen)** หากพอร์ต 5173 ถูกใช้อยู่ ให้ใช้พอร์ตที่ Vite แสดงแทน

ใช้ `npm run dev:website` เพื่อเริ่มเซิร์ฟเวอร์และเปิดหน้าเว็บหลักให้อัตโนมัติ หยุดด้วย `Ctrl+C` เว็บไซต์ V1 รันได้โดยไม่ต้องมี API key, ฐานข้อมูล, Spline, Codex หรือ Dropbox หลังติดตั้ง dependencies แล้ว

## หน้าและสถานะงาน

| เส้นทาง | เนื้อหา |
| --- | --- |
| `/website/` | V1: Motion Scrolling 10 ขั้น สีพื้น ห้องตัวอย่าง และโครงสร้าง 5 MM |
| `/calculator/` | คำนวณงบ เตรียมใบประมาณราคา พิมพ์/ดาวน์โหลด และเตรียมอีเมล |
| `/ceo/` | “คุยเรื่องพื้นกับพี่หน่อย” ต่อด้วยเรื่องราว Next Gen ด้านล่างในหน้าเดียว |
| `/ceo/#next-gen` | เลื่อนไปหาเรื่องราวคะน้าและก้าวต่อไปของแบรนด์ |
| `/next-gen/` | ลิงก์เก่าที่เปลี่ยนทางไป `/ceo/#next-gen` |
| `/` | Material Studio: แผ่นพื้น Three.js 7 สี |
| `/room/` | Room Motion: ห้อง 3D และพื้น 6 สี |
| `/v2/` | งานทดลอง V2 ที่ยังไม่เชื่อม Spline จริง แยกจาก V1 |

[เว็บไซต์ที่เผยแพร่](https://coolplan-material-studio.vitethap-n.chatgpt.site/website/) · [หน้า CEO ที่เผยแพร่](https://coolplan-material-studio.vitethap-n.chatgpt.site/ceo/)

## ตรวจและ build

```sh
npm test
npm run build:site
npm run preview:site -- --port 5185 --strictPort
```

เปิด `http://127.0.0.1:5185/website/` ผลลัพธ์รวม V1 อยู่ใน `site-dist/` โดยคงเส้นทาง Studio, Room, Website, Calculator และ CEO ไว้ครบ ส่วน V2 ทดลอง build แยกด้วย `npm run build:v2`

**Git push ไม่ได้อัปเดตเว็บ Sites ที่เผยแพร่อยู่โดยอัตโนมัติ** การส่งซอร์สให้เครื่องอื่นกับการเผยแพร่เว็บเป็นคนละขั้นตอน

## เผยแพร่ผ่าน GitHub Pages

Workflow `Publish COOLPLAN website` สร้างเว็บ V1 ครบ 6 เส้นทางและเผยแพร่เมื่อ push เข้า `main` หรือเลือก Run workflow ด้วยตัวเอง ก่อนใช้ครั้งแรก ให้เปิด repository → Settings → Pages แล้วเลือก Source เป็น **GitHub Actions** หาก repository แบบ private แจ้งให้ upgrade ให้ตรวจแพ็กเกจก่อน; workflow ไม่เปลี่ยน repository เป็น public และไม่สมัครบริการเพิ่ม

เมื่อเปิด Pages แล้ว ดูลิงก์ที่ GitHub แสดงใน Settings → Pages และเติม `/website/` เพื่อเข้าหน้าเว็บหลัก Workflow จะใช้ base path จาก GitHub ให้อัตโนมัติ และตรวจหน้าเว็บกับไฟล์ JavaScript หลังเผยแพร่ การเผยแพร่นี้แยกจากเว็บ ChatGPT Sites เดิม

ทดสอบ build สำหรับที่อยู่แบบ `/Coolplan/` ได้ด้วย `COOLPLAN_BASE_PATH=/Coolplan/ npm run build:site` และใช้ค่าเดียวกันตอนรัน preview บน Bash; ไม่ตั้งค่านี้เมื่อต้องการ build สำหรับรากโดเมนเดิม

## ทำงานต่อและส่งกลับ

ก่อนเริ่มงานแต่ละครั้ง ตรวจให้ไม่มีงานค้างที่ยังไม่ commit แล้วดึงการเปลี่ยนแปลง:

```sh
git status
git pull --ff-only
npm ci
npm run dev:website
```

จำเป็นต้องรัน `npm ci` ใหม่เมื่อ `package-lock.json` เปลี่ยน จากนั้นแก้ซอร์ส ตรวจ build และ commit เฉพาะไฟล์งานที่ต้องการส่ง ดูขั้นตอนละเอียดและแผนที่ไฟล์ใน [คู่มือส่งต่องาน Local](docs/LOCAL-HANDOFF.md)

## เอกสาร

- [คู่มือเครื่องใหม่และจุดแก้ไขหลัก](docs/LOCAL-HANDOFF.md)
- [รายละเอียดเว็บไซต์ ราคา ภาพ และขอบเขตการทำงาน](docs/WEBSITE-HANDOFF.md)
- [Three.js viewer API และการฝังในเว็บไซต์](docs/library-guide.md)
- [Room Motion](docs/room-motion.md)
- [สถานะ V2 และงาน Spline ที่ยังต้องทำ](docs/v2-handoff.md)

ไฟล์ซอร์สใช้ MIT; ภาพบุคคล ห้อง และเอกสารอ้างอิงที่ผู้ใช้ให้เป็นทรัพย์สินแยกจาก license ซอร์ส ฟอนต์และ dependencies มี license ของตนเอง ดู `LICENSE`, `THIRD_PARTY_NOTICES.txt` และไฟล์ license ใน `public/website/assets/`
