// Not modal: the map stays usable around it. A bottom sheet up to 60 % tall on phones, a floating panel on desktop.
// Its own module so the load error can take the panel's place without pulling in the panel's chunk
export const PANEL =
  "pointer-events-auto fixed inset-x-0 bottom-0 z-20 flex max-h-[60dvh] flex-col overflow-y-auto overscroll-contain " +
  "rounded-t-panel border-t border-structure bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] " +
  "md:inset-x-auto md:top-3 md:right-[max(0.75rem,env(safe-area-inset-right))] md:bottom-auto md:w-[360px] " +
  "md:max-h-[calc(100dvh-10rem)] md:rounded-panel md:border md:pb-4";
