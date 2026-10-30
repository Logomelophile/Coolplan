const clamp = (n: number) => Math.max(0,Math.min(1,Number.isFinite(n) ? n : 0));
const phase = (p: number,a: number,b: number) => clamp((p-a)/(b-a));
const smooth = (n: number) => n*n*(3-2*n);
export function orbitFrame(value: number) {
    const p=clamp(value);
    return { progress:p,head:phase(p,0,.12),sub:phase(p,.018,.16),title:1-phase(p,.225,.265),
        titleDock:smooth(phase(p,.10,.19)),counter:Math.round(175000*phase(p,.40,.66)),
        stats:phase(p,.40,.48)*(1-phase(p,.79,.84)),
        rings:[0,1,2].map(i=>phase(p,.47+i*.04,.62+i*.04)),
        snake:smooth(phase(p,.84,.94)),exit:smooth(phase(p,.94,1)),photos:1-phase(p,.985,1) };
}
/** Reserve an empty central rectangle inside the ellipse and its rotated portrait frames. */
export function orbitLayout(width:number,height:number) {
    const photoHeight=width<=520?Math.max(68,Math.min(80,height*.09)):Math.max(82,Math.min(185,height*.18));
    const rx=Math.min(width*(width<=520?.405:.43),height*.86);
    const ry=Math.max(0,Math.min(height*.385,(height-photoHeight*1.2-18)/2));
    return {photoHeight,rx,ry,contentWidth:Math.max(100,2*(rx-photoHeight*.55-18)*.62),
        contentHeight:Math.max(68,2*(ry-photoHeight*.65-18)*.62)};
}
/** Same nodes: a central pile, centrifugal release, autonomous orbit, then a wave exit. */
export function orbitPhotoPose(index:number,count:number,angle:number,p:number,width:number,height:number) {
    const f=orbitFrame(p),t=index/Math.max(1,count-1),a=angle+index/count*Math.PI*2;
    const layout=orbitLayout(width,height),release=1-Math.pow(1-phase(p,.23+t*.035,.365+t*.035),3);
    const pop=smooth(phase(p,.13+t*.018,.185+t*.018));
    const pileX=width*.5+Math.sin(index*2.4)*layout.photoHeight*.13;
    const pileY=height*.56+Math.cos(index*1.7)*layout.photoHeight*.08;
    const orbitX=width*.5+Math.cos(a)*layout.rx,orbitY=height*.5+Math.sin(a)*layout.ry;
    const x=pileX+(orbitX-pileX)*release,y=pileY+(orbitY-pileY)*release;
    const waveX=width*(-.06+t*1.12),waveY=height*(.5+Math.sin(t*Math.PI*2)*.11);
    const rotation=(index%2?1:-1)*(4+t*13)*(1-release)+Math.sin(a)*18*release,tilt=Math.cos(t*Math.PI*2)*12;
    return {x:x+(waveX-x)*f.snake+f.exit*width*1.6,y:y+(waveY-y)*f.snake,
        rotation:rotation+(tilt-rotation)*f.snake,scale:(.45+.55*pop)*(1-f.snake*.08),opacity:pop*f.photos};
}
