import {
  acknowledgeCompareDiscard,
  addCompareItem,
  clearCompareItems,
  COMPARE_KEY,
  getCompareSnapshot,
  removeCompareItem,
  replaceCompareItem,
  resetCompareCacheForTests,
  subscribeCompare,
  type NewCompareItem,
} from "@/features/property-comparison/store";
import type { PropertyInput } from "@/lib/validation/property";

const property: PropertyInput = {
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

const item = (label: string): NewCompareItem => ({
  label,
  property,
  askingColdRent: null,
  listingUrl: null,
  source: "analysis",
});

beforeEach(() => {
  resetCompareCacheForTests();
});

describe("comparison store (bhai.compare.v1)", () => {
  it("adds up to three items and refuses a fourth", () => {
    expect(addCompareItem(item("A")).ok).toBe(true);
    expect(addCompareItem(item("B")).ok).toBe(true);
    expect(addCompareItem(item("C")).ok).toBe(true);
    expect(addCompareItem(item("D"))).toEqual({ ok: false, reason: "full" });
    expect(getCompareSnapshot().items.map((i) => i.label)).toEqual(["A", "B", "C"]);
  });

  it("persists across a reload (a fresh read from storage)", () => {
    addCompareItem(item("Moabit, 65 m²"));
    resetCompareCacheForTests();
    const { items, persisted } = getCompareSnapshot();
    expect(persisted).toBe(true);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ label: "Moabit, 65 m²", property, askingColdRent: null });
  });

  it("removes and clears", () => {
    const first = addCompareItem(item("A"));
    addCompareItem(item("B"));
    if (!first.ok) throw new Error("expected the first add to succeed");
    removeCompareItem(first.id);
    expect(getCompareSnapshot().items.map((i) => i.label)).toEqual(["B"]);
    clearCompareItems();
    expect(getCompareSnapshot().items).toEqual([]);
  });

  it("drops corrupt stored data, says so once, and starts empty", () => {
    window.localStorage.setItem(COMPARE_KEY, JSON.stringify({ version: 1, items: [{ label: "no property" }] }));
    expect(getCompareSnapshot()).toMatchObject({ items: [], discarded: true });
    expect(window.localStorage.getItem(COMPARE_KEY)).toBeNull();
    acknowledgeCompareDiscard();
    expect(getCompareSnapshot().discarded).toBe(false);
  });

  it("replaces in place, and reports an item that is gone instead of writing", () => {
    const first = addCompareItem(item("A"), new Date("2026-10-29T10:00:00Z"));
    addCompareItem(item("B"));
    if (!first.ok) throw new Error("expected the first add to succeed");
    expect(replaceCompareItem(first.id, { ...item("A2"), askingColdRent: 1150 })).toBe(true);
    expect(getCompareSnapshot().items[0]).toMatchObject({
      id: first.id,
      label: "A2",
      askingColdRent: 1150,
      addedAt: "2026-10-29T10:00:00.000Z",
    });
    const before = window.localStorage.getItem(COMPARE_KEY);
    expect(replaceCompareItem("removed-in-another-tab", item("C"))).toBe(false);
    expect(window.localStorage.getItem(COMPARE_KEY)).toBe(before);
  });

  it("rejects unsafe listing links", () => {
    expect(() => addCompareItem({ ...item("A"), listingUrl: "javascript:alert(1)" })).toThrow();
    expect(getCompareSnapshot().items).toEqual([]);
  });

  it("picks up changes made in another tab", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCompare(listener);
    expect(getCompareSnapshot().items).toEqual([]);

    // Another tab writes; this tab only hears the storage event.
    window.localStorage.setItem(
      COMPARE_KEY,
      JSON.stringify({ version: 1, items: [{ ...item("From tab 2"), id: "x", addedAt: "2026-10-29T00:00:00Z" }] }),
    );
    window.dispatchEvent(new StorageEvent("storage", { key: COMPARE_KEY }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getCompareSnapshot().items.map((i) => i.label)).toEqual(["From tab 2"]);
    unsubscribe();
  });
});
