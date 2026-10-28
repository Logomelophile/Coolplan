/**
 * Catalogue 2026 and price list 2026 (COOLPLANWORKSHOP), transcribed from the
 * PDFs in Dropbox (/My Saas Startup/AI TEAM/Coolplan/). Prices are THB per m²
 * from the price list; sizes and colour codes are from the catalogue. Keep this
 * the single source for the site's product and pricing sections.
 */
export interface Series {
  id: string;
  name: string;
  nameTh: string;
  /** Catalogue family: used for grouping and the price lookup. */
  family: 'spc' | 'herringbone' | 'laminate' | 'lvt';
  thicknessMm: number;
  sizeMm: string;
  install: 'click' | 'glue';
  /** Material price per m² (price list 2026). */
  pricePerSqm: number;
  /** Installation labour per m² (price list 2026). */
  installPerSqm: number;
  codes: string[];
  /** Swatch file names (lower-case code) under /website/catalog/, when cropped from the catalogue. */
  swatches: string[];
  note?: string;
  highlights: string[];
}

export const SERIES: Series[] = [
  {
    id: 'spc-4-184', name: 'SPC Vinyl Flooring (Click Lock)', nameTh: 'SPC คลิกล็อก 4 มม. หน้ากว้าง 184', family: 'spc', thicknessMm: 4, sizeMm: '184 × 1220', install: 'click',
    pricePerSqm: 590, installPerSqm: 100,
    codes: ['CPWD SPC-1013', 'CPWD SPC-1004', 'CPWD SPC-1003', 'CPWD SPC-1007', 'CPWD SPC-1033', 'CPWD SPC-1035-1', 'CPWD SPC-1038', 'CPWD SPC-1038-1', 'CPWD SPC-1037-1'],
    swatches: ['cpwd-spc-1013', 'cpwd-spc-1004', 'cpwd-spc-1003', 'cpwd-spc-1007', 'cpwd-spc-1033', 'cpwd-spc-1035-1', 'cpwd-spc-1038', 'cpwd-spc-1038-1', 'cpwd-spc-1037-1'],
    highlights: ['กันน้ำ 100%', 'ติดตั้งไวด้วยคลิกล็อก ไม่ใช้กาว', 'เหมาะกับบ้าน คอนโด ออฟฟิศ คาเฟ่'],
  },
  {
    id: 'spc-4-180', name: 'SPC Vinyl Flooring (Click Lock)', nameTh: 'SPC คลิกล็อก 4 มม. หน้ากว้าง 180', family: 'spc', thicknessMm: 4, sizeMm: '180 × 1220', install: 'click',
    pricePerSqm: 590, installPerSqm: 100,
    codes: ['CPW-LHD2391', 'CPW-LHD2392', 'CPW-LHD2706', 'CPW-LHD2825', 'CPW-LHD2826', 'CPW-LHD2827', 'CPW-LHD2831', 'CPW-LHD6123', 'CPW-LHD3159', 'CPW-LHD3158', 'CPW-LHD2841', 'CPW-LHD5005', 'CPW-LHD2839'],
    swatches: ['cpw-lhd2391', 'cpw-lhd2392', 'cpw-lhd2706', 'cpw-lhd2825', 'cpw-lhd2826', 'cpw-lhd2827', 'cpw-lhd2831'],
    highlights: ['13 เฉดสีให้เลือกมากที่สุด', 'โทนโอ๊คอ่อนถึงวอลนัท', 'ราคาเริ่มต้นคุ้มค่า'],
  },
  {
    id: 'spc-5-180', name: 'SPC Click Lock Wood Series', nameTh: 'SPC คลิกล็อก 5 มม. แผ่นยาว', family: 'spc', thicknessMm: 5, sizeMm: '180 × 1220', install: 'click',
    pricePerSqm: 690, installPerSqm: 100,
    codes: ['CPW-KSE-134D', 'CPW-KSE-110D', 'CPW-KSE-003D', 'CPW-KSE-005D', 'CPW-KSE-002D', 'CPW-KSE-001D'],
    swatches: ['cpw-kse-134d', 'cpw-kse-110d', 'cpw-kse-003d', 'cpw-kse-005d', 'cpw-kse-002d', 'cpw-kse-001d'],
    highlights: ['หนา 5 มม. สัมผัสแน่น เดินไม่โปร่ง', 'เหมาะกับห้องที่ใช้งานหนัก', 'ลายไม้ธรรมชาติเข้มถึงขาวนวล'],
  },
  {
    id: 'spc-5-188', name: 'SPC Click Lock Wood Series', nameTh: 'SPC คลิกล็อก 5 มม. แผ่นสั้น', family: 'spc', thicknessMm: 5, sizeMm: '188 × 590', install: 'click',
    pricePerSqm: 690, installPerSqm: 100,
    codes: ['CPW-SP508-A3', 'CPW-SP505-A3', 'CPW-SP503-A3', 'CPW-SP511-B3', 'CPW-SP502-A3', 'CPW-SP507-A3', 'CPW-SP514-B3', 'CPW-SP516-B3', 'CPW-SP518-B3', 'CPW-SP519-B3', 'CPW-SP520-B3', 'CPW-SP517-B3', 'CPW-SP515-B3', 'CPW-SP521-B3', 'CPW-SP504-C3', 'CPW-SP510-C3', 'CPW-SP513-C3', 'CPW-SP522-C3', 'CPW-SP512-C3', 'CPW-SP506-C3', 'CPW-SP523-C3'],
    swatches: ['cpw-sp508-a3', 'cpw-sp507-a3', 'cpw-sp505-a3', 'cpw-sp502-a3', 'cpw-sp503-a3', 'cpw-sp511-b3', 'cpw-sp514-b3'],
    highlights: ['21 เฉดสี ครบทุกสไตล์', 'แผ่นสั้น 590 มม. ปูห้องเล็กลงตัว', 'มีโทนดำและขาวสำหรับงานโมเดิร์น'],
  },
  {
    id: 'herringbone', name: 'SPC Herringbone', nameTh: 'SPC ลายก้างปลา 5 มม.', family: 'herringbone', thicknessMm: 5, sizeMm: '125 × 650', install: 'click',
    pricePerSqm: 790, installPerSqm: 150,
    codes: ['CPW-KH5-735', 'CPW-KH5-732', 'CPW-KH5-682', 'CPW-KH5-674', 'CPW-KH5-110', 'CPW-KH5-651'],
    swatches: [],
    note: 'ใบราคา 2026 ระบุขนาดแผ่นก้างปลา 118 × 590 มม. ส่วนแค็ตตาล็อก 2026 ระบุ 125 × 650 มม. กรุณายืนยันรุ่นก่อนสั่งซื้อ',
    highlights: ['Classic Look เพิ่มมิติและความหรู', 'Solid Touch หนา 5 มม.', 'Unique Design ไม่ซ้ำใคร'],
  },
  {
    id: 'laminate-8', name: 'Laminate Wood Classic Series', nameTh: 'ลามิเนตคลาสสิก 8 มม.', family: 'laminate', thicknessMm: 8, sizeMm: '1288 × 192', install: 'click',
    pricePerSqm: 650, installPerSqm: 100,
    codes: ['ETS230', 'ETS233', 'ETS530', 'ETS588', 'ETS632', 'ETS800', 'ETS879'],
    swatches: ['ets230', 'ets233', 'ets530', 'ets588', 'ets632', 'ets800', 'ets879'],
    note: 'ราคาเริ่มต้นไม้จีน/ไม้ไทย 650 บาท ไม้มาเลเซีย 790 บาท และมีความหนา 12 มม. (750–990 บาท) ตามใบราคา',
    highlights: ['Natural Feel สัมผัสเหมือนไม้จริง', 'แกน HDF อัดแน่น รับแรงกระแทก', 'Wide Plank แผ่นใหญ่ ห้องดูโปร่ง'],
  },
  {
    id: 'lvt-cement', name: 'LVT Vinyl 3 mm (Glue Down)', nameTh: 'LVT ทากาว ลายปูน 3 มม.', family: 'lvt', thicknessMm: 3, sizeMm: '470 × 470', install: 'glue',
    pricePerSqm: 550, installPerSqm: 90,
    codes: ['CPW-KG-S21', 'CPW-KG-S22', 'CPW-KG-S23', 'CPW-KG-S24'],
    swatches: ['cpw-kg-s21', 'cpw-kg-s22', 'cpw-kg-s23', 'cpw-kg-s24'],
    highlights: ['Best Value คุ้มค่าที่สุด', 'ลายปูนขัด/หินสำหรับงานลอฟต์', 'ติดตั้งแบบทากาว แนบสนิทกับพื้น'],
  },
  {
    id: 'lvt-wood', name: 'LVT Vinyl 3 mm (Glue Down)', nameTh: 'LVT ทากาว ลายไม้ 3 มม.', family: 'lvt', thicknessMm: 3, sizeMm: '184 × 950', install: 'glue',
    pricePerSqm: 550, installPerSqm: 90,
    codes: ['CPW-KG-W11', 'CPW-KG-W12', 'CPW-KG-W13', 'CPW-KG-W14', 'CPW-KG-W15', 'CPW-KG-W16', 'CPW-KG-W17', 'CPW-KG-W18', 'CPW-KG-W19', 'CPW-KG-W20'],
    swatches: ['cpw-kg-w11', 'cpw-kg-w12', 'cpw-kg-w13', 'cpw-kg-w14', 'cpw-kg-w15'],
    highlights: ['10 เฉดลายไม้', 'เหมาะกับพื้นที่กว้าง งานโครงการ ห้าง', 'Easy Maintenance ดูแลง่าย'],
  },
];

/** Full price list 2026 rows (material and labour per m²). */
export interface PriceRow { group: string; item: string; sizeMm: string; pricePerSqm: number; installPerSqm: number; seriesId?: string }
export const PRICE_LIST: PriceRow[] = [
  { group: 'กระเบื้องยาง (แบบคลิกล็อก)', item: 'SPC 4 มม.', sizeMm: '179 × 1220', pricePerSqm: 590, installPerSqm: 100, seriesId: 'spc-4-184' },
  { group: 'กระเบื้องยาง (แบบคลิกล็อก)', item: 'SPC 5 / 5.3 มม.', sizeMm: '179 × 1220', pricePerSqm: 690, installPerSqm: 100, seriesId: 'spc-5-180' },
  { group: 'กระเบื้องยาง (แบบคลิกล็อก)', item: 'SPC 6 มม.', sizeMm: '183 × 1219.2', pricePerSqm: 990, installPerSqm: 100 },
  { group: 'กระเบื้องยาง (แบบคลิกล็อก)', item: 'SPC 7 มม.', sizeMm: '225 × 1420', pricePerSqm: 1100, installPerSqm: 100 },
  { group: 'กระเบื้องยาง (แบบคลิกล็อก)', item: 'ก้างปลา SPC 5 / 5.3 มม.', sizeMm: '118 × 590', pricePerSqm: 790, installPerSqm: 150, seriesId: 'herringbone' },
  { group: 'กระเบื้องยาง (แบบทากาว)', item: 'LVT 3 มม. ลายไม้', sizeMm: '152 × 914', pricePerSqm: 550, installPerSqm: 90, seriesId: 'lvt-wood' },
  { group: 'กระเบื้องยาง (แบบทากาว)', item: 'LVT 3 มม. ลายปูน', sizeMm: '18 × 36 นิ้ว', pricePerSqm: 550, installPerSqm: 90, seriesId: 'lvt-cement' },
  { group: 'กระเบื้องยาง (แบบทากาว)', item: 'LVT 2 มม. ลายไม้', sizeMm: '152.4 × 914.4', pricePerSqm: 490, installPerSqm: 90 },
  { group: 'ไม้ลามิเนต', item: 'ลามิเนต 8 มม. (ไม้จีน / ไม้ไทย)', sizeMm: '', pricePerSqm: 650, installPerSqm: 100, seriesId: 'laminate-8' },
  { group: 'ไม้ลามิเนต', item: 'ลามิเนต 8 มม. (ไม้มาเลเซีย)', sizeMm: '', pricePerSqm: 790, installPerSqm: 100 },
  { group: 'ไม้ลามิเนต', item: 'ลามิเนต 12 มม. (ไม้จีน / ไม้ไทย)', sizeMm: '', pricePerSqm: 750, installPerSqm: 100 },
  { group: 'ไม้ลามิเนต', item: 'ลามิเนต 12 มม. (ไม้มาเลเซีย)', sizeMm: '', pricePerSqm: 990, installPerSqm: 100 },
];

/** Surface preparation add-ons per m² and fixed fees (price list notes 1–6). */
export const PREP_OPTIONS = [
  { id: 'self-leveling', label: 'ปรับระดับด้วย Self-leveling', perSqm: 290 },
  { id: 'skim', label: 'สกิมพื้น', perSqm: 150 },
  { id: 'grind', label: 'ไล่พื้น (ปรับผิว)', perSqm: 100 },
] as const;
export const TRAVEL_FEE = { belowSqm: 50, amount: 2500 };
export const NIGHT_WORK_PER_NIGHT = 3500;
export const PRICE_NOTES = [
  'สภาพพื้นที่ติดตั้งต้องเรียบ แข็ง แห้ง ได้ระดับ สะอาด และพร้อมเข้าติดตั้งได้ 100%',
  'ราคาค่าติดตั้งเป็นราคางานกลางวัน หากทำงานกลางคืนคิดค่าแรงเพิ่มคืนละ 3,500 บาท',
  'พื้นที่ติดตั้งอยู่ในเขตกรุงเทพฯ และปริมณฑล พื้นที่น้อยกว่า 50 ตร.ม. คิดค่าเดินทาง 2,500 บาท',
];

/** Fixed-price packages (SPC wood-look, installation included). */
export const PACKAGES = [
  { id: 'p30', sqm: 30, title: '30 ตร.ม.', subtitle: 'สำหรับห้องต่าง ๆ ในบ้านหรือคอนโด', perSqm: 790, total: 23700, days: '1 วัน', warrantyYears: 10, description: 'แพ็กเกจปูพื้น SPC 30 ตารางเมตร ตก ตร.ม. ละ 790 บาทรวมค่าติดตั้งแล้ว สำหรับคอนโดหรือบ้าน รีโนเวทด้านพื้นด้วย SPC ลายไม้ ให้บรรยากาศอบอุ่น เรียบหรู ดูแลตั้งแต่ให้คำปรึกษา เลือกลายพื้น จนส่งมอบงาน' },
  { id: 'p100', sqm: 100, title: '100 ตร.ม.', subtitle: 'สำหรับรีโนเวทบ้าน', perSqm: 700, total: 70000, days: '1 วัน', warrantyYears: 10, description: 'แพ็กเกจปูพื้น SPC 100 ตารางเมตร ตก ตร.ม. ละ 700 บาทรวมค่าติดตั้งแล้ว สำหรับคอนโดหรือบ้าน รีโนเวทด้านพื้นด้วย SPC ลายไม้ ให้บรรยากาศอบอุ่น เรียบหรู ดูแลตั้งแต่ให้คำปรึกษา เลือกลายพื้น จนส่งมอบงาน' },
  { id: 'p1000', sqm: 1000, title: '1,000 ตร.ม.', subtitle: 'สำหรับบ้านจัดสรร โครงการ คอนโด', perSqm: 550, total: 550000, days: '30 วัน', warrantyYears: 10, description: 'แพ็กเกจปูพื้น SPC 1,000 ตารางเมตร ราคา ตก ตร.ม. ละ 550 บาท รวมติดตั้งแล้ว สำหรับงานโครงการ ดูแลตั้งแต่ให้คำปรึกษา เลือกลายพื้น จนส่งมอบงาน' },
] as const;

/** Company profile facts (catalogue pages 2–3). */
export const COMPANY = {
  since: 2005,
  years: 21,
  totalSqm: 175900,
  partners: [
    { name: 'SHAMA Service Apartment', sqm: 26300 },
    { name: 'HI Condo', sqm: 20000 },
    { name: 'Regent Home', sqm: 20000 },
    { name: 'KEN Attitude', sqm: 12000 },
    { name: 'ภูเก็ต ออร์คิด รีสอร์ท', sqm: 12000 },
  ],
  portfolio: ['Attitude BU 11,000', 'ไซมิส พระราม 9 10,000', 'Origin Condominium 10,000', 'Kantary Hotel 10,000', 'Water Gate Condo 9,000', 'The Sun Condo 8,000', 'Vimano Condo 5,500', 'Very Condo 4,500', 'The Sky Sukhumvit 3,500', 'Summer Spring พัทยา 3,000', 'LADDA 3,000', 'Cassia Residences Rama 9 2,500'],
  sectors: [
    { title: 'Corporate & Government', text: 'พันธมิตรงานระบบพื้นของกระทรวงและธนาคารระดับประเทศ' },
    { title: 'Residential & Hospitality', text: 'โครงการที่พักอาศัยและโรงแรมหรู อาทิ Whizdom, SAVVI และ Kantary Group' },
    { title: 'Commercial & Retail', text: 'ผู้อยู่เบื้องหลังงานพื้นมาตรฐานสากลของ Fitness First และโชว์รูมรถยนต์ชั้นนำ' },
  ],
};

export const money = (value: number): string => `฿${Math.round(value).toLocaleString('th-TH')}`;
