import { buttonClass } from "@/components/ui/button-styles";

// A plain link: the root not-found ships with the initial JS, and next/link adds 3.6 kB gzip there.
// A full load is also the cleanest way out of a crashed page
export function BackToMapLink({ label }: { label: string }) {
  return (
    // eslint-disable-next-line @next/next/no-html-link-for-pages -- see above
    <a href="/" className={buttonClass("secondary")}>
      {label}
    </a>
  );
}
