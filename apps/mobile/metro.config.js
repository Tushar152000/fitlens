// Learn more https://docs.expo.dev/guides/monorepos/
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

/**
 * Expo detects the pnpm workspace (../../pnpm-workspace.yaml) and already sets watchFolders and
 * nodeModulesPaths for it; with `node-linker=hoisted` every package resolves from the root
 * node_modules. The only change: don't watch the sibling apps (apps/web, apps/api) — the app never
 * imports them, and their build output (.next, dist) would only slow Metro's crawler down.
 */
const config = getDefaultConfig(__dirname);
const appsDir = path.resolve(__dirname, "..");
config.watchFolders = config.watchFolders.filter((folder) => folder === __dirname || path.dirname(folder) !== appsDir);

module.exports = config;
