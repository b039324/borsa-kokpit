import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LineChart } from "./LineChart";

describe("LineChart", () => {
  it("her seri için bir çizgi ve değer sayısı kadar nokta çizer", () => {
    render(
      <LineChart
        label="deneme"
        series={[
          { name: "a", values: [100, 110, 120], className: "s1" },
          { name: "b", values: [100, 90, 95], className: "s2" },
        ]}
      />,
    );
    expect(screen.getByRole("img", { name: "deneme" })).toBeInTheDocument();
    expect(screen.getByTestId("lc-s1").getAttribute("points")!.split(" ")).toHaveLength(3);
    expect(screen.getByTestId("lc-s2")).toBeInTheDocument();
  });

  it("en yüksek değer üstte (küçük y), en düşük altta çizilir; ortak ölçek kullanılır", () => {
    render(<LineChart label="x" series={[{ name: "a", values: [0, 10], className: "s1" }]} />);
    const [p0, p1] = screen.getByTestId("lc-s1").getAttribute("points")!.split(" ");
    expect(Number(p1.split(",")[1])).toBeLessThan(Number(p0.split(",")[1]));
  });

  it("taban çizgisi isteğe bağlıdır", () => {
    const { container, rerender } = render(<LineChart label="x" series={[{ name: "a", values: [95, 105], className: "s1" }]} />);
    expect(container.querySelector(".lc-base")).toBeNull();
    rerender(<LineChart label="x" baseline={100} series={[{ name: "a", values: [95, 105], className: "s1" }]} />);
    expect(container.querySelector(".lc-base")).not.toBeNull();
  });

  it("2'den az noktalı seri çizilmez; hiç seri yoksa hiçbir şey çizmez", () => {
    const { container } = render(<LineChart label="x" series={[{ name: "a", values: [1], className: "s1" }]} />);
    expect(container.querySelector("svg")).toBeNull();
  });
});
