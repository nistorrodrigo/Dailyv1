import GeneralSection from "./GeneralSection";
import SectionToggleList from "./SectionToggleList";
import MacroSection from "./MacroSection";
import TradeIdeasSection from "./TradeIdeasSection";
import FlowsSection from "./FlowsSection";
import MacroEstimatesSection from "./MacroEstimatesSection";
import CorporateSection from "./CorporateSection";
import ResearchSection from "./ResearchSection";
import LatestReportsSection from "./LatestReportsSection";
import SignaturesSection from "./SignaturesSection";
import TopMoversSection from "./TopMoversSection";
import TweetsSection from "./TweetsSection";
import BcraSection from "./BcraSection";
import EventsSection from "./EventsSection";
import KeyEventsSection from "./KeyEventsSection";
import ChartSection from "./ChartSection";
import SnapshotSection from "./SnapshotSection";
import WatchTodaySection from "./WatchTodaySection";
import LatAmSection from "./LatAmSection";
import MarketCommentSection from "./MarketCommentSection";
import YesterdayRecapSection from "./YesterdayRecapSection";
import LivePreviewPanel from "../LivePreviewPanel";
import LazySection from "../ui/LazySection";
import useDailyStore from "../../store/useDailyStore";

const SECTION_COMPONENTS: Record<string, React.ComponentType> = {
  yesterdayRecap: YesterdayRecapSection,
  snapshot: SnapshotSection,
  watchToday: WatchTodaySection,
  marketComment: MarketCommentSection,
  macro: MacroSection,
  tradeIdeas: TradeIdeasSection,
  flows: FlowsSection,
  corporate: CorporateSection,
  research: ResearchSection,
  latestReports: LatestReportsSection,
  topMovers: TopMoversSection,
  tweets: TweetsSection,
  latam: LatAmSection,
  bcra: BcraSection,
  events: EventsSection,
  macroEstimates: MacroEstimatesSection,
  chart: ChartSection,
};

export default function EditorTab() {
  const sections = useDailyStore((s) => s.sections);

  return (
    <LivePreviewPanel>
      <div className="editor-container" style={{ maxWidth: 800, margin: "0 auto", padding: 20 }}>
        {/* `id="section-..."` on each wrapper — the WorkflowPanel
            scrolls to these anchors when the analyst clicks a pending
            checklist item. Same convention used elsewhere
            (`id="sec-<key>"` in the email HTML's TOC mode), distinct
            prefix here so they don't collide if both are rendered
            in the same DOM tree later. */}
        <div id="section-general">
          <GeneralSection />
        </div>
        <SectionToggleList />
        {sections.filter((sec) => sec.on).map((sec) => {
          const Component = SECTION_COMPONENTS[sec.key];
          return Component ? (
            <div key={sec.key} id={`section-${sec.key}`}>
              <LazySection>
                <Component />
              </LazySection>
            </div>
          ) : null;
        })}
        <div id="section-signatures">
          <SignaturesSection />
        </div>
      </div>
    </LivePreviewPanel>
  );
}
