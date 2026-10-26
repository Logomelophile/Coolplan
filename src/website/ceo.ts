import './shared.css';
import './ceo.css';
import './next-gen.css';
import { icon, mountHeader, mountFooter, mountContactDialog } from './shared';

mountHeader('ceo');
mountFooter();
mountContactDialog();
document.querySelectorAll<HTMLElement>('[data-icon]').forEach(element => {
  element.innerHTML = icon(element.dataset.icon!);
});
