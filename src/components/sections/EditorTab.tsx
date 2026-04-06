import GeneralSection from "./GeneralSection";
import SectionToggleList from "./SectionToggleList";
import MacroSection from "./MacroSection";
import TradeIdeasSection from "./TradeIdeasSection";
import FlowsSection from "./FlowsSection";
import MacroEstimatesSection from "./MacroEstimatesSection";
import CorporateSection from "./CorporateSection";
import ResearchSection from "./ResearchSection";
import SignaturesSection from "./SignaturesSection";
import TopMoversSection from "./TopMoversSection";
import TweetsSection from "./TweetsSection";
import BcraSection from "./BcraSection";
import EventsSection from "./EventsSection";
import KeyEventsSection from "./KeyEventsSection";
import ChartSection from "./ChartSection";
import LivePreviewPanel from "../LivePreviewPanel";
import LazySection from "../ui/LazySection";
import useDailyStore from "../../store/useDailyStore";

const SECTION_COMPONENTS: Record<string, React.ComponentType> = {
  macro: MacroSection,
  tradeIdeas: TradeIdeasSection,
  flows: FlowsSection,
  macroEstimates: MacroEstimatesSection,
  corporate: CorporateSection,
  research: ResearchSection,
  topMovers: TopMoversSection,
  tweets: TweetsSection,
  bcra: BcraSection,
  events: EventsSection,
  keyEvents: KeyEventsSection,
  chart: ChartSection,
};

export default function EditorTab() {
  const sections = useDailyStore((s) => s.sections);

  return (
    <LivePreviewPanel>
      <div className="editor-container" style={{ maxWidth: 800, margin: "0 auto", padding: 20 }}>
        <GeneralSection />
        <SectionToggleList />
        {sections.filter((sec) => sec.on).map((sec) => {
          const Component = SECTION_COMPONENTS[sec.key];
          return Component ? (
            <LazySection key={sec.key}>
              <Component />
            </LazySection>
          ) : null;
        })}
        <SignaturesSection />
      </div>
    </LivePreviewPanel>
  );
}
