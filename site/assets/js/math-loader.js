/* Math typesetting is optional: a slow CDN must never block search or filters. */
(() => {
  for (const href of [
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;550;600;650;700&family=Manrope:wght@400;500;600;700;800&display=swap',
    'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css'
  ]) {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href;
    document.head.append(link);
  }
  function load(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
  }
  load('https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js')
    .then(() => load('https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js'))
    .then(() => window.dispatchEvent(new Event('fhs-math-ready')))
    .catch(() => { /* Original notation stays readable when typesetting is unavailable. */ });
})();
