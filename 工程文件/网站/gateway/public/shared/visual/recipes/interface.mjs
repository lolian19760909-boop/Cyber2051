// Geometry and timing only. Colors, typography and business state belong to the page.
export function interfaceRecipe({ theme = 'crisp', level = 'high' } = {}) {
  const quiet = theme === 'quiet' || level === 'medium';
  return {
    ease: 'cubic-bezier(.22,1,.36,1)',
    duration: quiet ? 160 : theme === 'cut' ? 180 : 220,
    exit: quiet ? 120 : 160,
    distance: quiet ? 4 : 14,
    rows: quiet ? 4 : 8,
    delay: quiet ? 12 : 18,
    entry(direction = 1) {
      return [{ opacity: quiet ? .5 : .2, transform: `translateX(${Math.sign(direction) * (quiet ? 4 : 14)}px)` }, { opacity: 1, transform: 'none' }];
    },
  };
}
