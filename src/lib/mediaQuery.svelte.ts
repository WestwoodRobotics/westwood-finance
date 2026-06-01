import { browser } from '$app/environment';

function createIsMobile() {
  let value = $state(false);

  if (browser) {
    const mq = window.matchMedia('(max-width: 768px)');
    value = mq.matches;
    mq.addEventListener('change', (e) => { value = e.matches; });
  }

  return {
    get current(): boolean { return value; },
  };
}

export const isMobile = createIsMobile();
