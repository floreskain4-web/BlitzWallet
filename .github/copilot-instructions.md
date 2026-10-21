# Copilot instructions — BlitzWallet

Read `AGENTS.md` and `CLAUDE.md` first. For applicable work, read `.claude/skills/react-native-android/SKILL.md`, `.claude/skills/bitcoin-unsigned-psbt/SKILL.md`, or `.claude/skills/external-knowledge-research/SKILL.md`.

**Wallet safety:** Never request, import, generate, expose, log, or store seeds/private keys. Never sign, spend, finalize a signed transaction, broadcast, make production calls, or touch real funds. Any explicitly requested transaction preparation is limited to unsigned PSBTs using user-provided public data and synthetic fixtures only. The user independently reviews/signs on their own hardware wallet and broadcasts themselves. Existing wallet functionality is not authorization to execute it. These instructions guide agents; they are not runtime enforcement.
