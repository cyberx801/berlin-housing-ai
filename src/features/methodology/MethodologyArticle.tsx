import Link from "next/link";
import type { ReactNode } from "react";
import { ProvenanceLabel } from "@/components/provenance/ProvenanceLabel";
import { formatIsoDate } from "@/lib/formatting/date";
import { formatAreaM2, formatKm2, formatPercent } from "@/lib/formatting/number";
import { RING_INSIDE_MIN, RING_OUTSIDE_MAX } from "@/lib/geo/ring";
import { RING_STATUS_SHORT } from "@/lib/property/labels";
import type { Provenance } from "@/types/provenance";
import type { DatasetEntry } from "@/types/registry";
import { DatasetRegistry } from "./DatasetRegistry";
import { sectionTitle, type MethodologyId } from "./sections";
import { TruthTable } from "./TruthTable";

export interface MethodologyFacts {
  provenance: Provenance;
  /** ISO date the official files were downloaded. */
  retrieved: string;
  bezirkCount: number;
  ortsteilCount: number;
  ringCounts: Record<"inside" | "partly" | "outside", number>;
  /** An Ortsteil to show how the official key reads. */
  keyExample: { name: string; code: string; bezirkName: string; bezirkCode: string };
  /** The Ortsteil whose own area field is furthest off, with its computed area. */
  areaExample: { name: string; areaKm2: number; ownFieldM2: number };
  simplify: { plate: string; map: string };
  registry: readonly DatasetEntry[];
}

const linkClass = "underline decoration-line-strong underline-offset-4 hover:decoration-ink";
const listClass = "type-prose flex flex-col gap-2 pl-6";

export function MethodologyArticle({ facts }: { facts: MethodologyFacts }) {
  const { keyExample: key, ringCounts } = facts;
  const retrieved = formatIsoDate(facts.retrieved);

  return (
    <article aria-label="Methodology" className="flex min-w-0 flex-col gap-16">
      <Section id="what-works">
        <p className="type-prose">
          What exists in this phase, and what backs it. This page has a section for each row, in the same order, and
          the marks are the ones the site&rsquo;s figures carry.
        </p>
        <div className="max-w-[60rem]">
          <TruthTable retrieved={retrieved} />
        </div>
      </Section>

      <Section id="geodata">
        <ProvenanceLabel provenance={facts.provenance} />
        <p className="type-prose">
          The geographic facts come from three official datasets that Geoportal Berlin publishes: the {facts.bezirkCount}{" "}
          Bezirke and {facts.ortsteilCount} Ortsteile from the ALKIS cadastre, and the Umweltzone. They were downloaded
          on {retrieved}. A build script reads the downloaded files, computes the facts below from them, and stops if a
          check fails. The files and their checksums are listed under{" "}
          <a href="#sources" className={linkClass}>
            Data sources and licenses
          </a>
          .
        </p>
        <p className="type-prose">
          Each Ortsteil belongs to the Bezirk named in its official 12-digit key. Digits 7 and 8 are the Bezirk number
          and the last four are the Ortsteil number: {key.name} is {key.code}, in Bezirk {key.bezirkCode},{" "}
          {key.bezirkName}. The build checks this against the boundaries, too: a point inside each Ortsteil must lie
          inside that Bezirk.
        </p>

        <Subsection id="areas">
          <p className="type-prose">
            Areas are measured on the earth&rsquo;s surface from the full-detail boundaries and rounded to 0.01 km². The
            Ortsteil dataset has an area field of its own, but for some Ortsteile made of several parts it doesn&rsquo;t
            match the boundaries: for {facts.areaExample.name} it says {formatAreaM2(facts.areaExample.ownFieldM2)}, while the boundary encloses{" "}
            {formatKm2(facts.areaExample.areaKm2)}. So the site ignores that field.
          </p>
        </Subsection>

        <Subsection id="ring">
          <p className="type-prose">
            The ring is not drawn from the railway. The site uses the Umweltzone, the low-emission zone that Berlin
            defines as the area within the S-Bahn ring, and measures how much of each Ortsteil&rsquo;s area lies inside
            it:
          </p>
          <ul className={`${listClass} list-disc`}>
            <li>
              <strong className="font-[600]">Inside</strong>: at least {formatPercent(RING_INSIDE_MIN)} of the area.
            </li>
            <li>
              <strong className="font-[600]">Outside</strong>: at most {formatPercent(RING_OUTSIDE_MAX)}.
            </li>
            <li>
              <strong className="font-[600]">Partly inside</strong>: anything between.
            </li>
          </ul>
          <p className="type-prose">
            The margins absorb the thin slivers left where two separately drawn boundaries don&rsquo;t quite meet. Each
            profile shows the share itself next to the status.
          </p>
          <dl className="grid max-w-[24rem] grid-cols-[minmax(0,1fr)_auto] gap-x-6 border-t border-ink type-body">
            {(["inside", "partly", "outside"] as const).map((status) => (
              <div key={status} className="col-span-2 grid grid-cols-subgrid border-b border-rule py-2">
                <dt>{RING_STATUS_SHORT[status]}</dt>
                <dd className="text-right tabular">
                  {ringCounts[status]} Ortsteile
                </dd>
              </div>
            ))}
          </dl>
        </Subsection>

        <Subsection id="adjacency">
          <p className="type-prose">
            Two Ortsteile are neighbors when they share a stretch of boundary in the full-detail geometry. Touching at a
            single point doesn&rsquo;t count. Neighbors can be in different Bezirke. The build checks that every
            Ortsteil has at least one neighbor and that each pair is recorded both ways.
          </p>
        </Subsection>

        <Subsection id="drawing">
          <p className="type-prose">
            The maps draw simplified outlines so pages stay light. The drawn maps on the home page and the profiles keep{" "}
            {facts.simplify.plate} of the points that could be removed, and the interactive map on Explore keeps{" "}
            {facts.simplify.map}. A border shared by two
            Ortsteile is simplified once for both, so no gaps open between neighbors. Areas, ring shares and neighbors
            are always computed from the full-detail geometry, never from the drawing.
          </p>
        </Subsection>
      </Section>

      <Section id="market-data">
        <p className="type-prose">
          Every chart on{" "}
          <Link href="/market" className={linkClass}>
            Market
          </Link>{" "}
          uses demo data: values generated by a script so the charts could be built and tested before a real source is
          ready. <strong className="font-[600]">They are not Berlin market statistics.</strong> The level of each Bezirk
          is a random draw, so the charts follow no real ranking of the Bezirke.
        </p>
        <ul className={`${listClass} list-disc`}>
          <li>
            The script uses a fixed seed, so it makes the same values every time, and a test fails if the stored values
            and the script disagree.
          </li>
          <li>
            The trend lines rise because the script adds a fixed upward drift, chosen so the lines have a slope to read.
            The rise is not an observation about Berlin.
          </li>
          <li>
            Each chart carries the hatched demo band, and the words &ldquo;Demo data&rdquo; are drawn inside the chart
            too, so a screenshot keeps the label.
          </li>
          <li>Demo values never appear in page titles, on the home page or in neighborhood facts.</li>
        </ul>
        <p className="type-prose">
          When a validated source is connected, it replaces the demo data in one place, and the labels change with it.
        </p>

        <Subsection id="market-vs-predictions">
          <p className="type-prose">
            Market figures and predictions answer different questions. A market figure summarizes many listings, for
            example the median €/m² in a Bezirk over a year. A prediction would estimate the cold rent of the one flat
            you describe, from a model trained on past listings. Neither exists here as real data yet: the market
            figures are demo data, and the model isn&rsquo;t connected.
          </p>
        </Subsection>
      </Section>

      <Section id="research-data">
        <p className="type-prose">
          A Kaggle dataset of five CSV files is planned as research data: rentals, secondary sales, new construction,
          monthly prices by Kiez, and transit stations. It isn&rsquo;t in the project yet, and its web address, author
          and license are unknown. Before any page uses it, it has to pass these checks:
        </p>
        <ol className={`${listClass} list-decimal`}>
          <li>Where it comes from: the author, the license, the version, and the original source it names.</li>
          <li>What it contains: the columns, their types, how many values are missing, and the row counts.</li>
          <li>
            Whether its files can be joined, and whether its place names match the {facts.ortsteilCount} official
            Ortsteile. Names that don&rsquo;t match are reported, not guessed.
          </li>
          <li>
            Whether its figures are plausible against independent published references, how many years it covers, and
            whether listings repeat.
          </li>
          <li>Whether it looks synthetic: overly smooth distributions, repeated patterns or impossible combinations.</li>
        </ol>
        <p className="type-prose">
          The result is one of three: it becomes research data with its caveats written down, it may be used only as
          demo data under the demo label, or it is rejected.
        </p>
      </Section>

      <Section id="in-development">
        <p className="type-prose">
          Two things the site is built for aren&rsquo;t connected yet: the rent model and transit access. Wherever they
          would appear, a dashed &ldquo;Not connected&rdquo; frame says what is missing. Nothing fills the space in the
          meantime.
        </p>

        <Subsection id="predictions">
          <p className="type-prose">
            A separate team is building a model to estimate the monthly cold rent (Nettokaltmiete) of a flat from its
            description. The site has a draft contract for it: the fields Analyze would send and the answer it expects.
            The contract hasn&rsquo;t been agreed yet and prediction is switched off, so Analyze ends at &ldquo;Prediction
            engine not connected&rdquo;.
          </p>
          <p className="type-prose">
            Until a real model answers, no estimate, fair price or rent-like number appears anywhere, and the site
            doesn&rsquo;t work one out in any other way: there is no formula behind the scenes. The &ldquo;AI&rdquo; in
            the name refers to that model. Nothing on the site uses one today.
          </p>
          <p className="type-prose">
            The draft contract asks the model to return, with each estimate, the model&rsquo;s version, the date its data
            reaches, what it had to assume for fields you left out, and warnings such as &ldquo;few examples for this
            Ortsteil&rdquo;. The site will show all of them with the estimate.
          </p>
        </Subsection>

        <Subsection id="uncertainty">
          <p className="type-prose">
            Even a good model can&rsquo;t name the one right rent for a flat. Similar flats are listed at different rents.
            The model sees only the fields you give it, not the light, the noise or the landlord. Fields you leave out
            have to be assumed. And its data ends at a date, while rents move on.
          </p>
          <p className="type-prose">
            So an estimate will be shown together with a range: the span the model expects the rent to fall in, at a
            stated level. If the model has no calibrated range, the page will say &ldquo;No uncertainty range
            available&rdquo; rather than make one up. Which method gives the range, and at what level, is still an open
            question for the model team.
          </p>
        </Subsection>

        <Subsection id="transit">
          <p className="type-prose">
            The site doesn&rsquo;t yet say how well an Ortsteil is served by U-Bahn, S-Bahn, tram or bus. The candidate
            sources are VBB timetable data (GTFS), from which distances could be computed, and the research
            dataset&rsquo;s station list once it passes intake. Neither has been checked for license, attribution or
            how often it is updated. On Analyze you can enter your own walking time to the nearest station; it stays one
            of your entries.
          </p>
        </Subsection>
      </Section>

      <Section id="your-data">
        <p className="type-prose">
          What you type into Analyze and Compare is marked &ldquo;From your entries&rdquo;. It is your own claim about a
          flat, shown back to you, and it stays in your browser:
        </p>
        <ul className={`${listClass} list-disc`}>
          <li>
            Analyze keeps your form in this tab&rsquo;s session storage, so a reload doesn&rsquo;t lose it. Closing the
            tab, or Start over, clears it.
          </li>
          <li>
            Compare keeps up to three properties in this browser&rsquo;s local storage until you remove them or clear
            your browser data. If a saved comparison can&rsquo;t be read, for example after an update, it is removed and
            the page says so.
          </li>
          <li>
            The €/m² on Compare is your asking cold rent divided by the living area you entered. It is arithmetic on your
            numbers, not a market figure.
          </li>
        </ul>
        <p className="type-prose">
          Nothing you enter on Analyze or Compare is sent anywhere. The rent model isn&rsquo;t connected, so Analyze
          ends by showing the request it would send instead of sending it. The short form on the home page is the
          exception: it opens Analyze with its three values (Bezirk, living area and rooms) in the page address, and
          that address reaches this site&rsquo;s server like any page request. There are no accounts, no cookies and
          no tracking.
        </p>
      </Section>

      <Section id="neighborhood-content">
        <p className="type-prose">
          A profile shows the computed facts above and nothing else. A description of what a neighborhood is like will
          appear only when each statement can be linked to a source. Until then the profile says &ldquo;Not written
          yet&rdquo;. There are no ratings, scores, safety indices or rankings of neighborhoods, and none will be added
          without a documented source.
        </p>
      </Section>

      <Section id="limitations">
        <ul className={`${listClass} list-disc`}>
          <li>The facts are geography only. They say nothing about rents, prices or what a place is like to live in.</li>
          <li>The ring is the Umweltzone&rsquo;s area, not the railway track.</li>
          <li>
            Areas are rounded to 0.01 km², and ring shares to whole percent, with one decimal where rounding would cross
            a threshold.
          </li>
          <li>The boundaries are as downloaded on {retrieved}. Later changes appear only after a new download.</li>
          <li>An address you type is kept as text. It isn&rsquo;t looked up or placed on the map.</li>
          <li>The site is in English. Places keep their official German names.</li>
          <li>
            Your entries live in one browser. They don&rsquo;t follow you to another device and are gone if you clear
            your browser data.
          </li>
          <li>Market figures are demo data, and the rent model, transit access and the research dataset aren&rsquo;t connected.</li>
        </ul>
      </Section>

      <Section id="sources">
        <p className="type-prose">
          The datasets the site reads, and the one it generates. The official files were downloaded from Geoportal
          Berlin&rsquo;s web feature services. A checksum identifies the exact file the build read, so a changed
          download can&rsquo;t slip in unnoticed.
        </p>
        <DatasetRegistry entries={facts.registry} />
      </Section>
    </article>
  );
}

function Section({ id, children }: { id: MethodologyId; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`methodology-${id}-title`} className="flex flex-col gap-5">
      <h2 id={`methodology-${id}-title`} className="type-title-2 stretch-wide">
        {sectionTitle(id)}
      </h2>
      {children}
    </section>
  );
}

function Subsection({ id, children }: { id: MethodologyId; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`methodology-${id}-title`} className="mt-4 flex flex-col gap-4">
      <h3 id={`methodology-${id}-title`} className="type-title-3">
        {sectionTitle(id)}
      </h3>
      {children}
    </section>
  );
}
