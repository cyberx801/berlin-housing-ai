import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExploreView } from "@/features/neighborhood-explorer/ExploreView";
import { GEO_PROVENANCE, getBerlinBbox, getExploreBezirke, getExplorePlaces } from "@/lib/data/geo";

// Next syncs useSearchParams with history.replaceState; reading the location reproduces that.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const places = getExplorePlaces();
const bezirke = getExploreBezirke();

// jsdom has no WebGL2 (tests/support/setup.ts), so the plate stands in for the map: the
// same path a browser without WebGL2 takes. A stub plate keeps the DOM small.
const renderView = () =>
  render(
    <ExploreView
      places={places}
      bezirke={bezirke}
      berlinBbox={getBerlinBbox()}
      provenance={GEO_PROVENANCE}
      plateIdPrefix="test-plate"
      plateSize={{ width: 100, height: 100 }}
      plate={
        <svg role="img" aria-label="Plate">
          <path data-code="0102" data-testid="plate-moabit" />
        </svg>
      }
    />,
  );

const listbox = () => screen.getByRole("listbox", { name: "Ortsteile" });
const option = (name: string) => within(listbox()).getByRole("option", { name: new RegExp(`^${name}`) });
const detailsHeading = () => document.getElementById("explore-details-title");

function setWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
}

beforeEach(() => {
  setWidth(1280);
  window.history.replaceState(null, "", "/explore");
});

describe("ExploreView", () => {
  it("lists all 97 Ortsteile grouped by Bezirk, and says why the map is a plate", () => {
    renderView();
    expect(within(listbox()).getAllByRole("option")).toHaveLength(97);
    expect(within(listbox()).getAllByRole("group")).toHaveLength(12);
    expect(within(listbox()).getByRole("group", { name: "Mitte" })).toBeInTheDocument();
    expect(screen.getByText("All 97 Ortsteile")).toBeInTheDocument();
    expect(screen.getByText(/The interactive map needs WebGL2/)).toBeInTheDocument();
    expect(document.querySelector("[data-map-state]")).toHaveAttribute("data-map-state", "fallback");
    expect(screen.getByText(/Geometry: ALKIS Berlin/)).toBeInTheDocument();
  });

  it("moves with the arrow keys and selects with Enter, keeping focus in the list", async () => {
    const user = userEvent.setup();
    renderView();
    // Search, Bezirk, ring status (one stop for the radio group), then the list.
    await user.click(screen.getByRole("searchbox", { name: "Search by name" }));
    await user.tab();
    await user.tab();
    await user.tab();
    expect(listbox()).toHaveFocus();
    const first = within(listbox()).getAllByRole("option")[0]!;
    expect(listbox()).toHaveAttribute("aria-activedescendant", first.id);

    await user.keyboard("{ArrowDown}");
    const second = within(listbox()).getAllByRole("option")[1]!;
    expect(listbox()).toHaveAttribute("aria-activedescendant", second.id);
    await user.keyboard("{End}");
    const options = within(listbox()).getAllByRole("option");
    expect(listbox()).toHaveAttribute("aria-activedescendant", options.at(-1)!.id);
    await user.keyboard("{Home}{ArrowDown}{Enter}");

    expect(second).toHaveAttribute("aria-selected", "true");
    expect(detailsHeading()).toHaveTextContent(second.textContent!.replace("Selected", ""));
    expect(listbox()).toHaveFocus();
    expect(window.location.search).toMatch(/^\?o=[a-z-]+$/);
  });

  it("selects with a click and shows only verified facts and the next steps", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(option("Moabit"));

    expect(option("Moabit")).toHaveAttribute("aria-selected", "true");
    expect(option("Moabit")).toHaveTextContent("Selected");
    expect(detailsHeading()).toHaveTextContent("Moabit");
    const details = screen.getByRole("region", { name: "Moabit" });
    expect(within(details).getByText("Official data")).toBeInTheDocument();
    expect(within(details).getByText("Partly inside the ring")).toBeInTheDocument();
    expect(within(details).getByRole("heading", { name: /Bordering Ortsteile/ })).toBeInTheDocument();
    expect(within(details).getByRole("link", { name: "Analyze a flat in Moabit" })).toHaveAttribute(
      "href",
      "/analyze?bezirk=mitte&ortsteil=moabit",
    );
    expect(within(details).getByRole("link", { name: "Open the Moabit profile" })).toHaveAttribute(
      "href",
      "/neighborhoods/moabit",
    );
    expect(window.location.search).toBe("?o=moabit");
    expect(await screen.findByText("Moabit selected, in Mitte. Partly inside the ring.")).toBeInTheDocument();
  });

  it("selects a bordering Ortsteil and moves focus to its heading", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(option("Moabit"));
    await user.click(screen.getByRole("button", { name: "Hansaviertel" }));
    expect(detailsHeading()).toHaveTextContent("Hansaviertel");
    expect(detailsHeading()).toHaveFocus();
    expect(window.location.search).toBe("?o=hansaviertel");
  });

  it("closes with Esc and returns focus to the list", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(option("Moabit"));
    screen.getByRole("button", { name: "Close" }).focus();
    await user.keyboard("{Escape}");
    expect(detailsHeading()).toHaveTextContent("No Ortsteil chosen yet");
    expect(option("Moabit")).toHaveAttribute("aria-selected", "false");
    expect(listbox()).toHaveFocus();
    expect(window.location.search).toBe("");
  });

  it("searches across spellings, writes the query to the URL and offers a way out of no matches", async () => {
    const user = userEvent.setup();
    renderView();
    const search = screen.getByRole("searchbox", { name: "Search by name" });
    await user.type(search, "neukoelln");
    expect(within(listbox()).getAllByRole("option").map((o) => o.textContent)).toEqual(["Neukölln"]);
    expect(screen.getByText("1 of 97 Ortsteile")).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe("?q=neukoelln"));

    await user.keyboard("{Enter}");
    expect(detailsHeading()).toHaveTextContent("Neukölln");

    await user.clear(search);
    await user.type(search, "zzz");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByText("No Ortsteil matches these filters.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear search and filters" }));
    expect(within(listbox()).getAllByRole("option")).toHaveLength(97);
  });

  it("filters by Bezirk and ring status, and keeps a filtered-out selection with a note", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(option("Neukölln"));
    await user.selectOptions(screen.getByRole("combobox", { name: "Bezirk (borough)" }), "Mitte");
    expect(within(listbox()).getAllByRole("option")).toHaveLength(6);
    expect(window.location.search).toBe("?o=neukoelln&bezirk=mitte");
    expect(screen.getByText("Hidden by the current filter.")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Inside" }));
    const inside = within(listbox()).getAllByRole("option");
    expect(inside.length).toBeGreaterThan(0);
    expect(inside.length).toBeLessThan(6);
    expect(window.location.search).toBe("?o=neukoelln&bezirk=mitte&ring=inside");

    await user.click(screen.getAllByRole("button", { name: "Clear filters" })[0]!);
    expect(within(listbox()).getAllByRole("option")).toHaveLength(97);
    expect(screen.queryByText("Hidden by the current filter.")).toBeNull();
    expect(window.location.search).toBe("?o=neukoelln");
  });

  it("applies a shared link once and drops the parts it can't use", async () => {
    window.history.replaceState(null, "", "/explore?o=moabit&bezirk=nowhere&ring=inside");
    renderView();
    await waitFor(() => expect(detailsHeading()).toHaveTextContent("Moabit"));
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent(
      "This link’s Bezirk couldn’t be matched, so it was left out.",
    );
    expect(screen.getByRole("radio", { name: "Inside" })).toBeChecked();
    expect(window.location.search).toBe("?o=moabit&ring=inside");
  });

  it("selects from the plate when the map can't run", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByTestId("plate-moabit"));
    expect(detailsHeading()).toHaveTextContent("Moabit");
  });

  describe("below lg", () => {
    beforeEach(() => setWidth(375));

    it("switches to the Details tab on selection and moves focus with it", async () => {
      const user = userEvent.setup();
      renderView();
      const listTab = screen.getByRole("tab", { name: "List (97)" });
      expect(listTab).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tabpanel", { name: "List (97)" })).toBeInTheDocument();

      act(() => listbox().focus());
      await user.keyboard("{ArrowDown}{Enter}");
      expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
      expect(detailsHeading()).toHaveFocus();

      await user.click(screen.getByRole("button", { name: "Close" }));
      expect(listTab).toHaveAttribute("aria-selected", "true");
      expect(listbox()).toHaveFocus();
    });

    it("moves between tabs with the arrow keys", async () => {
      const user = userEvent.setup();
      renderView();
      act(() => screen.getByRole("tab", { name: "List (97)" }).focus());
      await user.keyboard("{ArrowRight}");
      expect(screen.getByRole("tab", { name: "Details" })).toHaveFocus();
      expect(screen.getByRole("tabpanel", { name: "Details" })).toHaveTextContent("No Ortsteil chosen yet");
    });
  });
});
