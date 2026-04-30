import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// React Testing Library mounts into the global document; clean up after
// each test so a stale tree from one test doesn't leak into the next.
afterEach(() => {
  cleanup();
});
