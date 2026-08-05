"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SearchResult = {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
  image: string | null;
};

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; query: string; data: SearchResult[] };

/**
 * Fires `/api/search` (DuckDuckGo-backed) only on form submission — never
 * on keystroke — to avoid hammering the scraped endpoint while typing.
 */
export function SearchInput({ className }: { className?: string }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setState({ status: "loading" });
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "search_failed");
      setState({ status: "ready", query: trimmed, data: json.data ?? [] });
    } catch {
      setState({ status: "error" });
    }
  };

  return (
    <div className={cn("flex w-full flex-col gap-4", className)}>
      <form
        onSubmit={onSubmit}
        role="search"
        className="flex items-center gap-2 rounded-2xl border border-surface-border bg-surface p-2 shadow-card focus-within:border-accent/40 focus-within:shadow-glow"
      >
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the web"
            aria-label="Web search"
            className="h-12 w-full bg-transparent pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <Button type="submit" loading={state.status === "loading"} className="shrink-0">
          Search
        </Button>
      </form>

      {state.status === "error" && (
        <p className="text-sm text-muted-foreground">
          Search is unavailable right now — try again shortly.
        </p>
      )}

      {state.status === "ready" &&
        (state.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No results for &ldquo;{state.query}&rdquo;.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {state.data.map((result) => (
              <li
                key={result.link}
                className="flex gap-3 rounded-xl border border-surface-border bg-surface p-3"
              >
                {result.image && (
                  <Image
                    src={result.image}
                    alt=""
                    width={64}
                    height={64}
                    className="h-16 w-16 shrink-0 rounded-lg object-cover"
                    unoptimized
                  />
                )}
                <div className="min-w-0 flex-1">
                  <a
                    href={result.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-sm font-medium text-accent-strong hover:underline"
                  >
                    {result.title}
                  </a>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {result.displayLink}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">
                    {result.snippet}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
