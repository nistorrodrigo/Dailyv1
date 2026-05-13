interface XProps {
  onClick: () => void;
  /** Accessible name announced to screen readers. The default
   *  ("Remove") fits the common list-row-delete usage; pass a more
   *  specific label when the row context matters ("Remove analyst",
   *  "Delete corporate block", etc.) so the announcement is useful. */
  ariaLabel?: string;
}

export const X = ({ onClick, ariaLabel = "Remove" }: XProps) => (
  <button
    onClick={onClick}
    aria-label={ariaLabel}
    title={ariaLabel}
    className="bg-transparent border-none text-red-600 cursor-pointer text-lg px-1 leading-none hover:text-red-800"
  >
    {"\u00D7"}
  </button>
);
