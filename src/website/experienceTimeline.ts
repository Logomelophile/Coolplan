import { COMPANY } from './catalog';

const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const phase = (p: number, start: number, end: number): number => clamp((p - start) / (end - start));
const ease = (value: number): number => 1 - Math.pow(1 - clamp(value), 3);

export const EXPERIENCE_END_YEAR = COMPANY.since + COMPANY.years;

/** One reversible scroll clock keeps the years, distance and reveals in step. */
export function experienceFrame(value: number, proofValue = value) {
  const progress = clamp(Number.isFinite(value) ? value : 0);
  const proof = clamp(Number.isFinite(proofValue) ? proofValue : 0);
  const timeline = phase(progress, .16, .86);
  const active = progress < .43 ? 0 : progress < .65 ? 1 : 2;
  return {
    progress,
    head: .32 + .68 * phase(progress, 0, .16),
    sub: phase(progress, .04, .2),
    dock: ease(phase(progress, .08, .25)),
    timelineReveal: phase(progress, .08, .18),
    timeline,
    year: COMPANY.since + Math.round(COMPANY.years * timeline),
    counter: Math.round(COMPANY.totalSqm * timeline),
    rings: [ease(phase(progress, .2, .43)), timeline, ease(phase(progress, .63, .87))],
    panels: [0, 1, 2].map(index => phase(progress, .18 + index * .22, .29 + index * .22)),
    milestones: [.12, .48, .8].map(point => phase(timeline, point - .1, point + .01)),
    story: [0, 1, 2].map(index => index === active ? phase(progress, .18 + index * .22, .29 + index * .22) : 0),
    photos: [.2, .245, .42, .465, .64, .685].map(start => ease(phase(progress, start, start + .16))),
    marquee: phase(proof, 0, .35),
    checks: [0, 1, 2, 3].map(index => phase(proof, .1 + index * .08, .5 + index * .08)),
    active,
  };
}
