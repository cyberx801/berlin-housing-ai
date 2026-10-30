import Link from "next/link";
import type { ReactNode } from "react";
import { ProvenanceLabel } from "@/components/provenance/ProvenanceLabel";
import { rentModelConnected } from "@/lib/api/prediction/connected";
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
  /** Zensus 2022 rent aggregate: the all-Berlin figure our weighted average gives. */
  census: { berlinMeanRentPerM2: number; berlinDwellings: number };
}

const linkClass = "underline decoration-line-strong underline-offset-4 hover:decoration-ink";
const listClass = "type-prose flex flex-col gap-2 pl-6";

export function MethodologyArticle({ facts }: { facts: MethodologyFacts }) {
  const { keyExample: key, ringCounts, census } = facts;
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

      <Section id="census-rent">
        <p className="type-prose">
          Each Ortsteil profile shows one real rent figure: the average net cold rent (Nettokaltmiete) per m² that
          tenants paid on 15 May 2022. It comes from the 2022 census (Zensus 2022), which the statistical offices of the
          federal government and the Länder publish for 100&nbsp;m grid cells. It is official data, licensed{" "}
          <span className="whitespace-nowrap">dl-de/by-2.0</span>, with the source line &ldquo;Ergebnisse des Zensus
          2022, Statistische Ämter des Bundes und der Länder&rdquo;.
        </p>
        <p className="type-prose">
          <strong className="font-[600]">What it is not.</strong> These are rents in contracts that already existed,
          including many signed years ago. They are not asking rents, so they are lower than what a flat costs to rent
          today and can&rsquo;t be compared with a listing on Compare or with anything on Analyze.
        </p>
        <p className="type-prose">
          <strong className="font-[600]">What we did to it.</strong> For every cell the census gives the average rent per
          m² and the number of rented flats. We put each cell in the Ortsteil that contains its centre point, then
          averaged the cells&rsquo; rents weighted by their number of flats. That is a change to the published data and
          is ours, not the statistical offices&rsquo;. A cell on a border belongs to one Ortsteil only, so figures near
          a boundary are approximate. The statistical offices perturb the values slightly to protect privacy and leave
          out cells without flats. They mark some cells as statistically uncertain; those flats are counted, and their
          share is shown where it isn&rsquo;t zero. An Ortsteil with fewer than 100 rented flats behind it shows no figure.
        </p>
        <p className="type-prose">
          <strong className="font-[600]">Does it agree with the official total?</strong> Our weighted average for all of
          Berlin is {census.berlinMeanRentPerM2.toFixed(2)}&nbsp;€/m² over {census.berlinDwellings.toLocaleString("en")}{" "}
          rented flats. The statistical offices publish 7.67&nbsp;€/m² for Berlin. The Ortsteile with the lowest averages
          are large 1970s and 1980s estates (Marzahn, Neu-Hohenschönhausen, Märkisches Viertel) and the highest are
          villa districts (Grunewald, Dahlem).
        </p>
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
            you describe, from a model trained on past listings. Neither is real Berlin data: the market
            figures are demo data, and the only model is a demo trained on synthetic data that this build
            isn&rsquo;t connected to.
          </p>
        </Subsection>
      </Section>

      <Section id="research-data">
        <p className="type-prose">
          A Kaggle dataset of five CSV files (rentals, secondary sales, new construction, monthly prices by Kiez, and
          transit stations; author Sergey Nefedov, Apache 2.0) went through the intake checks on 30 October 2026. It
          failed the one that matters, so it is <strong className="font-[600]">synthetic and demo only</strong>. Its
          author writes that the listing-level apartment characteristics are generated from a pricing model. Only the
          Ortsteil coordinates, the stations and the interest-rate timeline are real. The checks here agree: no missing
          values anywhere, almost no round-number rents, a market level that moves in half-year steps, and a
          station-distance field that rarely names the nearest station.
        </p>
        <p className="type-prose">
          So no page shows a figure from it, and it is not research data. It was used for one thing: to train the demo
          model described below. Before any dataset is used as research data, it has to pass these checks:
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
          demo data under the demo label, or it is rejected. The Kaggle dataset ended as the second. The author&rsquo;s
          statement settled it, so the comparison with independent published figures was not needed and was not made.
        </p>
      </Section>

      <Section id="in-development">
        <p className="type-prose">
          {rentModelConnected
            ? "One thing the site is built for isn’t connected yet: transit access. Wherever it would appear, a dashed “Not connected” frame says what is missing. Nothing fills the space in the meantime. The rent model is a demo, described below."
            : "Two things the site is built for aren’t connected yet: the rent model and transit access. Wherever they would appear, a dashed “Not connected” frame says what is missing. Nothing fills the space in the meantime."}
        </p>

        <Subsection id="predictions">
          <p className="type-prose">
            The site has a model that estimates the monthly cold rent (Nettokaltmiete) of a flat from its description.{" "}
            <strong className="font-[600]">It is a demo.</strong> It was trained on the synthetic Kaggle dataset above,
            so it learned to reproduce the pricing model that generated that data. What it says about real flats in Berlin
            is nothing. Wherever it answers, the page carries the hatched demo band, the label &ldquo;Demo model&rdquo; and
            the words &ldquo;Demo model, trained on synthetic data. Not a Berlin market estimate.&rdquo;
          </p>
          <p className="type-prose">
            {rentModelConnected
              ? "In this build the model runs inside this site’s server. Analyze sends it your description through a contract that fixes the fields sent and the answer that comes back, and shows the answer. The same contract can also point at a separate service. "
              : "The model runs as a separate service, reached through this site’s server by a contract that fixes the fields Analyze sends and the answer it gets back. This build isn’t connected to one, so Analyze ends at “Prediction engine not connected”. When a service is connected, Analyze shows its answer. "}A
            figure from the demo model never appears in a page title, a preview, the home page or a neighborhood
            profile, and never next to a real figure as a comparison. If a service does not say that its model was
            trained on synthetic data, the site shows no figure at all.
          </p>
          <p className="type-prose">
            The site doesn&rsquo;t work out a rent in any other way: there is no formula and no simulated answer. The
            &ldquo;AI&rdquo; in the name refers to this model. With each estimate the model returns its version, the date
            its data reaches, what it had to assume for fields you left out, the fields it ignored, what moved the
            estimate, and warnings such as &ldquo;few examples for this Ortsteil&rdquo;. The page shows all of them.
          </p>
          <p className="type-prose">
            Two request fields have no effect. The property type is, in the data, only a label for the number of rooms.
            The walk to the station in the data is the walk to a named station that is rarely the nearest one, so it does
            not mean what the field on Analyze means. Half rooms are rounded and values outside the data&rsquo;s range
            are capped, with a warning.
          </p>
        </Subsection>

        <Subsection id="model-comparison">
          <p className="type-prose">
            Three kinds of model were compared on the same split, in time order: training on 2020 to 2024, validation
            on 2025, and a test on January to April 2026. A random split would let a model see the months it is judged
            on. The target is the log of the rent per m². The mean error on 2025, in € per month:
          </p>
          <ul className={`${listClass} list-disc`}>
            <li>Median €/m² of the training data: 405 €.</li>
            <li>Linear regression: 144 €.</li>
            <li>CatBoost, a tree-based model (3 runs): 145 €.</li>
            <li>A small neural network with embeddings (3 runs): 144 €.</li>
          </ul>
          <p className="type-prose">
            The three tie. The difference between CatBoost and the linear model is +1.1 € with a 95 % interval from
            &minus;1.7 to +3.8 €. That is what a log-linear pricing model behind the data would produce, so the tie is a
            fact about the data, not about the models. The linear model is the one served: its effects on the rent are
            exact, and it needs no extra software at run time. LightGBM was not tried, because CatBoost had already shown
            that boosting adds nothing here.
          </p>
          <p className="type-prose">
            On the 2026 test the linear model was too high by 77 € on average, because its time trend kept rising while
            the level of the data flattened. The served model is therefore fixed at the last month of the data (April
            2026), and the page warns when a request is more than 180 days later. An error of about 144 € measures how
            well the model recovers a synthetic generator. It is not an accuracy figure for Berlin.
          </p>
        </Subsection>

        <Subsection id="uncertainty">
          <p className="type-prose">
            Even a good model can&rsquo;t name the one right rent for a flat. Similar flats are listed at different rents.
            The model sees only the fields you give it, not the light, the noise or the landlord. Fields you leave out
            have to be assumed. And its data ends at a date, while rents move on.
          </p>
          <p className="type-prose">
            So an estimate is shown together with a range: the span the model expects the rent to fall in, at a stated
            level. The demo model&rsquo;s range is an 80 % range from the split-conformal method: it takes the errors the
            model made on its last 12 months of data and widens the estimate by their spread. It was checked on months
            the range was not built from: 78.9 % of 2025 and 76.4 % of 2026 fell inside, a little under 80 %, because the
            market moved. When you leave a field open, the model averages over how common each value is in its data,
            treating the open fields as independent, and the range widens. If a model has no calibrated range, the page
            says &ldquo;No uncertainty range available&rdquo; rather than make one up.
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
          {rentModelConnected
            ? "Compare entries stay in your browser. When you prepare an analysis, Analyze sends the request, which holds no address and no coordinates, to this site’s server. The demo model runs there and answers. The site doesn’t store the request. "
            : "Nothing you enter on Analyze or Compare is sent anywhere in this build. No rent model is connected, so Analyze ends by showing the request it would send instead of sending it. If a model is connected, Analyze sends that request, which holds no address and no coordinates, to this site’s server and on to the model. "}The short form on the home page is the
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
          <li>
            Market figures are demo data. {rentModelConnected
              ? "The rent model is a demo trained on synthetic data, and transit access isn’t connected."
              : "The rent model is a demo trained on synthetic data and isn’t connected to this build, and transit access isn’t connected."} The Kaggle dataset is synthetic and demo only.
          </li>
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
