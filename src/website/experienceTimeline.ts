import { COMPANY } from './catalog';
const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const phase = (p: number, start: number, end: number): number => clamp((p - start) / (end - start));
const ease = (value: number): number => 1 - Math.pow(1 - clamp(value), 3);
export const EXPERIENCE_END_YEAR = COMPANY.since + COMPANY.years;
/** Display total requested for this story; catalogue source figures remain independent. */
export const EXPERIENCE_TOTAL_SQM = 175000;
export const EXPERIENCE_GATHER_START = .96;
export const EXPERIENCE_GATHER_END = .985;
export const EXPERIENCE_SUMMARY_HOLD_MS = 800;
export const EXPERIENCE_PHOTO_DURATION = .035;
export const EXPERIENCE_STAGES = [
    { start: .29, filled: .395, photos: [.29, .345, .4], archive: [.475, .52], seek: .455 },
    { start: .525, filled: .63, photos: [.525, .58, .635], archive: [.695, .74], seek: .68 },
    { start: .745, filled: .85, photos: [.745, .8, .855], archive: [.915, .96], seek: .9 },
];
export interface ExperienceScrollRange { leadPx: number; introPx: number; travelPx: number; breakpoint: number }
/** A short, responsive title/year entry followed by a longer photographic story. */
export function experienceScrollRange(height: number, travel: number, timelineOnly = false): ExperienceScrollRange {
    const viewport = Number.isFinite(height) ? Math.max(1, height) : 800;
    const travelPx = Number.isFinite(travel) ? Math.max(0, travel) : 0;
    return { leadPx: timelineOnly ? 0 : Math.min(200, Math.max(100, viewport * .28)), introPx: timelineOnly ? 0 : Math.min(travelPx * .45, Math.min(520, Math.max(260, viewport * .6))), travelPx, breakpoint: EXPERIENCE_STAGES[0].start };
}
export function experienceScrollProgress(scrolled: number, range: ExperienceScrollRange): number {
    if (range.travelPx <= 0) return 1;
    const offset = Number.isFinite(scrolled) ? scrolled : -range.leadPx;
    if (range.introPx === 0) return range.breakpoint + (1-range.breakpoint)*clamp(offset/range.travelPx);
    return offset <= range.introPx ? range.breakpoint * clamp((offset + range.leadPx) / (range.introPx + range.leadPx)) : range.breakpoint + (1 - range.breakpoint) * clamp((offset - range.introPx) / (range.travelPx - range.introPx));
}
export function experienceScrollOffset(progress: number, range: ExperienceScrollRange): number {
    const p = clamp(Number.isFinite(progress) ? progress : 0);
    if (range.introPx === 0) return Math.max(0,(p-range.breakpoint)/(1-range.breakpoint))*range.travelPx;
    return p <= range.breakpoint ? p / range.breakpoint * (range.introPx + range.leadPx) - range.leadPx : range.introPx + (p - range.breakpoint) / (1 - range.breakpoint) * (range.travelPx - range.introPx);
}
/** One reversible scroll clock keeps the years, distance and reveals in step. */
export function experienceFrame(value: number, proofValue = value) {
    const progress = clamp(Number.isFinite(value) ? value : 0);
    const proof = clamp(Number.isFinite(proofValue) ? proofValue : 0);
    const timeline = phase(progress, .24, .955);
    const active = progress < EXPERIENCE_STAGES[1].start ? 0 : progress < EXPERIENCE_STAGES[2].start ? 1 : 2;
    const gather = ease(phase(progress, EXPERIENCE_GATHER_START, EXPERIENCE_GATHER_END));
    const accumulated = .9 * phase(progress, .29, EXPERIENCE_GATHER_START) + .1 * gather;
    return {
        progress,
        head: phase(progress, 0, .14),
        sub: phase(progress, .025, .18),
        dock: ease(phase(progress, .16, .28)),
        era: phase(progress, .19, .235),
        eraDock: ease(phase(progress, .235, .3)),
        timelineReveal: phase(progress, .21, .29),
        timeline,
        year: COMPANY.since + Math.round(COMPANY.years * timeline),
        counter: Math.round(EXPERIENCE_TOTAL_SQM * accumulated),
        counterReveal: phase(progress, .3, .34),
        rings: EXPERIENCE_STAGES.map(stage => phase(progress, stage.start, stage.filled)),
        panels: EXPERIENCE_STAGES.map(stage => phase(progress, stage.start - .01, stage.start + .025)),
        milestones: [.14, .48, .82].map(point => phase(timeline, point - .12, point + .01)),
        story: EXPERIENCE_STAGES.map((stage, index) => index === active ? phase(progress, stage.start - .01, stage.start + .025) * (1 - phase(progress, .94, .96)) : 0),
        photos: EXPERIENCE_STAGES.flatMap(stage => stage.photos.map(start => ease(phase(progress, start, start + EXPERIENCE_PHOTO_DURATION)))),
        archived: EXPERIENCE_STAGES.map(stage => ease(phase(progress, stage.archive[0], stage.archive[1]))),
        gather,
        marquee: phase(proof, 0, .35),
        checks: [0, 1, 2, 3].map(index => phase(proof, .1 + index * .08, .5 + index * .08)),
        active,
    };
}
