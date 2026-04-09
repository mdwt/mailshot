#!/usr/bin/env node
/* eslint-disable no-console */
import { syncSkills } from "./sync";

const { copied } = syncSkills();
const silent = process.argv.includes("--silent");

if (!silent) {
  console.log(`Synced ${copied.length} skill${copied.length === 1 ? "" : "s"}`);
}
