import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { HealthRecord, Paginated } from '../../lib/types';
import { useAuth } from '../../auth/useAuth';
import { Field } from '../../components/Field';
import { ErrorText } from '../../components/ErrorText';
import { formatDate } from '../../lib/format';

export function HealthTab({ horseId }: { horseId: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isVet = user?.role === 'VET';

  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [err, setErr] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Paginated<HealthRecord>>(
        `/horses/${horseId}/health-records`,
        { params: { limit: 100 } },
      );
      setRecords(res.data.data);
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
      {isVet && <CreateRecordForm horseId={horseId} onCreated={load} />}

      {loading ? (
        <p className="muted">…</p>
      ) : err ? (
        <ErrorText err={err} />
      ) : records.length === 0 ? (
        <p className="muted">{t('health.empty')}</p>
      ) : (
        <ul className="list">
          {records.map((r) => (
            <RecordItem
              key={r.id}
              record={r}
              isVet={isVet}
              onChanged={load}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateRecordForm({
  horseId,
  onCreated,
}: {
  horseId: string;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [examDate, setExamDate] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api.post(`/horses/${horseId}/health-records`, {
        examDate: new Date(examDate).toISOString(),
        diagnosis: diagnosis.trim(),
        ...(treatment.trim() ? { treatment: treatment.trim() } : {}),
      });
      setExamDate('');
      setDiagnosis('');
      setTreatment('');
      onCreated();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form-grid" onSubmit={submit}>
      <h2>{t('health.new')}</h2>
      <Field label={t('health.examDate')}>
        <input
          className="input"
          type="date"
          value={examDate}
          onChange={(e) => setExamDate(e.target.value)}
          required
        />
      </Field>
      <Field label={t('health.diagnosis')}>
        <textarea
          className="input"
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          rows={2}
          required
        />
      </Field>
      <Field label={t('health.treatment')}>
        <textarea
          className="input"
          value={treatment}
          onChange={(e) => setTreatment(e.target.value)}
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

function RecordItem({
  record,
  isVet,
  onChanged,
}: {
  record: HealthRecord;
  isVet: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [diagnosis, setDiagnosis] = useState(record.diagnosis);
  const [treatment, setTreatment] = useState(record.treatment ?? '');
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const body: Record<string, unknown> = {};
    if (diagnosis.trim() !== record.diagnosis) body.diagnosis = diagnosis.trim();
    if (treatment.trim() !== (record.treatment ?? ''))
      body.treatment = treatment.trim() || null;
    try {
      await api.patch(`/health-records/${record.id}`, body);
      setEditing(false);
      onChanged();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  const upload = async (e: FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setErr(null);
    setBusy(true);
    const form = new FormData();
    form.append('file', file);
    try {
      await api.post(`/health-records/${record.id}/attachment`, form);
      if (fileRef.current) fileRef.current.value = '';
      onChanged();
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    if (!record.attachmentPath) return;
    setErr(null);
    try {
      const res = await api.get(`/files/${record.attachmentPath}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data as Blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e2) {
      setErr(e2);
    }
  };

  return (
    <li className="card">
      <div className="item-head">
        <strong>{formatDate(record.examDate)}</strong>
        <span className="muted small">{record.vet.name}</span>
      </div>
      <div className="small">
        <b>{t('health.diagnosis')}:</b> {record.diagnosis}
      </div>
      {record.treatment && (
        <div className="small">
          <b>{t('health.treatment')}:</b> {record.treatment}
        </div>
      )}
      <div className="row mt">
        {record.attachmentPath && (
          <button type="button" className="btn small-btn" onClick={download}>
            {t('health.openAttachment')}
          </button>
        )}
        {isVet && !editing && (
          <button
            type="button"
            className="btn small-btn"
            onClick={() => setEditing(true)}
          >
            {t('common.update')}
          </button>
        )}
      </div>

      {isVet && (
        <form className="row mt" onSubmit={upload}>
          <input
            ref={fileRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            className="input"
          />
          <button type="submit" className="btn small-btn" disabled={busy}>
            {t('health.uploadAttachment')}
          </button>
        </form>
      )}

      {editing && (
        <form className="form-grid mt" onSubmit={save}>
          <Field label={t('health.diagnosis')}>
            <textarea
              className="input"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              rows={2}
            />
          </Field>
          <Field label={t('health.treatment')}>
            <textarea
              className="input"
              value={treatment}
              onChange={(e) => setTreatment(e.target.value)}
              rows={2}
            />
          </Field>
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
      <ErrorText err={err} />
    </li>
  );
}
