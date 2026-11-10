#!/usr/bin/env node
/**
 * Prints capability audit JSON (requires dev server or import — use curl in CI:
 * curl -s http://localhost:3000/api/admin/audit/capability)
 */
console.log(
  "Run: curl -s http://localhost:3000/api/admin/audit/capability | jq ."
);
