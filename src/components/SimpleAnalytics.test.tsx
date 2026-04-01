import { render } from "@testing-library/react";
import React from "react";
import SimpleAnalytics from "./SimpleAnalytics";

jest.mock("next/script", () => {
  return function MockScript(props: React.HTMLProps<HTMLScriptElement>) {
    return <script {...props} />;
  };
});

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("SimpleAnalytics", () => {
  it("does not render when disabled", () => {
    process.env.NEXT_PUBLIC_SIMPLE_ANALYTICS_ENABLED = "false";

    const { container } = render(<SimpleAnalytics />);

    expect(container.firstChild).toBeNull();
  });

  it("renders the Simple Analytics script and noscript fallback when enabled", () => {
    process.env.NEXT_PUBLIC_SIMPLE_ANALYTICS_ENABLED = "true";
    process.env.NEXT_PUBLIC_SIMPLE_ANALYTICS_HOSTNAME = "example.com";

    const { container } = render(<SimpleAnalytics />);

    const script = container.querySelector(
      'script[src="https://scripts.simpleanalyticscdn.com/latest.js"]',
    );
    expect(script).not.toBeNull();
    expect(script).toHaveAttribute("data-hostname", "example.com");

    const noscript = container.querySelector("noscript");
    expect(noscript).not.toBeNull();
  });
});
