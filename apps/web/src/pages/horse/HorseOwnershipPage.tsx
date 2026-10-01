import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ErrorText } from '../../components/ErrorText';
import { api } from '../../lib/api';
import type { Horse } from '../../lib/types';
import { HorseRecordNav } from './HorseRecordNav';

export function HorseOwnershipPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const [horse, setHorse] = useState<Horse | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    api.get<Horse>(`/horses/${id}`).then((response) => {
      if (active) setHorse(response.data);
    }).catch((reason: unknown) => { if (active) setError(reason); });
    return () => { active = false; };
  }, [id]);

  if (error) return <div className="horse-workspace"><ErrorText err={error} /></div>;
  if (!horse) return <p className="muted">{t('horseFlow.loading')}</p>;

  return (
    <div className="horse-workspace">
      <div className="horse-back-row"><Link to={`/horses/${id}`}>← {horse.name}</Link></div>
      <section className="horse-page-heading">
        <div><p className="eyebrow">{t('horseFlow.recordsEyebrow')}</p><h1>{t('horseFlow.ownershipTitle')}</h1><p className="muted">{t('horseFlow.ownershipDescription')}</p></div>
      </section>
      <HorseRecordNav horseId={id} />
      <section className="ownership-current">
        <div className="ownership-mark" aria-hidden="true">{horse.owner.name.slice(0, 1).toUpperCase()}</div>
        <div><span className="eyebrow">{t('horseFlow.currentOwner')}</span><h2>{horse.owner.name}</h2><p>{horse.owner.email}</p></div>
        <span className="horse-status status-active"><span aria-hidden="true" />{t('horseFlow.current')}</span>
      </section>
      <section className="ownership-notice">
        <span className="ownership-notice-icon" aria-hidden="true">i</span>
        <div><h2>{t('horseFlow.transferHistoryUnavailable')}</h2><p>{t('horseFlow.transferHistoryExplanation')}</p></div>
      </section>
    </div>
  );
}
