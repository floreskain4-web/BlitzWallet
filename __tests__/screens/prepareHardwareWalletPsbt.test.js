/* eslint-env jest */
import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import PrepareHardwareWalletPsbt from '../../app/screens/inAccount/prepareHardwareWalletPsbt';

const mockCopy = jest.fn().mockResolvedValue(undefined);
const mockPrepare = jest.fn();
jest.mock('expo-clipboard', () => ({
  setStringAsync: (...args) => mockCopy(...args),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: key => key }),
}));
jest.mock('../../context-store/theme', () => ({
  useGlobalThemeContext: () => ({ theme: false }),
}));
jest.mock('../../app/functions/CustomElements', () => ({
  GlobalThemeView: ({ children }) => children,
  ThemeText: ({ content }) => content,
}));
jest.mock('../../app/functions/bitcoin/prepareUnsignedPsbt', () => ({
  prepareUnsignedPsbt: (...args) => mockPrepare(...args),
}));

const request = {
  network: 'testnet',
  inputs: [
    {
      txid: 'public-outpoint',
      vout: 0,
      valueSats: 10000,
      path: "m/84'/1'/0'/0/0",
      publicKeyHex: 'public-key',
    },
  ],
};
const result = {
  psbtBase64: 'unsigned-psbt-only',
  summary: {
    network: 'testnet',
    inputCount: 1,
    inputSats: 10000,
    recipientAddress: 'recipient',
    amountSats: 8000,
    changeAddress: 'change',
    changeSats: 1500,
    feeSats: 500,
  },
};
let tree;
const byId = id =>
  tree.root.findAll(
    node => node.props.testID === id && typeof node.type !== 'string',
  )[0];
const exists = id => !!byId(id);
const press = async id => {
  await act(async () => {
    await byId(id).props.onPress();
  });
};
const enter = async value => {
  await act(async () => {
    byId('hardware-psbt-json').props.onChangeText(value);
  });
};

beforeEach(async () => {
  jest.clearAllMocks();
  mockPrepare.mockReturnValue(result);
  await act(async () => {
    tree = Renderer.create(<PrepareHardwareWalletPsbt />);
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
});

test('requires ownership, then separate review before explicit clipboard export', async () => {
  await enter(JSON.stringify(request));
  expect(byId('hardware-psbt-prepare').props.disabled).toBe(true);
  await press('hardware-psbt-ownership');
  await press('hardware-psbt-prepare');
  expect(mockPrepare).toHaveBeenCalledWith({ ...request, ownsInputs: true });
  expect(exists('hardware-psbt-copy')).toBe(false);
  expect(mockCopy).not.toHaveBeenCalled();
  await press('hardware-psbt-review');
  expect(mockCopy).not.toHaveBeenCalled();
  await press('hardware-psbt-copy');
  expect(mockCopy).toHaveBeenCalledWith(result.psbtBase64);
});

test('editing the request clears output and both acknowledgments', async () => {
  await enter(JSON.stringify(request));
  await press('hardware-psbt-ownership');
  await press('hardware-psbt-prepare');
  await press('hardware-psbt-review');
  await enter(JSON.stringify({ ...request, amountSats: 9000 }));
  expect(exists('hardware-psbt-copy')).toBe(false);
  expect(exists('hardware-psbt-review')).toBe(false);
  expect(byId('hardware-psbt-ownership').props.accessibilityState.checked).toBe(
    false,
  );
  expect(mockCopy).not.toHaveBeenCalled();
});

test('revoking ownership invalidates a reviewed export', async () => {
  await enter(JSON.stringify(request));
  await press('hardware-psbt-ownership');
  await press('hardware-psbt-prepare');
  await press('hardware-psbt-review');
  await press('hardware-psbt-ownership');
  expect(exists('hardware-psbt-copy')).toBe(false);
  expect(exists('hardware-psbt-review')).toBe(false);
});

test('preparation failure does not reveal caller-controlled errors or permit export', async () => {
  mockPrepare.mockImplementation(() => {
    throw new Error('sensitive pasted value');
  });
  await enter(JSON.stringify(request));
  await press('hardware-psbt-ownership');
  await press('hardware-psbt-prepare');
  expect(JSON.stringify(tree.toJSON())).not.toContain('sensitive pasted value');
  expect(exists('hardware-psbt-copy')).toBe(false);
});
