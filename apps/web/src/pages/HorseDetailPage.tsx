import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { Horse } from '../lib/types';
import { ErrorText } from '../components/ErrorText';
import { formatDate } from '../lib/format';
import { SessionsTab } from './horse/SessionsTab';
import { HealthTab } from './horse/HealthTab';

type Tab = 'sessions' | 'health';

export function HorseDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const [horse, setHorse] = useState<Horse | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const tab: Tab = params.get('tab') === 'health' ? 'health' : 'sessions';
  const setTab = (next: Tab) =>
    setParams(next === 'health' ? { tab: 'health' } : {}, { replace: true });

  useEffect(() => {
    let active = true;
    api
      .get<Horse>(`/horses/${id}`)
      .then((r) => {
        if (!active) return;
        setHorse(r.data);
        setErr(null);
      })
      .catch((e) => {
        if (active) setErr(e);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const showing = horse && horse.id === id ? horse : null;

  if (err && !showing) {
    return (
      <div className="stack">
        <p>
          <Link to="/horses">← {t('nav.horses')}</Link>
        </p>
        <ErrorText err={err} />
      </div>
    );
  }
  if (!showing) return <p className="muted">…</p>;

  return (
    <div className="stack">
      <p>
        <Link to="/horses">← {t('nav.horses')}</Link>
      </p>
      <div className="card">
        <h1>{showing.name}</h1>
        <dl className="kv">
          <div>
            <dt>{t('horse.breed')}</dt>
            <dd>{showing.breed ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('horse.birthDate')}</dt>
            <dd>{formatDate(showing.birthDate)}</dd>
          </div>
          <div>
            <dt>{t('horse.owner')}</dt>
            <dd>{showing.owner.name}</dd>
          </div>
          <div>
            <dt>{t('horse.status')}</dt>
            <dd>
              <span className="tag">{showing.status}</span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={tab === 'sessions' ? 'tab active' : 'tab'}
          onClick={() => setTab('sessions')}
        >
          {t('tab.sessions')}
        </button>
        <button
          type="button"
          className={tab === 'health' ? 'tab active' : 'tab'}
          onClick={() => setTab('health')}
        >
          {t('tab.health')}
        </button>
      </div>

      {tab === 'sessions' ? (
        <SessionsTab horseId={showing.id} />
      ) : (
        <HealthTab horseId={showing.id} />
      )}
    </div>
  );
}
