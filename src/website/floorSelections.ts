import { PRICE_LIST, SERIES, type Series } from './catalog';
import { sitePath } from '../sitePath';
export interface FloorSelection {
    id: string;
    name: string;
    family: Series['family'];
    thicknessMm: number;
    sizeMm: string;
    install: 'click' | 'glue';
    priceIndex: number;
    series?: Series;
    reference: Series;
}
export function catalogueFinishes(series: Series): {
    code: string;
    image: string | null;
}[] {
    return series.codes.map(code => {
        const slug = code.toLowerCase().replace(/\s+/g, '-');
        const file = series.family === 'herringbone' ? `/website/herringbone/${slug.replace('cpw-', '')}.webp` : series.swatches.includes(slug) ? `/website/catalog/${slug}.webp` : null;
        return { code, image: file ? sitePath(file) : null };
    });
}
function priceFor(series: Series): number {
    const exact = PRICE_LIST.findIndex(row => row.seriesId === series.id);
    if (exact >= 0)
        return exact;
    return PRICE_LIST.findIndex(row => row.seriesId === series.id || (row.pricePerSqm === series.pricePerSqm && row.installPerSqm === series.installPerSqm && row.group.includes(series.family === 'laminate' ? 'ลามิเนต' : series.install === 'glue' ? 'ทากาว' : 'คลิกล็อก')));
}
const catalogue = SERIES.map(series => ({ id: series.id, name: series.nameTh, family: series.family, thicknessMm: series.thicknessMm, sizeMm: series.sizeMm, install: series.install, priceIndex: priceFor(series), series, reference: series }));
export const FLOOR_SELECTIONS: FloorSelection[] = [...catalogue, ...PRICE_LIST.flatMap((row, index) => {
        if (catalogue.some(option => option.priceIndex === index))
            return [];
        const family: Series['family'] = row.group.includes('ลามิเนต') ? 'laminate' : row.group.includes('ทากาว') ? 'lvt' : 'spc';
        const reference = SERIES.find(series => family === 'lvt' ? series.id === (row.item.includes('ลายไม้') ? 'lvt-wood' : 'lvt-cement') : series.family === family)!;
        return [{ id: `price-${index}`, name: row.item, family, thicknessMm: Number(row.item.match(/\d+/)?.[0] ?? 0), sizeMm: row.sizeMm, install: family === 'lvt' ? 'glue' as const : 'click' as const, priceIndex: index, reference }];
    })];
export interface CatalogueFilter {
    families: string[];
    thickness: number | null;
    size: string;
    glue: boolean;
}
export function filterFloors(filters: CatalogueFilter): FloorSelection[] {
    return FLOOR_SELECTIONS.filter(option => (!filters.families.length || filters.families.includes(option.family)) && (!filters.thickness || option.thicknessMm === filters.thickness) && (!filters.size || option.sizeMm === filters.size) && (!filters.glue || option.install === 'glue'));
}
export function selectionImage(option: FloorSelection): string {
    return catalogueFinishes(option.reference).find(finish => finish.image)?.image ?? sitePath('/website/catalog/cpw-kse-134d.webp');
}
export function formatDimensions(size: string): string { return size ? `${size}${size.includes('นิ้ว') ? '' : ' มม.'}` : 'ยืนยันขนาดตามรุ่นกับทีมงาน'; }
export function sizeLabel(option: FloorSelection): string { return formatDimensions(option.sizeMm); }
