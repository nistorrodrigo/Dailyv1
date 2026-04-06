interface XProps {
  onClick: () => void;
}

export const X = ({ onClick }: XProps) => (
  <button
    onClick={onClick}
    className="bg-transparent border-none text-red-600 cursor-pointer text-lg px-1 leading-none hover:text-red-800"
  >
    {"\u00D7"}
  </button>
);
