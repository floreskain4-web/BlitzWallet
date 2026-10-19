import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import { prepareUnsignedPsbt } from '../../functions/bitcoin/prepareUnsignedPsbt';

const Txt = ({ children, style, ...props }) => (
  <ThemeText content={children} styles={style} {...props} />
);

const SAMPLE =
  '{\n  "network": "testnet",\n  "inputs": [{"txid":"<public-txid>","vout":0,"valueSats":10000,"publicKeyHex":"<compressed-public-key-hex>","masterFingerprintHex":"<fingerprint-hex>","path":"m/84\'/1\'/0\'/0/0"}],\n  "recipientAddress":"<testnet-native-segwit-address>","amountSats":8000,\n  "changeAddress":"<testnet-change-address>","changePublicKeyHex":"<compressed-change-public-key-hex>","changeMasterFingerprintHex":"<fingerprint-hex>","changePath":"m/84\'/1\'/0\'/1/0","feeSats":500\n}';

export default function PrepareHardwareWalletPsbt() {
  const { t } = useTranslation();
  const { theme } = useGlobalThemeContext();
  const tr = key => t(`hardwareWalletPsbt.${key}`);
  const [raw, setRaw] = useState('');
  const [ownsInputs, setOwnsInputs] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setResult(null);
    setReviewed(false);
    setError('');
  }, [raw]);
  const parsed = useMemo(() => {
    try {
      return raw.trim() ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }, [raw]);
  const acknowledgeOwnership = () => {
    setOwnsInputs(v => !v);
    setResult(null);
    setReviewed(false);
    setError('');
  };
  const prepare = async () => {
    setError('');
    setResult(null);
    setReviewed(false);
    if (!parsed || !ownsInputs) {
      setError(tr(!ownsInputs ? 'ownershipRequired' : 'invalidJson'));
      return;
    }
    setBusy(true);
    try {
      const request = { ...parsed, ownsInputs: true };
      const output = prepareUnsignedPsbt(request);
      if (!output?.psbtBase64 || !output?.summary)
        throw new Error(tr('prepareFailed'));
      setResult(output);
    } catch (_) {
      setError(tr('prepareFailed'));
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    if (!result || !reviewed || !ownsInputs) return;
    try {
      await Clipboard.setStringAsync(result.psbtBase64);
    } catch (_) {
      setError(tr('copyFailed'));
    }
  };
  const s = result?.summary;
  const row = (label, value) => (
    <View style={styles.row} key={label}>
      <Txt>{label}</Txt>
      <Txt selectable>{String(value)}</Txt>
    </View>
  );
  return (
    <GlobalThemeView styles={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Txt style={styles.warning}>{tr('warning')}</Txt>
        <Txt>{tr('intro')}</Txt>
        <TextInput
          testID="hardware-psbt-json"
          accessibilityLabel={tr('jsonLabel')}
          multiline
          value={raw}
          onChangeText={value => {
            setResult(null);
            setReviewed(false);
            setOwnsInputs(false);
            setError('');
            setRaw(value);
          }}
          placeholder={SAMPLE}
          placeholderTextColor={theme ? '#999' : '#666'}
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.input,
            {
              color: theme ? '#fff' : '#111',
              borderColor: theme ? '#777' : '#888',
            },
          ]}
        />
        <Txt style={styles.note}>{tr('sampleNote')}</Txt>
        <TouchableOpacity
          accessibilityRole="checkbox"
          testID="hardware-psbt-ownership"
          accessibilityLabel={tr('ownership')}
          accessibilityState={{ checked: ownsInputs }}
          onPress={acknowledgeOwnership}
          style={styles.check}
        >
          <Txt>
            {ownsInputs ? '☑' : '☐'} {tr('ownership')}
          </Txt>
        </TouchableOpacity>
        <TouchableOpacity
          testID="hardware-psbt-prepare"
          accessibilityLabel={tr('prepare')}
          accessibilityRole="button"
          disabled={busy || !ownsInputs || !parsed}
          onPress={prepare}
          style={[
            styles.button,
            (busy || !ownsInputs || !parsed) && styles.disabled,
          ]}
        >
          <Txt>{busy ? tr('preparing') : tr('prepare')}</Txt>
        </TouchableOpacity>
        {!!error && (
          <Txt accessibilityRole="alert" style={styles.error}>
            {error}
          </Txt>
        )}
        {s && (
          <View style={styles.summary}>
            <Txt style={styles.heading}>{tr('summaryTitle')}</Txt>
            {row(tr('network'), s.network)}
            {row(tr('inputCount'), s.inputCount)}
            {row(tr('inputSats'), `${s.inputSats} sats`)}
            {(parsed?.inputs || []).map((input, index) =>
              row(
                `${tr('input')} ${index + 1}`,
                `${input.txid}:${input.vout} · ${input.valueSats} sats · ${input.path} · ${input.publicKeyHex}`,
              ),
            )}
            {row(tr('recipient'), s.recipientAddress)}
            {row(tr('amount'), `${s.amountSats} sats`)}
            {row(
              tr('changeAddress'),
              s.changeSats === 0 ? tr('noChange') : s.changeAddress,
            )}
            {row(tr('changeSats'), `${s.changeSats} sats`)}
            {row(tr('fee'), `${s.feeSats} sats`)}
            <Txt style={styles.warning}>{tr('verifyWarning')}</Txt>
            <TouchableOpacity
              accessibilityRole="checkbox"
              testID="hardware-psbt-review"
              accessibilityLabel={tr('review')}
              accessibilityState={{ checked: reviewed }}
              onPress={() => setReviewed(v => !v)}
              style={styles.check}
            >
              <Txt>
                {reviewed ? '☑' : '☐'} {tr('review')}
              </Txt>
            </TouchableOpacity>
            {reviewed && ownsInputs && (
              <>
                <Txt selectable style={styles.outputLabel}>
                  {tr('unsignedPsbt')}
                </Txt>
                <TextInput
                  editable={false}
                  multiline
                  selectTextOnFocus
                  value={result.psbtBase64}
                  style={styles.output}
                  accessibilityLabel={tr('unsignedPsbt')}
                />
                <TouchableOpacity
                  testID="hardware-psbt-copy"
                  accessibilityLabel={tr('copy')}
                  accessibilityRole="button"
                  onPress={copy}
                  style={styles.button}
                >
                  <Txt>{tr('copy')}</Txt>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </GlobalThemeView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, gap: 14, paddingBottom: 36 },
  warning: { fontWeight: '700' },
  input: {
    minHeight: 180,
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 8,
    padding: 12,
    textAlignVertical: 'top',
  },
  note: { fontSize: 12 },
  check: { paddingVertical: 10 },
  button: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#888',
  },
  disabled: { opacity: 0.45 },
  error: { color: '#c00' },
  summary: { gap: 10, paddingTop: 12 },
  heading: { fontWeight: '700', fontSize: 18 },
  row: {
    gap: 4,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#888',
  },
  output: { minHeight: 100, borderWidth: 1, borderColor: '#888', padding: 10 },
  outputLabel: { fontWeight: '700' },
});
