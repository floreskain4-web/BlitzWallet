# Unsigned Bitcoin PSBT preparation

`prepareUnsignedPsbt(request)` constructs a Base64 PSBT for a narrowly supported transaction: native SegWit P2WPKH inputs and outputs on Bitcoin mainnet or testnet. It takes explicit selected outpoints, claimed previous-output values, compressed public keys, BIP84 derivation metadata, recipient amount, change destination, and a **fixed, caller-selected fee**. It includes every supplied input and never estimates fees.

The returned value is `{ psbtBase64, summary }`. The PSBT includes each input's `witnessUtxo` and BIP32 key-origin metadata, plus change-output key-origin metadata. Outputs contain the exact requested recipient value and non-dust change when applicable. Exact spending with no change is accepted. Dust outputs below 294 sats, unsupported scripts/networks/derivations, duplicate outpoints, malformed metadata, unsafe or excessive amounts, and insufficient input value are rejected.

## Security boundary

This module only prepares an **unsigned** PSBT. It does not accept private keys, seed phrases, or unknown request/input fields; it does not derive secret material, sign, finalize, persist, estimate fees, access a network, or broadcast. The caller must obtain explicit user confirmation before preparation. The user must inspect the complete transaction—including destination, amount, fee, and change—and sign it on their hardware wallet. Broadcasting is a separate, user-controlled action.

`ownsInputs: true` is an explicit caller acknowledgement, **not verified ownership**. Public keys do not prove that an input exists or belongs to the caller. Input outpoints and supplied previous-output amounts are untrusted claims until checked against a trusted Bitcoin node or equivalent trusted source. Hardware-wallet review remains essential. This flow is not connected to, and cannot spend, existing Spark or Lightning balances/funds.

## Request shape

```js
{
  network: 'bitcoin', // or 'testnet'
  inputs: [{
    txid: '<64 hex chars>',
    vout: 0,
    valueSats: 10000,
    publicKeyHex: '<compressed 33-byte public key hex>',
    masterFingerprintHex: '<4-byte hex>',
    path: "m/84'/0'/0'/0/0" // testnet coin type is 1
  }],
  recipientAddress: 'bc1q...',
  amountSats: 5000,
  changeAddress: 'bc1q...',
  changePublicKeyHex: '<compressed 33-byte public key hex>',
  changeMasterFingerprintHex: '<4-byte hex>',
  changePath: "m/84'/0'/0'/1/0",
  feeSats: 500,
  ownsInputs: true
}
```

No fee rate is inferred: the caller supplies the exact fee in sats, and the transaction's input/output difference equals that fee. This library does not validate fee reasonableness or confirm prevouts. The user and integrating application remain responsible for selecting an appropriate fee and independently checking the transaction before signing.
