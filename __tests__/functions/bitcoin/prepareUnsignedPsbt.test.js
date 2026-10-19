jest.mock('@craftzdog/react-native-buffer', () => require('node:buffer'));

const bitcoin = require('bitcoinjs-lib');
const {
  prepareUnsignedPsbt,
} = require('../../../app/functions/bitcoin/prepareUnsignedPsbt');

const pubKey =
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const fingerprint = 'deadbeef';
const testRequest = () => {
  const network = bitcoin.networks.bitcoin;
  const address = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(pubKey, 'hex'),
    network,
  }).address;
  const changeAddress = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(pubKey, 'hex'),
    network,
  }).address;
  return {
    network: 'bitcoin',
    inputs: [
      {
        txid: '11'.repeat(32),
        vout: 0,
        valueSats: 10000,
        publicKeyHex: pubKey,
        masterFingerprintHex: fingerprint,
        path: "m/84'/0'/0'/0/0",
      },
    ],
    recipientAddress: address,
    amountSats: 5000,
    changeAddress,
    changePublicKeyHex: pubKey,
    changeMasterFingerprintHex: fingerprint,
    changePath: "m/84'/0'/0'/1/0",
    feeSats: 500,
    ownsInputs: true,
  };
};

describe('prepareUnsignedPsbt', () => {
  test('creates a round-trippable unsigned PSBT with every input and explicit fee', () => {
    const result = prepareUnsignedPsbt(testRequest());
    const psbt = bitcoin.Psbt.fromBase64(result.psbtBase64);
    expect(result.summary).toEqual({
      network: 'bitcoin',
      inputCount: 1,
      inputSats: 10000,
      recipientAddress: testRequest().recipientAddress,
      amountSats: 5000,
      changeAddress: testRequest().changeAddress,
      changeSats: 4500,
      feeSats: 500,
    });
    expect(psbt.data.inputs).toHaveLength(1);
    expect(psbt.data.inputs[0].partialSig).toBeUndefined();
    expect(psbt.data.inputs[0].finalScriptSig).toBeUndefined();
    expect(psbt.data.inputs[0].finalScriptWitness).toBeUndefined();
    expect(psbt.data.inputs[0].bip32Derivation).toHaveLength(1);
    expect(psbt.data.outputs).toHaveLength(2);
    expect(psbt.data.outputs[1].bip32Derivation).toHaveLength(1);
  });

  test('permits exact spend with no change', () => {
    const request = testRequest();
    request.amountSats = 9500;
    expect(prepareUnsignedPsbt(request).summary.changeSats).toBe(0);
  });

  test.each([
    [
      'ownership acknowledgement',
      r => {
        r.ownsInputs = false;
      },
    ],
    [
      'unknown sensitive field',
      r => {
        r.seedPhrase = 'never';
      },
    ],
    [
      'unknown input field',
      r => {
        r.inputs[0].privateKey = 'never';
      },
    ],
    [
      'duplicate outpoint',
      r => {
        r.inputs.push({ ...r.inputs[0] });
      },
    ],
    [
      'wrong derivation purpose',
      r => {
        r.inputs[0].path = "m/44'/0'/0'/0/0";
      },
    ],
    [
      'wrong network coin type',
      r => {
        r.inputs[0].path = "m/84'/1'/0'/0/0";
      },
    ],
    [
      'invalid public key',
      r => {
        r.inputs[0].publicKeyHex = '04' + '00'.repeat(64);
      },
    ],
    [
      'wrong change script',
      r => {
        r.changeAddress = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
      },
    ],
    [
      'dust recipient',
      r => {
        r.amountSats = 293;
      },
    ],
    [
      'dust change',
      r => {
        r.amountSats = 9500;
        r.feeSats = 207;
      },
    ],
    [
      'insufficient funds',
      r => {
        r.feeSats = 5001;
      },
    ],
    [
      'unsafe amount',
      r => {
        r.amountSats = Number.MAX_SAFE_INTEGER + 1;
      },
    ],
    [
      'unknown network',
      r => {
        r.network = 'regtest';
      },
    ],
    [
      'missing required input',
      r => {
        r.inputs = [];
      },
    ],
    [
      'malformed txid',
      r => {
        r.inputs[0].txid = '12';
      },
    ],
  ])('rejects %s', (_name, mutate) => {
    const request = testRequest();
    mutate(request);
    expect(() => prepareUnsignedPsbt(request)).toThrow();
  });
});

test('serializes all selected inputs, exact outputs, and an explicit fee without signing', () => {
  const request = testRequest();
  request.inputs.push({
    ...request.inputs[0],
    txid: '22'.repeat(32),
    path: "m/84'/0'/0'/1/7",
  });
  const psbt = bitcoin.Psbt.fromBase64(prepareUnsignedPsbt(request).psbtBase64);
  expect(psbt.txInputs).toHaveLength(2);
  expect(psbt.txOutputs.map(output => output.value)).toEqual([5000, 14500]);
  expect(psbt.txOutputs[0].address).toBe(request.recipientAddress);
  expect(psbt.txOutputs[1].address).toBe(request.changeAddress);
  expect(
    psbt.data.inputs.reduce((sum, input) => sum + input.witnessUtxo.value, 0) -
      psbt.txOutputs.reduce((sum, output) => sum + output.value, 0),
  ).toBe(500);
  for (const input of psbt.data.inputs) {
    expect(input.partialSig).toBeUndefined();
    expect(input.finalScriptWitness).toBeUndefined();
    expect(input.finalScriptSig).toBeUndefined();
  }
});

test('supports a complete testnet request', () => {
  const request = testRequest();
  request.network = 'testnet';
  request.inputs[0].path = "m/84'/1'/0'/0/0";
  request.changePath = "m/84'/1'/0'/1/0";
  const address = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(pubKey, 'hex'),
    network: bitcoin.networks.testnet,
  }).address;
  request.recipientAddress = address;
  request.changeAddress = address;
  expect(prepareUnsignedPsbt(request).summary.network).toBe('testnet');
});

test.each([
  [
    'non-curve compressed point',
    r => {
      r.inputs[0].publicKeyHex = '02' + 'ff'.repeat(32);
    },
  ],
  [
    'wrong-network recipient',
    r => {
      r.network = 'testnet';
    },
  ],
  [
    'fractional value',
    r => {
      r.inputs[0].valueSats = 1.5;
    },
  ],
  [
    'invalid fingerprint',
    r => {
      r.inputs[0].masterFingerprintHex = 'dead';
    },
  ],
  [
    'negative output index',
    r => {
      r.inputs[0].vout = -1;
    },
  ],
  [
    'input-count bound',
    r => {
      r.inputs = Array.from({ length: 101 }, () => ({ ...r.inputs[0] }));
    },
  ],
  [
    'supply overflow',
    r => {
      r.inputs[0].valueSats = 2100000000000000;
      r.inputs.push({ ...r.inputs[0], txid: '33'.repeat(32) });
    },
  ],
  [
    'change receive branch',
    r => {
      r.changePath = "m/84'/0'/0'/0/0";
    },
  ],
])('rejects %s', (_name, mutate) => {
  const request = testRequest();
  mutate(request);
  expect(() => prepareUnsignedPsbt(request)).toThrow();
});
