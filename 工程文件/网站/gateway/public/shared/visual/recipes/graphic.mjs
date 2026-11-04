export const graphic = Object.freeze({
  id: 'graphic-c', version: 1,
  ease: 'cubic-bezier(.23,1,.32,1)',
  panelDuration: 340, pageDuration: 220,
  rowDuration: 180, rowDelay: 32, rowLimit: 6,
  panel: [
    { opacity: .25, clipPath: 'polygon(100% 0,100% 0,100% 100%,88% 100%)', transform: 'translateX(12px)' },
    { opacity: 1, clipPath: 'polygon(0 0,100% 0,100% 100%,0 100%)', transform: 'translateX(0)' },
  ],
  page(direction) {
    return [
      { opacity: .3, clipPath: `inset(0 ${direction > 0 ? '100%' : '0'} 0 ${direction > 0 ? '0' : '100%'})` },
      { opacity: 1, clipPath: 'inset(0 0 0 0)' },
    ];
  },
  row: [{ opacity: 0, transform: 'translateY(7px)' }, { opacity: 1, transform: 'translateY(0)' }],
});
