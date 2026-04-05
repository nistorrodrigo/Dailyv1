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
      style={{
        minHeight,
        background: "var(--bg-card)",
        borderRadius: 10,
        marginBottom: 14,
        border: "1px solid var(--border-light)",
      }}
    />
  );
}
