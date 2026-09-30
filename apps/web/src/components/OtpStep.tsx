import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { Field } from './Field';
import { ErrorText } from './ErrorText';

export function OtpStep({
  email,
  onVerified,
}: {
  email: string;
  onVerified: () => void;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api.post('/auth/verify-otp', { email, code: code.trim() });
      onVerified();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setErr(null);
    setResent(false);
    setBusy(true);
    try {
      await api.post('/auth/resend-otp', { email });
      setResent(true);
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card card">
      <h1>{t('auth.otpTitle')}</h1>
      <p className="muted">{t('auth.otpHint', { email })}</p>
      <form onSubmit={submit}>
        <Field label={t('auth.otpCode')}>
          <input
            className="input"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </Field>
        <ErrorText err={err} />
        {resent && <p className="muted small">{t('auth.otpResent')}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {t('auth.otpVerify')}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={resend}>
          {t('auth.otpResend')}
        </button>
      </form>
    </div>
  );
}
