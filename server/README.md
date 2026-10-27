# บริการฝั่งเซิร์ฟเวอร์ (ตัวเลือก) สำหรับ Floor Visualizer

เว็บทำงานได้ครบโดยไม่ต้องมีเซิร์ฟเวอร์ (ประมวลผลบนเครื่องผู้ใช้ทั้งหมด) โฟลเดอร์นี้คือส่วนเสริมตามเอกสารออกแบบ `docs/floor-visualizer-design.md` หัวข้อ 4.2–4.4 และเฟส 3

| โฟลเดอร์ | ทำอะไร | โฮสต์ที่เหมาะ | สถานะ |
| --- | --- | --- | --- |
| `floor-api/` | FastAPI: `/segment` (matte พื้นด้วย OneFormer ADE20K, MIT) และ `/depth` (Depth Anything V2 Small) บน CPU | VPS 2–4 vCPU ราว €5–7/เดือน หรือ Modal (เครดิตฟรี $30/เดือน) | โค้ดอ้างอิง ยังไม่ได้รันทดสอบ (เครื่องที่เขียนไม่มี Python) |
| `edge/room-advice.ts` | Cloudflare Worker เรียก OpenRouter (โมเดลฟรีที่รับภาพ) เพื่อทายประเภทห้อง/สไตล์/แนะนำสี COOLPLAN 3 สี ซ่อน API key และจำกัดเวลา 9 วินาที | Cloudflare Workers ฟรี (100k คำขอ/วัน) | โค้ดอ้างอิง ยังไม่ได้ deploy |

## เปิดใช้จากฝั่งเว็บ

ตั้งค่าใน `.env` (Vite) ตอน build:

```
VITE_ROOM_ADVICE_URL=https://<worker>.workers.dev/      # ปุ่ม "แนะนำสีด้วย AI" จะปรากฏเมื่อมีค่านี้
VITE_ANALYTICS_URL=https://<endpoint>/collect            # ส่ง event ด้วย sendBeacon (ไม่มีรูป ไม่มีข้อมูลส่วนตัว)
VITE_MODEL_FLOOR_SEG=https://<cdn>/floor-seg-q8.onnx     # ชี้โมเดล segmentation ที่โฮสต์เอง (ดู src/website/visualizer/models.ts)
```

## ข้อควรระวัง

- โมเดลฟรีบน OpenRouter หมุนเวียนบ่อย ตั้ง `MODELS` ใน Worker เป็นรายการสำรองหลายตัว ตรวจรายการล่าสุดที่ https://openrouter.ai/models?q=free
- ทีเออร์ฟรี: 20 คำขอ/นาที และ 50 คำขอ/วัน (หรือ 1,000/วัน เมื่อเคยเติมเครดิต $10) Worker ตอบ 502 เมื่อทุกโมเดลล้มเหลว เว็บจะแสดงข้อความและทำงานต่อได้ตามปกติ
- รูปที่ส่งไปขอคำแนะนำ (ย่อเหลือ 512 px) จะถูกส่งต่อไปยังผู้ให้บริการโมเดล ซึ่งทีเออร์ฟรีอาจเก็บหรือใช้ฝึกต่อ เว็บจึงถามยินยอมก่อนทุกครั้ง
- `floor-api` ไม่เขียนรูปลงดิสก์และไม่ log รูป ควรวางหลัง reverse proxy ที่มี TLS และจำกัดขนาดคำขอ 20 MB
