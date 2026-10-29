import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CHART_PATTERNS_ATTR, CHART_PATTERNS_KEY, chartPatternsScript } from "@/components/charts/chart-patterns";
import { ChartPatternsToggle } from "@/components/charts/ChartPatternsToggle";

const root = document.documentElement;

afterEach(() => {
  root.removeAttribute(CHART_PATTERNS_ATTR);
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("chart patterns setting", () => {
  it("turns patterns on and off at once and remembers the choice", async () => {
    const user = userEvent.setup();
    render(<ChartPatternsToggle id="patterns" />);
    const box = screen.getByRole("checkbox", { name: "Draw patterns in the charts" });
    expect(box).not.toBeChecked();
    expect(box).toHaveAccessibleDescription(/no series depends on color alone/);

    await user.click(box);
    expect(box).toBeChecked();
    expect(root.hasAttribute(CHART_PATTERNS_ATTR)).toBe(true);
    expect(localStorage.getItem(CHART_PATTERNS_KEY)).toBe("on");

    await user.click(box);
    expect(box).not.toBeChecked();
    expect(root.hasAttribute(CHART_PATTERNS_ATTR)).toBe(false);
    expect(localStorage.getItem(CHART_PATTERNS_KEY)).toBeNull();
  });

  it("shows a choice the head script already applied", () => {
    localStorage.setItem(CHART_PATTERNS_KEY, "on");
    new Function(chartPatternsScript)();
    expect(root.hasAttribute(CHART_PATTERNS_ATTR)).toBe(true);
    render(<ChartPatternsToggle id="patterns" />);
    expect(screen.getByRole("checkbox", { name: "Draw patterns in the charts" })).toBeChecked();
  });

  it("ignores any other stored value", () => {
    localStorage.setItem(CHART_PATTERNS_KEY, "true");
    new Function(chartPatternsScript)();
    expect(root.hasAttribute(CHART_PATTERNS_ATTR)).toBe(false);
  });

  it("still applies the choice when storage is blocked, and says it can't be kept", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const user = userEvent.setup();
    render(<ChartPatternsToggle id="patterns" />);
    const box = screen.getByRole("checkbox", { name: "Draw patterns in the charts" });
    await user.click(box);
    expect(box).toBeChecked();
    expect(root.hasAttribute(CHART_PATTERNS_ATTR)).toBe(true);
    expect(box).toHaveAccessibleDescription(/can’t be kept/);
  });
});
