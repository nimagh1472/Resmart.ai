import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { SmartSearch } from "@/components/smart-search";
import { SearchResults } from "@/components/search-results";

type Props = { searchParams: { q?: string } };

export function generateMetadata({ searchParams }: Props): Metadata {
  const q = searchParams.q?.trim();
  return { title: q ? `"${q}" — Search results` : "Search" };
}

export default function SearchPage({ searchParams }: Props) {
  const query = searchParams.q?.trim() ?? "";

  return (
    <>
      <Navbar />
      <main className="min-h-dvh bg-canvas">
        <div className="px-gutter mx-auto max-w-4xl pt-10 sm:pt-14">
          <SmartSearch />
        </div>
        <SearchResults query={query} />
      </main>
    </>
  );
}
