import { render, screen } from "@testing-library/react";
import { CensusRentModule } from "@/features/neighborhoods/ProfileSections";
import type { ExplorePlace } from "@/types/geo";
import type { Provenance } from "@/types/provenance";

const provenance: Provenance = {
  kind: "official",
  sourceId: "zensus-2022-rent-grid",
  label: "Zensus 2022 (Statistische Ämter des Bundes und der Länder)",
  license: "dl-de/by-2.0",
  retrieved: "2026-10-30",
};
const place = { name: "Marzahn", code: "1001" } as ExplorePlace;
const common = { idPrefix: "p", place, provenance, berlinMeanRentPerM2: 7.66, minDwellings: 100, referenceYear: "2022" };

describe("CensusRentModule", () => {
  it("shows the figure under the official band with what it is and is not", () => {
    render(<CensusRentModule {...common} rent={{ meanRentPerM2: 5.94, dwellings: 55811, flaggedShare: 0 }} />);
    const region = screen.getByRole("region", { name: "What did tenants in Marzahn pay in 2022?" });
    expect(region).toHaveTextContent("€5.94");
    expect(region).toHaveTextContent("55,811 rented flats");
    expect(region).toHaveTextContent("All of Berlin: €7.66");
    expect(region).toHaveTextContent("not asking rents");
    expect(region).toHaveTextContent("Official data");
    expect(region).not.toHaveTextContent("uncertain");
  });

  it("says how much of it rests on statistically uncertain cells", () => {
    render(<CensusRentModule {...common} rent={{ meanRentPerM2: 6.5, dwellings: 400, flaggedShare: 0.25 }} />);
    expect(screen.getByRole("region")).toHaveTextContent(/25\s% of these flats lie in cells that the statistical offices mark as statistically uncertain/);
  });

  it("shows no figure when too few flats stand behind it", () => {
    render(<CensusRentModule {...common} rent={{ meanRentPerM2: null, dwellings: 9, flaggedShare: 0 }} />);
    const region = screen.getByRole("region");
    expect(region).toHaveTextContent("Fewer than 100 rented flats");
    expect(region).not.toHaveTextContent("€");
  });
});
