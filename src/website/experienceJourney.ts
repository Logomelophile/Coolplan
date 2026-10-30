/** One native scroll range and one pinned viewport for the photographic story. */
export const ORBIT_END = .26;
export const TIMELINE_START = .26;
const clamp=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));
export function journeyFrame(progress:number) {
    const p=clamp(progress),t=clamp((p-.23)/(.26-.23));
    return {orbit:clamp(p/ORBIT_END),handoff:t*t*(3-2*t)};
}
export function journeyRange(top:number,height:number,viewport:number) {
    const lead=Math.min(180,viewport*.2),travel=Math.max(0,height-viewport)+lead;
    const start=top-lead;
    return {start,travel,timelineStart:start+travel*TIMELINE_START,timelineTravel:travel*(1-TIMELINE_START)};
}
export function measureJourney(host:HTMLElement) {
    const journey=host.querySelector<HTMLElement>('.experience-journey')!;
    return journeyRange(journey.getBoundingClientRect().top+scrollY,journey.offsetHeight,innerHeight);
}
