import { COMPANY } from './catalog';
const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const phase = (p: number, start: number, end: number): number => clamp((p - start) / (end - start));
const ease = (value: number): number => 1 - Math.pow(1 - clamp(value), 3);
export const EXPERIENCE_END_YEAR = COMPANY.since + COMPANY.years;
/** Display total requested for this story; catalogue source figures remain independent. */
export const EXPERIENCE_TOTAL_SQM = 175000;
export const EXPERIENCE_GATHER_START = .96;
export const EXPERIENCE_PHOTO_DURATION = .04;
export const EXPERIENCE_STAGES = [
    { start: .29, filled: .395, photos: [.29, .345, .4], archive: [.475, .52], seek: .455 },
    { start: .525, filled: .63, photos: [.525, .58, .635], archive: [.695, .74], seek: .68 },
    { start: .745, filled: .85, photos: [.745, .8, .855], archive: [.915, .96], seek: .9 },
];
/** One reversible scroll clock keeps the years, distance and reveals in step. */
export function experienceFrame(value: number, proofValue = value) {
    const progress = clamp(Number.isFinite(value) ? value : 0);
    const proof = clamp(Number.isFinite(proofValue) ? proofValue : 0);
    const timeline = phase(progress, .24, .955);
    const active = progress < EXPERIENCE_STAGES[1].start ? 0 : progress < EXPERIENCE_STAGES[2].start ? 1 : 2;
    const gather = ease(phase(progress, EXPERIENCE_GATHER_START, 1));
    const accumulated = .9 * phase(progress, .29, EXPERIENCE_GATHER_START) + .1 * gather;
    return {
        progress,
        head: phase(progress, 0, .14),
        sub: phase(progress, .025, .18),
        dock: ease(phase(progress, .16, .28)),
        era: phase(progress, .15, .21),
        eraDock: ease(phase(progress, .21, .3)),
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
