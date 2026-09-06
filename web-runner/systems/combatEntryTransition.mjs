// Keep the old screen visible until black; reveal combat only after the hold.
export function createCombatEntryTransition(canvas) {
  return async change => {
    const shade = document.createElement('div');
    shade.setAttribute('aria-label', 'Entering combat');
    const place = () => {
      const r = canvas.getBoundingClientRect();
      Object.assign(shade.style, {left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`});
    };
    Object.assign(shade.style, {position:'fixed',background:'#000',zIndex:'1000',opacity:'0',pointerEvents:'auto'});
    place();
    const observer = new ResizeObserver(place);
    observer.observe(canvas);
    document.body.append(shade);
    const animate = (frames, duration) => shade.animate(frames, {duration,fill:'forwards',easing:'cubic-bezier(.65,0,.35,1)'}).finished;
    try {
      await animate([{opacity:0},{opacity:1}], 250);
      await animate([{opacity:1},{opacity:1}], 500);
      const changed = await change();
      await animate([{opacity:1},{opacity:0}], 1000);
      return changed;
    } finally {
      observer.disconnect();
      shade.remove();
    }
  };
}
