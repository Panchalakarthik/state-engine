import type { ComponentType } from "react";

type BabelStandalone = typeof import("@babel/standalone");
let babelCache: BabelStandalone | null = null;

async function getBabel(): Promise<BabelStandalone> {
  if (!babelCache) {
    babelCache = await import("@babel/standalone");
  }
  return babelCache;
}

/**
 * Transform a JSX string into plain JS (React.createElement calls).
 */
export async function compileJsx(jsxString: string): Promise<string> {
  const Babel = await getBabel();
  const result = Babel.transform(jsxString, {
    // Classic runtime → React.createElement (no `import` statements, which
    // would break the new Function eval). React is injected into scope.
    presets: [["react", { runtime: "classic" }]],
    filename: "component.jsx",
  });
  if (!result.code) throw new Error("Babel transform produced no output");
  return result.code;
}

/**
 * Compile + evaluate a JSX string into a React component, injecting Blade
 * components (and React) into scope. The generated code must define a
 * top-level function named `GeneratedComponent`.
 */
export async function evalComponent(
  jsxString: string,
  scope: Record<string, unknown>,
): Promise<ComponentType> {
  const React = (await import("react")).default;
  const code = await compileJsx(jsxString);
  const allScope = { React, ...scope };
  const keys = Object.keys(allScope);
  const values = Object.values(allScope);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const fn = new Function(...keys, `${code}\nreturn GeneratedComponent;`);
  return fn(...values) as ComponentType;
}
