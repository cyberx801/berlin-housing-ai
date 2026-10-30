import Link from "next/link";
import { rentModelConnected } from "@/lib/api/prediction/connected";
import { ProvenanceMark } from "@/components/provenance/ProvenanceMark";
import type { ProvenanceKind } from "@/types/provenance";

interface ToolRow {
  href: string;
  name: string;
  question: string;
  state: { kind: ProvenanceKind; label: string };
}

// PRD A4: each tool, the question it answers, and what backs it today.
const TOOLS: ToolRow[] = [
  {
    href: "/analyze",
    name: "Analyze",
    question: rentModelConnected
      ? "Describe a flat and see what the demo rent model says."
      : "Describe a flat and prepare it for the rent model.",
    state: rentModelConnected
      ? { kind: "demo", label: "Demo model, synthetic data" }
      : { kind: "not-connected", label: "Rent model not connected" },
  },
  {
    href: "/explore",
    name: "Explore",
    question: "Find an Ortsteil, what borders it, and where the ring runs.",
    state: { kind: "official", label: "Official data" },
  },
  {
    href: "/market",
    name: "Market",
    question: "How do districts and periods compare?",
    state: { kind: "demo", label: "Demo data" },
  },
  {
    href: "/neighborhoods",
    name: "Neighborhoods",
    question: "What do we know about each of the 97 Ortsteile?",
    state: { kind: "official", label: "Official data" },
  },
  {
    href: "/compare",
    name: "Compare",
    question: "How do up to three listings line up side by side?",
    state: { kind: "user", label: "From your entries" },
  },
];

export function ToolsLedger() {
  return (
    <ul className="border-t border-ink">
      {TOOLS.map((tool) => (
        <li
          key={tool.href}
          className="grid grid-cols-1 gap-x-6 gap-y-1 border-b border-rule py-4 md:grid-cols-[10rem_minmax(0,1fr)_14rem] md:items-baseline"
        >
          <Link href={tool.href} className="type-title-3 stretch-wide font-[680] underline-offset-4">
            {tool.name}
          </Link>
          <p className="type-body text-ink">{tool.question}</p>
          <p className="flex items-center gap-2 type-small text-ink-2">
            <ProvenanceMark kind={tool.state.kind} />
            {tool.state.label}
          </p>
        </li>
      ))}
    </ul>
  );
}
