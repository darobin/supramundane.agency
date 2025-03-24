
const SVG_NS = 'http://www.w3.org/2000/svg';

(() => {
  let svg;
  const h1 = document.querySelector('h1');
  function paint () {
    if (svg) svg.remove();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const h1h = h1.offsetHeight || 0;
    console.warn(h1h);
    const stopTop = (vh / 2) - (h1h / 2) - 20;
    const stopBot = (vh / 2) + (h1h / 2) + 20;
    
    svg = s('svg', { viewBox: `0 0 ${vw} ${vh}`, id: 'lines' },
      [
        s('g', { stroke: 'red', 'stroke-width': '2' },
          [
            s('line', { x1: 0, x2: vw, y1: stopTop, y2: stopTop }),
            s('line', { x1: 0, x2: vw, y1: stopBot, y2: stopBot }),
          ]
        ),
      ]
    );
    
    document.body.prepend(svg);
  }
  
  window.addEventListener('load', paint);
  window.addEventListener('resize', paint);
})();


function s (n, attr, kids) {
  const el = document.createElementNS(SVG_NS, n);
  if (attr) {
    Object.keys(attr).forEach(k => el.setAttribute(k, attr[k]));
  }
  if (kids) el.append(...kids);
  return el;
}
