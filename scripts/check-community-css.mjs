import fs from "node:fs";
import assert from "node:assert/strict";
import postcss from "postcss";

const root = postcss.parse(fs.readFileSync("styles.css", "utf8"));
const important = [];
root.walkRules(rule => {
  assert.ok(!rule.selector.includes(":has("), `Water CSS must use owned state classes: ${rule.selector}`);
  const names = new Set();
  rule.nodes.filter(node => node.type === "decl").forEach(declaration => {
    assert.ok(!names.has(declaration.prop), `Duplicate ${declaration.prop}: ${rule.selector}`);
    names.add(declaration.prop);
    if (declaration.important) important.push({ selector: rule.selector, property: declaration.prop });
  });
});
const budget = JSON.parse(fs.readFileSync("community-css-policy.json", "utf8"));
assert.ok(important.length <= budget.max_important_declarations, "New priority overrides require scoped host regression and a reviewed policy update");
console.log(`CSS states scoped; no :has or duplicate properties; ${important.length} documented host overrides.`);
