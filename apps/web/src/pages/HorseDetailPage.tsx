import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { Horse } from '../lib/types';
import { ErrorText } from '../components/ErrorText';
import { formatDate } from '../lib/format';
import { SessionsTab } from './horse/SessionsTab';
import { HealthTab } from './horse/HealthTab';
import { PedigreeTab } from './horse/PedigreeTab';

type Tab = 'sessions' | 'health' | 'pedigree';

export function HorseDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const [horse, setHorse] = useState<Horse | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const requestedTab = params.get('tab');
  const tab: Tab =
    requestedTab === 'health' || requestedTab === 'pedigree'
      ? requestedTab
      : 'sessions';
  const setTab = (next: Tab) => {
    const nextParams = new URLSearchParams(params);
    if (next === 'sessions') nextParams.delete('tab');
    else nextParams.set('tab', next);
    setParams(nextParams, { replace: true });
  };
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
        <button
          type="button"
          className={
            tab === 'pedigree'
              ? 'tab active pedigree-tab-button'
              : 'tab pedigree-tab-button'
          }
          onClick={() => setTab('pedigree')}
        >
          {t('tab.pedigree')}
        </button>
      </div>

      {tab === 'sessions' && <SessionsTab horseId={showing.id} />}
      {tab === 'health' && <HealthTab horseId={showing.id} />}
      {tab === 'pedigree' && <PedigreeTab horseId={showing.id} />}
    </div>
  );
}
