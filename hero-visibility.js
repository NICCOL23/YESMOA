(() => {
  const element = document.querySelector('.hero-swiper');
  const canvas = element?.closest('.canvas');
  if (!element || !canvas) return;
  let frame;
  const sync = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const swiper = element.swiper;
      if (!swiper || swiper.destroyed) return;
      if (canvas.hidden || document.hidden) {
        swiper.autoplay?.stop();
        return;
      }
      // Recalculate fade offsets only after the previously hidden canvas has layout.
      swiper.update();
      swiper.slideTo(swiper.activeIndex, 0, false);
      swiper.updateAutoHeight(0);
      if (!element.matches(':hover')) swiper.autoplay?.start();
    });
  };
  new MutationObserver(sync).observe(canvas, {attributes:true,attributeFilter:['hidden']});
  window.addEventListener('pageshow', sync);
  document.addEventListener('visibilitychange', sync);
  element.querySelectorAll('img').forEach(img => img.addEventListener('load', sync));
  sync();
})();
