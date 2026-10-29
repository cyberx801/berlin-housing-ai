import {
  formatAreaM2,
  formatEUR,
  formatEURPerM2,
  formatFloor,
  formatKm2,
  formatPercent,
  formatRooms,
} from "@/lib/formatting/number";

const NNBSP = " ";

describe("number formatting (en-GB)", () => {
  it("formats euros with the symbol first and comma grouping", () => {
    expect(formatEUR(1150)).toBe("€1,150");
    expect(formatEURPerM2(17.6923)).toBe(`€17.69${NNBSP}/m²`);
  });

  it("keeps units attached with a narrow no-break space", () => {
    expect(formatAreaM2(65)).toBe(`65${NNBSP}m²`);
    expect(formatAreaM2(65.55)).toBe(`65.6${NNBSP}m²`);
    expect(formatKm2(7.7)).toBe(`7.7${NNBSP}km²`);
    expect(formatPercent(0.834)).toBe(`83${NNBSP}%`);
  });

  it("writes half rooms and singular correctly", () => {
    expect(formatRooms(1)).toBe("1 room");
    expect(formatRooms(2.5)).toBe("2.5 rooms");
  });

  it("names Berlin floor conventions", () => {
    expect(formatFloor(0)).toBe("Ground floor");
    expect(formatFloor(-1)).toBe("Souterrain");
    expect(formatFloor(3, 5)).toBe("Floor 3 of 5");
    expect(formatFloor(3, null)).toBe("Floor 3");
  });
});
