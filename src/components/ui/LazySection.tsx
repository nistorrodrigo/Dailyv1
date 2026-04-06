import { useState, useRef, useEffect } from "react";

export default function LazySection({ children, minHeight = 80 }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (visible) return children;

  return (
    <div
      ref={ref}
      className="rounded-[10px] mb-3.5 border border-[var(--border-light)] bg-[var(--bg-card)]"
      style={{ minHeight }}
    />
  );
}
