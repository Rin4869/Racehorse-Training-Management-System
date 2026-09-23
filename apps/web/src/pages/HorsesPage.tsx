import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { Horse, Paginated, User } from '../lib/types';
import { useAuth } from '../auth/useAuth';
import { Field } from '../components/Field';
import { ErrorText } from '../components/ErrorText';
import { formatDate } from '../lib/format';

export function HorsesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isManager = user?.role === 'MANAGER';

  const [horses, setHorses] = useState<Horse[]>([]);
  const [loadErr, setLoadErr] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Paginated<Horse>>('/horses', {
        params: { limit: 100 },
      });
      setHorses(res.data.data);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="stack">
      <h1>{t('nav.horses')}</h1>

      {isManager && <CreateHorseForm onCreated={load} />}

      {loading ? (
        <p className="muted">…</p>
      ) : loadErr ? (
        <ErrorText err={loadErr} />
      ) : horses.length === 0 ? (
        <p className="muted">{t('horse.empty')}</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t('horse.name')}</th>
              <th>{t('horse.breed')}</th>
              <th>{t('horse.birthDate')}</th>
              <th>{t('horse.owner')}</th>
              <th>{t('horse.status')}</th>
            </tr>
          </thead>
          <tbody>
            {horses.map((h) => (
              <tr key={h.id}>
                <td>
                  <Link to={`/horses/${h.id}`}>{h.name}</Link>
                </td>
                <td>{h.breed ?? '—'}</td>
                <td>{formatDate(h.birthDate)}</td>
                <td>{h.owner.name}</td>
                <td>
                  <span className="tag">{h.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CreateHorseForm({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation();
  const [owners, setOwners] = useState<User[]>([]);
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api
      .get<Paginated<User>>('/users', { params: { role: 'OWNER', limit: 100 } })
      .then((r) => setOwners(r.data.data))
      .catch(() => setOwners([]));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api.post('/horses', {
        name: name.trim(),
        ownerId,
        ...(breed.trim() ? { breed: breed.trim() } : {}),
        ...(birthDate ? { birthDate: new Date(birthDate).toISOString() } : {}),
      });
      setName('');
      setBreed('');
      setBirthDate('');
      setOwnerId('');
      setOpen(false);
      onCreated();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-primary self-start"
        onClick={() => setOpen(true)}
      >
        {t('horse.new')}
      </button>
    );
  }

  return (
    <form className="card form-grid" onSubmit={submit}>
      <h2>{t('horse.new')}</h2>
      <Field label={t('horse.name')}>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </Field>
      <Field label={t('horse.breed')}>
        <input
          className="input"
          value={breed}
          onChange={(e) => setBreed(e.target.value)}
        />
      </Field>
      <Field label={t('horse.birthDate')}>
        <input
          className="input"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
        />
      </Field>
      <Field label={t('horse.owner')}>
        <select
          className="input"
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          required
        >
          <option value="" disabled>
            —
          </option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.email})
            </option>
          ))}
        </select>
      </Field>
      <ErrorText err={err} />
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {t('common.create')}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => setOpen(false)}
          disabled={busy}
        >
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}
