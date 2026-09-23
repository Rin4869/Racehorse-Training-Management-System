import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { Paginated, TrainingSession } from '../../lib/types';
import { useAuth } from '../../auth/useAuth';
import { Field } from '../../components/Field';
import { ErrorText } from '../../components/ErrorText';
import { formatDateTime } from '../../lib/format';

export function SessionsTab({ horseId }: { horseId: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const role = user?.role;
  const canCreate = role === 'TRAINER';
  const canUpdate = role === 'TRAINER' || role === 'GROOM';

  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Paginated<TrainingSession>>(
        `/horses/${horseId}/sessions`,
        { params: { limit: 100 } },
      );
      setSessions(res.data.data);
      setErr(null);
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }, [horseId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="stack">
      {canCreate && <CreateSessionForm horseId={horseId} onCreated={load} />}

      {loading ? (
        <p className="muted">…</p>
      ) : err ? (
        <ErrorText err={err} />
      ) : sessions.length === 0 ? (
        <p className="muted">{t('session.empty')}</p>
      ) : (
        <ul className="list">
          {sessions.map((s) => (
            <SessionItem
              key={s.id}
              session={s}
              canUpdate={canUpdate}
              isTrainer={role === 'TRAINER'}
              onChanged={load}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateSessionForm({
  horseId,
  onCreated,
}: {
  horseId: string;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [scheduledAt, setScheduledAt] = useState('');
  const [type, setType] = useState('');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api.post(`/horses/${horseId}/sessions`, {
        scheduledAt: new Date(scheduledAt).toISOString(),
        type: type.trim(),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setScheduledAt('');
      setType('');
      setNotes('');
      onCreated();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form-grid" onSubmit={submit}>
      <h2>{t('session.new')}</h2>
      <Field label={t('session.scheduledAt')}>
        <input
          className="input"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          required
        />
      </Field>
      <Field label={t('session.type')}>
        <input
          className="input"
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder="gallop, sprint, trot…"
          required
        />
      </Field>
      <Field label={t('session.notes')}>
        <textarea
          className="input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </Field>
      <ErrorText err={err} />
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {t('common.create')}
      </button>
    </form>
  );
}

function SessionItem({
  session,
  canUpdate,
  isTrainer,
  onChanged,
}: {
  session: TrainingSession;
  canUpdate: boolean;
  isTrainer: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<'DONE' | 'CANCELLED' | ''>('');
  const [resultMetric, setResultMetric] = useState(session.resultMetric ?? '');
  const [resultValue, setResultValue] = useState(
    session.resultValue?.toString() ?? '',
  );
  const [notes, setNotes] = useState(session.notes ?? '');
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const editable = canUpdate && session.status === 'PLANNED';

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const body: Record<string, unknown> = {};
    if (status) body.status = status;
    if (resultMetric.trim()) body.resultMetric = resultMetric.trim();
    if (resultValue.trim()) body.resultValue = Number(resultValue);
    if (isTrainer && notes !== (session.notes ?? '')) body.notes = notes.trim();
    try {
      await api.patch(`/sessions/${session.id}`, body);
      setEditing(false);
      onChanged();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="card">
      <div className="item-head">
        <strong>{session.type}</strong>
        <span className="tag">{session.status}</span>
      </div>
      <div className="muted small">
        {formatDateTime(session.scheduledAt)} · {session.trainer.name}
      </div>
      {(session.resultMetric || session.resultValue != null) && (
        <div className="small">
          {t('session.result')}: {session.resultMetric ?? '—'} ={' '}
          {session.resultValue ?? '—'}
        </div>
      )}
      {session.notes && <div className="small">{session.notes}</div>}

      {editable && !editing && (
        <button
          type="button"
          className="btn small-btn"
          onClick={() => setEditing(true)}
        >
          {t('common.update')}
        </button>
      )}

      {editing && (
        <form className="form-grid mt" onSubmit={save}>
          <Field label={t('session.status')}>
            <select
              className="input"
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as 'DONE' | 'CANCELLED' | '')
              }
            >
              <option value="">{t('session.keepPlanned')}</option>
              <option value="DONE">DONE</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </Field>
          <Field label={t('session.resultMetric')}>
            <input
              className="input"
              value={resultMetric}
              onChange={(e) => setResultMetric(e.target.value)}
              placeholder="time_1200m_s"
            />
          </Field>
          <Field label={t('session.resultValue')}>
            <input
              className="input"
              type="number"
              step="any"
              value={resultValue}
              onChange={(e) => setResultValue(e.target.value)}
            />
          </Field>
          {isTrainer && (
            <Field label={t('session.notes')}>
              <textarea
                className="input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </Field>
          )}
          <ErrorText err={err} />
          <div className="row">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {t('common.save')}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setEditing(false)}
              disabled={busy}
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
