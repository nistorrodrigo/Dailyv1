import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Markdown preview render — split out as its own module so the
 * 150 KB react-markdown + remark-gfm graph is code-split into a
 * separate chunk that only loads when the analyst clicks "Preview".
 *
 * The vast majority of editing time is spent in the textarea side of
 * `MarkdownEditor`; lazy-loading the preview drops ~150 KB / ~50 KB
 * gzip from the initial bundle.
 */
export default function MarkdownPreviewLazy({ value }: { value: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>;
}
