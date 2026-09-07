import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      name: "cloudflare-workers-test-runtime",
      resolveId(id) {
        return id === "cloudflare:workers"
          ? "\0cloudflare-workers-test-runtime"
          : undefined;
      },
      load(id) {
        if (id !== "\0cloudflare-workers-test-runtime") {
          return undefined;
        }
        return `
          export class DurableObject {
            constructor(context, environment) {
              this.ctx = context;
              this.env = environment;
            }
          }
        `;
      },
    },
  ],
  test: {
    include: ["tests/**/*.test.ts", "scripts/**/*.test.mjs"],
  },
});
