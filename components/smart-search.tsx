"use client";

import { useState } from "react";
import { ImageUp, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VisionAiModal } from "@/components/vision-ai-modal";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "MacBook Air M2",
  "LG C4 65\"",
  "Dyson V15",
  "PS5 Slim",
  "Sony WH-1000XM5",
];

export function SmartSearch({ className }: { className?: string }) {
  const [query, setQuery] = useState("");
  const [visionOpen, setVisionOpen] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Wire to /search once the results route exists.
  };

  return (
    <div className={cn("flex w-full flex-col gap-4", className)}>
      <form
        onSubmit={submit}
        className="flex flex-col gap-2 rounded-2xl border border-surface-border bg-surface p-2 shadow-card focus-within:border-accent/40 focus-within:shadow-glow sm:flex-row sm:items-center"
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
            placeholder="Search any product — we'll find the open-box price"
            aria-label="Search open-box and refurbished inventory"
            className="h-12 w-full bg-transparent pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>

        <div className="grid shrink-0 grid-cols-1 items-center gap-2 sm:flex">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setVisionOpen(true)}
            leftIcon={<ImageUp className="h-4 w-4" />}
          >
            <span className="hidden sm:inline">Upload Screenshot / Paste Link</span>
            <span className="sm:hidden">Upload / Paste</span>
          </Button>
          <Button type="submit" className="shrink-0">
            Search
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Trending
        </span>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setQuery(s)}
            className="rounded-full border border-surface-border bg-surface px-3 py-1 text-xs text-muted transition hover:border-accent/40 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>

      <VisionAiModal open={visionOpen} onClose={() => setVisionOpen(false)} />
    </div>
  );
}
