import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { Field } from '../components/Field';
import { ErrorText } from '../components/ErrorText';

export function RegisterPage() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const [step, setStep] = useState<'form' | 'otp' | 'done'>('form');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api.post('/auth/register', {
        name: name.trim(),
        email: email.trim(),
        password,
      });
      setStep('otp');
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="auth-card card">
        <h1>{t('auth.register')}</h1>
        <p>{t('auth.registerDone')}</p>
        <p className="muted">
          <Link to="/login">{t('auth.login')}</Link>
        </p>
      </div>
    );
  }

  if (step === 'otp') {
    return <OtpStep email={email.trim()} onVerified={() => setStep('done')} />;
  }

  return (
    <div className="auth-card card">
      <h1>{t('auth.register')}</h1>
      <form onSubmit={submit}>
        <Field label={t('auth.name')}>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>
        <Field label={t('auth.email')}>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label={t('auth.password')} hint={t('auth.passwordHint')}>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <ErrorText err={err} />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {t('auth.register')}
        </button>
      </form>
      <p className="muted">
        <Link to="/login">{t('auth.login')}</Link>
      </p>
    </div>
  );
}

function OtpStep({
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
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={resend}
        >
          {t('auth.otpResend')}
        </button>
      </form>
    </div>
  );
}
