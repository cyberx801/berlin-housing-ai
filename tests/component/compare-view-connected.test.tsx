import { render, screen } from "@testing-library/react";
import { CompareView } from "@/features/property-comparison/CompareView";
import { addCompareItem, resetCompareCacheForTests } from "@/features/property-comparison/store";
import { getBezirkOptions, getOrtsteilOptions } from "@/lib/data/geo";

// A build with the demo model (embedded mode) must not call it "still being built" on Compare.
vi.mock("@/lib/api/prediction/connected", () => ({ rentModelConnected: true }));

describe("Compare in a build with the demo rent model", () => {
  beforeEach(() => {
    resetCompareCacheForTests();
  });

  it("says Compare does not run the model, in the legend and in the table", () => {
    addCompareItem({
      label: "Moabit, 65 m²",
      property: {
        bezirkCode: "01", ortsteilCode: "0102", address: null, propertyType: "apartment", areaM2: 65, rooms: 2.5,
        floor: 2, totalFloors: 5, buildingEra: "unknown", energyClass: "unknown", condition: "unknown", hasLift: null,
        hasBalcony: true, furnishing: "unfurnished", transitMinutes: null,
      },
      askingColdRent: null,
      listingUrl: null,
      source: "analysis",
    });
    render(<CompareView bezirke={getBezirkOptions()} ortsteile={getOrtsteilOptions()} />);
    expect(screen.getAllByText(/Not run on Compare|Not run here/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/still being built/)).toBeNull();
    expect(screen.queryByText("Model not connected")).toBeNull();
  });
});
