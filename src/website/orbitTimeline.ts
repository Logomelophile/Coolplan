const clamp = (n: number) => Math.max(0,Math.min(1,Number.isFinite(n) ? n : 0));
const phase = (p: number,a: number,b: number) => clamp((p-a)/(b-a));
const smooth = (n: number) => n*n*(3-2*n);
export function orbitFrame(value: number) {
    const p=clamp(value);
    return { progress:p,head:phase(p,0,.12),sub:phase(p,.018,.16),title:1-phase(p,.17,.25),
        counter:Math.round(175000*phase(p,.21,.62)),stats:phase(p,.21,.30)*(1-phase(p,.70,.77)),
        rings:[0,1,2].map(i=>phase(p,.40+i*.045,.59+i*.045)),
        snake:smooth(phase(p,.72,.90)),exit:smooth(phase(p,.89,1)),photos:phase(p,.025,.10)*(1-phase(p,.97,1)) };
}
/** Clock angle is independent from scroll. Only the circle → single wave → exit is scrubbed. */
export function orbitPhotoPose(index:number,count:number,angle:number,p:number,width:number,height:number) {
    const f=orbitFrame(p),t=index/Math.max(1,count-1),a=angle+index/count*Math.PI*2;
    const x=width*.5+Math.cos(a)*Math.min(width*(width<=520?.405:.43),height*.86);
    const photoHeight=width<=520?Math.max(68,Math.min(80,height*.09)):Math.max(82,Math.min(185,height*.18));
    // Leave room for the rotated portrait corners, including on a short landscape screen.
    const radiusY=Math.max(0,Math.min(height*.385,(height-photoHeight*1.2-18)/2));
    const y=height*.5+Math.sin(a)*radiusY;
    const waveX=width*(-.06+t*1.12),waveY=height*(.5+Math.sin(t*Math.PI*2)*.11);
    const rotation=Math.sin(a)*18,tilt=Math.cos(t*Math.PI*2)*12;
    return {x:x+(waveX-x)*f.snake+f.exit*width*1.6,y:y+(waveY-y)*f.snake,
        rotation:rotation+(tilt-rotation)*f.snake,scale:1-f.snake*.08,opacity:f.photos};
}
