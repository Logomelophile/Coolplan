(() => {
  const phoneLayout = window.matchMedia('(max-width: 520px)');
  const current = window.location.pathname;
  const mobilePage = /^\/mobile(?:\/(?:index\.html)?)?$/.test(current);

  function selectLayout() {
    if (phoneLayout.matches === mobilePage) return;

    const target = phoneLayout.matches ? '/mobile/' : '/';
    window.location.replace(target + window.location.search + window.location.hash);
  }

  selectLayout();
  phoneLayout.addEventListener('change', selectLayout);
})();
