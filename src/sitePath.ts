/** Resolve site-owned paths for root hosting or a project path such as /Coolplan/. */
export function sitePath(path: string): string {
  const base = import.meta.env?.BASE_URL;
  if (!base || base === './' || base === '/' || path.startsWith(base)) return path;
  return `${base}${path.replace(/^\//, '')}`;
}

export function localizeSiteLinks(root: ParentNode): void {
  root.querySelectorAll<HTMLAnchorElement>('a[href^="/"]:not([href^="//"])').forEach(link => {
    link.setAttribute('href', sitePath(link.getAttribute('href')!));
  });
}
