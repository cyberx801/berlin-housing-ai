import type { Metadata } from "next";
import { PropertyAnalysisForm } from "@/features/property-analysis/PropertyAnalysisForm";
import { rentModelConnected } from "@/lib/api/prediction/connected";
import { getBezirkOptions, getOrtsteilOptions } from "@/lib/data/geo";

export const metadata: Metadata = {
  title: "Analyze a flat",
  description: rentModelConnected
    ? "Describe a Berlin flat and try the demo rent model. It is trained on synthetic data, so its answer is not a Berlin market estimate."
    : "Describe a Berlin flat and see the exact request a rent model would receive. The model is not connected yet, so no estimate is shown.",
};

export default function AnalyzePage() {
  return (
    <>
      <div className="page-grid pt-10 pb-8 md:pt-14">
        <div className="col-span-full flex flex-col gap-4">
          <h1 className="type-display-2">Describe the flat</h1>
          <p className="type-prose text-ink-2">
            Four details are required: the Bezirk, the property type, the living area and the number of rooms.
            Everything else can stay &ldquo;Not sure&rdquo;.{" "}
            {rentModelConnected
              ? "Preparing the analysis sends your description to a demo model. It was trained on synthetic data, so the answer shows how the tool works and says nothing about real Berlin rents."
              : "Preparing the analysis checks your description and shows the exact request a rent model would receive. The model is still being built, so no estimate is shown yet."}
          </p>
        </div>
      </div>
      <PropertyAnalysisForm bezirke={getBezirkOptions()} ortsteile={getOrtsteilOptions()} />
    </>
  );
}
