import type { Analyst, CorpBlock, CoverageItem } from "../types";

export const rc = (r: string): string => {
  const l = (r || "").toLowerCase();
  return l === "overweight" ? "#27864a"
    : l === "neutral" ? "#e6a817"
    : l === "underweight" ? "#c0392b"
    : l === "nr" ? "#888"
    : l === "ur" ? "#7b5ea7"
    : "#666";
};

export const rb = (r: string): string => {
  const l = (r || "").toLowerCase();
  return l === "overweight" ? "#e8f5e9"
    : l === "neutral" ? "#fff8e1"
    : l === "underweight" ? "#fbe9e7"
    : l === "nr" ? "#f0f0f0"
    : l === "ur" ? "#f3eef8"
    : "#f5f5f5";
};

interface ResolvedCoverage {
  ticker: string;
  rating: string;
  tp: string;
  last: string;
}

interface ResolvedCorpBlock {
  tickers: string[];
  covs: ResolvedCoverage[];
  headline: string;
  analyst: string;
  body: string;
  link: string;
}

export function resolveCorporateBlock(c: CorpBlock & { ticker?: string }, analysts: Analyst[]): ResolvedCorpBlock {
  const a = analysts.find((x) => x.id === c.analystId);
  const tickers = c.tickers || (c.ticker ? [c.ticker] : []);
  const covs: ResolvedCoverage[] = tickers.map((t: string) => {
    const cv: CoverageItem | undefined = a ? a.coverage.find((x) => x.ticker === t) : undefined;
    return {
      ticker: t,
      rating: cv ? cv.rating : "",
      tp: cv ? cv.tp : "",
      last: cv ? cv.last || "" : "",
    };
  });
  return {
    tickers,
    covs,
    headline: c.headline,
    analyst: a ? `${a.name}, ${a.title}` : "",
    body: c.body,
    link: c.link,
  };
}
