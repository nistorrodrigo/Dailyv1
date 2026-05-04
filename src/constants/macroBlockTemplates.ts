/**
 * Curated macro-block templates for the Argentina Daily.
 *
 * Each entry pre-fills a recurring block type — the kind of section
 * that shows up multiple times a week and benefits from a consistent
 * structure. Pick a template → a new macroBlock is appended with
 * the title set, body containing a labelled skeleton the analyst
 * fills in, and lsPick stubbed with the standard LS-view shape.
 *
 * The body skeleton uses bracketed placeholders ([…]) so the analyst
 * can scan-replace as they fill in. Prompts inside the brackets
 * remind them which data point belongs where without dictating the
 * narrative.
 *
 * Tone target throughout: institutional, English, precise — the
 * register foreign PMs/traders read in. Avoids softeners, retail
 * vocabulary, and filler.
 */

export interface MacroBlockTemplate {
  id: string;
  /** Short human label shown in the picker dropdown. */
  label: string;
  /** One-line description of what the block covers. Helps the
   *  analyst pick the right one when titles look similar. */
  description: string;
  /** Title written into the new macroBlock. Always UPPERCASE to match
   *  the existing macroBlock convention. */
  title: string;
  /** Body skeleton the analyst fills in. Newlines preserved. */
  body: string;
  /** Suggested LS-view shape. Empty string when the template is
   *  data-only and a view doesn't usually attach. */
  lsPick: string;
}

export const MACRO_BLOCK_TEMPLATES: MacroBlockTemplate[] = [
  {
    id: "bcra-rate",
    label: "BCRA rate decision",
    description: "Rate change vs. consensus, vote split, forward guidance read.",
    title: "BCRA RATE DECISION",
    body:
      "BCRA [cut/held/hiked] the policy rate by [X]bps to [Y]%, [in line with / above / below] LS estimates of [Z]bps. " +
      "[Vote split / unanimity, if disclosed]. " +
      "Forward guidance [reaffirmed / softened] the [next-meeting bias / inflation glide path / FX framework]. " +
      "Money-market reaction: [front-end shift, repo activity, peso curve]. " +
      "Implication for the carry trade: [].",
    lsPick:
      "[Long/short] [front-end BONCAP / Bonar 30 / specific name] — the decision [confirms / weakens] our [rate-path / FX] thesis through [date].",
  },
  {
    id: "treasury-auction",
    label: "Treasury auction",
    description: "Roll rate, premium, demand by tenor, fiscal-program implication.",
    title: "TREASURY AUCTION RESULTS",
    body:
      "Tesoro placed [ARS X]tn at today's auction, achieving a [Y]% rollover ([above / below] the [Z]% target). " +
      "Demand concentrated in the [tenor] bucket, with [X]bps premium over secondary on the [name]. " +
      "FX-linked / CER-linked / fixed-rate split: [X% / Y% / Z%]. " +
      "Implication for the [program target / Q calendar]: [].",
    lsPick:
      "Long [BONCAP-X / BONCER-Y]: the auction confirmed [absorption capacity / pricing tail / curve preference] and the carry through [event] looks [attractive / fully priced].",
  },
  {
    id: "inflation",
    label: "CPI / inflation print",
    description: "Headline, core, monthly run-rate, vs. LS / consensus / REM.",
    title: "INFLATION DATA",
    body:
      "[Month] CPI printed [X]% m/m and [Y]% y/y, [above / in line with / below] LS estimate of [Z]% and consensus of [W]%. " +
      "Core CPI: [X]% (the relevant gauge for BCRA's reaction function). " +
      "Drivers: [seasonal foods / regulated tariffs / services / FX pass-through]. " +
      "REM survey median for [next month] currently at [X]%. " +
      "Implication for the rate path: [].",
    lsPick:
      "The print [supports / challenges] our view of a [Q]% terminal-rate path. We [add / hold / fade] [BONCER 28 / front-end BONCAP] on the back of it.",
  },
  {
    id: "reserves",
    label: "BCRA reserves update",
    description: "Net / gross delta, FX intervention, programme status.",
    title: "RESERVES UPDATE",
    body:
      "BCRA [bought / sold] USD [X]mn in the [past session / week], bringing net reserves to [USD Y]bn ([Z] vs IMF target). " +
      "Gross reserves: [USD Y]bn. " +
      "Cumulative YTD: [+/− USD Z]bn. " +
      "Driver: [exporter sales / agro repo / energy imports / debt service]. " +
      "Programme implication: [on track / at risk / cushion building] for the [target review].",
    lsPick:
      "[Constructive / cautious] on the front-end of the sovereign curve as long as accumulation runs at [USD X]mn/day. " +
      "[ARGENT 30 / GD30] [tightens / widens] in the [scenario].",
  },
  {
    id: "fiscal",
    label: "Fiscal data",
    description: "Primary balance, revenue/spending mix, programme target check.",
    title: "FISCAL DATA",
    body:
      "[Month] primary balance: [+/-ARS X]bn ([X]% of GDP), [vs] LS estimate of [Y] and the IMF target of [Z]. " +
      "Revenue: [X]% y/y real, driven by [PAIS tax / income tax / VAT]. " +
      "Spending: [X]% y/y real, [above / below] the programme path. " +
      "YTD primary balance: [X]% of GDP ([on / above / below] track for the [Y]% annual target). " +
      "Implication for the IMF review in [date]: [].",
    lsPick: "",
  },
  {
    id: "imf",
    label: "IMF programme update",
    description: "Review outcome, disbursement schedule, target adjustments.",
    title: "IMF PROGRAM",
    body:
      "Staff-level / Board approval reached on [review name], releasing USD [X]bn (cumulative USD [Y]bn since [start date]). " +
      "Performance criteria: [reserves accumulation, primary balance, monetary financing] — [met / waivers granted / under monitoring]. " +
      "Forward review: [next milestone, date]. " +
      "Net new financing vs. roll: [USD X]bn / USD [Y]bn. " +
      "Implication for [debt servicing / FX runway]: [].",
    lsPick:
      "[Constructive / neutral] on the sovereign curve — the [review milestone] [removes / adds] near-term tail risk through [date].",
  },
  {
    id: "political",
    label: "Political update / poll",
    description: "Approval ratings, election polling, governance signals.",
    title: "POLITICAL UPDATE",
    body:
      "[Pollster] [date] survey: Milei approval at [X]% ([+/-Y]pp m/m, term [low / high]). " +
      "Disapproval: [X]%. " +
      "Image vs. opposition: [Kicillof / Massa / other] at [X]%. " +
      "Driver: [economic concerns / specific event / messaging]. " +
      "Implication for [Congress dynamics / mid-term setup / fiscal commitment credibility]: [].",
    lsPick:
      "Political risk premium is [under-priced / fairly priced] in [GD30 / Bonar 30] given the polling trend through [event].",
  },
  {
    id: "fx-bcra",
    label: "FX / BCRA framework",
    description: "Crawl pace, parallel-rate spreads, intervention signals.",
    title: "FX / BCRA",
    body:
      "Official rate: [X]/USD, [+/-Y]% in the [period]. Crawl pace [vs] BCRA's stated [Z]% monthly. " +
      "CCL: [X]/USD ([+/-Y]% session). MEP: [X]/USD. Blue: [X]/USD. " +
      "Spreads: CCL/Official [X]%, MEP/Official [X]%. " +
      "BCRA intervention: [bought / sold / absent]. " +
      "Reading: [crawl pace credible / FX gap pressuring / programme hands-off].",
    lsPick:
      "[Long / fade] CCL on [carry, fundamentals, intervention pattern]. We [add / hold] [front-end carry / sovereign duration] given the [scenario].",
  },
  {
    id: "rem",
    label: "REM survey (BCRA)",
    description: "Consensus revisions on CPI / GDP / FX / rates.",
    title: "REM SURVEY",
    body:
      "Latest BCRA REM ([release date]): consensus revisions on the key macro forecasts. " +
      "CPI [next month]: [X]% ([+/-Y]pp from prior survey). " +
      "CPI [year-end]: [X]% ([+/-Y]pp). " +
      "GDP [year]: [X]% ([+/-Y]pp). " +
      "FX EoP [year]: [X]/USD ([+/-Y]%). " +
      "Policy rate end-period: [X]%. " +
      "Direction of revisions: [convergent / dispersive] — [tightening / loosening] consensus on [theme].",
    lsPick:
      "REM revisions [confirm / push back against] our [thesis]. We hold [position] given the move in [forecast].",
  },
  {
    id: "earnings-preview",
    label: "Earnings preview / wrap",
    description: "Quarter expectation or post-print read on a sector.",
    title: "EARNINGS — [SECTOR / TICKER]",
    body:
      "[Pre / post] [Q] earnings for [tickers]. " +
      "Key metrics to watch: [NIM / production / EBITDA / margin]. " +
      "LS vs consensus: [our estimate] vs [street] on [primary metric]. " +
      "Catalysts: [guidance / dividend / capex]. " +
      "Read across to [other tickers]: [].",
    lsPick:
      "Long [ticker] into the print: [specific catalyst] gives [X]% upside vs the LS price target of [Y]. " +
      "Risks: [].",
  },
];
