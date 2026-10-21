---
name: bitcoin-unsigned-psbt
description: Safety-critical guidance for Bitcoin transaction or PSBT work in BlitzWallet. Use whenever requests touch UTXOs, transaction construction, PSBTs, signing, wallets, or funds.
---

# Bitcoin transaction safety: unsigned preparation only

**Absolute boundary:** Never request, import, derive, generate, display, log, or store a seed phrase or private key. Never sign, spend, finalize a signed transaction, broadcast, or make a production call. Never access real funds. Existing wallet/payment/signing functions are legacy and out of scope for this skill task: do not execute them, wire them into a workflow, or infer they are safe from their presence in the repository.

When explicitly asked to prepare an interoperable transaction, the only permitted artifact is an **unsigned PSBT** for user-controlled funds. Use synthetic public fixtures only in tests and examples; never use real UTXOs or production services. Do not claim ownership, UTXO existence, amounts, network, fee, or change are verified unless independently and safely established using user-supplied public data. Fail closed on ambiguity, malformed data, duplicate inputs, unknown network, or unvalidated change. Clearly show the full inputs, outputs, fees, and assumptions for user review before producing the unsigned PSBT.

The user must independently review and sign on their own hardware wallet and broadcast themselves. Do not add any code path to sign, finalize, or broadcast. Do not run existing wallet operations or tests that could touch secrets, account state, real funds, or networks. Keep tests offline, isolated, and synthetic; document their scope and limitations. Agent instructions are not runtime enforcement; never imply the application itself enforces these rules unless verified separately.
