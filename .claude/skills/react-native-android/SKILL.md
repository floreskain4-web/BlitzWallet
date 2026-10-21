---
name: react-native-android
description: Safe React Native and Android development in BlitzWallet. Use for UI, JavaScript/TypeScript, native Android integration, tests, builds, or dependency questions in this repository.
---

# React Native and Android in BlitzWallet

- Read `AGENTS.md`, `CLAUDE.md`, and relevant tests before editing. Keep changes surgical; state assumptions and verify stated success criteria.
- This is a bare React Native app (RN 0.81.4, Expo ~54; Yarn 3.6.4; Node >=20), with checked-in `android/` and `ios/`. Follow existing local patterns. Check `package.json`, lockfile and installed native configuration before asserting APIs or proposing changes.
- Preserve provider order in `App.tsx`, the deliberately provider-free background entry in `index.background.js`, and the last-position Worklets Babel plugin. Metro shims and native patches can be required by crypto/SDK integrations; inspect before touching.
- Prefer focused offline Jest tests and scoped lint. Do not install dependencies, run device/release builds, access secrets, or make network/production calls unless explicitly requested and safe. Never run tests that invoke wallet, network, account, or secret-handling paths without confirming they are isolated and mocked.
- For Android changes, inspect Gradle/plugin/native versions and relevant patches first; limit native edits to requested behavior and document device/build validation limits.
- Do not infer runtime safety from agent instructions: instructions guide work but do not enforce application behavior.
