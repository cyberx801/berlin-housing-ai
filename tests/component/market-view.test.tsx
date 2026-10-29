import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarketView } from "@/features/market-intelligence/MarketView";
import { getBezirkOptions } from "@/lib/data/geo";
import { demoMarketSource as source } from "@/lib/data/market/demo-source";
import { defaultFilter, parseApiQuery } from "@/lib/market/query";

// Next syncs useSearchParams with history.replaceState; reading the location reproduces that.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const bezirke = getBezirkOptions();
const filter = defaultFilter(source.coverage);
const initial = {
  trend: { provenance: source.provenance, data: await source.rentTrend(filter) },
  districts: { provenance: source.provenance, data: await source.districtComparison(filter) },
  distribution: { provenance: source.provenance, data: await source.priceDistribution(filter) },
  types: { provenance: source.provenance, data: await source.propertyTypeComparison(filter) },
};

// The fake network answers from the same demo source the route handlers use.
const ANSWERS: Record<string, (f: typeof filter) => Promise<unknown>> = {
  "/api/market/rent-trend": (f) => source.rentTrend(f),
  "/api/market/districts": (f) => source.districtComparison(f),
  "/api/market/distribution": (f) => source.priceDistribution(f),
  "/api/market/property-types": (f) => source.propertyTypeComparison(f),
};
const requests: string[] = [];
let failPath: string | null = null;

const fetchMock = vi.fn(async (input: string) => {
  const url = new URL(input, "http://localhost");
  requests.push(`${url.pathname}${url.search}`);
  if (url.pathname === failPath) return { ok: false, status: 503, json: async () => ({}) };
  const parsed = parseApiQuery(url.searchParams, source.coverage);
  if (!parsed.ok) return { ok: false, status: 400, json: async () => ({}) };
  const data = await ANSWERS[url.pathname]!(parsed.filter);
  return { ok: true, status: 200, json: async () => ({ provenance: source.provenance, data }) };
});

const renderView = () => render(<MarketView bezirke={bezirke} coverage={source.coverage} initial={initial} />);
const checkbox = (name: string) => screen.getByRole("checkbox", { name });
const plate = (id: string) => document.getElementById(id)!;
const scope = (id: string) => plate(id).querySelector("[data-module-scope]")!.textContent;
const allReady = () =>
  waitFor(() => {
    const statuses = [...document.querySelectorAll("[data-module-status]")].map((e) => e.getAttribute("data-module-status"));
    expect(statuses).toEqual(["ready", "ready", "ready", "ready"]);
  });

beforeEach(() => {
  window.history.replaceState(null, "", "/market");
  requests.length = 0;
  failPath = null;
  vi.stubGlobal("fetch", fetchMock);
  // Give every chart frame a size, so the SVGs are drawn.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 720,
    height: 320,
    top: 0,
    left: 0,
    right: 720,
    bottom: 320,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("MarketView", () => {
  it("renders the four modules from the server data without fetching, each labeled as demo", () => {
    renderView();
    for (const title of [
      "How has the median asking rent per m² moved?",
      "How do the 12 Bezirke compare on asking rent per m²?",
      "How are asking rents per m² spread across listings?",
      "How do property types compare on asking rent per m²?",
    ]) {
      const region = screen.getByRole("region", { name: title });
      expect(within(region).getByText("Demo data, not Berlin market statistics", { selector: "p span" })).toBeInTheDocument();
      expect(region.querySelector('[data-provenance-stamp="demo"]')).toHaveTextContent(
        "Demo data, not Berlin market statistics",
      );
      expect(within(region).getByText("Show table")).toBeInTheDocument();
      expect(within(region).getByRole("link", { name: "How this is calculated" })).toHaveAttribute(
        "href",
        "/methodology#market-data",
      );
    }
    expect(screen.getAllByRole("slider")).toHaveLength(4);
    expect(scope("market-trend")).toBe("All of Berlin, all property types, 2020 to 2025.");
    expect(requests).toEqual([]);
  });

  it("updates every module and the URL when Bezirke are chosen, keeping each line's color", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(checkbox("Mitte"));
    await user.click(checkbox("Pankow"));
    await user.click(checkbox("Spandau"));
    expect(window.location.search).toBe("?bezirke=mitte%2Cpankow%2Cspandau");
    await allReady();
    expect(scope("market-trend")).toBe("Mitte, Pankow and Spandau, all property types, 2020 to 2025.");
    expect(scope("market-distribution")).toBe("Mitte, Pankow and Spandau combined, all property types, 2020 to 2025.");
    expect(within(plate("market-trend")).getByRole("list", { name: "Lines" })).toHaveTextContent("MittePankowSpandau");

    // Removing Mitte must not repaint Pankow (slot 2) or Spandau (slot 3).
    await user.click(checkbox("Mitte"));
    await allReady();
    const keyOf = (name: string) => checkbox(name).closest("label")!.querySelector("[aria-hidden]");
    expect(keyOf("Pankow")).toHaveClass("bg-series-2");
    expect(keyOf("Spandau")).toHaveClass("bg-series-3");
    // A new Bezirk takes the free slot.
    await user.click(checkbox("Lichtenberg"));
    expect(keyOf("Lichtenberg")).toHaveClass("bg-series-1");
    expect(window.location.search).toBe("?bezirke=lichtenberg%2Cpankow%2Cspandau");
  });

  it("refuses a fifth Bezirk and says why", async () => {
    const user = userEvent.setup();
    renderView();
    for (const name of ["Mitte", "Pankow", "Spandau", "Neukölln"]) await user.click(checkbox(name));
    const fifth = checkbox("Lichtenberg");
    expect(fifth).toHaveAttribute("aria-disabled", "true");
    expect(fifth).toHaveAccessibleDescription("4 of 4 chosen. Clear one to add another.");
    await user.click(fifth);
    expect(fifth).not.toBeChecked();
    expect(document.getElementById("market-bezirke-status")).toHaveAttribute("role", "status");
    expect(document.getElementById("market-bezirke-status")).toHaveTextContent(
      "Up to 4 Bezirke can be compared at once. Clear one to add Lichtenberg.",
    );
    expect(window.location.search).toBe("?bezirke=mitte%2Cpankow%2Cspandau%2Cneukoelln");
  });

  it("only refetches the modules whose filters changed", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(checkbox("Mitte"));
    await allReady();
    // The district comparison always shows all 12 Bezirke, so a Bezirk change doesn't touch it.
    expect(requests.map((r) => r.split("?")[0]).sort()).toEqual([
      "/api/market/distribution",
      "/api/market/property-types",
      "/api/market/rent-trend",
    ]);
    requests.length = 0;
    await user.selectOptions(screen.getByLabelText("Property type"), "loft");
    await allReady();
    expect(requests.map((r) => r.split("?")[0]).sort()).toEqual([
      "/api/market/distribution",
      "/api/market/districts",
      "/api/market/rent-trend",
    ]);
    expect(scope("market-types")).toBe("Mitte, 2020 to 2025. Every property type is shown, with lofts outlined.");
    expect(await screen.findByText("Charts show Mitte, lofts, 2020 to 2025.")).toBeInTheDocument();
  });

  it("keeps the period valid and writes it to the URL", async () => {
    const user = userEvent.setup();
    renderView();
    await user.selectOptions(screen.getByLabelText("From"), "2023");
    const to = screen.getByLabelText("To");
    expect(within(to).getByRole("option", { name: "2022" })).toBeDisabled();
    expect(within(to).getByRole("option", { name: "2023" })).not.toBeDisabled();
    expect(window.location.search).toBe("?from=2023");
    await allReady();
    expect(scope("market-districts")).toBe("All 12 Bezirke, all property types, 2023 to 2025.");
  });

  it("shows the empty state for a combination without demo data, with a way out", async () => {
    window.history.replaceState(null, "", "/market?bezirke=spandau&type=penthouse");
    const user = userEvent.setup();
    renderView();
    await waitFor(() => expect(scope("market-trend")).toBe("Spandau, penthouses, 2020 to 2025."));
    await allReady();
    const trend = within(plate("market-trend"));
    expect(trend.getByRole("heading", { name: "No demo series for this combination" })).toBeInTheDocument();
    expect(trend.queryByRole("slider")).not.toBeInTheDocument();
    // The property-type comparison still answers, with no dot for penthouses.
    expect(within(plate("market-types")).getByRole("slider")).toBeInTheDocument();

    await user.click(trend.getByRole("button", { name: "Show all property types" }));
    await allReady();
    expect(window.location.search).toBe("?bezirke=spandau");
    expect(within(plate("market-trend")).getByRole("slider")).toBeInTheDocument();
  });

  it("cleans a link it can't use in full and says what was dropped", async () => {
    window.history.replaceState(null, "", "/market?bezirke=mitte,atlantis&from=2030&type=castle");
    renderView();
    expect(
      await screen.findByText(
        "This link couldn’t be used in full: a Bezirk in it wasn't recognised and was left out, its period wasn't valid, so every year is shown and its property type wasn't recognised, so all types are shown.",
      ),
    ).toBeInTheDocument();
    expect(window.location.search).toBe("?bezirke=mitte");
    expect(checkbox("Mitte")).toBeChecked();
  });

  it("keeps the other modules when one request fails, and can try again", async () => {
    failPath = "/api/market/distribution";
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    renderView();
    await user.click(checkbox("Pankow"));
    const distribution = within(plate("market-distribution"));
    expect(await distribution.findByRole("heading", { name: "This chart couldn't load" })).toBeInTheDocument();
    await waitFor(() => expect(scope("market-trend")).toBe("Pankow, all property types, 2020 to 2025."));
    expect(within(plate("market-trend")).getByRole("slider")).toBeInTheDocument();
    expect(await screen.findByText("Charts show Pankow, all property types, 2020 to 2025. One chart couldn't load.")).toBeInTheDocument();

    failPath = null;
    await user.click(distribution.getByRole("button", { name: "Try again" }));
    await allReady();
    expect(within(plate("market-distribution")).getByRole("slider")).toBeInTheDocument();
    log.mockRestore();
  });

  it("reads values with the arrow keys and dismisses the readout with Escape", async () => {
    const user = userEvent.setup();
    renderView();
    const slider = within(plate("market-trend")).getByRole("slider", { name: "Median asking rent per m², by month" });
    expect(slider).toHaveAttribute("aria-valuemax", "72");
    expect(slider).toHaveAttribute("aria-valuetext", expect.stringMatching(/^December 2025: €\d+\.\d\d/));
    slider.focus();
    await user.keyboard("{Home}");
    expect(slider).toHaveAttribute("aria-valuenow", "1");
    expect(slider).toHaveAttribute("aria-valuetext", expect.stringMatching(/^January 2020: /));
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(slider).toHaveAttribute("aria-valuetext", expect.stringMatching(/^March 2020: /));
    expect(slider).toHaveAttribute("data-chart-index", "2");
    await user.keyboard("{Escape}");
    expect(slider).not.toHaveAttribute("data-chart-index");

    const bars = within(plate("market-districts")).getByRole("slider");
    bars.focus();
    await user.keyboard("{ArrowDown}");
    expect(bars).toHaveAttribute("aria-valuetext", expect.stringMatching(/, 2 of 12: €\d+\.\d\d.*listings$/));
  });

  it("lists every value in the table views", () => {
    renderView();
    const tables = screen.getAllByRole("table", { hidden: true });
    expect(tables).toHaveLength(4);
    expect(within(tables[0]!).getAllByRole("row", { hidden: true })).toHaveLength(73);
    expect(within(tables[1]!).getAllByRole("row", { hidden: true })).toHaveLength(13);
    expect(tables[0]!.querySelector("caption")).toHaveTextContent(
      "Median asking rent per m² by month. All of Berlin, all property types, 2020 to 2025. Demo data, not Berlin market statistics.",
    );
  });
});
