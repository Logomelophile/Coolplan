import { COMPANY } from './catalog';
const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const phase = (p: number, start: number, end: number): number => clamp((p - start) / (end - start));
const ease = (value: number): number => 1 - Math.pow(1 - clamp(value), 3);
export const EXPERIENCE_END_YEAR = COMPANY.since + COMPANY.years;
/** One reversible scroll clock keeps the years, distance and reveals in step. */
export function experienceFrame(value: number, proofValue = value) {
    const progress = clamp(Number.isFinite(value) ? value : 0);
    const proof = clamp(Number.isFinite(proofValue) ? proofValue : 0);
    const timeline = phase(progress, .24, .9);
    const active = progress < .49 ? 0 : progress < .7 ? 1 : 2;
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
        counter: Math.round(COMPANY.totalSqm * timeline),
        rings: [phase(progress, .29, .46), timeline, phase(progress, .7, .86)],
        panels: [0, 1, 2].map(index => phase(progress, .28 + index * .21, .34 + index * .21)),
        milestones: [.14, .48, .82].map(point => phase(timeline, point - .12, point + .01)),
        story: [0, 1, 2].map(index => index === active ? phase(progress, .28 + index * .21, .34 + index * .21) * (1 - phase(progress, .89, .93)) : 0),
        photos: [.31, .335, .36, .51, .535, .56, .72, .745, .77].map(start => ease(phase(progress, start, start + .085))),
        archived: [[.46, .53], [.67, .74], [.86, .91]].map(([start, end]) => ease(phase(progress, start, end))),
        gather: ease(phase(progress, .91, .995)),
        marquee: phase(proof, 0, .35),
        checks: [0, 1, 2, 3].map(index => phase(proof, .1 + index * .08, .5 + index * .08)),
        active,
    };
}
