// Not modal: the map stays usable around it. A bottom sheet up to 60 % tall on phones, a floating panel on desktop.
// On phones it rises from the very bottom edge, over the folded attribution, which comes back when it closes.
// It never climbs higher than 10rem from the top, so the creature it is about keeps some map above it.
// Its own module so the load error can take the panel's place without pulling in the panel's chunk
export const PANEL =
  "pointer-events-auto fixed inset-x-0 bottom-0 z-20 flex max-h-[min(60dvh,calc(100dvh-10rem))] " +
  "flex-col overflow-y-auto overscroll-contain rounded-t-panel border-t border-structure bg-surface p-4 " +
  "pb-[max(1rem,env(safe-area-inset-bottom))] " +
  "md:inset-x-auto md:top-3 md:right-[max(0.75rem,env(safe-area-inset-right))] md:bottom-auto md:w-[360px] " +
  "md:max-h-[calc(100dvh-10rem)] md:rounded-panel md:border md:pb-4";
