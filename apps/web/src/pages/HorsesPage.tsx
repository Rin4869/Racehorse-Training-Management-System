import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { Horse, Paginated } from '../lib/types';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { formatDate } from '../lib/format';

export function HorsesPage({ personal = false }: { personal?: boolean } = {}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isManager = user?.role === 'MANAGER';

  const [horses, setHorses] = useState<Horse[]>([]);
  const [loadErr, setLoadErr] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get<Paginated<Horse>>('/horses', {
        params: {
          limit: 100,
          ...(query ? { q: query } : {}),
          ...(status ? { status } : {}),
        },
      });
      setHorses(res.data.data);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e);
    } finally {
      setLoading(false);
    }
  }, [query, status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="horse-workspace">
      <section className="horse-page-heading">
        <div>
          <p className="eyebrow">{personal ? t('horseFlow.ownerEyebrow') : t('horseFlow.directoryEyebrow')}</p>
          <h1>{personal ? t('horseFlow.myHorses') : t('horseFlow.directoryTitle')}</h1>
          <p className="muted">{personal ? t('horseFlow.ownerDescription') : t('horseFlow.directoryDescription')}</p>
        </div>
        <div className="horse-heading-actions">
          {!personal && user?.role === 'OWNER' && (
            <Link className="btn" to="/my-horses">
              {t('horseFlow.myHorses')}
            </Link>
          )}
          {isManager && (
            <Link className="btn btn-primary" to="/horses/new">
              + {t('horse.new')}
            </Link>
          )}
        </div>
      </section>

      <section className="horse-toolbar" aria-label={t('horseFlow.filters')}>
        <label className="horse-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('horseFlow.searchPlaceholder')}
            aria-label={t('horseFlow.searchPlaceholder')}
          />
        </label>
        <select
          className="input horse-status-filter"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label={t('horse.status')}
        >
          <option value="">{t('horseFlow.allStatuses')}</option>
          <option value="ACTIVE">{t('horseFlow.status.ACTIVE')}</option>
          <option value="RESTING">{t('horseFlow.status.RESTING')}</option>
          <option value="RETIRED">{t('horseFlow.status.RETIRED')}</option>
        </select>
        <span className="horse-result-count">
          {horses.length} {t('horseFlow.horsesFound')}
        </span>
      </section>

      {loading ? (
        <div className="horse-empty-state">{t('horseFlow.loading')}</div>
      ) : loadErr ? (
        <ErrorText err={loadErr} />
      ) : horses.length === 0 ? (
        <div className="horse-empty-state">
          <span className="horse-empty-mark" aria-hidden="true">H</span>
          <h2>{t('horse.empty')}</h2>
          <p className="muted">{t('horseFlow.noHorsesDescription')}</p>
        </div>
      ) : (
        <div className="horse-table-wrap">
          <table className="table horse-directory-table">
            <thead>
              <tr>
                <th>{t('horseFlow.horse')}</th>
                <th>{t('horse.breed')}</th>
                <th>{t('horse.birthDate')}</th>
                <th>{t('horse.owner')}</th>
                <th>{t('horse.status')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {horses.map((horse) => (
                <tr key={horse.id}>
                  <td>
                    <Link className="horse-name-link" to={`/horses/${horse.id}`}>
                      {horse.photoUrl ? (
                        <img className="horse-avatar" src={horse.photoUrl} alt="" />
                      ) : (
                        <span className="horse-avatar horse-avatar-fallback" aria-hidden="true">
                          {horse.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span>
                        <strong>{horse.name}</strong>
                      </span>
                    </Link>
                  </td>
                  <td>{horse.breed ?? '—'}</td>
                  <td>{formatDate(horse.birthDate)}</td>
                  <td>{horse.owner.name}</td>
                  <td>
                    <span className={`horse-status status-${horse.status.toLowerCase()}`}>
                      <span aria-hidden="true" />
                      {t(`horseFlow.status.${horse.status}`)}
                    </span>
                  </td>
                  <td>
                    <Link
                      className="horse-row-action"
                      to={`/horses/${horse.id}`}
                      aria-label={t('horseFlow.openProfile')}
                    >
                      ↗
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
