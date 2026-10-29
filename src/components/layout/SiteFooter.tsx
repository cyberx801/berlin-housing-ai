import Link from "next/link";
import { ProvenanceMark } from "@/components/provenance/ProvenanceMark";
import { NAV_ITEMS } from "./nav-items";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t-[3px] border-ink bg-sheet">
      <div className="page-grid gap-y-10 py-12">
        <div className="col-span-4 flex flex-col gap-3 md:col-span-8 lg:col-span-4">
          <p className="type-title-3 stretch-wide">Berlin Housing AI</p>
          <p className="max-w-[44ch] type-small text-ink-2">
            A research tool for reading Berlin flats against their city. It shows what the data can tell you
            and labels what it can&rsquo;t.
          </p>
        </div>

        <nav aria-label="Footer" className="col-span-2 md:col-span-3 lg:col-span-2">
          <h2 className="mb-3 type-small font-[620] text-ink">Tools</h2>
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="type-small text-ink-2 hover:text-ink">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="col-span-4 md:col-span-5 lg:col-span-3">
          <h2 className="mb-3 type-small font-[620] text-ink">Sources and licenses</h2>
          <ul className="flex flex-col gap-2 type-small text-ink-2">
            <li>District and Ortsteil boundaries: ALKIS Berlin, Geoportal Berlin, dl-de/zero-2.0</li>
            <li>Umweltzone (area within the S-Bahn ring): Geoportal Berlin, dl-de/zero-2.0</li>
            <li>
              <Link href="/methodology#sources" className="text-ink-2 hover:text-ink">
                Full dataset registry
              </Link>
            </li>
          </ul>
        </div>

        <div className="col-span-4 md:col-span-8 lg:col-span-3">
          <h2 className="mb-3 type-small font-[620] text-ink">Project status</h2>
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 type-small text-ink-2">
            <dt className="contents">
              <ProvenanceMark kind="official" />
            </dt>
            <dd>Geography: official data</dd>
            <dt className="contents">
              <ProvenanceMark kind="demo" />
            </dt>
            <dd>Market figures: demo data</dd>
            <dt className="contents">
              <ProvenanceMark kind="not-connected" />
            </dt>
            <dd>Rent model: not connected</dd>
          </dl>
          <p className="mt-4 type-small text-ink-3">No tracking, no cookies. Your entries stay in your browser.</p>
        </div>
      </div>
    </footer>
  );
}
