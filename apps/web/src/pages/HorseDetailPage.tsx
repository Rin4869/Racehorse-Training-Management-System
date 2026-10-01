import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { Horse } from '../lib/types';
import { ErrorText } from '../components/ErrorText';
import { formatDate } from '../lib/format';
import { SessionsTab } from './horse/SessionsTab';
import { HealthTab } from './horse/HealthTab';
import { useAuth } from '../auth/useAuth';
import { HorseRecordNav } from './HorseFlowPages';

type Tab = 'sessions' | 'health';

export function HorseDetailPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
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
    <div className="horse-workspace">
      <HorseBackHeader horseId={showing.id} canEdit={user?.role === 'MANAGER'} />
      <HorseProfileHero horse={showing} />
      <HorseStatGrid horse={showing} />
      <HorseRecordNav horseId={showing.id} />
      <HorseProfileDetails horse={showing} />
      <HorseTabSwitcher tab={tab} onTabChange={setTab} />
      {tab === 'sessions' ? <SessionsTab horseId={showing.id} /> : <HealthTab horseId={showing.id} />}
    </div>
  );
}

function HorseBackHeader({ horseId, canEdit }: { horseId: string; canEdit: boolean }) {
  const { t } = useTranslation();

  return (
    <div className="horse-back-row">
      <Link to="/horses">← {t('horseFlow.backToDirectory')}</Link>
      {canEdit && (
        <Link className="btn" to={`/horses/${horseId}/edit`}>
          {t('horseFlow.editHorse')}
        </Link>
      )}
    </div>
  );
}

function HorseProfileHero({ horse }: { horse: Horse }) {
  const { t } = useTranslation();

  return (
    <section className="horse-profile-hero">
      {horse.photoUrl ? (
        <img className="horse-profile-photo" src={horse.photoUrl} alt={horse.name} />
      ) : (
        <div className="horse-profile-photo horse-profile-photo-fallback" aria-hidden="true">
          {horse.name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="horse-profile-title">
        <p className="eyebrow">{t('horseFlow.profileEyebrow')}</p>
        <h1>{horse.name}</h1>
        <p>
          {horse.breed ?? t('horseFlow.breedNotSet')} · {horse.owner.name}
        </p>
      </div>
      <span className={`horse-status status-${horse.status.toLowerCase()}`}>
        <span aria-hidden="true" />
        {t(`horseFlow.status.${horse.status}`)}
      </span>
    </section>
  );
}

function HorseStatGrid({ horse }: { horse: Horse }) {
  const { t } = useTranslation();

  return (
    <section className="horse-stat-grid" aria-label={t('horseFlow.profileSummary')}>
      <div className="horse-stat">
        <span>{t('horseFlow.fitnessScore')}</span>
        <strong>
          {horse.fitnessScore ?? '—'}
          <small>{horse.fitnessScore == null ? '' : ' / 100'}</small>
        </strong>
      </div>
      <div className="horse-stat">
        <span>{t('horseFlow.healthCondition')}</span>
        <strong>{t(`horseFlow.health.${horse.healthStatus ?? 'FIT'}`)}</strong>
      </div>
      <div className="horse-stat">
        <span>{t('horseFlow.trainingLock')}</span>
        <strong>{horse.locked ? t('horseFlow.locked') : t('horseFlow.unlocked')}</strong>
      </div>
      <div className="horse-stat">
        <span>{t('horseFlow.registered')}</span>
        <strong>{formatDate(horse.createdAt)}</strong>
      </div>
    </section>
  );
}

function HorseProfileDetails({ horse }: { horse: Horse }) {
  const { t } = useTranslation();

  return (
    <section className="horse-profile-details">
      <div>
        <span>{t('horse.breed')}</span>
        <strong>{horse.breed ?? '—'}</strong>
      </div>
      <div>
        <span>{t('horse.birthDate')}</span>
        <strong>{formatDate(horse.birthDate)}</strong>
      </div>
      <div>
        <span>{t('horse.owner')}</span>
        <strong>{horse.owner.name}</strong>
      </div>
      <div>
        <span>{t('horseFlow.email')}</span>
        <strong>{horse.owner.email}</strong>
      </div>
    </section>
  );
}

function HorseTabSwitcher({
  tab,
  onTabChange,
}: {
  tab: Tab;
  onTabChange: (next: Tab) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="tabs">
      <button type="button" className={tab === 'sessions' ? 'tab active' : 'tab'} onClick={() => onTabChange('sessions')}>
        {t('tab.sessions')}
      </button>
      <button type="button" className={tab === 'health' ? 'tab active' : 'tab'} onClick={() => onTabChange('health')}>
        {t('tab.health')}
      </button>
    </div>
  );
}
