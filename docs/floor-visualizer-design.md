# เอกสารออกแบบ: AI Floor Visualizer ระดับ Roomvo สำหรับเว็บ COOLPLAN

> สถานะ: ร่างออกแบบ (design document) · วันที่ 27 ต.ค. 2026 · ขอบเขต: เว็บไซต์ V1 (`website/`, `src/website/`)
> เอกสารนี้ไม่ได้แก้โค้ดใด ๆ เป็นแผนและสเปกสำหรับการพัฒนาในเฟสถัดไป

## 0. สรุปสำหรับผู้ตัดสินใจ

**คำถาม:** จะทำให้ส่วน "2. ดูผลลัพธ์ในห้องของคุณ" อัปโหลดรูปห้องจริงแล้ว "เปลี่ยนเฉพาะพื้น" ได้อัตโนมัติ สวยเทียบ Roomvo ด้วยต้นทุนต่ำและใช้เฉพาะโมเดลฟรี/โอเพนซอร์สได้อย่างไร

**คำตอบสั้น**

1. **Roomvo ทำทุกอย่างบนเซิร์ฟเวอร์** (จากการแกะจริงในหัวข้อ 2): อัปโหลดแล้วเซิร์ฟเวอร์หาพื้นให้ใน ~2.5 วินาที และ *ทุกครั้ง* ที่เลือกสินค้า เบราว์เซอร์ขอรูป JPEG 2048 px ที่เรนเดอร์เสร็จจากเซิร์ฟเวอร์ (0.5–1.2 วินาที/รูป) ฝั่งเบราว์เซอร์ไม่มี canvas/WebGL ในฟลว์หลักเลย
2. **เราไม่ต้องทำแบบเดียวกัน** ปัจจุบันเทคโนโลยีเบราว์เซอร์ (ONNX Runtime Web + WebGPU/WASM) ทำให้ "หาพื้น" บนเครื่องผู้ใช้ได้ภายใน 1–3 วินาทีด้วยโมเดลขนาด 4–15 MB และการ "ปูลายพื้นตามเปอร์สเปกทีฟ + เก็บแสงเงาเดิม" ทำได้ด้วย fragment shader บน quad เดียว (WebGL2) **ไม่ต้องใช้ three.js และไม่ต้องสร้างฉาก 3 มิติ** เพราะพื้นห้องคือระนาบเดียว การ map ลายพื้นจึงเป็นแค่ homography 3×3
3. **สถาปัตยกรรมที่แนะนำคือ "client-first hybrid"**: ขั้นหาพื้น/เรนเดอร์ทำบนเบราว์เซอร์ทั้งหมด (ต้นทุนรันไทม์ 0 บาท, รูปผู้ใช้ไม่ออกจากเครื่อง = ดีต่อ PDPA) และมี **เซิร์ฟเวอร์ตัวเลือก** ราคาถูก (CPU VPS หรือ HF Spaces) สำหรับเครื่องเก่า/โมเดลใหญ่กว่า และสำหรับส่งออกภาพความละเอียดสูง
4. **โมเดลฟรีบน OpenRouter ไม่ใช่เครื่องมือหาพื้น** พวกมันเป็น LLM ที่รับภาพแล้วตอบเป็น *ข้อความ* ไม่ได้ส่งออก pixel mask จึงใช้ได้แค่งานเสริม เช่น ทายประเภทห้อง เสนอสีที่เข้ากัน ตรวจคุณภาพผลลัพธ์ หรือให้พิกัดคร่าว ๆ และต้องมี fallback เสมอเพราะ rate limit ของฟรี (50 หรือ 1,000 คำขอ/วัน) ข้อเท็จจริงเพิ่มเติม ณ 27 ต.ค. 2026: **Kimi, DeepSeek, Qwen-VL, Llama Vision ไม่อยู่ในรายการฟรีของ OpenRouter แล้ว** ตัวฟรีที่รับภาพได้ตอนนี้คือ Gemma 4 (ผ่าน Google AI Studio tier ฟรี ซึ่งอาจนำข้อมูลไปใช้) และ Nemotron 3.5 Super VL (ดูหัวข้อ 4.4)
5. **เรื่องสัญญาอนุญาตที่ต้องรู้ก่อนเลือกโมเดล**: น้ำหนัก SegFormer ที่ finetune บน ADE20K ทุกขนาดเป็น **NVIDIA Source Code License (วิจัย/ประเมินเท่านั้น)** ใช้ทำต้นแบบได้แต่ขึ้นระบบขายของไม่ได้ ตัวที่ใช้เชิงพาณิชย์ได้และเล็กพอสำหรับเบราว์เซอร์คือ **EfficientViT-Seg B1 (Apache-2.0, export ONNX เอง)**, **SlimSAM-77 (Apache-2.0)** และ **Depth Anything V2 Small (Apache-2.0; รุ่น Base/Large เป็น CC-BY-NC)** ส่วน OneFormer/Mask2Former (MIT) เหมาะฝั่งเซิร์ฟเวอร์
6. **ลำดับการสร้าง**: เฟส 0 ปรับโครง renderer เดิมให้เป็น WebGL + ลายไม้จริงจาก `products.json` (ใช้ได้กับห้องตัวอย่างทันที) → เฟส 1 MVP อัตโนมัติ (segmentation เล็ก + guided filter + หาเส้นขอบฟ้าอัตโนมัติ + เครื่องมือปรับมือ) → เฟส 2 ความลึก/การบังวัตถุ/คลิกแก้ mask (Depth Anything V2 Small + SlimSAM-77) → เฟส 3 เทียบชั้น Roomvo (เซิร์ฟเวอร์เรนเดอร์ 2K+, อัปโหลดจากมือถือผ่าน QR, แชร์, วิเคราะห์การใช้งาน)

ประมาณการรวมถึงเฟส 2: **~7–9 สัปดาห์คน** (รายละเอียดหัวข้อ 7)

---

## 1. สิ่งที่มีอยู่แล้วในโค้ดเบสและข้อจำกัด

ไฟล์หลัก: [src/website/roomPreview.ts](../src/website/roomPreview.ts) (547 บรรทัด) ควบคุมจาก [src/website/main.ts](../src/website/main.ts) และ HTML ใน [website/index.html](../website/index.html) (ส่วน `.preview-column`)

| ความสามารถเดิม | วิธีทำปัจจุบัน | ใช้ต่อได้ไหม |
| --- | --- | --- |
| ห้องตัวอย่าง 7 ห้อง | crop จากสไปรต์ภาพเดียว `prototype-home.png` + **polygon mask วาดมือ** (`FLOOR_MASKS`) และรูเจาะโต๊ะ (`TABLE_HOLE`) สำหรับห้องแรก | ได้ แต่ควรเปลี่ยนเป็น mask ที่สร้างจากโมเดลแล้ว bake เป็นไฟล์ PNG ล่วงหน้า (precomputed) |
| อัปโหลดรูปผู้ใช้ | รับ JPG/PNG/WebP ≤ 20 MB ย่อให้ยาวสุด 1600 px แล้ว **ให้ผู้ใช้คลิก 4 มุม** ของบริเวณพื้นที่โล่ง (`orderedQuad`) | เก็บไว้เป็น fallback สุดท้าย ("โหมดปรับมือ") |
| เปอร์สเปกทีฟ | `warpTexture()` คำนวณ **inverse homography จาก 4 มุม** แล้ว sample แบบ bilinear ทีละพิกเซลบน CPU (`getImageData`/`putImageData`) | สูตรถูกต้องแล้ว แต่ช้า (loop JS ทั้งภาพทุกครั้งที่เปลี่ยนสี) ย้ายไป fragment shader |
| ลายพื้น | ตัด swatch 9 คอลัมน์จากสไปรต์ ลงใน tile 768×768 ขีดเส้นร่องไม้ | เปลี่ยนเป็น texture จริง: โค้ดมี `generateWoodPixels()` ใน [src/textures/wood.ts](../src/textures/wood.ts) ที่สร้างลายไม้ procedural ตาม `products.json` (ขนาดแผ่นจริง 1220×180 มม.) ใช้ได้ทั้งสองที่ |
| เก็บแสงเงาเดิม | ซ้อนแบบ `globalCompositeOperation = 'color'` (α .86) + `multiply` + `soft-light` บนภาพเดิม | แนวคิด "ยืม luminance จากภาพเดิม" ถูกทาง แต่ยังเป็น heuristic ต่อสี (α ต่างกันตาม finish) ควรแทนด้วย shading transfer ที่มีหลักการ (หัวข้อ 5.6) |
| เปรียบเทียบก่อน/หลัง | ผ่าครึ่งภาพตรงกลาง (ไม่ลากได้) | อัปเกรดเป็น slider ลากได้ และเลือกสินค้าคนละฝั่งแบบ Roomvo |
| มุมมอง 6 แบบ, ขยายเต็มจอ, คีย์บอร์ด/ARIA | มีครบ | ใช้ต่อ |

**ข้อจำกัดสำคัญที่ต้องแก้**

- ผู้ใช้ต้องคลิก 4 มุมเอง และต้องเป็นบริเวณที่ไม่มีเฟอร์นิเจอร์บัง → ผลคือ "แปะสี่เหลี่ยมลายไม้" ไม่ได้เปลี่ยนพื้นทั้งห้อง เฟอร์นิเจอร์ไม่ได้บังพื้นใหม่
- ไม่มี mask ขอบนุ่ม (soft edge) ขอบเฟอร์นิเจอร์/ขาโต๊ะจึงคมหรือเลอะ
- ไม่มีข้อมูลสเกล (ขนาดแผ่นเทียบห้องจริง) และทิศทางปูแผ่น
- ทั้งหมดเป็น CPU canvas: เปลี่ยนสีทีละครั้งต้องวนทั้งภาพ บนมือถือรู้สึกหน่วง

---

## 2. แกะการทำงานของ Roomvo (สังเกตจริง 27 ต.ค. 2026)

ทดสอบที่ https://www.roomvo.com/my/powerartmaterials/ (ภาษาไทย) ด้วยเบราว์เซอร์ในแอป ดู network / DOM และทดลองอัปโหลดรูป ทุกอย่างด้านล่างคือสิ่งที่หน้าเว็บแสดงออกมา ไม่ใช่เอกสารภายในของ Roomvo

### 2.1 ฟลว์ผู้ใช้

1. หน้าแรก: กล่อง "ลากและวาง หรือเลือกรูปภาพ" (`<input accept="image/*,.heic">`), QR "อัปโหลดจากมือถือ" (เปิดกล้องมือถือแล้วส่งรูปเข้า session เดิม) และแกลเลอรี "ลองใช้ห้องตัวอย่างของเรา" 8 ห้อง
2. เลือกห้อง/อัปโหลดแล้วเข้า viewer: ภาพใหญ่ตรงกลาง แถบสินค้าด้านล่าง (swatch + หัวใจ) ปุ่มบน: **เปรียบเทียบ · ซูม · แชร์ · ดาวน์โหลด · อัปโหลด/เปลี่ยนห้อง · ดูแกลเลอรี่ · ติดต่อเรา · ไปที่หน้าสินค้า** และใต้ภาพ **รีเซ็ต · หมุน** (หมุนทิศแผ่น 0° → 90°)
3. เปรียบเทียบ = slider ลากซ้าย-ขวา โดยกำหนดสินค้าให้ "ฝั่งซ้าย/ฝั่งขวา" คนละตัวได้ (เทียบสินค้า 2 ตัว ไม่ใช่แค่ก่อน/หลัง)
4. ไม่มีเครื่องมือให้ผู้ใช้แก้ขอบเขตพื้นเอง (อย่างน้อยกับ vendor นี้) ถ้าโมเดลผิดก็ผิดเลย

### 2.2 สิ่งที่รันฝั่งไหน

| ขั้นตอน | ที่รัน | หลักฐาน |
| --- | --- | --- |
| อัปโหลด + หาพื้น + ทายประเภทห้อง | **เซิร์ฟเวอร์, synchronous** | `POST /services/room/rooms/` (multipart) ใช้เวลา **~2.5 วินาที** กับรูป 600×400 แล้วตอบกลับ `status:"Built"`, `roomType:"Bedroom"`, `productInstances[0]` มี `anchorNormalizedRow/Col` (จุดกึ่งกลางพื้น) และ `boundingBox:[0, .772, 1, .228]` (กรอบพื้นแบบ normalized) |
| เรนเดอร์ลายพื้น | **เซิร์ฟเวอร์ ทุกครั้งที่เปลี่ยนสินค้า** | `GET /rooms/{id}/paint/?instance_spec={"product_id","product_vendor","orientation":0\|90,"instance_number":1}&display_width=2048&display_height=1024` ตอบ JPEG 2048×1339 ขนาด 270–420 KB ใช้เวลา 0.5–1.2 วินาที (TTFB 0.6–1.0 s) แสดงด้วย `<img>` ธรรมดา ไม่มี `<canvas>` ในหน้า |
| "room 3D model" | ดาวน์โหลดมาที่ client | `GET /services/room/room_3d_models/{id}/?attestation_hash=…` 150–360 KB เนื้อหาเข้ารหัส/obfuscate (ขอโดยไม่มี hash ได้ 403) น่าจะเป็นระนาบพื้น/mask สำหรับ marker และฟีเจอร์อื่น ไม่จำเป็นต่อการสลับสี |
| JS bundle | 6.5 MB / 24 chunks (Next.js) | มีสตริง `WebGLRenderer`, `glb`, `WebXR` → ใช้กับสินค้าประเภทอื่น/AR ไม่ใช่ฟลว์รูปถ่าย |

### 2.3 คุณภาพผลลัพธ์ที่เห็น

- เปอร์สเปกทีฟถูกต้อง เส้นแผ่นลู่เข้าจุดอันตรธานตามห้องจริง ลายก้างปลา (herringbone) สเกลสมจริง
- เฟอร์นิเจอร์บังพื้นสะอาด (ขาเก้าอี้ ขาโต๊ะ ชายผ้าปูเตียง) ไม่มีลายไม้ทะลุขึ้นมา
- **แสงเงาเดิมของพื้นถูกเก็บไว้** เงาใต้โซฟา/เตียงยังอยู่ และโทนสว่างใกล้หน้าต่างยังสว่าง → ยืนยันว่าใช้ shading ของภาพต้นฉบับคูณกับลายใหม่ ไม่ใช่สร้างภาพใหม่ด้วย generative model (ถ้าใช้ diffusion ลายสินค้าจะเพี้ยนและเฟอร์นิเจอร์จะเปลี่ยน)
- รูปอัปโหลดเล็กมาก (600×400) ยังถูกขยายส่งกลับที่ 2048 px → มีขั้น upscale/ sharpen ฝั่งเซิร์ฟเวอร์

### 2.4 สิ่งที่สรุปได้จากภายนอก

หน้าการตลาด get.roomvo.com ไม่อธิบายเทคโนโลยี (พูดแค่ "in seconds", "realistic, accurate", 7K+ retailers) แต่พฤติกรรมข้างต้นตรงกับสูตรคลาสสิกของวงการนี้ (เหมือนสิทธิบัตร Geomagical Labs/IKEA Kreativ US 11727587B2 ที่อธิบายไว้ชัด): **segmentation หาพื้น → ประมาณระนาบพื้น (ความลึก/จุดอันตรธาน) → วางลายผ่าน homography → เก็บ shading เดิม → ซ้อนด้วย mask การบังของวัตถุ** หัวข้อ 3–5 คือการออกแบบของเราบนสูตรนี้ด้วยของฟรีทั้งหมด

---

## 3. State of the art: "เปลี่ยนพื้นในรูปถ่าย" ทำอย่างไร

ปัญหาแตกเป็น 5 ขั้นอิสระ แต่ละขั้นมีโมเดล/เทคนิคโอเพนซอร์สให้เลือก

```
รูปห้อง ──► (A) หาบริเวณพื้น ──► (B) ขอบนุ่ม/บังวัตถุ ──► (C) ระนาบพื้น+homography ──► (D) ปูลาย ──► (E) ถ่ายโอนแสงเงา ──► ภาพผล
                 segmentation         matting / SAM          VP / depth-plane          shader           luminance transfer
```

### 3.1 (A) Semantic segmentation หาพื้น

ชุดข้อมูล ADE20K มี 150 คลาส ที่เราสนใจคือ `floor` (index 3), `rug` (28), `stairs` (53), `step` (121) และ `earth/ground` (13) — เอา `floor ∪ rug` เป็นพื้นเริ่มต้น (พรมมักวางบนพื้นที่ผู้ใช้อยากเปลี่ยน ให้เลือกได้ว่า "รวมพรมไหม")

| โมเดล (ปี) | สัญญาอนุญาต | พารามิเตอร์ | ADE20K mIoU | ขนาด ONNX (fp32 / fp16 / q8) | พอร์ตเบราว์เซอร์ |
| --- | --- | --- | --- | --- | --- |
| SegFormer-B0 (2021) | **NVIDIA Source Code License — ใช้เพื่อวิจัย/ประเมินเท่านั้น** (น้ำหนักทุกขนาดที่ finetune ADE) | 3.8M | 37.4 | 15.3 / 7.9 / **4.4 MB** | `Xenova/segformer-b0-finetuned-ade-512-512` (transformers.js) |
| SegFormer-B2 | เดียวกัน | 27.5M | 46.5 | 110 / 55.7 / 28.9 MB | `Xenova/segformer-b2-…` |
| SegFormer-B5 (640) | เดียวกัน | 84.7M | 51.0 | 341 / 172 / 89.5 MB | `Xenova/segformer-b5-…` |
| **EfficientViT-Seg B1 / B2 / L1** (ICCV 2023) | **Apache-2.0** | 4.8M / 15M / 40M | 42.8 / 45.9 / 49.2 | ยังไม่มีพอร์ตสำเร็จรูป ต้อง export ONNX เอง (ประมาณ 20 / 60 / 160 MB fp32) | ไม่มี (รันผ่าน ONNX Runtime Web ได้เมื่อ export แล้ว) |
| Mask2Former Swin-T / Swin-L (CVPR 2022) | โค้ด MIT (เช็กน้ำหนักรายตัว) | ~47M / ~215M | 47.7 / 56.1 | ใหญ่ ใช้ฝั่งเซิร์ฟเวอร์ | ไม่อยู่ใน transformers.js |
| OneFormer Swin-L / DiNAT-L (CVPR 2023) | **MIT** | 219M / 223M | 57.0 / 58.3 | เซิร์ฟเวอร์เท่านั้น | ไม่อยู่ใน transformers.js |
| DPT-Large ADE | Apache-2.0 | ~340M | 49.0 | เซิร์ฟเวอร์ | สถาปัตยกรรมรองรับใน transformers.js แต่ไม่มีพอร์ต ADE สำเร็จรูป |

ข้อสังเกตเรื่องความเร็ว: SegFormer-B0 รายงาน ~50 FPS บน GPU (ADE20K 512) ส่วน EfficientViT-B1 รายงาน 4 ms บน Jetson Orin / 110 ms บน Jetson Nano (TensorRT fp16) → บนมือถือผ่าน WebGPU คาดอยู่ที่หลักร้อย ms และ WASM หลักวินาที (ไม่มีตัวเลขเบราว์เซอร์ที่ตีพิมพ์ ต้องวัดเองบนเครื่องเป้าหมาย)

**ข้อแนะนำ (ปรับหลังตรวจสัญญาอนุญาต):**

- **ช่วงพัฒนา/ประเมิน**: ใช้ `Xenova/segformer-b0-finetuned-ade-512-512` q8 (4.4 MB) เพราะเสียบกับ transformers.js ได้ทันที เหมาะทำ prototype และสร้างชุดทดสอบ
- **ช่วงขึ้นจริง (เชิงพาณิชย์)**: น้ำหนัก SegFormer ของ NVIDIA ใช้ไม่ได้ ให้ **export EfficientViT-Seg-B1 (Apache-2.0, 4.8M params, mIoU 42.8 ดีกว่า B0)** เป็น ONNX แล้ว quantize เอง (งาน 1–2 วัน รวมทดสอบ) หรือถ้าตั้งเซิร์ฟเวอร์ ใช้ **OneFormer (MIT)** / Mask2Former เพื่อ mask คุณภาพสูงและใช้ทำ mask อ้างอิงของชุดทดสอบ
- ชุดข้อมูล ADE20K เองมีเงื่อนไขการใช้ (ตรวจก่อน fine-tune เอง) ถ้าจะฝึกโมเดล "พื้น/ไม่ใช่พื้น" แบบ binary ขนาดเล็กเองในอนาคต ให้ดูชุดข้อมูลอย่าง Hypersim / SUN RGB-D ประกอบ

### 3.2 (B) ขอบนุ่มและการแก้ mask ด้วยคลิก

- **Guided filter** (He et al. 2013) ใช้ภาพสีเป็นตัวนำ ทำให้ mask ความละเอียดต่ำ (128×128 logits ของ SegFormer) กลายเป็น alpha ขอบคมตามขอบวัตถุจริง ต้นทุนต่ำมาก (O(N) เขียนใน JS/WebGL ได้) — **นี่คือตัวทำคุณภาพขอบที่คุ้มสุด**
- **Promptable segmentation (SAM family)** ให้ผู้ใช้คลิก "ตรงนี้คือพื้น / ตรงนี้ไม่ใช่" แล้วได้ mask ใหม่ทันที เหมาะกับการแก้เคสที่โมเดล (A) พลาด เช่น พื้นลายเดียวกับพรม

| โมเดล | สัญญาอนุญาต | พารามิเตอร์ | ขนาด encoder / decoder (ONNX) | หมายเหตุ |
| --- | --- | --- | --- | --- |
| **SlimSAM-77** (NeurIPS 2024) | **Apache-2.0** | 9.1M | enc 23.3 / 12.2 / **8.9 MB** (fp32/fp16/q8), dec 16.6 / 8.6 / 4.9 MB | SAM ที่เล็กสุดใน transformers.js (`Xenova/slimsam-77-uniform`) mIoU SA-1B 67.4 → **ตัวเลือกหลักสำหรับคลิกแก้ขอบในเบราว์เซอร์** |
| MobileSAM (2023) | Apache-2.0 | 9.8M | ONNX ทางการ; ไม่มีพอร์ต transformers.js | encoder 8 ms GPU / ~3 s CPU i5 |
| EfficientSAM-Ti / S | Apache-2.0 | 9.8M / 25M | ONNX ทางการ | แม่นกว่า MobileSAM (COCO AP 42.3 / 44.4 vs 38.7) |
| EdgeSAM | **NTU S-Lab — ไม่เชิงพาณิชย์** | 9.6M | CoreML/ONNX | 38.7 FPS บน iPhone 14 แต่ใช้ขายไม่ได้ |
| SAM 2.1 Hiera-tiny (2024) | Apache-2.0 | 38.9M | enc 134 / 67 / 52.6 MB (q4f16 28.5), dec 21 / 10.5 / 8.7 MB | `onnx-community/sam2.1-hiera-tiny-ONNX`; ดีกว่าแต่หนักสำหรับมือถือ เหมาะเซิร์ฟเวอร์/เดสก์ท็อป |
| SAM 3 / 3.1 (พ.ย. 2025 / มี.ค. 2026) | "SAM License" (custom Meta) | ~0.85B | enc 1.87 GB fp32 / 296 MB q4f16 | เซิร์ฟเวอร์เท่านั้น มี text prompt ("floor") ได้ |
| SAM ViT-B (2023) | Apache-2.0 | 93.7M | enc 359 / 180 / 101 MB | ใหญ่เกินสำหรับเว็บทั่วไป |
| ViTMatte-S (2023) | Apache-2.0 | 25.8M | 104 / — / 27.5 MB (`Xenova/vitmatte-small-distinctions-646`) | matting จาก trimap (สร้าง trimap ด้วย erode/dilate mask) ให้ขอบชายผ้า/ขนพรมนุ่มที่สุด แต่ guided filter พอสำหรับพื้นในเกือบทุกเคส |
| CLIPSeg / Grounding DINO-tiny | Apache-2.0 | ~0.2B | 139–204 MB q8 | ทางเลือก "พิมพ์คำว่า floor" แต่หยาบและใหญ่ ไม่คุ้มเมื่อเทียบ segmentation ตรง ๆ |

สถาปัตยกรรม SAM ทุกตัวแยกเป็น image encoder (หนัก รันครั้งเดียวต่อรูป) + prompt/mask decoder (เบา 5–17 MB รันต่อคลิกในหลัก ms) → cache embedding ไว้ แล้วทุกคลิกของผู้ใช้รันแค่ decoder

### 3.3 (C) ระนาบพื้นและ homography

พื้นห้องเป็นระนาบ ดังนั้นความสัมพันธ์ระหว่างพิกัดบนพื้น (เมตร) กับพิกเซลคือ homography `H` 3×3 เพียงตัวเดียว มี 3 ทางหาค่า:

| วิธี | ต้องการ | ข้อดี | ข้อเสีย |
| --- | --- | --- | --- |
| **C1 ผู้ใช้ลาก 4 มุม** (มีอยู่แล้ว) | คน | แน่นอน | ไม่อัตโนมัติ |
| **C2 จุดอันตรธาน (vanishing points)** จากเส้นร่องพื้น/ขอบผนัง + สมมติพื้นราบและกล้องไม่เอียง (roll ≈ 0) | ภาพอย่างเดียว | เร็ว (<100 ms) ไม่ต้องใช้โมเดล | พื้นเรียบไร้เส้น (พื้นปูน/พรม) หาเส้นไม่ได้ → ต้อง fallback |
| **C3 ความลึก (monocular depth) → RANSAC fit ระนาบ** | โมเดลความลึก ~25–100 MB | ได้ระนาบแม้ไม่มีเส้น + ได้ occlusion ฟรี | หนักบนมือถือเก่า, สเกลสัมพัทธ์ (ต้องเดา focal length) |

| โมเดลความลึก/normal | สัญญาอนุญาต | พารามิเตอร์ | ขนาด ONNX | ใช้ในเบราว์เซอร์ได้ไหม |
| --- | --- | --- | --- | --- |
| **Depth Anything V2 Small** (มิ.ย. 2024) | **Apache-2.0** | 24.8M | 99 / 49.6 / **27.3 MB** (q4f16 19.1 MB) `onnx-community/depth-anything-v2-small` | ได้ (มี demo WebGPU เรียลไทม์ของ Xenova) — **ตัวเดียวที่ทั้งเล็กและใช้เชิงพาณิชย์ได้** |
| Depth Anything V2 Base / Large / Giant | **CC-BY-NC-4.0** (ไม่เชิงพาณิชย์) | 97.5M / 335M / 1.3B | — | ไม่ใช้ |
| Depth Pro (Apple, 2024) | ชื่อสัญญาอนุญาตไม่สอดคล้องกันระหว่าง HF/GitHub ต้องตรวจ | ~1B | 3.8 GB fp32 / 600 MB q4f16 | เซิร์ฟเวอร์เท่านั้น ให้ metric depth + focal length (มีประโยชน์กับสเกลแผ่น) |
| Metric3D v2 | BSD-2 | ViT-S/L/g | ไม่มีพอร์ต | เซิร์ฟเวอร์ (metric depth) |
| DSINE (normal) | Imperial custom — วิชาการเท่านั้น | — | — | ไม่ใช้ |
| StableNormal | Apache-2.0 | ขนาด SD | — | เซิร์ฟเวอร์ GPU; ไม่จำเป็น เพราะ normal คำนวณจาก depth ได้ (cross product ของ gradient) |

การประมาณ focal length ถ้าไม่มี EXIF: ใช้ค่า f ≈ 0.85–1.0 × กว้างภาพ (มุมมอง ~55–60°) ซึ่งเป็นช่วงกล้องมือถือทั่วไป ความคลาดเคลื่อนของ f ส่งผลต่อ "สเกลแผ่น" มากกว่าเปอร์สเปกทีฟ จึงให้ผู้ใช้ปรับขนาดแผ่นได้

**ข้อแนะนำ:** MVP ใช้ **C2 + กล่องปรับมือ 2 ราง** (ลากเส้นขอบฟ้า/ทิศแผ่น) แล้วเฟส 2 เพิ่ม **C3 ด้วย Depth Anything v2 Small** เฉพาะเครื่องที่มี WebGPU และใช้ผลความลึกทำ occlusion ของวัตถุที่ segmentation ไม่ครอบ (เช่น ขาเก้าอี้บาง ๆ)

### 3.4 (D) ปูลายสินค้า

ลายพื้นจริงของเราเป็น **procedural** อยู่แล้ว (`generateWoodPixels` สร้าง albedo + height ตาม seed/grain ใน `products.json`) จึงสร้าง tile ขนาด 2048×512 ที่แทนแผ่น 1220×180 มม. ได้โดยไม่ต้องโหลดรูป และวาง "แผ่น" ซ้ำแบบ staggered (เหลื่อม 1/3) ใน floor-space ก่อนส่งเข้า shader ทิศแผ่นเลือกได้ (0°/90°/ตามจุดอันตรธานหลัก) ก้างปลา/ลายสานทำเป็น pattern อีกชั้นใน floor-space เช่นกัน

### 3.5 (E) ถ่ายโอนแสงเงา (relighting)

ตัวเลือกจากถูกไปแพง:

1. **Luminance-ratio shading transfer** (ที่ Roomvo และเกือบทุกเจ้าใช้): แยกภาพเดิมใน mask เป็น shading ≈ `L / blur_large(L)` (ความถี่สูง: เงา, รอยต่อ) + global tone (ความถี่ต่ำ: สว่างใกล้หน้าต่าง) แล้วคูณกับลายใหม่ใน linear light ปรับ white balance ตามสีเฉลี่ยของพื้นเดิมเล็กน้อย ต้นทุน ~0 รันใน shader ได้
2. **Intrinsic decomposition ด้วยโมเดล** (เช่น Careaga & Aksoy "Intrinsic" 2023/2024 หรือ RGB↔X ของ Adobe) ได้ albedo/shading แม่นกว่าโดยเฉพาะพื้นลายเข้มที่ heuristic ข้อ 1 จะเอาลายเดิมติดมาเป็น "เงา" — เหมาะกับฝั่งเซิร์ฟเวอร์
3. **Generative (SD inpainting + ControlNet / FLUX Fill / Qwen-Image-Edit)**: สวยแต่ **ไม่รักษาลายสินค้าจริง** (สีและลายเพี้ยนทุกครั้ง) ใช้ GPU และสัญญาอนุญาตหลายตัวไม่ฟรีเชิงพาณิชย์ → ไม่เหมาะเป็นตัวหลักของ visualizer ขายสินค้า ใช้ได้แค่สร้าง "ห้องตัวอย่าง" ใหม่ ๆ ออฟไลน์

| แนวทาง | สัญญาอนุญาต | เหมาะกับการรักษาลายสินค้าจริงไหม |
| --- | --- | --- |
| **Luminance-ratio / Retinex transfer** (Land & McCann 1971; Grid Dynamics ใช้ HSV-V difference ในระบบจริง) | ไม่มีปัญหา (อัลกอริทึม) | **ดีที่สุด**: ลายสินค้าไม่ถูกแตะนอกจากคูณ shading; จุดอ่อนคือพื้นเดิมลายเข้มจะรั่วมาเป็น "เงา" → แก้ด้วย blur/median ใหญ่และ guided filter |
| Intrinsic (Careaga & Aksoy, TOG 2023/2024) | **วิชาการเท่านั้น** (ขอเชิงพาณิชย์ผ่าน SFU) | แยก albedo/shading จริง แต่ใช้ขายไม่ได้โดยไม่ขอสิทธิ์ |
| Intrinsic Image Diffusion (CVPR 2024) | CC-BY-NC-SA 4.0 | ไม่เชิงพาณิชย์ ช้า (≥10 GB VRAM) |
| RGB↔X (Adobe, 2024) | Adobe Research — ไม่เชิงพาณิชย์ | ไม่ใช้ |
| SD 1.5 inpainting + ControlNet | CreativeML OpenRAIL-M | ลาย/สี/สเกลเพี้ยน (generative) ไม่ซื่อตรงต่อสินค้า |
| FLUX.1 Fill-dev / Kontext-dev | FLUX dev Non-Commercial | ไม่เชิงพาณิชย์ + GPU 24 GB |
| Qwen-Image-Edit (2025) | Apache-2.0 (20B) | ใช้ได้ตามสัญญา แต่ GPU เซิร์ฟเวอร์และยังเป็น generative → เหมาะแค่ "harmonize" ขอบแบบ strength ต่ำ ไม่ใช่ตัวหลัก |

เอกสารวิชาการที่ใกล้เคียงที่สุด: Liu et al. "Texture re-rendering tool for re-mixing indoor scene images" (Electronic Imaging 2017) — projective mapping ลายใหม่ลงพื้น/ผนังจาก orientation ที่ประมาณได้; และ Ji et al. "Virtual Home Staging" (ISVC 2023) ที่ชี้ว่าพื้นลายซ้ำเป็นส่วนที่ inpainting ทำได้แย่ที่สุด ซึ่งสนับสนุนแนวทาง deterministic ของเรา

### 3.6 รันไทม์ในเบราว์เซอร์

- **ONNX Runtime Web 1.31.x** (ต.ค. 2026): backend WASM (ทุกเบราว์เซอร์), **WebGPU** (Chromium 113+, fp16 ต้อง Chrome 121+), WebGL (maintenance), WebNN (flag) — README ยังระบุ WebGPU เป็น experimental
- **WebGPU บนอุปกรณ์จริง** (web.dev พ.ย. 2025): Chrome/Edge เดสก์ท็อป 113+, Chrome Android 121+ (Android 12+), **Safari 26 / iOS 26 มี WebGPU แล้ว** ส่วน iOS ก่อนหน้าต้องเปิด flag → **ต้องมี WASM fallback เสมอ** และวัดเวลาจริงเพื่อตัดสินใจ
- **transformers.js v3/v4** (Hugging Face): `device:'webgpu'`, `dtype` fp32/fp16/q8/q4/q4f16; รองรับ SegFormer, SAM, SAM2, DPT, Depth Anything, ViTMatte, CLIPSeg, Grounding DINO แต่ **ไม่รองรับ** Mask2Former, OneFormer, EfficientViT, MobileSAM/EfficientSAM (ต้องเรียก ONNX Runtime Web ตรง ๆ ซึ่งเราทำอยู่แล้ว)
- **ตัวเลขเบราว์เซอร์ที่ตีพิมพ์**: ไม่มีสำหรับ SegFormer-B0/MobileSAM/Depth Anything Small โดยตรง มีแค่ anchor: WebGPU เร็วกว่า WASM 10–50 เท่าในเบนช์มาร์กของ Xenova (MiniLM 10–46 ms vs 380–530 ms) และ SAM-style 256² ~277 ms บน M1 Max → ตัวเลขในหัวข้อ 5.9 เป็นประมาณการที่ต้องยืนยันด้วย Playwright บนเครื่องจริง
- **งบดาวน์โหลดที่แนะนำบนมือถือ (โหลดเมื่อกดอัปโหลดเท่านั้น, cache ด้วย Cache Storage)**: segmentation q8 ≈ 5–8 MB + SlimSAM-77 q8 ≈ 14 MB (enc+dec) + Depth Anything V2 Small q4f16 ≈ 19 MB ≈ **35–40 MB รวม** (เดสก์ท็อปใช้ fp16 ได้ประมาณ 2 เท่า) โดย depth และ SAM เป็น "โหลดเมื่อจำเป็น" ไม่ใช่ตอนเริ่ม

---

## 4. ตัวเลือกสถาปัตยกรรมและต้นทุน

### 4.1 (a) Client-side ล้วน

```
Browser ─ Web Worker: ONNX Runtime Web (WebGPU → WASM fallback)
        │   segmentation q8 (~4–8 MB: SegFormer-B0 ตอนพัฒนา / EfficientViT-B1 ตอนขึ้นจริง)  →  logits 128×128
        ├─ main thread: guided filter (WebGL) → alpha mask เต็มภาพ
        ├─ geometry: VP detection (JS) หรือ depth (เฟส 2) → H
        └─ renderer: WebGL2 fragment shader บน quad เดียว (homography + plank tiling + shading transfer + alpha composite)
```

- ต้นทุนรันไทม์ **0 บาท** โฮสต์เป็น static (GitHub Pages เดิม) โมเดลวางใน `public/website/models/` หรือ CDN (jsDelivr/HF)
- ความเป็นส่วนตัว: รูปห้องไม่ออกจากเครื่อง (ข้อความ "ประมวลผลบนเครื่องของคุณ" เป็นจุดขาย และตัด PDPA scope)
- ข้อจำกัด: มือถือเก่า/iOS รุ่นที่ไม่มี WebGPU จะช้า (WASM 1–4 วินาทีสำหรับ B0 ยังรับได้; depth model ไม่ไหว), ขนาดโหลดครั้งแรก 5–20 MB (โหลดเมื่อผู้ใช้กดอัปโหลดเท่านั้น + cache ด้วย Cache Storage)

### 4.2 (b) เซิร์ฟเวอร์ราคาถูก

```
Browser ──POST image──► FastAPI (Python) ── ONNX Runtime CPU / PyTorch
                          SegFormer-B2 หรือ Mask2Former + (ตัวเลือก) SAM2 + Depth Anything v2
                        ◄── JSON: mask PNG (alpha), plane/H, horizon, roomType, shading map
Browser เรนเดอร์เองด้วย shader เดิม (เซิร์ฟเวอร์ไม่ต้องเรนเดอร์ทุกครั้งที่เปลี่ยนสี)
```

- ตัวเลือกโฮสต์และราคาปัจจุบันอยู่ในตาราง 4.3
- ข้อดี: โมเดลใหญ่กว่า/แม่นกว่า, อัปเดตโมเดลได้โดยไม่ต้อง deploy เว็บ, รองรับเครื่องเก่า
- ข้อเสีย: ต้องดูแลเซิร์ฟเวอร์, มีเวลารอเครือข่าย 1–4 วินาที, ต้องมีนโยบายลบรูป (ลบทันทีหลังตอบ, ไม่เก็บ log รูป)

### 4.3 (c) Hybrid (แนะนำ)

| งาน | ค่าเริ่มต้น | ถ้าเครื่องช้า / ผู้ใช้กด "ปรับละเอียด" |
| --- | --- | --- |
| หาพื้น | EfficientViT-B1 (หรือ SegFormer-B0 ช่วงพัฒนา) บนเครื่อง | เซิร์ฟเวอร์ OneFormer/Mask2Former (MIT) |
| ระนาบพื้น | VP + ปรับมือ | Depth Anything v2 (WebGPU บนเครื่อง หรือเซิร์ฟเวอร์) |
| เรนเดอร์ | WebGL บนเครื่อง เสมอ | ส่งออก 4K จากเซิร์ฟเวอร์ (ตัวเลือก) |
| ประเภทห้อง/คำแนะนำ | heuristic จากคลาส segmentation (เตียง→ห้องนอน, อ่าง→ห้องน้ำ) | OpenRouter free VLM |

**ตัวเลือกโฮสต์สำหรับฝั่งเซิร์ฟเวอร์ (ราคาตรวจ 27 ต.ค. 2026)**

| ตัวเลือก | ฟรี | ราคาจ่าย | เหมาะกับงานนี้ไหม |
| --- | --- | --- | --- |
| **CPU VPS** (Hetzner Regular จาก €6.49/เดือน 2 vCPU; Contabo VPS 4 คอร์/8 GB €4.40/เดือนแบบสัญญา 24 เดือน; OVH VPS-1 จาก $4.54/เดือน) | — | **~€5–7/เดือน เหมาจ่าย** | **ดีที่สุดเมื่อมีผู้ใช้เกินไม่กี่ร้อยรูป/วัน**: FastAPI + ONNX Runtime CPU รัน SegFormer-B2/EfficientViT หรือ Depth Anything Small ที่ 512 px ใช้ ~0.3–2 วินาที/รูปบน 2–4 คอร์ (ประมาณการ ต้องวัด) |
| **Modal** | **$30 เครดิต/เดือนฟรี** (Starter) | T4 $0.000164/วินาที, A10 $0.000306/s, H100 $0.0011/s | งบฟรีใจกว้างสุด (~51 ชั่วโมง T4/เดือน) scale-to-zero แต่มี cold start 10–30 วินาที → เหมาะกับงาน "ปรับละเอียด/ส่งออก 4K" ที่ผู้ใช้ยอมรอ |
| **HF Spaces ZeroGPU** | บัญชีฟรี 5 นาที GPU/วัน, PRO ($9/เดือน) 40 นาที/วัน | overage $1 ต่อ 10 นาที GPU | เหมาะทำ demo/ชุดทดสอบ ไม่เหมาะเป็น API จริง (คิว, Gradio เท่านั้น) |
| **HF Inference Providers** | บัญชีฟรี: **ไม่มีเครดิต** (PRO $2/เดือน) | ตามผู้ให้บริการ | มี task `image-segmentation` ด้วย `nvidia/segformer-b4-finetuned-ade-512-512` (ติดสัญญา NVIDIA เช่นกัน) |
| **Replicate** | ไม่มี | `grounded_sam` ≈ $0.0026/ครั้ง ~3 s; `sam-2` ≈ $0.036/ครั้ง; `depth-anything-v2` ≈ $0.0045/ครั้ง | ง่ายแต่ cold start และต้นทุนต่อครั้งสูงกว่า VPS เมื่อโต |
| **Cloudflare Workers AI** | 10,000 neurons/วัน | $0.011/1,000 neurons | **ไม่มีโมเดล segmentation/depth** ในแค็ตตาล็อก (มีแค่ classification, LLaVA/Moondream, Llama vision, flux) → ใช้ได้แค่เป็น edge function ยิง OpenRouter และเก็บ cache |
| fal.ai | ไม่มีเครดิตฟรีที่ยืนยันได้ | H100 $2.49–4.50/ชม. | ไม่จำเป็น |
| Google Colab | GPU ฟรีจำกัดไม่แน่นอน | Pro $9.99/เดือน (100 CU) | ใช้ทำงาน batch (precompute ห้องตัวอย่าง, สร้าง mask อ้างอิง) ไม่ใช่เซิร์ฟเวอร์ |

**สรุปต้นทุน**: เฟส 0–1 = 0 บาท/เดือน (static + client); เฟส 2–3 ถ้าเปิดเซิร์ฟเวอร์ = ~200–300 บาท/เดือน (VPS) หรือ 0 บาทด้วย Modal ภายในเครดิต $30; OpenRouter ฟรี = 0 บาทแต่มีโควตา (หัวข้อ 4.4)

### 4.4 OpenRouter และโมเดลฟรี: ทำอะไรได้/ไม่ได้ (พูดตรง ๆ)

ดึงรายการจาก `https://openrouter.ai/api/v1/models` เมื่อ 27 ต.ค. 2026 (464 โมเดล) มี **17 ตัว** ที่ลงท้าย `:free` ราคา 0

- **โมเดลที่ถูกเอ่ยถึง (Kimi K2/VL, DeepSeek R1/V3, Qwen 2.5/3-VL, Llama 3.2/4 Vision, Gemma 3, Mistral Small 3.x, GLM-4.5V, InternVL) ตอนนี้ไม่มีตัวไหนฟรีบน OpenRouter แล้ว** ยังอยู่แต่เป็นแบบจ่าย เช่น `qwen/qwen3-vl-8b-instruct` $0.25/$0.75 ต่อล้านโทเคน, `meta-llama/llama-4-scout` $0.10/$0.30 (ถูกมากอยู่ดี: รูป 512 px ≈ 300–800 โทเคน → ราว 0.01–0.03 บาท/รูป) รายการฟรีหมุนเวียนตามรุ่นใหม่ จึงต้องออกแบบให้ **สลับโมเดลได้ด้วย config** ไม่ผูกชื่อ
- โมเดลฟรีที่รับภาพได้ ณ วันนี้: `google/gemma-4-31b-it:free`, `google/gemma-4-26b-a4b-it:free` (เสิร์ฟผ่าน **Google AI Studio tier ฟรี** ซึ่งเงื่อนไข Gemini API ระบุว่าอาจใช้ข้อมูลปรับปรุงผลิตภัณฑ์และมีคนตรวจดูได้ → **ห้ามส่งรูปบ้านลูกค้าโดยไม่ยินยอม**), `nvidia/nemotron-3.5-super-vl:free` (120B-A12B, structured output, บริบท 1M), `thinkingmachines/inkling:free` / `inkling-small:free`, `dots-studio/dots-3-note-preview:free` และ `openrouter/free` (auto-router) ส่วนที่เหลือเป็นโมเดลข้อความ/โค้ด
- **Rate limit ของฟรี (ทางการ)**: 20 คำขอ/นาที; **50 คำขอ/วัน** ถ้าเคยเติมเครดิตน้อยกว่า $10 และ **1,000 คำขอ/วัน** เมื่อเติมครบ $10 ครั้งเดียว → แผนที่คุ้ม: เติม $10 หนึ่งครั้งเพื่อปลดล็อก 1,000/วัน
- **ไม่มีโมเดลฟรีตัวไหนส่งออกภาพหรือ mask** (`output_modalities` ของทุก `:free` คือ text) โมเดลสร้างภาพบน OpenRouter (Gemini image, GPT image) มีแต่แบบจ่าย และไม่มีตัวไหนให้ segmentation mask เป็น modality
- **สิ่งที่ VLM ให้ได้จริง**: จำแนกประเภทห้อง/สไตล์/วัสดุ/คุณภาพแสง (เชื่อถือได้สูง); bounding box / จุดเป็น JSON (ปานกลาง — Gemini ใช้ `[ymin,xmin,ymax,xmax]` 0–1000, Qwen3-VL รองรับ box และ point; Gemma 4 / Nemotron ไม่มีรูปแบบ grounding ที่ประกาศ ต้องทดสอบ); polygon mask (ต่ำ และมีแต่ Gemini แบบจ่าย ความหยาบระดับ polygon ไม่ใช่ matting); pixel-mask / เปอร์สเปกทีฟ / ความลึก (**ไม่เหมาะ** — งานวิจัยปี 2025–2026 หลายชิ้นสรุปตรงกันว่า box ของ VLM "หยาบเกินไปสำหรับ IoU เข้มงวด" เพราะพิกัดถูกสร้างเป็นโทเคนข้อความทีละตัว)

**สรุปการใช้ในระบบนี้**

| ขั้นตอน | ใช้ LLM ฟรีได้ไหม | เหตุผล / วิธีใช้ |
| --- | --- | --- |
| หา pixel mask ของพื้น | **ไม่ได้** | LLM ตอบเป็นข้อความ ไม่มี mask output ต้องใช้โมเดล segmentation |
| คำนวณ homography / ระนาบ | **ไม่ได้** (ไม่แม่นพอ) | VLM ให้พิกัดคร่าว ๆ ได้ (เช่น bbox พื้น, จุดบนพื้น 1 จุด) ใช้เป็น *prompt point* ให้ SAM ได้เท่านั้น |
| ทายประเภทห้อง, สไตล์, แนะนำสี COOLPLAN ที่เข้ากับผนัง/เฟอร์นิเจอร์ | **ได้ดี** | ส่งภาพย่อ 512 px + รายการสินค้า → JSON `{roomType, palette, suggestions:[CP-xxx]}` |
| QA ผลลัพธ์ ("ลายทะลุเฟอร์นิเจอร์ไหม", "เปอร์สเปกทีฟเพี้ยนไหม") | **ได้พอใช้** | ใช้ตอนทดสอบ/เก็บ metric และตอน runtime ถ้าคะแนนต่ำให้เปิดโหมดปรับมืออัตโนมัติ |
| สร้างข้อความอธิบาย/แชร์ | ได้ | ไม่สำคัญกับคุณภาพภาพ |

กติกาการใช้ของฟรี: อยู่นอก critical path เสมอ, timeout 5 วินาที, มี cache ตาม hash รูป, มี fallback เป็น heuristic, อย่าส่งรูปผู้ใช้ไปถ้าผู้ใช้ไม่ติ๊กยินยอม (ผู้ให้บริการโมเดลฟรีบางรายใช้ข้อมูลฝึกต่อ ดูตารางด้านบน) และยิงจากเซิร์ฟเวอร์เล็ก ๆ/edge function เท่านั้นเพื่อไม่เปิดเผย API key

### 4.5 Fallback เมื่อไม่มีโมเดล

ลำดับการถอยที่ผู้ใช้ยังได้ผลลัพธ์เสมอ:

1. WebGPU ไม่มี → WASM (ช้าลงแต่ได้)
2. โหลดโมเดลไม่ได้ / เครื่องช้ามาก (วัดเวลาเกิน 8 วินาที) → เซิร์ฟเวอร์ (ถ้าเปิดใช้) → ถ้าไม่มี ให้ **โหมดวาดเอง**: แปรง/ยางลบ + polygon บน mask (ไม่ใช่แค่ 4 มุมแบบเดิม) และ "ราง" 2 เส้นสำหรับเปอร์สเปกทีฟ
3. ระนาบหาไม่ได้ (ไม่มีเส้น) → ใช้ค่าเริ่มต้น: เส้นขอบฟ้าที่ 45% ความสูงภาพ (ค่ากลางของรูปถ่ายห้องทั่วไป) + ให้ผู้ใช้ลากปรับ
4. ทุกอย่างล้มเหลว → UI 4 มุมเดิมยังอยู่

---

## 5. ไปป์ไลน์และอัลกอริทึมทีละขั้น

### 5.1 ภาพรวมการไหลของข้อมูล

```mermaid
flowchart LR
  U[ผู้ใช้เลือก/ถ่ายรูป] --> D[decode + EXIF orientation<br/>ย่อ ≤1600px → ImageBitmap]
  D --> W[(Worker: ONNX Runtime Web)]
  W -->|SegFormer-B0 512²| L[logits 150×128×128]
  L --> M[argmax → floor∪rug mask<br/>+ ความมั่นใจ]
  D --> G[guided filter<br/>ใช้ภาพเป็นตัวนำ]
  M --> G
  G --> A[alpha mask เต็มภาพ]
  D --> V[หาเส้น → จุดอันตรธาน → เส้นขอบฟ้า]
  A --> V
  V --> H[homography H<br/>floor-space ⇄ pixel]
  P[products.json → tile ลายไม้<br/>generateWoodPixels] --> R
  D --> S[shading map<br/>L / blur(L), tone, WB]
  A --> R
  H --> R
  S --> R[WebGL2 fragment shader<br/>quad เดียว]
  R --> O[ภาพผล + slider เปรียบเทียบ<br/>ดาวน์โหลด/แชร์]
  O -.ปรับมือ.-> A
  O -.ลากราง.-> H
```

สิ่งที่คำนวณ **ครั้งเดียวต่อรูป**: mask, alpha, H, shading map (รวม 1–4 วินาที) สิ่งที่คำนวณ **ทุกครั้งที่เปลี่ยนสี/หมุน**: แค่ uniform ของ shader + texture bind (<16 ms จึงลื่นแบบเรียลไทม์ ต่างจาก Roomvo ที่รอเซิร์ฟเวอร์ ~1 วินาที)

### 5.2 ขั้นเตรียมภาพ

```ts
async function prepare(file: File): Promise<Prepared> {
  // HEIC จาก iPhone: ใช้ createImageBitmap ถ้าเบราว์เซอร์รองรับ ไม่งั้น heic2any (ตัวเลือก) หรือบอกผู้ใช้
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); // แก้ EXIF rotate
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const work = draw(bmp, bmp.width * scale, bmp.height * scale);          // ภาพทำงาน
  const net  = letterbox(work, 512, 512, IMAGENET_MEAN, IMAGENET_STD);     // tensor 1×3×512×512 float32
  return { work, net, scale };
}
```

### 5.3 หาพื้น (Worker)

```ts
// worker.ts — โหลดครั้งเดียวแล้ว cache session
const session = await ort.InferenceSession.create(MODEL_URL, {
  executionProviders: ['webgpu', 'wasm'], graphOptimizationLevel: 'all',
});
const { logits } = await session.run({ pixel_values: tensor });           // [1,150,128,128] (ADE20K 150 คลาส ทั้ง SegFormer และ EfficientViT-Seg)
const FLOOR = 3, RUG = 28, STAIRS = 53, STEP = 121;                      // ดัชนีคลาส ADE20K
// softmax ต่อพิกเซล → prob ของพื้น = p[FLOOR] + (includeRug ? p[RUG] : 0)
// ส่งกลับ Float32Array 128×128 "ความน่าจะเป็นพื้น" ไม่ใช่ mask ไบนารี เพื่อให้ขั้นถัดไปทำขอบนุ่ม
```

กติกาคุณภาพ: ถ้า `mean(prob > .5) < 3%` ของภาพ ถือว่า "ไม่พบพื้น" → เปิดโหมดวาดเองพร้อมข้อความแนะนำ (ถ่ายให้เห็นพื้นมากขึ้น) และบันทึกเป็น event

### 5.4 ขอบนุ่มด้วย guided filter

```
input : I = ภาพทำงาน (gray หรือ RGB, 0..1), p = prob พื้นขยายขึ้นเป็นขนาดภาพ (bilinear)
radius r = 8 px (ที่ 1600 px), eps = 1e-3
mean_I = box(I,r); mean_p = box(p,r); corr_Ip = box(I*p,r); var_I = box(I*I,r) - mean_I²
a = (corr_Ip - mean_I*mean_p) / (var_I + eps);  b = mean_p - a*mean_I
alpha = box(a,r)*I + box(b,r)
alpha = smoothstep(.35, .65, alpha)        // ให้ขอบคมพอดี ไม่เบลอทั้งแผ่น
```

box filter ทำด้วย separable pass บน WebGL (2 เท็กซ์เจอร์) หรือ integral image บน CPU สำหรับ 1600×1200 ใช้เวลาไม่ถึง 50 ms ทั้งสองแบบ ผลคือเส้นขอบขาเก้าอี้/ชายผ้าตามขอบจริงของภาพแม้ mask ต้นทางมีแค่ 128×128

### 5.5 ระนาบพื้น → homography

**C2: จากจุดอันตรธาน (MVP)**

```
1. edge = Canny(gray) เฉพาะใน dilate(mask, 20px)  (เอาเส้นร่องพื้น + รอยต่อพื้น-ผนัง)
2. segments = Hough แบบ probabilistic หรือ LSD แบบง่าย (ความยาว ≥ 2% ของกว้างภาพ)
3. ตัดเส้นแนวดิ่ง (|θ-90°| < 10°) ออก → เหลือเส้นบนระนาบพื้น
4. คลัสเตอร์มุมเป็น 2 กลุ่ม (k-means บน θ, วน) → RANSAC หาจุดตัดร่วม VP1, VP2 (พิกัด homogeneous ได้ที่อนันต์)
5. เส้นขอบฟ้า h = VP1 × VP2 (cross product)   ถ้าได้ VP เดียว: h ผ่าน VP1 และขนานแกน x (สมมติ roll=0)
6. คุณภาพ = สัดส่วน inlier; ถ้า < 40% ใช้ค่าเริ่มต้น h: y = .45·height และตั้งธง needsManualRails
```

จากเส้นขอบฟ้า `h` และ focal length `f` (ประมาณ 0.85·กว้างภาพ หรือจาก EXIF `FocalLengthIn35mmFilm`: `f = 36mm_equiv/36 · width`) ได้ normal ของพื้น `n = K^T h` (normalize) แล้วสร้าง **เฟรมบนพื้น**:

```
K = [[f,0,cx],[0,f,cy],[0,0,1]]
n = normalize(Kᵀ · h)                      // normal ของระนาบพื้นในพิกัดกล้อง (ชี้ขึ้น)
d = 1.5 m                                   // ระยะกล้องจากพื้น ค่าสมมติ (กำหนดสเกลแผ่น; ผู้ใช้ปรับ "ขนาดแผ่น" ได้)
P0 = ray(anchor pixel) ∩ plane(n,d)         // จุดอ้างอิงบนพื้น (จุดศูนย์กลาง mask)
u = normalize(cross(n, K⁻¹·VP1 ถ้ามี, ไม่งั้นแกน z ของกล้องฉายลงระนาบ))   // ทิศแผ่นเริ่มต้น
v = cross(n, u)
H = K · [u  v  P0]                          // (s,t,1) เมตรบนพื้น → พิกเซล (homogeneous)
Hinv = H⁻¹                                  // ใช้ใน shader: พิกเซล → (s,t)
```

**C3: จากความลึก (เฟส 2)**

```
depth = DepthAnythingV2-small(img)            // relative inverse-depth 518²
Z = 1 / (a·depth + b)  (a,b จาก prior ความสูงกล้อง 1.5 m: ปรับให้มัธยฐาน Z ของพื้นแถวล่างภาพ ≈ 2.5 m)
points = K⁻¹ · (x,y,1) · Z   เฉพาะพิกเซล alpha > .8
(n,d) = RANSAC plane fit (threshold 3 cm, 200 iters) → ใช้แทนขั้น 5 ของ C2
occlusion: พิกเซลใน dilate(mask) ที่ |n·P - d| > 5 cm และ Z น้อยกว่าระนาบ → วัตถุหน้า → alpha = 0
```

ความลึกยังช่วย "หมุนลายให้ขนานผนัง" และให้สเกลแผ่นถูกต้องขึ้นเมื่อมีวัตถุขนาดรู้จัก (ประตู ≈ 2 m) ซึ่งเป็น V3

**การปรับมือ (ทุกเฟส):** overlay "ราง 2 เส้น" บนพื้น (เส้นที่ควรขนานกันในโลกจริง) ผู้ใช้ลาก 4 จุด → VP1 = จุดตัด → คำนวณ H ใหม่แบบเรียลไทม์ ง่ายกว่าการลาก 4 มุมเดิมและไม่ต้องหาที่โล่ง

### 5.6 Shader เรนเดอร์ (WebGL2, quad เดียว)

```glsl
#version 300 es
precision highp float;
uniform sampler2D uPhoto;     // ภาพเดิม (sRGB)
uniform sampler2D uAlpha;     // alpha พื้น (จาก 5.4 + occlusion)
uniform sampler2D uShade;     // shading map (5.7) : R = detail, G = tone
uniform sampler2D uPlank;     // tile ลายแผ่น (albedo, linear), repeat
uniform vec2  uResolution;    // ขนาดภาพทำงาน (px)
uniform mat3  uHinv;          // พิกเซล → floor-space (เมตร)
// atlasUv() และ hash() เป็นฟังก์ชันช่วย (ละไว้): เลือกช่องแผ่นใน atlas 4×4 แบบสุ่มคงที่ต่อแผ่น
uniform vec2  uPlankSize;     // (1.220, 0.180) เมตร
uniform float uRotate;        // 0 / 90° / มุมตาม VP
uniform float uStagger;       // 1/3 = ปูเหลื่อม
uniform vec3  uTargetMeanRGB; // ค่าเฉลี่ยสีพื้นเดิม (linear) สำหรับ WB เบา ๆ
uniform float uGrout;         // ความเข้มร่องแผ่น
in vec2 vUv; out vec4 outColor;

vec3 toLinear(vec3 c){ return pow(c, vec3(2.2)); }
vec3 toSRGB(vec3 c){ return pow(c, vec3(1.0/2.2)); }

void main(){
  vec3 photo = texture(uPhoto, vUv).rgb;
  float a = texture(uAlpha, vUv).r;
  if (a < 0.002) { outColor = vec4(photo, 1.0); return; }

  // 1) พิกเซล → ตำแหน่งบนพื้น (เมตร)
  vec3 p = uHinv * vec3(vUv * uResolution, 1.0);
  vec2 st = p.xy / p.z;
  float c = cos(uRotate), s = sin(uRotate);
  st = mat2(c, -s, s, c) * st;

  // 2) แผ่น: แถว = t / กว้างแผ่น, เหลื่อมแต่ละแถว
  float row = floor(st.y / uPlankSize.y);
  float sOff = st.x + row * uStagger * uPlankSize.x;
  vec2 plankUv = vec2(fract(sOff / uPlankSize.x), fract(st.y / uPlankSize.y));
  // สุ่มเลือกแผ่นย่อยใน atlas เพื่อไม่ให้ลายซ้ำ (hash ของ row, floor(sOff/len))
  vec3 albedo = texture(uPlank, atlasUv(plankUv, hash(row, floor(sOff / uPlankSize.x)))).rgb;
  // ร่องแผ่น (bevel) นุ่มตามระยะ ใช้ fwidth เพื่อไม่ aliasing ไกล ๆ
  float edge = min(min(plankUv.x, 1.0 - plankUv.x) * uPlankSize.x, min(plankUv.y, 1.0 - plankUv.y) * uPlankSize.y);
  albedo *= 1.0 - uGrout * (1.0 - smoothstep(0.0, 0.002 + fwidth(edge) * 2.0, edge));

  // 3) ถ่ายโอนแสงเงา
  vec2 sh = texture(uShade, vUv).rg;           // detail (รอบ 1.0), tone (0..2)
  vec3 lit = albedo * sh.y * sh.x;
  lit *= uTargetMeanRGB / max(dot(uTargetMeanRGB, vec3(.333)), 1e-3) * 0.25 + 0.75; // WB เบา ๆ 25%

  // 4) เก็บไฮไลต์สะท้อน (แสงหน้าต่างบนพื้นมัน): screen เฉพาะส่วนที่สว่างจัดในภาพเดิม
  float spec = smoothstep(0.85, 1.0, dot(toLinear(photo), vec3(.299,.587,.114)));
  lit = mix(lit, 1.0 - (1.0 - lit) * (1.0 - toLinear(photo)), spec * 0.6);

  outColor = vec4(mix(photo, toSRGB(lit), a), 1.0);
}
```

ทำไม **ไม่ใช้ three.js**: ฉากนี้คือ quad เต็มจอกับ 4 เท็กซ์เจอร์ โค้ด WebGL2 ดิบประมาณ 150 บรรทัด (สร้าง program, upload texture, draw) three.js เพิ่ม ~600 KB โดยไม่ได้ใช้ scene graph/แสง/กล้องเลย และ CPU fallback (เขียน loop เดียวกันใน JS บน `ImageData` เหมือน `warpTexture()` เดิม) ยังใช้ได้กับเบราว์เซอร์ที่ WebGL ล้มเหลว ส่วน three.js ที่มีอยู่ใช้ต่อในส่วน hero/story ตามเดิม

### 5.7 Shading map (คำนวณครั้งเดียวต่อรูป)

```
L  = luminance(linear(photo))                            เฉพาะใน alpha > .5 (นอกนั้นเติมด้วย normalized convolution)
B  = blur(L, σ = 4% ของกว้างภาพ)  แบบ mask-aware (หารด้วย blur(alpha))
detail = clamp(L / max(B, ε), 0.3, 1.8)                 // เงา/รอยต่อ/ขาเก้าอี้ ความถี่สูง
tone   = B / mean(B)                                     // ไล่สว่างทั่วห้อง (หน้าต่าง)
// ป้องกัน "ลายเดิมติดมา": ถ้าพื้นเดิมเป็นกระเบื้องลายเข้ม detail จะมีเส้นร่องเดิม → ทำ median 5px ก่อน และ blend detail เข้าหา 1.0 ตามค่า uDetailStrength (ค่าเริ่มต้น .8, ผู้ใช้ปรับได้ "เก็บเงาเดิม")
targetMeanRGB = mean(linear(photo) ใน alpha>.5)
```

เมื่อเทียบกับโค้ดเดิม: ขั้นนี้คือสิ่งที่ `color`/`multiply`/`soft-light` พยายามทำโดยอ้อม การแยก detail/tone ออกมาชัดทำให้สีเข้ม (Walnut) ไม่ซีดและสีอ่อน (Light Oak) ไม่มืดเกินจริง ไม่ต้องตั้ง α ต่อสีอีก

### 5.8 ห้องตัวอย่าง (precompute)

ห้องตัวอย่าง 7 ห้องไม่ต้องรันโมเดลบนเครื่องผู้ใช้: รันไปป์ไลน์เดียวกันแบบออฟไลน์ (สคริปต์ Node + onnxruntime-node หรือ Python) แล้วเก็บ `rooms/<id>.json` (H, horizon, roomType) + `rooms/<id>-alpha.png` + `rooms/<id>-shade.png` ไว้ใน `public/website/rooms/` → หน้าแรกเปลี่ยนสีได้ทันทีโดยไม่โหลดโมเดล และคุณภาพเท่ากับรูปอัปโหลด (แทนที่ `FLOOR_MASKS` วาดมือ)

### 5.9 เวลาและขนาดที่คาดหวัง

ตัวเลขด้านล่างเป็น **ประมาณการ** จากขนาดโมเดล/FLOPs และ anchor ที่ตีพิมพ์ (หัวข้อ 3.6) ต้องยืนยันด้วย `tests/visualizer-browser.mjs` บนเครื่องจริงในเฟส 1 (อย่าวัดในเบราว์เซอร์ที่ซ่อนอยู่ เพราะ rAF/timer จะหยุด)

| ขั้น | ดาวน์โหลด (ครั้งแรก, cache ได้) | เดสก์ท็อป WebGPU | มือถือกลาง ๆ WebGPU (Android 12+/iOS 26) | มือถือ WASM เท่านั้น |
| --- | --- | --- | --- | --- |
| โหลด ORT runtime + สร้าง session | ort wasm ~5 MB + โมเดล 4–8 MB | 0.5–1.5 s | 1–3 s | 1–3 s |
| Segmentation 512² (EfficientViT-B1 q8 / SegFormer-B0 q8) | รวมข้างบน | 50–200 ms | 200–800 ms | 1–4 s |
| Guided filter 1600 px | — | <20 ms (WebGL) | 20–60 ms | 50–150 ms (CPU) |
| เส้น/จุดอันตรธาน | — | 20–80 ms | 50–200 ms | 50–200 ms |
| Shading map | — | <20 ms | 30–80 ms | 80–200 ms |
| เรนเดอร์ต่อเฟรม (เปลี่ยนสี/หมุน) | atlas ลายสร้างครั้งเดียว ~50–150 ms ต่อสี | <5 ms | <16 ms | 100–400 ms (CPU fallback) |
| **รวมถึงเห็นผลครั้งแรก (เฟส 1)** | ~10–13 MB | **~1–2 s** | **~2–4 s** | **~3–8 s** |
| (เฟส 2) Depth Anything V2 Small 518² | +19–27 MB | 0.2–0.6 s | 1–3 s | ไม่แนะนำ (10 s+) → ข้ามหรือใช้เซิร์ฟเวอร์ |
| (เฟส 2) SlimSAM-77 encoder 1024² / decoder ต่อคลิก | +14 MB | 0.3–1 s / <30 ms | 1–3 s / <80 ms | 4–10 s / 100–300 ms |
| (เทียบ) Roomvo | 6.5 MB JS | อัปโหลด+หาพื้น ~2.5 s แล้วรอเรนเดอร์ **0.5–1.2 s ทุกครั้งที่เปลี่ยนสี** | เท่ากัน (ขึ้นกับเครือข่าย) | เท่ากัน |

จุดที่เราได้เปรียบเชิงโครงสร้าง: หลังสแกนครั้งแรก การเปลี่ยนสี/หมุน/ปรับขนาดแผ่นของเราเป็นเรียลไทม์บนเครื่อง ขณะที่ Roomvo ต้องรอเซิร์ฟเวอร์ทุกครั้ง

### 5.10 โครงสร้างไฟล์ที่เสนอ (Vite + TypeScript เดิม)

```
src/website/visualizer/
  index.ts                 // FloorVisualizer (แทน RoomPreview) API เดิม: setRoom/setFinish/setCompare/upload + ใหม่: setRotation, setPlankScale, refine(point), rails()
  prepare.ts               // decode/EXIF/resize/letterbox
  segmentation.worker.ts   // ONNX Runtime Web + SegFormer, โหลดแบบ lazy, cache ใน Cache Storage
  mask/guidedFilter.ts     // WebGL + CPU
  geometry/lines.ts        // Canny/Hough แบบเบา
  geometry/vanishing.ts    // คลัสเตอร์ + RANSAC VP, horizon
  geometry/plane.ts        // K, n, d, frame → H (+ depth RANSAC ในเฟส 2)
  render/FloorRenderer.ts  // WebGL2 quad, textures, uniforms
  render/shaders.ts
  render/shading.ts        // shading map
  texture/plankAtlas.ts    // generateWoodPixels → atlas 4×4 แผ่น, ก้างปลา
  ui/Scanner.ts            // แอนิเมชันสแกน + ข้อความสถานะ
  ui/RailsEditor.ts        // ราง 2 เส้น / แปรง mask / 4 มุม (เดิม)
  ui/CompareSlider.ts
public/website/models/floor-seg-q8.onnx     // EfficientViT-B1 (ขึ้นจริง) หรือ SegFormer-B0 (ต้นแบบ) + ort-wasm-simd-threaded.jsep.wasm จาก node_modules ผ่าน vite asset
public/website/models/{slimsam77-enc,slimsam77-dec,depth-anything-v2-small}-*.onnx   // เฟส 2 โหลดเมื่อจำเป็น
scripts/precompute-rooms.mjs
scripts/export-efficientvit-seg.py          // export + quantize ONNX ครั้งเดียว (Python, ไม่ใช่ส่วนของเว็บ)
tests/visualizer-geometry.test.ts (homography/VP/plane: ตรวจกับภาพสังเคราะห์ที่รู้คำตอบ)
tests/visualizer-browser.mjs      (Playwright: อัปโหลดรูปตัวอย่าง 5 รูป → ตรวจ IoU กับ mask อ้างอิง ≥ .85, เวลา, ไม่มี error)
```

`vite.config.ts` ต้องเพิ่ม: `optimizeDeps.exclude: ['onnxruntime-web']`, header `Cross-Origin-Opener-Policy/Embedder-Policy` ใน dev/preview ถ้าต้องการ WASM multi-thread (ไม่บังคับ; single-thread ยังพอ) และ copy ไฟล์ `.wasm/.mjs` ของ ort ไปยัง `assets/`

---

## 6. ประสบการณ์ผู้ใช้ (UX) ที่ออกแบบ

1. **ก่อนอัปโหลด**: ตัวอย่าง "รูปที่ถ่ายดี" 3 แบบ (ยืนถ่ายระดับอก เห็นพื้น ≥ 1/3 ภาพ แสงกลางวัน) + ปุ่ม "ถ่ายรูป" (`capture="environment"` บนมือถือ) + ลากวาง + วางจากคลิปบอร์ด
2. **ระหว่างประมวลผล (1–4 วินาที)**: แอนิเมชัน "สแกน" เส้นแสงม่วงกวาดผ่านภาพ แล้วค่อย ๆ เผย mask สีม่วงโปร่ง 30% ("พบพื้น 38% ของภาพ") → เป็นการให้ feedback ที่ Roomvo ไม่มี และซ่อน latency
3. **ผลอัตโนมัติ**: พื้นเปลี่ยนเป็นสีที่เลือกอยู่ทันที พร้อม chip เล็ก "ดูถูกต้องไหม? [ปรับขอบ] [ปรับมุม]" เฉพาะเมื่อความมั่นใจต่ำ (inlier < 60% หรือ mask area น้อย)
4. **ปรับขอบ**: โหมดคลิก/แตะ "+ พื้น / − ไม่ใช่พื้น" (SAM ในเฟส 2, แปรงในเฟส 1) และยางลบ
5. **ปรับมุม**: ราง 2 เส้นลากได้ + slider "ขนาดแผ่น" และปุ่ม "หมุน 90°" (เทียบ Roomvo "หมุน")
6. **เปรียบเทียบ**: slider ลากได้, ฝั่งซ้าย/ขวาเลือกสินค้าคนละตัว, ปุ่ม "ก่อน/หลัง" แบบกดค้าง
7. **ส่งออก**: ดาวน์โหลด PNG 1600/2048 px มีโลโก้ COOLPLAN มุมล่าง + ชื่อรุ่น, แชร์ Web Share API, ปุ่ม "ขอใบเสนอราคาสำหรับห้องนี้" ส่งไปหน้า calculator พร้อมรุ่นที่เลือก (เชื่อม conversion)
8. **ความเป็นส่วนตัว**: ข้อความ "รูปของคุณประมวลผลบนเครื่องนี้ ไม่ถูกอัปโหลด" เมื่อใช้โหมด client; ถ้าเปิดเซิร์ฟเวอร์ต้องมี toggle + นโยบายลบทันที
9. **เข้าถึงได้**: คงคีย์บอร์ด/ARIA ที่มีอยู่, ทุกเครื่องมือมีปุ่มแทนการลาก, `prefers-reduced-motion` ปิดแอนิเมชันสแกน

สีแบรนด์: ใช้ `--purple` สำหรับ mask/ราง/สถานะ และส้ม `#e9773e` เฉพาะ CTA ("ขอใบเสนอราคา")

---

## 7. แผนงานเป็นเฟสและประมาณการ

| เฟส | สิ่งที่ได้ | งานหลัก | ประมาณการ |
| --- | --- | --- | --- |
| **0 · ฐานใหม่** (ทำก่อนทุกอย่าง) | ห้องตัวอย่างสวยขึ้นทันที, เปลี่ยนสีลื่น, โค้ดแยกส่วนพร้อมต่อยอด | แยก `roomPreview.ts` เป็น `visualizer/`; `FloorRenderer` WebGL2 + CPU fallback; `plankAtlas` จาก `generateWoodPixels`; shading map 5.7; CompareSlider ลากได้; precompute mask/H ของ 7 ห้องด้วยสคริปต์ (รันโมเดลใน Node); ทดสอบ Playwright เดิมผ่าน | 6–8 วันคน |
| **1 · MVP อัตโนมัติ** | อัปโหลดแล้วได้พื้นใหม่เองใน ≤4 วินาที, มีเครื่องมือแก้ | worker + ONNX Runtime Web; ต้นแบบด้วย SegFormer-B0 q8 แล้ว **export EfficientViT-Seg-B1 เป็น ONNX q8 (1–2 วัน) ก่อนปล่อยจริง**; guided filter; VP/horizon + ราง 2 เส้น; Scanner UX; แปรง mask; ดาวน์โหลด/แชร์; วัดเวลาและ fallback WASM; ชุดภาพทดสอบ 30 รูป (ห้องไทยจริง: คอนโด ทาวน์โฮม บ้านเดี่ยว แสงต่างกัน) พร้อม mask อ้างอิงจาก Mask2Former-large รันออฟไลน์ | 10–12 วันคน |
| **2 · คุณภาพระดับ Roomvo** | ขาเก้าอี้/ของบนพื้นบังถูกต้อง, คลิกแก้ขอบได้, สเกลแผ่นสมจริงขึ้น | Depth Anything v2 Small (WebGPU เท่านั้น) → plane RANSAC + occlusion; SlimSAM/MobileSAM click-refine (encoder รันครั้งเดียว decoder <100 ms); หมุนตาม VP; HEIC; cache โมเดลใน Cache Storage; OpenRouter VLM สำหรับประเภทห้อง/คำแนะนำสีผ่าน edge function พร้อม fallback | 12–15 วันคน |
| **3 · เทียบชั้น/แซง** | ความละเอียดสูง, อัปโหลดจากมือถือด้วย QR, วิเคราะห์ | เซิร์ฟเวอร์ตัวเลือก (FastAPI บน CPU VPS หรือ HF Space): SegFormer-B2/Mask2Former + export 4K; ช่องทาง QR → session (WebSocket/Supabase Realtime); analytics (เวลา, อัตราใช้โหมดปรับมือ, สีที่ดูบ่อย → ส่งต่อทีมขาย); A/B กับหน้าเดิม; ตัวเลือก AR (WebXR hit-test) ถ้าต้องการ | 10–15 วันคน |

รวมเฟส 0–2 ≈ **28–35 วันคน (~7–9 สัปดาห์)** เฟส 3 แยกตัดสินใจตามผลใช้งานจริง

**เริ่มสัปดาห์แรกอย่างไร (เฟส 0)**

1. สร้าง `src/website/visualizer/render/FloorRenderer.ts` ที่รับ `{photo, alpha, shade, H, plankAtlas}` แล้ววาด quad ใช้กับห้องตัวอย่างห้องแรกก่อน เปรียบเทียบภาพกับผลเดิมด้วย Playwright screenshot
2. เขียน `scripts/precompute-rooms.mjs` รัน SegFormer-B0 ผ่าน `onnxruntime-node` กับ 7 crop เดิม → เก็บ alpha PNG; ตรวจด้วยตาและแก้มือใน image editor ถ้าจำเป็น (ทำครั้งเดียว)
3. ย้าย `main.ts` มาใช้ `FloorVisualizer` ผ่าน API เดิม (`setRoom/setFinish/setCompare/setView/upload/resetUpload/diagnostics`) เพื่อไม่กระทบ `tests/website-browser.mjs`

---

## 7.1 สถานะการลงมือ (อัปเดต 27 ต.ค. 2026): เฟส 0 เสร็จในสาขางาน (ยังไม่ commit)

สิ่งที่มีในโค้ดแล้ว

| ส่วน | ไฟล์ | หมายเหตุ |
| --- | --- | --- |
| เรขาคณิต | `src/website/visualizer/geometry/homography.ts` | `homographyFromQuad`, `floorFrame` (เส้นขอบฟ้า + focal + anchor → H/Hinv เมตร↔พิกเซล), ทดสอบใน `tests/visualizer-geometry.test.ts` |
| ขอบนุ่ม | `src/website/visualizer/mask/guidedFilter.ts` | guided filter + box blur + resize + luminance (pure, ใช้ได้ทั้ง Node และเบราว์เซอร์) |
| แสงเงา | `src/website/visualizer/render/shading.ts` | detail/tone map แบบ mask-aware ตาม §5.7 |
| เรนเดอร์ | `src/website/visualizer/render/FloorRenderer.ts` | WebGL2 quad เดียว (shader ตาม §5.6) + CPU fallback พิกเซลต่อพิกเซล; เปลี่ยนสี/หมุน <16 ms |
| ลายไม้ | `src/website/visualizer/texture/plankAtlas.ts` | atlas 4 แผ่น/สินค้า จาก `generateWoodPixels` (seed ต่างกันต่อแผ่น) ~0.3 s ต่อสินค้า สร้างล่วงหน้าตอน idle |
| ห้องตัวอย่าง | `src/website/visualizer/rooms.ts` + `public/website/rooms/room-*-alpha.png` | matte 7 ห้องจาก `npm run precompute:rooms` (SegFormer-B0 ใน headless Chrome + guided filter; โมเดลอยู่นอก repo) ค่ากล้องต่อห้องปรับมือ; polygon เดิมเป็น fallback |
| ตัวควบคุม | `src/website/visualizer/index.ts`, `src/website/main.ts`, `src/website/visualizer.css` | `FloorVisualizer` แทน `RoomPreview` (API เดิมครบ + `rotate()`/`setRotation`/`setComparePosition`), slider เปรียบเทียบลากได้ (เมาส์/นิ้ว/ลูกศร), ปุ่ม "หมุนลายแผ่น" ใส่จาก TS โดยไม่แก้ `index.html` |

## 7.2 สถานะเฟส 1–3 (อัปเดต 27 ต.ค. 2026, ยังไม่ commit)

**เฟส 1 — ตรวจหาพื้นอัตโนมัติบนเครื่องผู้ใช้ (เสร็จ)**

| ส่วน | ไฟล์ | หมายเหตุ |
| --- | --- | --- |
| Worker + ONNX Runtime Web | `src/website/visualizer/vision.worker.ts` | โหลดโมเดลผ่าน Cache Storage (`models.ts`), ลอง WebGPU ก่อนแล้วถอยเป็น WASM, งาน `segment` / `depth` / `sam-embed` / `sam-click` |
| เตรียมภาพ | `prepare.ts` | decode พร้อม EXIF orientation (HEIC ผ่าน `createImageBitmap` → `<img>` fallback), ย่อ ≤1600 px, tensor 512² / 518 / 1024² |
| ขอบฟ้าอัตโนมัติ | `geometry/vanishing.ts` (+ `tests/visualizer-vanishing.test.ts`) | Sobel → Hough แบบใช้ทิศ gradient → RANSAC จุดอันตรธาน; ถ้าไม่มั่นใจใช้ค่าเริ่มต้นจากขอบบนของ mask และให้ผู้ใช้ลากเอง |
| ทำความสะอาด mask | `mask/cleanup.ts` | ตัด blob เล็กที่ไม่ติดกับพื้นหลัก |
| สเกลแผ่นอัตโนมัติ | `index.ts#autoCameraHeight` | สมมติพื้นที่เห็นลึก ~4 m เลือกความสูงกล้องให้สอดคล้อง ผู้ใช้ปรับต่อด้วย "ขนาดแผ่น" |
| UX สแกน | `index.ts#drawScanner` | แถบกวาด + ความคืบหน้าดาวน์โหลดโมเดล, เผย mask สีม่วง 0.9 s, เคารพ `prefers-reduced-motion` |
| เครื่องมือปรับมือ | `ui/Toolbar.ts`, `visualizer.css` | แปรงเพิ่ม/ลบ, เส้นขอบฟ้าลากได้ (+ลูกศร), ขนาดแผ่น, คืนค่าขอบ, สแกนใหม่, เลือก 4 มุมเอง (fallback อัตโนมัติเมื่อโมเดลล้มเหลวหรือพบพื้น <3%) |
| ส่งออก | `index.ts#exportImage`, Toolbar | ดาวน์โหลด JPEG พร้อมคำบรรยายสินค้า, แชร์ผ่าน Web Share API เมื่อมี |

วัดจริง (headless Chrome, WASM เธรดเดียว, รูป 1600×1067, เครื่องพัฒนา): ครั้งแรกรวมดาวน์โหลดโมเดล 4.4 MB **6.7 s** (load 4.4 s · infer 1.7 s · refine 0.5 s · horizon 0.03 s) ครั้งถัดไป (cache แล้ว) **4.0 s** (load 1.8 s · infer 1.8 s) ขอบที่ได้ครอบคลุม 50% ของภาพและบังโซฟา/โต๊ะ/กระถางถูกต้อง (`test-results/website/browser-report.json` ฟิลด์ `desktopScan`/`mobileScan`)

**เฟส 2 — ความลึก, คลิกแก้ขอบ, คำแนะนำ AI (เสร็จ)**

| ส่วน | ไฟล์ | วัดจริง (WASM เธรดเดียว) |
| --- | --- | --- |
| ความลึก → ตัดวัตถุบนพื้น | `geometry/depthPlane.ts` (fit ระนาบใน inverse-depth แบบ affine-invariant ด้วย RANSAC) | Depth Anything V2 Small **q8 ≈ 4–6 s** ที่ 518×686 (q4f16/fp16 ≈ 17 s บน WASM จึงใช้ q8 เมื่อไม่มี WebGPU และ q4f16 เมื่อมี) รันอัตโนมัติเฉพาะ WebGPU นอกนั้นเป็นปุ่ม "แยกวัตถุด้วยความลึก" |
| คลิกเพิ่ม/ลบด้วย SlimSAM-77 | `vision.worker.ts#samEmbed/samClick`, `index.ts#applySamMask` | encoder ครั้งเดียว **~17 s WASM** (ต้องมี WebGPU ถึงจะเร็ว) ส่วน decoder **~0.36 s ต่อคลิก** ทดสอบลบโต๊ะ/เพิ่มพื้นแล้วค่า coverage เปลี่ยนตามคาด |
| หมุนแผ่นตามจุดอันตรธาน | `geometry/homography.ts#rotationTowards` | ใช้เมื่อความมั่นใจของ VP ≥ .25 |
| HEIC, cache โมเดล | `prepare.ts`, `models.ts` | — |
| คำแนะนำสีจาก VLM ฟรี | `advice.ts` + `server/edge/room-advice.ts` (Cloudflare Worker เรียก OpenRouter) | ปิดไว้จนกว่าจะตั้ง `VITE_ROOM_ADVICE_URL`; ถามยินยอมก่อนส่งภาพย่อ 512 px; ยังไม่ได้ deploy/ทดสอบกับคีย์จริง |

**เฟส 3 — เทียบชั้น Roomvo (ทำในส่วนที่ทำได้โดยไม่มีบัญชีบริการภายนอก)**

| ส่วน | สถานะ |
| --- | --- |
| เซิร์ฟเวอร์ตัวเลือก (FastAPI `/segment` ด้วย OneFormer MIT, `/depth`) | โค้ดอ้างอิง + Dockerfile ใน `server/floor-api/` ยังไม่ได้รัน (ไม่มี Python ในเครื่องที่พัฒนา) |
| อัปโหลดจากมือถือด้วย QR | ทำแล้ว: ปุ่ม "ถ่ายด้วยมือถือ" เปิด dialog QR (`ui/QrDialog.ts`, `qrcode-generator` MIT) ชี้มาหน้านี้พร้อม `#upload-room` ซึ่งเลื่อนมาที่ visualizer เอง; มือถือประมวลผลรูปของตัวเอง ไม่ต้องมี session บนเซิร์ฟเวอร์ |
| Analytics | `analytics.ts`: event upload/scan/tool/depth/sam/finish/export/advice → `dataLayer` และ/หรือ `VITE_ANALYTICS_URL` ผ่าน sendBeacon (ไม่มีรูป) |
| ส่งออก 4K จากเซิร์ฟเวอร์, A/B test, AR (WebXR) | ยังไม่ทำ: ต้องมีโฮสต์/บัญชีจริงและข้อมูลการใช้งานก่อนตัดสินใจ |

**งานที่เหลือก่อนปล่อยจริง**: (1) export EfficientViT-Seg-B1 เป็น ONNX q8 แทนน้ำหนัก SegFormer ของ NVIDIA (ต้องใช้ Python/PyTorch) แล้วตั้ง `VITE_MODEL_FLOOR_SEG`; (2) โฮสต์ไฟล์โมเดลเอง (ตอนนี้โหลดจาก Hugging Face CDN); (3) ชุดภาพทดสอบห้องไทยจริง 30 รูป; (4) ย้ายการสร้าง atlas ลายไม้ไป worker ถ้าพบว่ามือถือกระตุก; (5) deploy edge function + ทดสอบกับคีย์จริง

## 8. ความเสี่ยงและข้อควรระวัง

| ความเสี่ยง | ผลกระทบ | การรับมือ |
| --- | --- | --- |
| สัญญาอนุญาตน้ำหนักโมเดล (SegFormer-ADE ของ NVIDIA = วิจัยเท่านั้น, Depth Anything V2 Base/Large = CC-BY-NC, EdgeSAM = ไม่เชิงพาณิชย์, Intrinsic/RGB↔X = วิชาการ) | ใช้เชิงพาณิชย์ไม่ได้/ต้องขอ | ใช้ชุด Apache-2.0/MIT ที่ระบุในหัวข้อ 3 (EfficientViT-Seg, SlimSAM, Depth Anything V2 Small, OneFormer) และใช้ SegFormer เฉพาะต้นแบบภายใน; เก็บไฟล์ LICENSE ไว้ใน `THIRD_PARTY_NOTICES.txt` |
| สิทธิบัตรของ Leap Tools (Roomvo) ตระกูล "product visualization using a single-page application" (US 10,817,648 และต่อเนื่อง) | ความเสี่ยงทางกฎหมายถ้าขยายเป็น widget ให้เว็บอื่นฝัง | claims เน้นการฉีด script เข้าหน้าร้านค้าบุคคลที่สาม ระบบของเราอยู่บนเว็บตัวเองและใช้เทคนิคสาธารณะ (segmentation + homography) แต่ **ควรให้ที่ปรึกษากฎหมายทบทวนก่อนทำเป็นบริการให้ร้านอื่น** (เอกสารนี้ไม่ใช่คำแนะนำทางกฎหมาย) |
| มือถือเก่า/iOS ไม่มี WebGPU, หน่วยความจำจำกัด | ช้าหรือแท็บล่ม | จำกัดภาพทำงาน 1600 px, โมเดล q8, ปล่อย tensor ทันที, วัดเวลาแล้วสลับไปเซิร์ฟเวอร์/โหมดมือ |
| โมเดลพลาดกับพื้นไทยบางแบบ (กระเบื้องลายหินอ่อนขัดเงาสะท้อน, พื้นปูนขัดมัน, พรมทั้งห้อง) | ผลเพี้ยน | ชุดทดสอบภาพไทย 30+ รูปตั้งแต่เฟส 1; เครื่องมือแก้ขอบต้องมีเสมอ; ตัวเลือก "รวมพรม" |
| สะท้อนบนพื้นมัน (reflection) | ลายใหม่ไม่มีเงาสะท้อนเฟอร์นิเจอร์ ดูแบน | shading detail เก็บสะท้อนบางส่วนไว้แล้ว; V3 อาจเพิ่ม "ความมัน" ด้วย screen ของภาพเดิม |
| PDPA / รูปห้องส่วนตัว | ความเชื่อมั่น | ค่าเริ่มต้น client-only; เซิร์ฟเวอร์ต้อง opt-in และไม่เก็บรูป; ไม่ส่งรูปให้ OpenRouter โดยไม่ยินยอม |
| ขนาดบันเดิล | หน้าแรกช้า | โหลด ORT + โมเดลแบบ lazy เฉพาะเมื่อกดอัปโหลด (dynamic import), ห้องตัวอย่างใช้ไฟล์ precompute |
| รูป HEIC จาก iPhone | เปิดไม่ได้ | Safari decode ได้เอง; Chrome/Android ใช้ `heic2any` (lazy) หรือแนะนำให้ตั้งกล้องเป็น "Most compatible" |

---

## 9. อ้างอิง

**โมเดลและรันไทม์**

- SegFormer: https://github.com/NVlabs/SegFormer · https://huggingface.co/nvidia/segformer-b0-finetuned-ade-512-512 (สัญญาอนุญาต) · พอร์ต https://huggingface.co/Xenova/segformer-b0-finetuned-ade-512-512
- EfficientViT-Seg: https://github.com/mit-han-lab/efficientvit (Apache-2.0)
- Mask2Former: https://github.com/facebookresearch/Mask2Former · OneFormer: https://github.com/SHI-Labs/OneFormer (MIT)
- SlimSAM: https://github.com/czg1225/SlimSAM · https://huggingface.co/Xenova/slimsam-77-uniform · MobileSAM: https://github.com/ChaoningZhang/MobileSAM · EfficientSAM: https://github.com/yformer/EfficientSAM · EdgeSAM (non-commercial): https://github.com/chongzhou96/EdgeSAM
- SAM 2: https://github.com/facebookresearch/sam2 · https://huggingface.co/onnx-community/sam2.1-hiera-tiny-ONNX · SAM 3: https://github.com/facebookresearch/sam3
- ViTMatte: https://huggingface.co/Xenova/vitmatte-small-distinctions-646 · CLIPSeg: https://huggingface.co/CIDAS/clipseg-rd64-refined · Grounding DINO: https://huggingface.co/IDEA-Research/grounding-dino-tiny
- Depth Anything V2: https://github.com/DepthAnything/Depth-Anything-V2 · https://huggingface.co/onnx-community/depth-anything-v2-small · Depth Pro: https://github.com/apple/ml-depth-pro · Metric3D: https://github.com/YvanYin/Metric3D
- Intrinsic (Careaga & Aksoy): https://github.com/compphoto/Intrinsic · RGB↔X: https://github.com/zheng95z/rgbx · FLUX Fill: https://huggingface.co/black-forest-labs/FLUX.1-Fill-dev · Qwen-Image-Edit: https://huggingface.co/Qwen/Qwen-Image-Edit
- ONNX Runtime Web: https://www.npmjs.com/package/onnxruntime-web · transformers.js v3: https://huggingface.co/blog/transformersjs-v3 · WebGPU support: https://web.dev/blog/webgpu-supported-major-browsers
- Texture re-rendering (Liu et al. 2017): https://library.imaging.org/ei/articles/29/10/art00014 · Virtual Home Staging: https://arxiv.org/abs/2311.12265 · Grid Dynamics wall retexturing pipeline: https://griddynamics.com/?p=4247 · Manhattan world (Coughlan & Yuille 1999)
- LSD for JS (AGPL-3.0 ระวังสัญญาอนุญาต): https://www.jsdelivr.com/package/npm/line-segment-detector · OpenCV.js ขนาด 6–8 MB (build เองเหลือ ~1.5 MB) → เขียน Canny/Hough เองเล็กกว่า

**OpenRouter และโฮสต์**

- https://openrouter.ai/api/v1/models · https://openrouter.ai/docs/api-reference/limits · https://openrouter.ai/docs/features/privacy-and-logging · เงื่อนไข Gemini API (ทีเออร์ฟรี): https://ai.google.dev/gemini-api/terms · Gemini grounding: https://ai.google.dev/gemini-api/docs/image-understanding · Qwen3-VL report: https://arxiv.org/pdf/2511.21631
- ข้อจำกัด grounding ของ VLM: https://arxiv.org/html/2509.21922v1 · https://arxiv.org/pdf/2510.08759
- https://huggingface.co/docs/inference-providers/pricing · https://huggingface.co/docs/hub/spaces-zerogpu · https://replicate.com/pricing · https://modal.com/pricing · https://developers.cloudflare.com/workers-ai/platform/pricing/ · https://www.hetzner.com/cloud/ · https://contabo.com/en/vps/ · https://www.ovhcloud.com/en/vps/

**Roomvo / คู่แข่ง**

- สิทธิบัตร Leap Tools (Roomvo): US 10,817,648 · US 11,194,952 · US 11,200,365 · US 12,020,311 · CA 3,166,296 · EP3859566 · EP4318272 — "Systems and methods for product visualization using a single-page application" (อธิบาย CNN segmentation ของพื้น/ผนัง + ประมาณ viewpoint/depth เป็นฉาก 3 มิติบนเซิร์ฟเวอร์ แล้ว client เรนเดอร์) **ควรให้ที่ปรึกษากฎหมายทบทวนก่อนขึ้นระบบ** แม้ claims จะเน้นกลไก script-injection ลงหน้าร้านค้า
- Roomvo stack จากประกาศงาน: TypeScript/Next.js/React/Three.js ฝั่งหน้า, Python/Django/PostgreSQL/AWS/Kubernetes ฝั่งหลัง; โมเดลธุรกิจผู้ผลิตจ่าย ร้านค้าได้ widget ฟรี; ไม่มี AR กล้องสด/แอป
- คู่แข่ง: Floori (จาก $165/เดือน), Chameleon Power (auto-detect ตั้งแต่ 2019 + แก้มือ), Shaw Floorvana+, Mohawk/Mannington/AHF (ใช้ Roomvo หรือระบบคล้ายกัน), Visualizee.ai (generative ทั้งห้อง ไม่ซื่อตรงต่อสินค้า)
- สิทธิบัตร US 11727587B2 "Method and system for scene image modification" (Geomagical Labs) — ตัวอย่างสูตร depth + segmentation + ระนาบพื้น + occlusion ในอุตสาหกรรม
- He, Sun, Tang. "Guided Image Filtering" (ECCV 2010 / TPAMI 2013)
- Roomvo demo ที่สังเกต: https://www.roomvo.com/my/powerartmaterials/ และ https://get.roomvo.com/
- โค้ดเดิม: `src/website/roomPreview.ts`, `src/textures/wood.ts`, `src/data/products.json`
