import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResultPanel } from "@/features/property-analysis/ResultPanel";
import { getCompareSnapshot, resetCompareCacheForTests } from "@/features/property-comparison/store";
import { interpretPredictionResponse } from "@/lib/api/prediction/interpret";
import type { RentEstimateOutcome } from "@/lib/api/prediction/types";
import { rentPredictionRequestV1 } from "@/lib/contracts/rent-prediction.v1";
import type { PropertyInput } from "@/lib/validation/property";

// The `ok` view is only ever rendered here, from the contract fixtures read off disk.
// src/ never imports them (boundary rule), so the app cannot show a fixture as an estimate.
const fixture = (name: string) => readFileSync(path.join(process.cwd(), "tests/contracts/fixtures", name), "utf8");
const outcomeFrom = (status: number, name: string) => interpretPredictionResponse(status, fixture(name), "req-1");

const payload = rentPredictionRequestV1.parse(JSON.parse(fixture("rent.v1.request.json")));
const input: PropertyInput = {
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
};
const place = { bezirkName: "Mitte", bezirkSlug: "mitte", ortsteilName: "Moabit", ortsteilSlug: "moabit" };

function renderPanel(outcome: RentEstimateOutcome, props: { stale?: boolean; onRetry?: () => void } = {}) {
  render(<ResultPanel id="t-result" outcome={outcome} input={input} payload={payload} place={place} {...props} />);
  return screen.getByRole("region");
}

beforeEach(() => resetCompareCacheForTests());

describe("ResultPanel", () => {
  it("not connected: says so, focuses the heading, shows the exact payload and no money figure", () => {
    const panel = renderPanel({ status: "not_connected", reason: "disabled", requestId: "r" });
    const heading = within(panel).getByRole("heading", { level: 2, name: "Prediction engine not connected" });
    expect(heading).toHaveFocus();
    expect(panel).toHaveTextContent("Nothing was sent anywhere.");
    expect(panel).toHaveTextContent("Not connected");
    expect(panel.textContent).not.toMatch(/€|EUR/);
    expect(within(panel).getByText("Show the request the model will receive (JSON)")).toBeInTheDocument();
    expect(panel.querySelector("code")?.textContent).toBe(JSON.stringify(payload, null, 2));
    expect(within(panel).getByRole("link", { name: "Open the Moabit profile" })).toHaveAttribute(
      "href",
      "/neighborhoods/moabit",
    );
  });

  it("not connected because the server has no model configured says the request reached the server", () => {
    const panel = renderPanel({ status: "not_connected", reason: "not_configured", requestId: "r" });
    expect(panel).toHaveTextContent("no rent model is configured behind it yet");
    expect(panel).not.toHaveTextContent("Nothing was sent anywhere.");
  });

  it("not connected because the model did not say what it was trained on shows no figure", () => {
    const outcome = outcomeFrom(200, "rent.v1.ok-no-flag.json");
    const panel = renderPanel(outcome);
    expect(panel).toHaveTextContent("did not say what data it was trained on");
    expect(panel.textContent).not.toMatch(/€|EUR/);
  });

  it("ok, synthetic: the estimate sits under the demo band with the fixed words", () => {
    const panel = renderPanel(outcomeFrom(200, "rent.v1.ok.json"));
    expect(panel).toHaveTextContent("Demo model");
    expect(panel).toHaveTextContent("Demo model, trained on synthetic data. Not a Berlin market estimate.");
    expect(panel).not.toHaveTextContent("Model estimate");
    expect(panel.querySelector(".band-hatch")).not.toBeNull();
  });

  it("ok, observed: no demo wording and the solid band", () => {
    const panel = renderPanel(outcomeFrom(200, "rent.v1.ok-observed.json"));
    expect(within(panel).getByRole("heading", { name: "Estimated cold rent" })).toHaveFocus();
    expect(panel).toHaveTextContent("Model estimate");
    expect(panel).not.toHaveTextContent("synthetic");
    expect(panel.querySelector(".band-hatch")).toBeNull();
  });

  it("ok, synthetic: lists the ignored fields and what moved the estimate", () => {
    const panel = renderPanel(outcomeFrom(200, "rent.v1.ok.json"));
    expect(panel).toHaveTextContent("Sent, but this model does not use them: Property type.");
    expect(within(panel).getByText("What moved the estimate")).toBeInTheDocument();
    expect(panel).toHaveTextContent("Location (Ortsteil)+11.1 %");
    expect(panel).toHaveTextContent("Market period+2.2 %");
    expect(panel).toHaveTextContent("Rooms−0.1 %");
  });

  it("ok: the model's estimate, rounded to €10, with a widened range and the model's provenance", () => {
    const outcome = outcomeFrom(200, "rent.v1.ok.json");
    expect(outcome.status).toBe("ok");
    const panel = renderPanel(outcome);
    expect(within(panel).getByRole("heading", { name: "Demo estimate of the cold rent" })).toHaveFocus();
    expect(panel).toHaveTextContent("Demo model");
    expect(panel).toHaveTextContent("€1,230");
    expect(panel).toHaveTextContent("€1,110 to €1,340"); // 1,111.11 down, 1,333.33 up
    // toHaveTextContent folds the narrow no-break space (U+202F) into a plain space.
    expect(panel).toHaveTextContent("Range at the 80 % level");
    expect(panel).toHaveTextContent("€12.34 /m² of living area");
    expect(panel).toHaveTextContent("rent-model 0.0.0-example");
    expect(panel).toHaveTextContent("Reflects data up to31 December 2000");
    expect(panel).toHaveTextContent("example-source (synthetic), January 2000 to December 2000");
    expect(panel).toHaveTextContent("Not given, so the model filled them in: Building era, Energy class.");
    expect(panel).toHaveTextContent("Few training examples for this Ortsteil.");
    expect(within(panel).getByText("Show the request that was sent (JSON)")).toBeInTheDocument();
  });

  it("ok without an interval says there is no range instead of inventing one", () => {
    const panel = renderPanel(outcomeFrom(200, "rent.v1.ok-no-interval.json"));
    expect(panel).toHaveTextContent("No uncertainty range available.");
    expect(panel).not.toHaveTextContent("Range at the");
    expect(panel).not.toHaveTextContent("/m²");
  });

  it("rejected: explains that the flat is outside the model's support", () => {
    const panel = renderPanel(outcomeFrom(422, "rent.v1.error-out-of-support.json"));
    expect(within(panel).getByRole("heading", { name: "This flat is outside what the model covers" })).toHaveFocus();
    expect(panel).toHaveTextContent("The model has too few examples for this kind of property.");
    expect(panel.textContent).not.toMatch(/€/);
  });

  it("unavailable and retryable: offers to try again", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const panel = renderPanel(outcomeFrom(503, "rent.v1.error-unavailable.json"), { onRetry });
    expect(within(panel).getByRole("heading", { name: "No estimate right now" })).toBeInTheDocument();
    expect(panel).toHaveTextContent("Model is reloading.");
    expect(panel).toHaveTextContent("Reference req-1, code MODEL_UNAVAILABLE");
    await user.click(within(panel).getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("unavailable and not retryable (a malformed answer): no retry, nothing half-parsed", () => {
    const panel = renderPanel(outcomeFrom(200, "rent.v1.malformed.json"), { onRetry: vi.fn() });
    expect(panel).toHaveTextContent("answered in an unexpected format");
    expect(within(panel).queryByRole("button", { name: "Try again" })).toBeNull();
    expect(panel.textContent).not.toMatch(/€/);
  });

  it("invalid input: lists the model's complaints in form terms and offers no comparison", () => {
    const panel = renderPanel(outcomeFrom(422, "rent.v1.error-validation.json"));
    expect(panel).toHaveTextContent("Living area: must be >= 10");
    expect(within(panel).queryByRole("button", { name: "Add to comparison" })).toBeNull();
  });

  it("Add to comparison stores the description and confirms with the fixed wording", async () => {
    const user = userEvent.setup();
    const panel = renderPanel({ status: "not_connected", reason: "disabled", requestId: "r" });
    await user.click(within(panel).getByRole("button", { name: "Add to comparison" }));

    const added = within(panel).getByRole("button", { name: "Added to comparison" });
    expect(added).toHaveAttribute("aria-disabled", "true");
    expect(within(panel).getByRole("status")).toHaveTextContent("Saved in this browser, 1 of 3 places used.");
    const { items } = getCompareSnapshot();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ property: input, askingColdRent: null, source: "analysis" });
    expect(items[0]?.label).toMatch(/^Moabit, 65 m²$/);

    await user.click(added); // a second click adds nothing
    expect(getCompareSnapshot().items).toHaveLength(1);
  });

  it("marks a result that no longer matches the form", () => {
    const panel = renderPanel({ status: "not_connected", reason: "disabled", requestId: "r" }, { stale: true });
    expect(panel).toHaveTextContent("You changed the form after preparing this.");
  });
});
