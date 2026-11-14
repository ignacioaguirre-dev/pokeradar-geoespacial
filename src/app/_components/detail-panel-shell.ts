// Not modal: the map stays usable around it. A bottom sheet up to 60 % tall on phones, a floating panel on desktop.
// On phones it rests 8 px above the folded attribution (one 44 px button), which stays in reach. It never climbs
// higher than 10rem from the top, so the creature it is about keeps some map above it.
// Its own module so the load error can take the panel's place without pulling in the panel's chunk
export const PANEL =
  "pointer-events-auto fixed inset-x-0 bottom-[calc(3.25rem+env(safe-area-inset-bottom))] z-20 flex " +
  "max-h-[min(60dvh,calc(100dvh-13.25rem-env(safe-area-inset-bottom)))] " +
  "flex-col overflow-y-auto overscroll-contain rounded-t-panel border-t border-structure bg-surface p-4 " +
  "md:inset-x-auto md:top-3 md:right-[max(0.75rem,env(safe-area-inset-right))] md:bottom-auto md:w-[360px] " +
  "md:max-h-[calc(100dvh-10rem)] md:rounded-panel md:border md:pb-4";
