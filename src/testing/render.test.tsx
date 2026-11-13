import { useTranslations } from "next-intl";
import { describe, expect, it } from "vitest";
import { render, screen } from "./render";

function Titulo() {
  const t = useTranslations("Home");
  return <h1>{t("heading")}</h1>;
}

describe("render with intl", () => {
  it("provides the real es-AR catalog to components", () => {
    render(<Titulo />);
    expect(screen.getByRole("heading", { name: "PokeRadar Geoespacial" })).toBeInTheDocument();
  });
});
