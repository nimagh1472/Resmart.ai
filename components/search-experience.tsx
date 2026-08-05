"use client";

import { useState } from "react";
import {
  DEFAULT_SEARCH_FILTERS,
  SearchControlPanel,
  type SearchFilters,
} from "@/components/search-control-panel";
import { SearchResults } from "@/components/search-results";

/** Owns the Condition/Fulfillment/Zip filter state shared by the panel and results. */
export function SearchExperience({ query }: { query: string }) {
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_SEARCH_FILTERS);

  return (
    <>
      <div className="px-gutter mx-auto max-w-4xl pt-4">
        <SearchControlPanel value={filters} onChange={setFilters} />
      </div>
      <SearchResults query={query} filters={filters} />
    </>
  );
}
