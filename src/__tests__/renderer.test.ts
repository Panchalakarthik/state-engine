import { describe, it, expect } from "vitest";
import { compileJsx } from "@/lib/renderer";

describe("compileJsx", () => {
  it("transforms JSX into React.createElement calls", async () => {
    const jsx = `function GeneratedComponent() { return <div>hello</div>; }`;
    const result = await compileJsx(jsx);
    expect(result).toContain("React.createElement");
    expect(result).toContain("hello");
  });

  it("throws on invalid JS", async () => {
    await expect(compileJsx("function broken( { return; }")).rejects.toThrow();
  });
});
