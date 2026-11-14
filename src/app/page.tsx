import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { preconnect } from "react-dom";
import { loadCatalog } from "@/features/catalog/queries";
import { loadSightings } from "@/features/sightings/queries";
import { sweepPayload } from "@/features/sweep/payload";
import type { SightingsPayload } from "@/features/sweep/types";
import { MapStage } from "./_components/map-stage";

const ATTRIBUTION_LINK =
  "inline-flex min-h-11 items-center rounded-control underline-offset-2 hover:text-foreground hover:underline " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";

// The map's sources; ecoregions are CC BY 4.0, which asks for the source and the license
function Credits({ data, separated = false }: { data: string; separated?: boolean }) {
  const dot = separated ? <span aria-hidden="true">·</span> : null;
  return (
    <>
      <a href="https://openfreemap.org" className={ATTRIBUTION_LINK}>
        © OpenFreeMap
      </a>
      {dot}
      <a href="https://openmaptiles.org" className={ATTRIBUTION_LINK}>
        © OpenMapTiles
      </a>
      {dot}
      <span className="inline-flex items-center gap-x-1">
        {data}
        <a href="https://www.openstreetmap.org/copyright" className={ATTRIBUTION_LINK}>
          © OpenStreetMap
        </a>
      </span>
      {dot}
      <a href="https://ecoregions.appspot.com" className={ATTRIBUTION_LINK}>
        © RESOLVE (CC BY 4.0)
      </a>
    </>
  );
}

export default async function Home() {
  // Started first so it overlaps the translations. Not awaited: a failed catalog is cached only briefly,
  // so awaiting it here would make the build depend on PokéAPI. Handed over as a promise, the route stays
  // prerendered and the dots stream in. On failure it is null: the dots stay off and the sweep says so.
  // The catalog is the same cached call loadSightings already made; it adds the slugs that name each marker
  const sightings: Promise<SightingsPayload | null> = Promise.all([loadSightings(), loadCatalog()]).then(
    ([loaded, catalog]) => (loaded.ok && catalog.ok ? sweepPayload(loaded.data, catalog.data) : null),
  );
  // MapLibre fetches the TileJSON with CORS, so only an anonymous connection gets reused
  preconnect("https://tiles.openfreemap.org", { crossOrigin: "anonymous" });
  // Sprites and cries; the markers and the list load their sprites anonymously to share this connection
  preconnect("https://raw.githubusercontent.com", { crossOrigin: "anonymous" });
  const [t, tMap, messages] = await Promise.all([
    getTranslations("Home"),
    getTranslations("Map"),
    getMessages(),
  ]);
  return (
    // Bottom column: MapStage's notice and controls stack above the attribution; the map fills it absolutely.
    // Clipped rather than hidden: a hidden box can still be scrolled from code (a focus), sliding the whole map aside
    <div className="relative flex h-dvh flex-col justify-end gap-2 overflow-clip bg-map-sea pb-[env(safe-area-inset-bottom)]">
      {/* Lets drags reach the map under the brand */}
      <header className="pointer-events-none absolute top-[max(0.75rem,env(safe-area-inset-top))] left-[max(0.75rem,env(safe-area-inset-left))] z-10">
        <h1 className="font-display font-stretch-condensed text-title font-bold uppercase tracking-tight md:text-headline">
          {t("heading")}
        </h1>
      </header>
      {/* Clicks fall through the empty column to the map; MapStage re-enables them on its parts */}
      <main className="pointer-events-none flex min-h-0 flex-1 flex-col items-end justify-end gap-2 pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))]">
        {/* A nested provider replaces the messages, so every namespace the island reads goes here */}
        <NextIntlClientProvider
          messages={{
            Map: messages.Map,
            MapHelp: messages.MapHelp,
            Button: messages.Button,
            Habitats: messages.Habitats,
            Fences: messages.Fences,
            Sweep: messages.Sweep,
            Creature: messages.Creature,
            Stats: messages.Stats,
            Types: messages.Types,
          }}
        >
          {/* loadSightings never rejects by design (failure is a value): no silent catch needed here */}
          <MapStage sightings={sightings} />
        </NextIntlClientProvider>
      </main>
      <footer
        aria-label={tMap("attribution")}
        className="relative mr-[max(0.75rem,env(safe-area-inset-right))] ml-[max(0.75rem,env(safe-area-inset-left))] self-end rounded-t-panel text-label text-muted md:bg-background/80 md:px-2"
      >
        {/* Phones fold it behind one button, like MapLibre's compact attribution, so it costs one line of map */}
        <details className="group md:hidden">
          <summary className="ml-auto flex size-11 cursor-pointer list-none items-center justify-center rounded-control border border-control bg-surface font-mono text-subtitle text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground group-open:border-foreground [&::-webkit-details-marker]:hidden">
            <span aria-hidden="true">©</span>
            <span className="sr-only">{tMap("attribution")}</span>
          </summary>
          <p className="absolute right-0 bottom-full mb-2 flex w-max max-w-[calc(100vw-1.5rem)] flex-col items-end rounded-panel border border-structure bg-surface px-3 py-1">
            <Credits data={tMap("attributionData")} />
          </p>
        </details>
        <p className="flex flex-wrap items-center justify-end gap-x-1 max-md:hidden">
          <Credits data={tMap("attributionData")} separated />
        </p>
      </footer>
    </div>
  );
}
