import { sitePath } from '../sitePath';
import { motionPreference } from './motionPreference';
import clients from './clientLogos.json';

/** Two equal groups give the logo strip a seamless loop, with no animation JS. */
export class ClientLogos {
  private readonly abort = new AbortController();
  private readonly motion = motionPreference;
  private readonly observer: IntersectionObserver;
  private readonly button: HTMLButtonElement;
  private visible = false;
  private paused = false;

  constructor(private readonly section: HTMLElement) {
    const track = section.querySelector<HTMLElement>('.client-logos-track')!;
    this.button = section.querySelector<HTMLButtonElement>('.client-logos-toggle')!;
    for (let copy = 0; copy < 2; copy++) {
      const group = document.createElement('ul');
      group.className = 'client-logos-group';
      if (copy) group.setAttribute('aria-hidden', 'true');
      clients.forEach(client => {
        const item = document.createElement('li');
        const image = document.createElement('img');
        image.src = sitePath(`/website/clients/${client.file}`);
        image.alt = copy ? '' : client.name;
        image.width = client.width;
        image.height = client.height;
        image.loading = 'lazy';
        image.decoding = 'async';
        item.append(image);
        group.append(item);
      });
      track.append(group);
    }
    const signal = this.abort.signal;
    this.button.addEventListener('click', () => { this.paused = !this.paused; this.sync(); }, { signal });
    this.motion.addEventListener('change', this.sync, { signal });
    document.addEventListener('visibilitychange', this.sync, { signal });
    this.observer = new IntersectionObserver(entries => {
      this.visible = entries.some(entry => entry.isIntersecting);
      // Load the entire ribbon before it reaches the viewport, including its offscreen copy.
      if (this.visible) section.querySelectorAll<HTMLImageElement>('img').forEach(image => { image.loading = 'eager'; });
      this.sync();
    }, { rootMargin: '500px 0px' });
    this.observer.observe(section);
    this.sync();
  }

  get diagnostics() {
    return { count: clients.length, paused: this.paused, reduced: this.motion.matches, running: this.visible && !this.paused && !this.motion.matches && !document.hidden };
  }

  private sync = (): void => {
    if (!this.motion.matches) this.section.querySelector<HTMLElement>('.client-logos-window')!.scrollLeft = 0;
    this.section.classList.toggle('is-running', this.diagnostics.running);
    this.button.hidden = this.motion.matches;
    this.button.setAttribute('aria-pressed', String(this.paused));
    const label = this.paused ? 'เลื่อนโลโก้ต่อ' : 'พักการเลื่อนโลโก้';
    this.button.setAttribute('aria-label', label);
    this.button.title = label;
    this.button.innerHTML = `<span aria-hidden="true">${this.paused ? '▶' : 'Ⅱ'}</span>`;
  };

  dispose(): void {
    this.visible = false;
    this.abort.abort();
    this.observer.disconnect();
    this.section.classList.remove('is-running');
  }
}

export function mountClientLogos(section: HTMLElement | null): ClientLogos | null {
  return section ? new ClientLogos(section) : null;
}
