import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

describe("security-patched lint dependency compatibility", () => {
  it("keeps source/script coverage and generated/vendor exclusions", async () => {
    const eslint = new ESLint();
    for (const file of ["src/domain/pokemon/xl.ts", "src/features/simulation/DuelPage.tsx", "scripts/validate-workflow-security.ts"]) {
      expect(await eslint.isPathIgnored(file), file).toBe(false);
      const config = await eslint.calculateConfigForFile(file) as { rules?: Record<string, unknown> } | undefined;
      expect(config?.rules?.["@typescript-eslint/no-unused-vars"], file).toBeTruthy();
    }
    for (const file of ["public/vendor/pvpoke/js/GameMaster.js", "dist/assets/index.js", "dist-admin/assets/index.js", "node_modules/eslint/lib/api.js"]) {
      expect(await eslint.isPathIgnored(file), file).toBe(true);
    }
  });

  it("still enforces typed TypeScript and React Hooks rules", async () => {
    const eslint = new ESLint();
    const typescript = await eslint.lintText("const unused: number = 1;\nexport {};\n", {
      filePath: "src/domain/pokemon/xl.ts",
    });
    expect(typescript.flatMap(result => result.messages).some(message => message.ruleId === "@typescript-eslint/no-unused-vars")).toBe(true);
    const react = await eslint.lintText("import { useState } from 'react';\nexport function Probe({ enabled }: { enabled: boolean }) {\nif (enabled) useState(0);\nreturn <div />;\n}\n", {
      filePath: "src/features/simulation/DuelPage.tsx",
    });
    expect(react.flatMap(result => result.messages).some(message => message.ruleId === "react-hooks/rules-of-hooks")).toBe(true);
  });
});
