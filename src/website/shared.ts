import { localizeSiteLinks, sitePath } from '../sitePath';

export const contact = { name:'คุณคะน้า', phone:'0846707551', tel:'+66846707551', email:'coolplanworkshop@gmail.com' };
export const icon = (name:string) => {
  const paths:Record<string,string> = {
    arrow:'<path d="M4 12h15m-5-5 5 5-5 5"/>',
    diamond:'<path d="m3 8 5-5h8l5 5-9 13L3 8Zm0 0h18M8 3l4 5 4-5M8 8l4 13 4-13"/>',
    shield:'<path d="M12 2c3 3 6 3 8 3v7c0 5-5 8-8 10-3-2-8-5-8-10V5c2 0 5 0 8-3Z"/><path d="m8 12 3 3 5-6"/>',
    drop:'<path d="M12 2C9 7 4 12 4 16a8 8 0 0 0 16 0c0-4-5-9-8-14Z"/><path d="M8 15c0 3 1 4 3 4"/>',
    leaf:'<path d="M21 3C4 0 1 13 5 19c7 4 17-1 16-16Z"/><path d="m3 22 14-15"/>',
    upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>',
    room:'<path d="m3 11 9-8 9 8M5 9v12h14V9M10 21v-7h4v7"/>',
    camera:'<path d="M3 7h4l2-3h6l2 3h4v14H3V7Z"/><circle cx="12" cy="13" r="4"/>',
    compare:'<path d="M12 2v20M9 5H3v14h6m6-14h6v14h-6M6 8v8m12-8v8"/>',
    expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6"/>',
    reset:'<path d="M4 8a9 9 0 1 1-1 8M4 3v5h5"/>',
    layers:'<path d="m3 7 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 17l9 5 9-5"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    phone:'<path d="m5 3 4 1 1 5-3 2c2 3 3 4 6 6l2-3 5 1 1 4c-2 5-9 1-13-3S0 5 5 3Z"/>',
    mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
    search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
    menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
    chat:'<path d="M21 11a9 8 0 0 1-9 8H6l-4 3 1-7a8 8 0 0 1 0-8c3-6 18-6 18 4Z"/><path d="M7 11h1m4 0h1m4 0h1"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
};
export function mountHeader(active:'home'|'calculator'|'ceo') {
  const host=document.getElementById('site-header');
  if(!host)return;
  const home='/website/';
  const links=active!=='calculator'
    ? `<a href="${home}" ${active==='home'?'aria-current="page"':''}>หน้าแรก</a><a href="${home}#products">สินค้าของเรา</a><a href="${home}#rooms">แรงบันดาลใจ</a><a href="/ceo/" ${active==='ceo'?'aria-current="page"':''}>CEO & Brand</a><a href="/ceo/#next-gen">Next Gen</a><button type="button" data-contact-open>ติดต่อเรา</button>`
    : `<a href="${home}">หน้าแรก</a><a href="${home}#products">สินค้า</a><button type="button" data-about-open>บริการ</button><a href="/calculator/" aria-current="page">คำนวณราคา</a><a href="${home}#rooms">ผลงานของเรา</a><a href="/ceo/">CEO & Brand</a><a href="/ceo/#next-gen">Next Gen</a><button type="button" data-contact-open>ติดต่อเรา</button>`;
  host.innerHTML=`<a class="skip-link" href="#main">ข้ามไปเนื้อหา</a><header class="site-header ${active==='calculator'?'calculator-header':''}"><a class="site-logo" href="${home}" aria-label="COOLPLAN หน้าแรก"><img class="site-logo-mark" src="${sitePath('/website/assets/logo-mark.png')}" alt="" width="794" height="399" /><span>COOLPLAN<small>${active==='calculator'?'FLOORING FOR A BETTER TOMORROW':'SPC FLOORING'}</small></span></a><nav class="site-nav-links" id="main-navigation" aria-label="เมนูหลัก">${links}</nav>${active==='calculator'?`<a class="header-search" href="${home}#products" aria-label="ค้นหาสินค้า">${icon('search')}</a>`:''}<a class="header-quote" href="/calculator/#quote" ${active==='calculator'?'data-quote-open':''}>ขอใบเสนอราคา ${active==='home'?icon('arrow'):''}</a><button class="menu-toggle" type="button" aria-controls="main-navigation" aria-expanded="false" aria-label="เปิดเมนู">${icon('menu')}</button></header>`;
  localizeSiteLinks(host);
  const header=host.querySelector('header')!;
  const menu=host.querySelector<HTMLButtonElement>('.menu-toggle')!;
  menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));header.classList.toggle('menu-open',open);});
  header.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.getAttribute('aria-expanded')==='true'){menu.setAttribute('aria-expanded','false');header.classList.remove('menu-open');menu.focus();}});
  header.querySelectorAll('nav a,nav button').forEach(link=>link.addEventListener('click',()=>{menu.setAttribute('aria-expanded','false');header.classList.remove('menu-open');}));
  let wasScrolled:boolean|null=null;
  // Only touch the DOM when the state flips: reading scrollY on a long page is cheap, a class toggle per event is not.
  const scrolled=()=>{const now=scrollY>20;if(now!==wasScrolled){wasScrolled=now;header.classList.toggle('is-scrolled',now);}};
  window.addEventListener('scroll',scrolled,{passive:true});scrolled();
}
export function mountFooter() {
  const host=document.getElementById('site-footer');
  if(!host)return;
  host.innerHTML=`<footer class="site-footer" aria-label="ส่วนท้ายเว็บไซต์ COOLPLAN">
    <div class="footer-invitation"><div><span class="footer-eyebrow">LET'S MAKE ROOM FOR YOU</span><h2>พื้นที่ของคุณ<br><em>เริ่มต้นจากการพูดคุย</em></h2></div><a class="primary-button" href="/calculator/#quote" data-quote-open>ขอใบเสนอราคา ${icon('arrow')}</a></div>
    <div class="footer-columns">
      <div class="footer-brand"><a class="site-logo" href="/website/" aria-label="COOLPLAN หน้าแรก">COOLPLAN<small>SPC FLOORING</small></a><p>พื้นที่ดี เริ่มต้นจากพื้นฐานที่ดีกว่า<br>ค้นหาสีพื้น วางแผนพื้นที่<br>และเลือกสิ่งที่เข้ากับชีวิตของคุณ</p></div>
      <nav class="footer-menu" aria-label="รู้จัก COOLPLAN"><h3>รู้จัก COOLPLAN</h3><a href="/website/">หน้าแรก</a><a href="/ceo/">CEO & Brand</a><a href="/ceo/#next-gen">Next Gen · ก้าวต่อไปของเรา</a><a href="/website/#products">สินค้าของเรา</a><a href="/website/#rooms">แรงบันดาลใจแต่งห้อง</a></nav>
      <nav class="footer-menu" aria-label="วางแผนพื้นของคุณ"><h3>วางแผนพื้นของคุณ</h3><a href="/website/#products">ลองสีพื้นในห้อง</a><a href="/calculator/">คำนวณราคาเบื้องต้น</a><a href="/">Material Studio · ดูชั้นวัสดุ</a><a href="/room/">Room Motion · ห้อง 3D</a><button type="button" data-contact-open>ปรึกษาเรื่องพื้น</button></nav>
      <address class="footer-contact" id="contact"><h3>ติดต่อเรา</h3><p>${contact.name}</p><a class="footer-phone" href="tel:${contact.tel}">084 670 7551 ${icon('arrow')}</a><a class="footer-email" href="mailto:${contact.email}">${contact.email}</a><button type="button" data-contact-open>ดูช่องทางติดต่อ ${icon('arrow')}</button></address>
    </div>
    <div class="footer-bottom"><p>© ${new Date().getFullYear()} COOLPLAN. All rights reserved.</p><span>SPC FLOORING · YOUR SPACE, YOUR EVERYDAY</span><a href="#main">กลับด้านบน ↑</a></div>
  </footer>`;
  localizeSiteLinks(host);
}
export function mountContactDialog() {
  if(document.getElementById('contact-dialog'))return;
  const holder=document.createElement('div');
  holder.innerHTML=`<dialog class="site-dialog contact-dialog" id="contact-dialog" aria-labelledby="contact-heading"><button class="dialog-close" data-dialog-close type="button" aria-label="ปิด">${icon('close')}</button><span class="dialog-eyebrow">LET'S CREATE YOUR SPACE</span><h2 id="contact-heading">คุยเรื่องพื้นที่ของคุณ</h2><p>ปรึกษาเรื่องวัสดุ การติดตั้ง และขอใบเสนอราคากับ ${contact.name}</p><a class="contact-method" href="tel:${contact.tel}">${icon('phone')}<span><small>โทรหา${contact.name}</small>084 670 7551</span>${icon('arrow')}</a><a class="contact-method" href="mailto:${contact.email}?subject=${encodeURIComponent('สอบถามพื้น SPC และขอใบเสนอราคา COOLPLAN')}">${icon('mail')}<span><small>ส่งอีเมลถึงเรา</small>${contact.email}</span>${icon('arrow')}</a><a class="primary-button purple" href="/calculator/">คำนวณงบประมาณเบื้องต้น ${icon('arrow')}</a></dialog><dialog class="site-dialog" id="about-dialog" aria-labelledby="about-heading"><button class="dialog-close" data-dialog-close type="button" aria-label="ปิด">${icon('close')}</button><span class="dialog-eyebrow">COOLPLAN · SPC FLOORING</span><h2 id="about-heading">พื้นที่ดี เริ่มต้นจากพื้นฐานที่ดีกว่า</h2><p>เลือกพื้น SPC ลายไม้ที่เข้ากับสไตล์ของคุณ สำรวจสีและชั้นวัสดุ เปรียบเทียบบรรยากาศในห้อง และวางงบประมาณก่อนเลือกพื้น</p><div class="about-services"><div>${icon('diamond')}<strong>เลือกวัสดุ</strong><p>ดูสี ลายไม้ และโครงสร้างของแผ่นพื้น</p></div><div>${icon('room')}<strong>วางแผนพื้นที่</strong><p>คำนวณค่าวัสดุและค่าติดตั้งเบื้องต้น</p></div><div>${icon('chat')}<strong>ปรึกษาโดยตรง</strong><p>สอบถามรายละเอียดกับ${contact.name}</p></div></div><button class="primary-button purple" type="button" data-contact-open>ปรึกษาผู้เชี่ยวชาญ ${icon('arrow')}</button></dialog>`;
  document.body.append(holder);
  localizeSiteLinks(document);
  holder.querySelectorAll<HTMLDialogElement>('dialog').forEach(dialog=>{
    dialog.querySelector('[data-dialog-close]')!.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  });
  document.addEventListener('click',event=>{
    const button=(event.target as Element).closest('[data-contact-open],[data-about-open]');if(!button)return;
    event.preventDefault();holder.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>d.close());
    (document.getElementById(button.hasAttribute('data-contact-open')?'contact-dialog':'about-dialog') as HTMLDialogElement).showModal();
  });
}
export function sprite(element:HTMLElement,crop:[number,number,number,number],source='home') {
  const [x,y,w,h]=crop, width=source==='home'?1122:1024,height=source==='home'?1402:1536;
  element.style.backgroundImage=`url('${sitePath(`/website/assets/prototype-${source}.${source==='home'?'webp':'png'}`)}')`;
  element.style.backgroundSize=`${width/w*100}% ${height/h*100}%`;
  element.style.backgroundPosition=`${x/(width-w)*100}% ${y/(height-h)*100}%`;
  element.style.aspectRatio=`${w}/${h}`;
}
