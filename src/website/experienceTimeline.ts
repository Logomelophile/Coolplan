import { COMPANY } from './catalog';

const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const phase = (p: number, start: number, end: number): number => clamp((p - start) / (end - start));
const ease = (value: number): number => 1 - Math.pow(1 - clamp(value), 3);

export const EXPERIENCE_END_YEAR = COMPANY.since + COMPANY.years;

/** One reversible scroll clock keeps the years, distance and reveals in step. */
export function experienceFrame(value: number) {
  const progress = clamp(Number.isFinite(value) ? value : 0);
  const timeline = ease(phase(progress, .22, .7));
  return {
    progress,
    head: .32 + .68 * phase(progress, 0, .2),
    sub: phase(progress, .07, .27),
    dock: ease(phase(progress, .16, .4)),
    timelineReveal: phase(progress, .18, .3),
    timeline,
    year: COMPANY.since + Math.round(COMPANY.years * timeline),
    counter: Math.round(COMPANY.totalSqm * timeline),
    rings: [timeline, ease(phase(progress, .43, .8)), ease(phase(progress, .5, .87))],
    panels: [0, 1, 2].map(index => phase(progress, .39 + index * .035, .52 + index * .035)),
    marquee: phase(progress, .68, .8),
    checks: [0, 1, 2, 3].map(index => phase(progress, .76 + index * .025, .89 + index * .025)),
    active: progress < .43 ? 0 : progress < .7 ? 1 : 2,
  };
}
