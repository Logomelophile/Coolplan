import { COMPANY } from './catalog';

const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const phase = (p: number, start: number, end: number): number => clamp((p - start) / (end - start));
const ease = (value: number): number => 1 - Math.pow(1 - clamp(value), 3);

export const EXPERIENCE_END_YEAR = COMPANY.since + COMPANY.years;

/** One reversible scroll clock keeps the years, distance and reveals in step. */
export function experienceFrame(value: number, proofValue = value) {
  const progress = clamp(Number.isFinite(value) ? value : 0);
  const proof = clamp(Number.isFinite(proofValue) ? proofValue : 0);
  const timeline = phase(progress, .3, .96);
  const active = progress < .56 ? 0 : progress < .78 ? 1 : 2;
  return {
    progress,
    head: .32 + .68 * phase(progress, 0, .25),
    sub: phase(progress, .08, .32),
    dock: ease(phase(progress, .18, .36)),
    era: (.6 + .4 * phase(progress, 0, .14)) * (1 - phase(progress, .28, .4)),
    eraDock: ease(phase(progress, .24, .4)),
    timelineReveal: phase(progress, .25, .35),
    timeline,
    year: COMPANY.since + Math.round(COMPANY.years * timeline),
    counter: Math.round(COMPANY.totalSqm * timeline),
    rings: [phase(progress, .34, .55), timeline, phase(progress, .78, .96)],
    panels: [0, 1, 2].map(index => phase(progress, .33 + index * .22, .41 + index * .22)),
    milestones: [.14, .48, .82].map(point => phase(timeline, point - .12, point + .01)),
    story: [0, 1, 2].map(index => index === active ? phase(progress, .33 + index * .22, .41 + index * .22) : 0),
    photos: [.36, .395, .43, .58, .615, .65, .8, .835, .87].map(start => ease(phase(progress, start, start + .1))),
    marquee: phase(proof, 0, .35),
    checks: [0, 1, 2, 3].map(index => phase(proof, .1 + index * .08, .5 + index * .08)),
    active,
  };
}
