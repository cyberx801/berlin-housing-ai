import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NeighborhoodDirectory } from "@/features/neighborhoods/NeighborhoodDirectory";
import { GEO_PROVENANCE, getBezirkOptions, getPlatePlaces } from "@/lib/data/geo";

const push = vi.fn();

// Next syncs useSearchParams with history.replaceState; reading the location reproduces that.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push }),
}));

const renderDirectory = () =>
  render(<NeighborhoodDirectory places={getPlatePlaces()} bezirke={getBezirkOptions()} provenance={GEO_PROVENANCE} />);

const table = () => screen.getByRole("table");
const rowNames = () =>
  within(table())
    .getAllByRole("rowheader")
    .map((cell) => within(cell).getByRole("link").textContent);
const search = () => screen.getByRole("searchbox", { name: "Search by name" });

beforeEach(() => {
  push.mockReset();
  window.history.replaceState(null, "", "/neighborhoods");
});

describe("NeighborhoodDirectory", () => {
  it("lists all 97 Ortsteile A–Z, each linking to its profile", () => {
    renderDirectory();
    expect(rowNames()).toHaveLength(97);
    const names = getPlatePlaces().map((p) => p.name);
    expect(rowNames()).toEqual(names);
    expect(screen.getByRole("link", { name: "Moabit" })).toHaveAttribute("href", "/neighborhoods/moabit");
    expect(screen.getByText("All 97 Ortsteile")).toBeInTheDocument();
    expect(screen.getByRole("search", { name: "Filter the Ortsteile" })).toBeInTheDocument();
  });

  it("reads its filters from the link", () => {
    window.history.replaceState(null, "", "/neighborhoods?bezirk=mitte&ring=inside");
    renderDirectory();
    expect(rowNames()).toEqual(["Hansaviertel", "Mitte", "Tiergarten"]);
    expect(screen.getByText("3 of 97 Ortsteile")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Bezirk (borough)" })).toHaveDisplayValue("Mitte");
    expect(screen.getByRole("radio", { name: "Inside" })).toBeChecked();
  });

  it("writes filters to the URL without adding history entries", async () => {
    const user = userEvent.setup();
    const length = window.history.length;
    renderDirectory();
    await user.selectOptions(screen.getByRole("combobox", { name: "Bezirk (borough)" }), "Mitte");
    expect(window.location.search).toBe("?bezirk=mitte");
    await user.click(screen.getByRole("radio", { name: "Partly inside" }));
    expect(window.location.search).toBe("?bezirk=mitte&ring=partly");
    const expected = getPlatePlaces()
      .filter((p) => p.bezirkCode === "01" && p.ringStatus === "partly")
      .map((p) => p.name);
    expect(expected).toContain("Moabit");
    expect(rowNames()).toEqual(expected);
    expect(window.history.length).toBe(length);
  });

  it("searches by name, folding umlauts, and opens a single match with Enter", async () => {
    const user = userEvent.setup();
    renderDirectory();
    await user.type(search(), "moa");
    expect(rowNames()).toEqual(["Moabit"]);
    expect(search()).toHaveAccessibleDescription("1 of 97 Ortsteile");
    expect(window.location.search).toBe("");
    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/neighborhoods/moabit");
    // The delayed search write is flushed first, so Back returns to "?q=moa".
    expect(window.location.search).toBe("?q=moa");

    await user.clear(search());
    await user.type(search(), "koepenick");
    expect(rowNames()).toEqual(["Köpenick"]);
  });

  it("lists the active filters when nothing matches, and each can be removed", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/neighborhoods?bezirk=spandau&ring=inside&q=xyz");
    renderDirectory();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("No Ortsteil matches these filters")).toBeInTheDocument();
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Bezirk: SpandauRemove",
      "Ring status: Inside the ringRemove",
      "Name contains: “xyz”Remove",
    ]);

    await user.click(screen.getByRole("button", { name: "Remove the name search" }));
    expect(search()).toHaveFocus();
    expect(screen.getByText("No Ortsteil matches these filters")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove the ring status filter" }));
    expect(screen.getByRole("radio", { name: "Any" })).toHaveFocus();
    expect(rowNames()).toHaveLength(9);
    expect(window.location.search).toBe("?bezirk=spandau");
  });

  it("clears every filter and returns focus to the search field", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/neighborhoods?bezirk=spandau&ring=inside");
    renderDirectory();
    await user.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(rowNames()).toHaveLength(97);
    expect(search()).toHaveFocus();
    expect(window.location.search).toBe("");
  });

  it("drops link parts it can't match and says so", () => {
    window.history.replaceState(null, "", "/neighborhoods?bezirk=atlantis&ring=inside");
    renderDirectory();
    expect(screen.getByRole("status")).toHaveTextContent("This link’s Bezirk couldn’t be matched, so it was left out.");
    expect(window.location.search).toBe("?ring=inside");
  });

  it("announces the count once typing pauses", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderDirectory();
      await user.type(search(), "wedd");
      const live = document.querySelector("[aria-live='polite']")!;
      expect(live).toHaveTextContent("");
      await act(() => vi.advanceTimersByTimeAsync(900));
      expect(live).toHaveTextContent("1 of 97 Ortsteile shown.");
      expect(window.location.search).toBe("?q=wedd");
    } finally {
      vi.useRealTimers();
    }
  });
});
