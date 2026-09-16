// The site is static, but "today" isn't: re-partition news by the reader's
// date so items move from Upcoming to Today to Previously without a rebuild.
(() => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  document.querySelectorAll('time[data-date]').forEach((t) => t.classList.toggle('today', t.dataset.date === today));

  const root = document.querySelector('[data-news-sections]');
  if (!root) return;
  const limit = Number(root.dataset.limit) || Infinity;
  const lists = {
    today: root.querySelector('#news-today ol'),
    upcoming: root.querySelector('#news-upcoming ol'),
    previously: root.querySelector('#news-previously ol'),
  };
  if (!lists.today || !lists.upcoming || !lists.previously) return;

  const items = [...root.querySelectorAll('li[data-date]')];
  const bucket = (li) => (li.dataset.date === today ? 'today' : li.dataset.date > today ? 'upcoming' : 'previously');
  const moved = items.some((li) => li.parentElement !== lists[bucket(li)]);
  if (!moved) return;

  const groups = { today: [], upcoming: [], previously: [] };
  for (const li of items) {
    li.classList.toggle('today', li.dataset.date === today);
    groups[bucket(li)].push(li);
  }
  groups.today.sort((a, b) => a.dataset.date.localeCompare(b.dataset.date));
  groups.upcoming.sort((a, b) => a.dataset.date.localeCompare(b.dataset.date));
  groups.previously.sort((a, b) => b.dataset.date.localeCompare(a.dataset.date));
  const overflow = groups.previously.length > limit;
  groups.previously = groups.previously.slice(0, limit);
  for (const [k, list] of Object.entries(lists)) {
    list.replaceChildren(...groups[k]);
    list.closest('section').hidden = groups[k].length === 0;
  }
  const more = root.querySelector('#news-more');
  if (more && overflow) more.hidden = false;
})();
