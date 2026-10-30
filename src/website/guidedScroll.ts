/** A user-started tour; any manual navigation immediately gives control back. */
export function mountGuidedScroll(button: HTMLButtonElement) {
    const abort=new AbortController(),signal=abort.signal;
    let raf=0,last=0,running=false,previousBehavior='';
    const label=()=>{button.innerHTML=`${running?'หยุดเลื่อน':'เลื่อนลงข้างล่าง'} <span aria-hidden="true">${running?'Ⅱ':'↓'}</span>`;button.setAttribute('aria-pressed',String(running));};
    const stop=()=>{if(!running)return;running=false;cancelAnimationFrame(raf);document.documentElement.style.scrollBehavior=previousBehavior;label();};
    const tick=(now:number)=>{if(!running)return;const delta=Math.min(40,now-last);last=now;
        const end=document.documentElement.scrollHeight-innerHeight;
        if(scrollY>=end-2){stop();return;}
        scrollTo(0,Math.min(end,scrollY+delta*.32));raf=requestAnimationFrame(tick);
    };
    button.addEventListener('click',()=>{if(running){stop();return;}running=true;previousBehavior=document.documentElement.style.scrollBehavior;document.documentElement.style.scrollBehavior='auto';label();last=performance.now();raf=requestAnimationFrame(tick);},{signal});
    for(const event of ['wheel','touchstart','pointerdown','keydown'])window.addEventListener(event,e=>{if(event==='pointerdown'&&button.contains(e.target as Node))return;stop();},{passive:true,signal});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();},{signal});label();
    return {dispose(){stop();abort.abort();}};
}
