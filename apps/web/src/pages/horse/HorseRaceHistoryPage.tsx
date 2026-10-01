import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/useAuth';
import { ErrorText } from '../../components/ErrorText';
import { Field } from '../../components/Field';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import type { Horse, HorseRaceEntry, Paginated, Race, RaceEntry } from '../../lib/types';
import { HorseRecordNav } from './HorseRecordNav';

// Flow 1: đăng ký ngựa cho cuộc đua và xem lịch sử kết quả thi đấu.
// Chia thành 3 phần chính:
// 1) tải dữ liệu ngựa + race entries + danh sách race còn mở
// 2) form đăng ký ngựa cho giải mới
// 3) bảng hiển thị lịch sử thi đấu và thống kê nhanh
export function HorseRaceHistoryPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [horse, setHorse] = useState<Horse | null>(null);
  const [entries, setEntries] = useState<HorseRaceEntry[]>([]);
  const [races, setRaces] = useState<Race[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [registrationError, setRegistrationError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<Horse>(`/horses/${id}`),
      api.get<Paginated<HorseRaceEntry>>(`/horses/${id}/race-entries`, { params: { limit: 100 } }),
      api.get<Paginated<Race>>('/races', { params: { limit: 100 } }),
    ]).then(([horseResponse, raceResponse, raceListResponse]) => {
      if (active) {
        setHorse(horseResponse.data);
        setEntries(raceResponse.data.data);
        setRaces(raceListResponse.data.data);
      }
    }).catch((reason: unknown) => { if (active) setError(reason); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  // Chỉ hiện các race còn diễn ra trong tương lai và chưa được ngựa này đăng ký.
  const enteredRaceIds = new Set(entries.map((entry) => entry.race.id));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const availableRaces = races.filter((race) => (
    new Date(race.date) >= today && !enteredRaceIds.has(race.id)
  ));

  // Tính nhanh các KPI hiển thị ở đầu tab: số lần thi, số lần lên podium, vị trí tốt nhất.
  const wins = entries.filter((entry) => entry.position === 1).length;
  const podiums = entries.filter((entry) => entry.position != null && entry.position <= 3).length;
  const bestPlace = entries.reduce<number | null>((best, entry) => entry.position != null && (best == null || entry.position < best) ? entry.position : best, null);

  const registerForRace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedRaceId) return;
    setRegistrationError(null);
    setRegistering(true);
    try {
      const response = await api.post<RaceEntry>(`/races/${selectedRaceId}/entries`, { horseId: id });
      const race = races.find((item) => item.id === selectedRaceId);
      if (race) {
        setEntries((current) => [{
          ...response.data,
          race: { id: race.id, name: race.name, date: race.date, venue: race.venue },
        }, ...current].sort((left, right) => right.race.date.localeCompare(left.race.date)));
      }
      setSelectedRaceId('');
    } catch (reason) {
      setRegistrationError(reason);
    } finally {
      setRegistering(false);
    }
  };

  if (loading) return <p className="muted">{t('horseFlow.loading')}</p>;
  if (error) return <div className="horse-workspace"><ErrorText err={error} /></div>;
  if (!horse) return null;

  return (
    <div className="horse-workspace">
      <div className="horse-back-row"><Link to={`/horses/${id}`}>← {horse.name}</Link></div>
      <section className="horse-page-heading">
        <div><p className="eyebrow">{t('horseFlow.trackRecordEyebrow')}</p><h1>{t('horseFlow.performanceTitle')}</h1><p className="muted">{horse.name} · {t('horseFlow.performanceDescription')}</p></div>
      </section>
      <HorseRecordNav horseId={id} />
      {user?.role === 'MANAGER' && (
        <section className="race-registration">
          <div>
            <p className="eyebrow">{t('horseFlow.entryEyebrow')}</p>
            <h2>{t('horseFlow.registerForRace')}</h2>
            <p className="muted">{t('horseFlow.entryDescription', { horse: horse.name })}</p>
          </div>
          {availableRaces.length > 0 ? (
            <form className="race-registration-form" onSubmit={registerForRace}>
              <Field label={t('horseFlow.upcomingRace')}>
                <select className="input" value={selectedRaceId} onChange={(event) => setSelectedRaceId(event.target.value)} required>
                  <option value="">{t('horseFlow.selectRace')}</option>
                  {availableRaces.map((race) => (
                    <option key={race.id} value={race.id}>
                      {race.name} · {formatDate(race.date)}{race.venue ? ` · ${race.venue}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <button className="btn btn-primary" type="submit" disabled={registering || !selectedRaceId}>
                {registering ? t('horseFlow.registering') : t('horseFlow.registerHorse')}
              </button>
            </form>
          ) : (
            <p className="race-registration-empty">{t('horseFlow.noAvailableRaces')}</p>
          )}
          {registrationError && <ErrorText err={registrationError} />}
        </section>
      )}
      <section className="horse-stat-grid horse-stat-grid-three">
        <div className="horse-stat"><span>{t('horseFlow.racesStarted')}</span><strong>{entries.length}</strong></div>
        <div className="horse-stat"><span>{t('horseFlow.wins')}</span><strong>{wins}</strong></div>
        <div className="horse-stat"><span>{t('horseFlow.podiums')}</span><strong>{podiums}</strong></div>
        <div className="horse-stat"><span>{t('horseFlow.bestFinish')}</span><strong>{bestPlace == null ? '—' : `#${bestPlace}`}</strong></div>
      </section>
      {entries.length === 0 ? (
        <div className="horse-empty-state"><h2>{t('horseFlow.noRaceResults')}</h2><p className="muted">{t('horseFlow.noRaceResultsDescription')}</p></div>
      ) : (
        <div className="horse-table-wrap">
          <table className="table horse-directory-table">
            <thead><tr><th>{t('horseFlow.race')}</th><th>{t('horseFlow.date')}</th><th>{t('horseFlow.venue')}</th><th>{t('horseFlow.finish')}</th><th>{t('horseFlow.time')}</th></tr></thead>
            <tbody>{entries.map((entry) => (
              <tr key={entry.id}>
                <td><strong>{entry.race.name}</strong></td>
                <td>{formatDate(entry.race.date)}</td>
                <td>{entry.race.venue ?? '—'}</td>
                <td>{entry.position == null ? t('horseFlow.pendingResult') : `#${entry.position}`}</td>
                <td>{entry.time ?? '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
