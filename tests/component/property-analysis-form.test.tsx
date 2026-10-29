import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DRAFT_KEY } from "@/features/property-analysis/draft";
import { PropertyAnalysisForm } from "@/features/property-analysis/PropertyAnalysisForm";
import { getBezirkOptions, getOrtsteilOptions } from "@/lib/data/geo";
import { EMPTY_PROPERTY_FORM } from "@/lib/validation/property";

// Next syncs useSearchParams with history.replaceState; reading the location reproduces that.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const bezirke = getBezirkOptions();
const ortsteile = getOrtsteilOptions();
const codeOf = (slug: string) => bezirke.find((b) => b.slug === slug)!.code;

const renderForm = () => render(<PropertyAnalysisForm bezirke={bezirke} ortsteile={ortsteile} />);
const bezirkSelect = () => screen.getByRole("combobox", { name: /^Bezirk/ });
const ortsteilSelect = () => screen.getByRole("combobox", { name: /^Ortsteil/ });
const textbox = (name: RegExp) => screen.getByRole("textbox", { name });
const submit = () => screen.getAllByRole("button", { name: "Prepare analysis" }).at(-1)!;

beforeEach(() => {
  window.history.replaceState(null, "", "/analyze");
});

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(bezirkSelect(), "Mitte");
  await user.click(screen.getByRole("radio", { name: "Apartment" }));
  await user.type(textbox(/^Living area/), "65");
  await user.type(textbox(/^Rooms/), "2,5");
}

describe("PropertyAnalysisForm", () => {
  it("shows five groups with completion counts and the required count in words", () => {
    renderForm();
    for (const title of ["Location", "The flat", "Building", "Features", "Surroundings"]) {
      expect(screen.getByRole("region", { name: title })).toBeInTheDocument();
    }
    expect(within(screen.getByRole("region", { name: "Location" })).getByText("0 of 3 answered")).toBeInTheDocument();
    expect(screen.getAllByText("Required fields: 0 of 4").length).toBeGreaterThan(0);
    // Every categorical optional field offers an explicit "Not sure" (PRD B2).
    for (const group of ["Condition", "Lift", "Balcony", "Furnishing"]) {
      expect(within(screen.getByRole("group", { name: new RegExp(`^${group}`) })).getByRole("radio", { name: "Not sure" })).toBeChecked();
    }
  });

  it("an empty submit shows an error summary, focuses it, and its links focus the fields (B4)", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(submit());

    const summary = await screen.findByRole("region", { name: "Fix 4 fields to prepare the analysis" });
    expect(summary).toHaveFocus();
    const links = within(summary).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([
      "Choose the Bezirk (borough) the flat is in.",
      "Choose the property type.",
      "Enter the living area in m², for example 65.",
      "Enter the number of rooms, for example 2 or 2.5.",
    ]);
    expect(bezirkSelect()).toHaveAttribute("aria-invalid", "true");

    await user.click(links[2]!);
    expect(textbox(/^Living area/)).toHaveFocus();
    await user.click(links[1]!);
    expect(screen.getByRole("radio", { name: "Apartment" })).toHaveFocus();
  });

  it("leaving the property type without choosing keeps a clean value (no null in the form or draft)", async () => {
    const user = userEvent.setup();
    renderForm();
    screen.getByRole("radio", { name: "Apartment" }).focus();
    await user.tab();
    await user.click(submit());
    const summary = await screen.findByRole("region", { name: /Fix 4 fields/ });
    expect(summary).toHaveTextContent("Choose the property type.");
    expect(summary).not.toHaveTextContent(/expected|received/);

    await user.type(textbox(/^Living area/), "65");
    await waitFor(() => {
      const draft = JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) ?? "{}");
      expect(draft.values).toMatchObject({ area: "65", propertyType: "" });
    });
  });

  it("changing the Bezirk clears an Ortsteil that is not in it and announces it (B3)", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.selectOptions(bezirkSelect(), "Mitte");
    expect(within(ortsteilSelect()).getAllByRole("option").map((o) => o.textContent)).toContain("Moabit");
    expect(within(ortsteilSelect()).queryByRole("option", { name: "Prenzlauer Berg" })).toBeNull();
    await user.selectOptions(ortsteilSelect(), "Moabit");

    await user.selectOptions(bezirkSelect(), "Pankow");
    expect(ortsteilSelect()).toHaveValue("");
    expect(screen.getByText("Ortsteil cleared: Moabit is not in Pankow.")).toBeInTheDocument();
  });

  it("choosing an Ortsteil first fills in its Bezirk", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.selectOptions(ortsteilSelect(), "Moabit");
    expect(bezirkSelect()).toHaveValue(codeOf("mitte"));
    expect(screen.getByText("Bezirk set to Mitte.")).toBeInTheDocument();
  });

  it("floor above total floors is an error on the floor field, even before the rest is filled in", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(textbox(/^Floor/), "7");
    await user.type(textbox(/^Total floors/), "5");
    await user.tab();
    // No error on blur (D-033): it appears on submit, in the summary and at the field.
    expect(textbox(/^Floor/)).not.toHaveAttribute("aria-invalid");
    await user.click(submit());
    const message = "Floor 7 is above the building's 5 floors. Lower the floor or raise total floors.";
    expect(within(await screen.findByRole("region", { name: /Fix 5 fields/ })).getByRole("link", { name: message })).toBeInTheDocument();
    expect(document.getElementById("analyze-floor-error")).toHaveTextContent(message);
    expect(textbox(/^Floor/)).toHaveAttribute("aria-invalid", "true");

    // After a submit, errors follow the input: raising total floors clears it.
    await user.clear(textbox(/^Total floors/));
    await user.type(textbox(/^Total floors/), "8");
    await waitFor(() => expect(textbox(/^Floor/)).not.toHaveAttribute("aria-invalid"));
  });

  it("no error appears on blur before the first submit", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(textbox(/^Living area/), "5");
    await user.tab();
    expect(textbox(/^Living area/)).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText(/Living area must be between/)).toBeNull();
  });

  it("a valid submit prepares the request and shows the not-connected result, never a figure (B5)", async () => {
    const user = userEvent.setup();
    renderForm();
    await fillRequired(user);
    await user.selectOptions(ortsteilSelect(), "Moabit");
    await user.click(submit());

    const heading = await screen.findByRole("heading", { name: "Prediction engine not connected" });
    expect(heading).toHaveFocus();
    const result = screen.getByRole("region", { name: "Prediction engine not connected" });
    expect(result.textContent).not.toMatch(/€|EUR/);
    const code = result.querySelector("code")?.textContent ?? "";
    expect(JSON.parse(code)).toMatchObject({
      bezirk: "Mitte",
      ortsteil: "Moabit",
      ortsteil_code: "0102",
      property_type: "apartment",
      area_m2: 65,
      rooms: 2.5,
      has_lift: null,
      lat: null,
    });
    expect(screen.getByText("Analysis prepared.")).toBeInTheDocument();

    // Editing afterwards marks the result as out of date.
    await user.type(textbox(/^Living area/), "0");
    expect(result).toHaveTextContent("You changed the form after preparing this.");
  });

  it("keeps a session draft and restores it on the next visit (B6)", async () => {
    const user = userEvent.setup();
    const first = renderForm();
    await user.type(textbox(/^Living area/), "72");
    await waitFor(() => expect(JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) ?? "{}").values?.area).toBe("72"));
    first.unmount();

    renderForm();
    // Shown as a notice and also announced in the live region.
    expect(await screen.findAllByText("Restored your entries from earlier in this session.")).toHaveLength(2);
    expect(document.querySelector("[aria-live]")).toHaveTextContent("Restored your entries");
    expect(textbox(/^Living area/)).toHaveValue("72");
  });

  it("drops an unreadable draft and says so", async () => {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, values: { area: 65 } }));
    renderForm();
    expect(await screen.findByText(/A saved draft couldn.t be read, so it was removed/)).toBeInTheDocument();
    expect(window.sessionStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("applies the homepage link once: valid values in, invalid ones reported, URL cleaned (Flow 1)", async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ version: 1, values: { ...EMPTY_PROPERTY_FORM, bezirk: codeOf("pankow"), area: "40" } }),
    );
    window.history.replaceState(null, "", "/analyze?bezirk=mitte&area=abc&rooms=2");
    renderForm();

    expect(await screen.findByText("Filled in from the link: Bezirk, rooms.")).toBeInTheDocument();
    expect(screen.getByText("Left empty because the link’s value wasn’t valid: living area.")).toBeInTheDocument();
    expect(bezirkSelect()).toHaveValue(codeOf("mitte"));
    expect(textbox(/^Living area/)).toHaveValue("");
    expect(textbox(/^Rooms/)).toHaveValue("2");
    expect(window.location.search).toBe("");
    // Focus goes to the first required field still empty: the property type.
    expect(screen.getByRole("radio", { name: "Apartment" })).toHaveFocus();

    // The earlier draft is one click away.
    await user.click(screen.getByRole("button", { name: "Bring back your earlier entries" }));
    expect(bezirkSelect()).toHaveValue(codeOf("pankow"));
    expect(textbox(/^Living area/)).toHaveValue("40");
  });

  it("Start over asks first, then clears the form and the draft", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(textbox(/^Living area/), "65");

    await user.click(screen.getAllByRole("button", { name: "Start over" })[0]!);
    const dialog = screen.getByRole("dialog", { name: "Start over?" });
    await user.click(within(dialog).getByRole("button", { name: "Keep my entries" }));
    expect(textbox(/^Living area/)).toHaveValue("65");

    await user.click(screen.getAllByRole("button", { name: "Start over" })[0]!);
    await user.click(within(screen.getByRole("dialog", { name: "Start over?" })).getByRole("button", { name: "Clear the form" }));
    expect(textbox(/^Living area/)).toHaveValue("");
    await waitFor(() => expect(window.sessionStorage.getItem(DRAFT_KEY)).toBeNull());
  });
});
