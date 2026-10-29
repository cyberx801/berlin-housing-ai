import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DRAFT_KEY } from "@/features/property-analysis/draft";
import { CompareView } from "@/features/property-comparison/CompareView";
import { defaultCompareLabel } from "@/features/property-comparison/rows";
import {
  addCompareItem,
  COMPARE_KEY,
  getCompareSnapshot,
  removeCompareItem,
  resetCompareCacheForTests,
  type NewCompareItem,
} from "@/features/property-comparison/store";
import { getBezirkOptions, getOrtsteilOptions } from "@/lib/data/geo";
import { EMPTY_PROPERTY_FORM } from "@/lib/validation/property";

const bezirke = getBezirkOptions();
const ortsteile = getOrtsteilOptions();

const item = (label: string, overrides: Partial<NewCompareItem> = {}): NewCompareItem => ({
  label,
  property: {
    bezirkCode: "01",
    ortsteilCode: "0102",
    address: null,
    propertyType: "apartment",
    areaM2: 65,
    rooms: 2.5,
    floor: 2,
    totalFloors: 5,
    buildingEra: "unknown",
    energyClass: "unknown",
    condition: "unknown",
    hasLift: null,
    hasBalcony: true,
    furnishing: "unfurnished",
    transitMinutes: null,
  },
  askingColdRent: null,
  listingUrl: null,
  source: "analysis",
  ...overrides,
});

const renderView = () => render(<CompareView bezirke={bezirke} ortsteile={ortsteile} />);
const dialog = () => screen.getByRole("dialog");
const columns = () => within(screen.getByRole("table").querySelector("thead")!).getAllByRole("columnheader");
const cells = (row: string) => Array.from(document.querySelectorAll(`td[headers~="compare-row-${row}"]`));
const live = () => document.querySelector("#compare-view > [aria-live]");
const plain = (text: string | null | undefined) => text?.replaceAll(" ", " ");

async function fillRequired(user: ReturnType<typeof userEvent.setup>, area = "65") {
  const scope = within(dialog());
  await user.selectOptions(scope.getByRole("combobox", { name: /^Bezirk/ }), "Mitte");
  await user.click(scope.getByRole("radio", { name: "Apartment" }));
  await user.type(scope.getByRole("textbox", { name: /^Living area/ }), area);
  await user.type(scope.getByRole("textbox", { name: /^Rooms/ }), "2");
}

beforeEach(() => resetCompareCacheForTests());

describe("CompareView", () => {
  it("starts with an empty state that invites both ways in", () => {
    renderView();
    const empty = screen.getByRole("region", { name: "Add the properties you are weighing up" });
    expect(within(empty).getByRole("button", { name: "Add a property" })).toBeInTheDocument();
    expect(within(empty).getByRole("link", { name: "Start from an analysis" })).toHaveAttribute("href", "/analyze");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(document.querySelector("#compare-view")).toHaveAttribute("data-hydrated");
  });

  it("validates the dialog like /analyze, then adds the property and moves focus to it", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole("button", { name: "Add a property" }));
    await screen.findByRole("dialog");
    await user.click(within(dialog()).getByRole("button", { name: "Add to comparison" }));

    const summary = within(dialog()).getByRole("region", { name: "Fix 4 fields to add this property" });
    expect(summary).toHaveFocus();
    expect(within(summary).getByRole("link", { name: "Choose the Bezirk (borough) the flat is in." })).toBeInTheDocument();

    await fillRequired(user);
    await user.type(within(dialog()).getByRole("textbox", { name: /^Asking cold rent/ }), "1.150");
    await user.click(within(dialog()).getByRole("button", { name: "Add to comparison" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(columns().map((th) => plain(th.textContent))).toEqual(["Mitte, 65 m²"]);
    await waitFor(() => expect(columns()[0]).toHaveFocus());
    expect(plain(live()?.textContent)).toBe("Added to comparison: Mitte, 65 m². 1 of 3 places used.");
    expect(cells("askingColdRent")[0]).toHaveTextContent("€1,150 a month");
    expect(plain(cells("rentPerM2")[0]?.textContent)).toBe("€17.69 /m²");
    expect(getCompareSnapshot().items[0]).toMatchObject({ source: "manual", askingColdRent: 1150 });
  });

  it("flags a missing asking rent and opens the editor on that field", async () => {
    addCompareItem(item(defaultCompareLabel("Moabit", 65)));
    const user = userEvent.setup();
    renderView();
    expect(cells("askingColdRent")[0]).toHaveTextContent("Missing");
    expect(cells("rentPerM2")[0]).toHaveTextContent("Needs the asking rent");
    expect(cells("predicted")[0]).toHaveTextContent("Model not connected");

    await user.click(screen.getByRole("button", { name: /^Add the asking rent for Moabit, 65\sm²$/ }));
    await screen.findByRole("dialog");
    const rent = within(dialog()).getByRole("textbox", { name: /^Asking cold rent/ });
    await waitFor(() => expect(rent).toHaveFocus());
    // The made-up title is left empty, so it keeps following the place and area.
    expect(within(dialog()).getByRole("textbox", { name: /^Name in the comparison/ })).toHaveValue("");
    await user.type(rent, "980");
    await user.click(within(dialog()).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(cells("askingColdRent")[0]).toHaveTextContent("€980 a month"));
    await waitFor(() => expect(columns()[0]).toHaveFocus());
    expect(live()).toHaveTextContent("Saved changes to Moabit");
    expect(getCompareSnapshot().items[0]).toMatchObject({ askingColdRent: 980, source: "analysis" });
  });

  it("asks before removing or clearing, then puts focus on the page", async () => {
    addCompareItem(item("A"));
    addCompareItem(item("B"));
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("button", { name: "Remove A" }));
    expect(dialog()).toHaveAccessibleName("Remove A?");
    await user.click(within(dialog()).getByRole("button", { name: "Keep it" }));
    expect(columns()).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Remove A" }));
    await user.click(within(dialog()).getByRole("button", { name: "Remove the property" }));
    expect(columns().map((th) => th.textContent)).toEqual(["B"]);
    await waitFor(() => expect(screen.getByRole("heading", { name: "How do your properties compare?" })).toHaveFocus());
    expect(live()).toHaveTextContent("Removed A. 1 of 3 places used.");

    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(dialog()).toHaveAccessibleDescription("This property is deleted from this browser and can't be brought back.");
    await user.click(within(dialog()).getByRole("button", { name: "Clear the comparison" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Add the properties you are weighing up" })).toHaveFocus(),
    );
    expect(getCompareSnapshot().items).toEqual([]);
  });

  it("requires a choice of property to replace when the comparison is full", async () => {
    for (const label of ["A", "B", "C"]) addCompareItem(item(label));
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole("button", { name: "Add a property" }));
    await screen.findByRole("dialog");
    const group = within(dialog()).getByRole("group", { name: /^Which property does this one replace\?/ });
    await fillRequired(user, "70");
    await user.click(within(dialog()).getByRole("button", { name: "Add to comparison" }));
    expect(within(dialog()).getByRole("link", { name: "Choose the property this one replaces." })).toBeInTheDocument();

    await user.click(within(group).getByRole("radio", { name: "B" }));
    await user.click(within(dialog()).getByRole("button", { name: "Add to comparison" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(columns().map((th) => plain(th.textContent))).toEqual(["A", "Mitte, 70 m²", "C"]);
    expect(plain(live()?.textContent)).toBe("Mitte, 70 m² replaced B.");
  });

  it("keeps the entries of an edited property that another tab removed", async () => {
    const added = addCompareItem(item("A", { askingColdRent: 1000 }));
    if (!added.ok) throw new Error("expected the add to succeed");
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole("button", { name: "Edit A" }));
    await screen.findByRole("dialog");
    await user.clear(within(dialog()).getByRole("textbox", { name: /^Asking cold rent/ }));
    await user.type(within(dialog()).getByRole("textbox", { name: /^Asking cold rent/ }), "1100");

    act(() => removeCompareItem(added.id));
    await user.click(within(dialog()).getByRole("button", { name: "Save changes" }));
    expect(within(dialog()).getByText(/perhaps removed in another tab/)).toBeInTheDocument();
    expect(within(dialog()).getByRole("textbox", { name: /^Asking cold rent/ })).toHaveValue("1100");

    await user.click(within(dialog()).getByRole("button", { name: "Add to comparison" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(getCompareSnapshot().items).toMatchObject([{ label: "A", askingColdRent: 1100 }]);
  });

  it("offers the tab's analysis and keeps unsaved entries when the dialog closes", async () => {
    window.sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        version: 1,
        values: { ...EMPTY_PROPERTY_FORM, bezirk: "01", propertyType: "loft", area: "90", rooms: "3" },
      }),
    );
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole("button", { name: "Add a property" }));
    await screen.findByRole("dialog");
    await user.type(within(dialog()).getByRole("textbox", { name: /^Name in the comparison/ }), "Loft");
    await user.click(within(dialog()).getByRole("button", { name: "Close and keep my entries" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Add a property" }));
    await screen.findByRole("dialog");
    expect(within(dialog()).getByText("Your unsaved entries from before are still here.")).toBeInTheDocument();
    expect(within(dialog()).getByRole("textbox", { name: /^Name in the comparison/ })).toHaveValue("Loft");

    await user.click(within(dialog()).getByRole("button", { name: "Fill in from your analysis" }));
    expect(within(dialog()).getByRole("textbox", { name: /^Asking cold rent/ })).toHaveFocus();
    expect(within(dialog()).getByRole("radio", { name: "Loft" })).toBeChecked();
    expect(within(dialog()).getByRole("textbox", { name: /^Living area/ })).toHaveValue("90");
    await user.click(within(dialog()).getByRole("button", { name: "Add to comparison" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(getCompareSnapshot().items).toMatchObject([{ label: "Loft", source: "analysis" }]);
  });

  it("leaves a broken analysis draft for /analyze to report", async () => {
    window.sessionStorage.setItem(DRAFT_KEY, "{broken");
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole("button", { name: "Add a property" }));
    await screen.findByRole("dialog");
    expect(within(dialog()).queryByRole("button", { name: "Fill in from your analysis" })).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem(DRAFT_KEY)).toBe("{broken");
  });

  it("tells the user when saved data couldn't be read", async () => {
    window.localStorage.setItem(COMPARE_KEY, "{not json");
    const user = userEvent.setup();
    renderView();
    expect(screen.getByText(/The comparison saved in this browser couldn’t be read/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/couldn’t be read/)).not.toBeInTheDocument();
  });
});
