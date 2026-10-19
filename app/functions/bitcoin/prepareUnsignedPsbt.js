const bitcoin = require('bitcoinjs-lib');
const { Buffer } = require('buffer');
const { Point } = require('@noble/secp256k1');

const MAX_MONEY = 21000000 * 100000000;
const DUST_SATS = 294;
const REQUEST_KEYS = new Set([
  'network',
  'inputs',
  'recipientAddress',
  'amountSats',
  'changeAddress',
  'changePublicKeyHex',
  'changeMasterFingerprintHex',
  'changePath',
  'feeSats',
  'ownsInputs',
]);
const INPUT_KEYS = new Set([
  'txid',
  'vout',
  'valueSats',
  'publicKeyHex',
  'masterFingerprintHex',
  'path',
]);

function fail(message) {
  throw new TypeError(`Invalid unsigned PSBT request: ${message}`);
}

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail(`${label} must be an object`);
  for (const key of Object.keys(value))
    if (!keys.has(key)) fail(`unsupported field in ${label}`);
  for (const key of keys)
    if (!Object.prototype.hasOwnProperty.call(value, key))
      fail(`missing ${label} field: ${key}`);
}

function amount(value, label, allowZero = false) {
  if (
    !Number.isSafeInteger(value) ||
    value < (allowZero ? 0 : 1) ||
    value > MAX_MONEY
  )
    fail(`${label} is outside safe Bitcoin amount bounds`);
  return value;
}

function publicKey(hex, label) {
  if (typeof hex !== 'string' || !/^(02|03)[0-9a-fA-F]{64}$/.test(hex))
    fail(`${label} must be a compressed public key`);
  const key = Buffer.from(hex, 'hex');
  try {
    Point.fromBytes(key);
  } catch (_error) {
    fail(`${label} is not a valid secp256k1 public key`);
  }
  return key;
}

function derivation(path, network, branch, label) {
  if (typeof path !== 'string') fail(`${label} must be a BIP84 path`);
  const match =
    /^m\/84'\/(0|1)'\/(0|[1-9][0-9]*)'\/([01])\/(0|[1-9][0-9]*)$/.exec(path);
  const expectedCoin = network === 'bitcoin' ? '0' : '1';
  if (
    !match ||
    match[1] !== expectedCoin ||
    (Array.isArray(branch)
      ? !branch.includes(Number(match[3]))
      : match[3] !== String(branch))
  )
    fail(`${label} must use the expected BIP84 network and branch`);
  const account = Number(match[2]);
  const index = Number(match[4]);
  if (
    !Number.isSafeInteger(account) ||
    account >= 0x80000000 ||
    !Number.isSafeInteger(index) ||
    index >= 0x80000000
  )
    fail(`${label} has an out-of-range child index`);
  return { path };
}

function fingerprint(hex, label) {
  if (typeof hex !== 'string' || !/^[0-9a-fA-F]{8}$/.test(hex))
    fail(`${label} must be 4-byte hex`);
  return Buffer.from(hex, 'hex');
}

function p2wpkhAddress(address, network, label) {
  if (typeof address !== 'string')
    fail(`${label} must be a native SegWit P2WPKH address`);
  let output;
  try {
    output = bitcoin.address.toOutputScript(address, network);
  } catch (_error) {
    fail(`${label} is invalid or for the wrong network`);
  }
  if (
    output.length !== 22 ||
    output[0] !== bitcoin.script.OPS.OP_0 ||
    output[1] !== 20
  )
    fail(`${label} must be native SegWit P2WPKH`);
  return output;
}

function p2wpkhScript(key) {
  return bitcoin.script.compile([
    bitcoin.script.OPS.OP_0,
    bitcoin.crypto.hash160(key),
  ]);
}

function prepareUnsignedPsbt(request) {
  exactKeys(request, REQUEST_KEYS, 'request');
  if (!['bitcoin', 'testnet'].includes(request.network))
    fail('network must be bitcoin or testnet');
  if (request.ownsInputs !== true)
    fail('caller must acknowledge input ownership');
  const network =
    request.network === 'bitcoin'
      ? bitcoin.networks.bitcoin
      : bitcoin.networks.testnet;
  if (!Array.isArray(request.inputs) || request.inputs.length === 0)
    fail('at least one input is required');
  if (request.inputs.length > 100) fail('at most 100 inputs are supported');
  const amountSats = amount(request.amountSats, 'amountSats');
  const feeSats = amount(request.feeSats, 'feeSats');
  if (amountSats < DUST_SATS) fail('recipient amount is dust');
  const recipientScript = p2wpkhAddress(
    request.recipientAddress,
    network,
    'recipientAddress',
  );
  const changeScript = p2wpkhAddress(
    request.changeAddress,
    network,
    'changeAddress',
  );
  const changeKey = publicKey(request.changePublicKeyHex, 'changePublicKeyHex');
  if (!p2wpkhScript(changeKey).equals(changeScript))
    fail('change address does not match supplied change public key');
  const changeDerivation = derivation(
    request.changePath,
    request.network,
    1,
    'changePath',
  );
  const changeFingerprint = fingerprint(
    request.changeMasterFingerprintHex,
    'changeMasterFingerprintHex',
  );

  let inputSats = 0;
  const seen = new Set();
  const normalized = request.inputs.map((input, index) => {
    exactKeys(input, INPUT_KEYS, `input ${index}`);
    if (typeof input.txid !== 'string' || !/^[0-9a-fA-F]{64}$/.test(input.txid))
      fail(`input ${index} has invalid txid`);
    if (
      !Number.isSafeInteger(input.vout) ||
      input.vout < 0 ||
      input.vout > 0xffffffff
    )
      fail(`input ${index} has invalid vout`);
    const outpoint = `${input.txid.toLowerCase()}:${input.vout}`;
    if (seen.has(outpoint)) fail('duplicate input outpoint');
    seen.add(outpoint);
    const valueSats = amount(input.valueSats, `input ${index} valueSats`);
    inputSats += valueSats;
    if (!Number.isSafeInteger(inputSats) || inputSats > MAX_MONEY)
      fail('input total exceeds Bitcoin supply');
    const key = publicKey(input.publicKeyHex, `input ${index} publicKeyHex`);
    const payment = { output: p2wpkhScript(key) };
    const keyDerivation = derivation(
      input.path,
      request.network,
      [0, 1],
      `input ${index} path`,
    );
    return {
      txid: input.txid.toLowerCase(),
      vout: input.vout,
      valueSats,
      key,
      payment,
      keyDerivation,
      fingerprint: fingerprint(
        input.masterFingerprintHex,
        `input ${index} masterFingerprintHex`,
      ),
    };
  });
  if (amountSats + feeSats > MAX_MONEY)
    fail('amount and fee exceed Bitcoin supply');
  if (inputSats < amountSats + feeSats)
    fail('inputs do not cover amount and fee');
  const changeSats = inputSats - amountSats - feeSats;
  if (changeSats !== 0 && changeSats < DUST_SATS)
    fail('change amount is dust; adjust the explicit amount or fee');

  const psbt = new bitcoin.Psbt({ network });
  for (const input of normalized) {
    psbt.addInput({
      hash: input.txid,
      index: input.vout,
      witnessUtxo: { script: input.payment.output, value: input.valueSats },
      bip32Derivation: [
        {
          masterFingerprint: input.fingerprint,
          pubkey: input.key,
          path: input.keyDerivation.path,
        },
      ],
    });
  }
  psbt.addOutput({ script: recipientScript, value: amountSats });
  if (changeSats > 0) {
    psbt.addOutput({
      script: changeScript,
      value: changeSats,
      bip32Derivation: [
        {
          masterFingerprint: changeFingerprint,
          pubkey: changeKey,
          path: changeDerivation.path,
        },
      ],
    });
  }
  return {
    psbtBase64: psbt.toBase64(),
    summary: {
      network: request.network,
      inputCount: normalized.length,
      inputSats,
      recipientAddress: request.recipientAddress,
      amountSats,
      changeAddress: request.changeAddress,
      changeSats,
      feeSats,
    },
  };
}

module.exports = { prepareUnsignedPsbt };
