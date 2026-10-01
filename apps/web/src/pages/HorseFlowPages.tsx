import { useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/useAuth';
import { ErrorText } from '../components/ErrorText';
import { Field } from '../components/Field';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';
import type {
  Horse,
  HorseRaceEntry,
  HorseStatus,
  Paginated,
  PedigreeNode,
  Race,
  RaceEntry,
  User,
} from '../lib/types';
import { HorsesPage } from './HorsesPage';

const HORSE_STATUSES: HorseStatus[] = ['ACTIVE', 'RESTING', 'RETIRED'];

export function MyHorsesPage() {
  return <HorsesPage personal />;
}

export function HorseRecordNav({ horseId }: { horseId: string }) {
  const { t } = useTranslation();
  const links = [
    { to: `/horses/${horseId}`, label: t('horseFlow.overview'), end: true },
    { to: `/horses/${horseId}/pedigree`, label: t('horseFlow.pedigree') },
    { to: `/horses/${horseId}/performance`, label: t('horseFlow.performance') },
    { to: `/horses/${horseId}/ownership`, label: t('horseFlow.ownership') },
  ];

  return (
    <nav className="horse-record-nav" aria-label={t('horseFlow.recordSections')}>
      {links.map((link) => (
        <NavLink key={link.to} to={link.to} end={link.end}>
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}

type HorseFormState = {
  name: string;
  breed: string;
  birthDate: string;
  ownerId: string;
  status: HorseStatus;
  sireId: string;
  damId: string;
  fitnessScore: string;
};

const EMPTY_FORM: HorseFormState = {
  name: '',
  breed: '',
  birthDate: '',
  ownerId: '',
  status: 'ACTIVE',
  sireId: '',
  damId: '',
  fitnessScore: '',
};

export function HorseFormPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState<HorseFormState>(EMPTY_FORM);
  const [owners, setOwners] = useState<User[]>([]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [ownerResponse, horseResponse, detailResponse] = await Promise.all([
          api.get<Paginated<User>>('/users', { params: { role: 'OWNER', limit: 100 } }),
          api.get<Paginated<Horse>>('/horses', { params: { limit: 100 } }),
          id ? api.get<Horse>(`/horses/${id}`) : Promise.resolve(null),
        ]);
        if (!active) return;
        setOwners(ownerResponse.data.data);
        setHorses(horseResponse.data.data);
        if (detailResponse) {
          const horse = detailResponse.data;
          setForm({
            name: horse.name,
            breed: horse.breed ?? '',
            birthDate: horse.birthDate?.slice(0, 10) ?? '',
            ownerId: horse.ownerId,
            status: horse.status,
            sireId: horse.sireId ?? '',
            damId: horse.damId ?? '',
            fitnessScore: horse.fitnessScore?.toString() ?? '',
          });
        }
      } catch (error) {
        if (active) setLoadError(error);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [id]);

  const setValue = <K extends keyof HorseFormState>(key: K, value: HorseFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError(null);
    setSaving(true);
    try {
      const body = id
        ? {
            name: form.name.trim(),
            breed: form.breed.trim() || null,
            birthDate: form.birthDate ? new Date(`${form.birthDate}T00:00:00`).toISOString() : null,
            ownerId: form.ownerId,
            status: form.status,
            sireId: form.sireId || null,
            damId: form.damId || null,
            fitnessScore: form.fitnessScore === '' ? null : Number(form.fitnessScore),
          }
        : {
            name: form.name.trim(),
            breed: form.breed.trim() || undefined,
            birthDate: form.birthDate ? new Date(`${form.birthDate}T00:00:00`).toISOString() : undefined,
            ownerId: form.ownerId,
            status: form.status,
          };
      const response = id
        ? await api.patch<Horse>(`/horses/${id}`, body)
        : await api.post<Horse>('/horses', body);
      if (photo) {
        const payload = new FormData();
        payload.append('file', photo);
        await api.post(`/horses/${response.data.id}/photo`, payload);
      }
      navigate(`/horses/${response.data.id}`);
    } catch (error) {
      setSaveError(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="muted">{t('horseFlow.loading')}</p>;
  if (loadError) return <ErrorText err={loadError} />;

  return (
    <div className="horse-workspace">
      <div className="horse-back-row">
        <Link to={id ? `/horses/${id}` : '/horses'}>← {t('horseFlow.backToDirectory')}</Link>
      </div>
      <section className="horse-page-heading">
        <div>
          <p className="eyebrow">{t('horseFlow.managementEyebrow')}</p>
          <h1>{id ? t('horseFlow.editHorse') : t('horseFlow.addHorse')}</h1>
          <p className="muted">{t('horseFlow.formDescription')}</p>
        </div>
      </section>
      <form className="horse-form" onSubmit={submit}>
        <section className="horse-form-section">
          <h2>{t('horseFlow.identitySection')}</h2>
          <div className="horse-form-grid">
            <Field label={t('horse.name')}>
              <input className="input" value={form.name} onChange={(event) => setValue('name', event.target.value)} required maxLength={120} />
            </Field>
            <Field label={t('horse.breed')}>
              <input className="input" value={form.breed} onChange={(event) => setValue('breed', event.target.value)} maxLength={120} />
            </Field>
            <Field label={t('horse.birthDate')}>
              <input className="input" type="date" value={form.birthDate} onChange={(event) => setValue('birthDate', event.target.value)} />
            </Field>
            <Field label={t('horse.owner')}>
              <select className="input" value={form.ownerId} onChange={(event) => setValue('ownerId', event.target.value)} required>
                <option value="">{t('horseFlow.selectOwner')}</option>
                {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name} ({owner.email})</option>)}
              </select>
            </Field>
            <Field label={t('horse.status')}>
              <select className="input" value={form.status} onChange={(event) => setValue('status', event.target.value as HorseStatus)}>
                {HORSE_STATUSES.map((status) => <option key={status} value={status}>{t(`horseFlow.status.${status}`)}</option>)}
              </select>
            </Field>
            <Field label={t('horseFlow.photo')}>
              <input className="input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} />
            </Field>
          </div>
        </section>

        {id && (
          <section className="horse-form-section">
            <h2>{t('horseFlow.pedigreeAndFitness')}</h2>
            <div className="horse-form-grid">
              <Field label={t('horseFlow.sire')}>
                <select className="input" value={form.sireId} onChange={(event) => setValue('sireId', event.target.value)}>
                  <option value="">{t('horseFlow.unknown')}</option>
                  {horses.filter((horse) => horse.id !== id && horse.id !== form.damId).map((horse) => <option key={horse.id} value={horse.id}>{horse.name}</option>)}
                </select>
              </Field>
              <Field label={t('horseFlow.dam')}>
                <select className="input" value={form.damId} onChange={(event) => setValue('damId', event.target.value)}>
                  <option value="">{t('horseFlow.unknown')}</option>
                  {horses.filter((horse) => horse.id !== id && horse.id !== form.sireId).map((horse) => <option key={horse.id} value={horse.id}>{horse.name}</option>)}
                </select>
              </Field>
              <Field label={t('horseFlow.fitnessScore')}>
                <input className="input" type="number" min="0" max="100" value={form.fitnessScore} onChange={(event) => setValue('fitnessScore', event.target.value)} />
              </Field>
            </div>
          </section>
        )}

        {saveError && <ErrorText err={saveError} />}
        <div className="horse-form-actions">
          <button className="btn btn-primary" type="submit" disabled={saving || !user}>
            {saving ? t('horseFlow.saving') : id ? t('common.save') : t('horseFlow.createRecord')}
          </button>
          <Link className="btn" to={id ? `/horses/${id}` : '/horses'}>{t('common.cancel')}</Link>
        </div>
      </form>
    </div>
  );
}

export function HorsePedigreePage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const [horse, setHorse] = useState<Horse | null>(null);
  const [tree, setTree] = useState<PedigreeNode | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    Promise.all([api.get<Horse>(`/horses/${id}`), api.get<PedigreeNode>(`/horses/${id}/pedigree`)])
      .then(([horseResponse, treeResponse]) => {
        if (active) {
          setHorse(horseResponse.data);
          setTree(treeResponse.data);
        }
      })
      .catch((reason: unknown) => { if (active) setError(reason); });
    return () => { active = false; };
  }, [id]);

  if (error) return <div className="horse-workspace"><ErrorText err={error} /></div>;
  if (!horse || !tree) return <p className="muted">{t('horseFlow.loading')}</p>;

  return (
    <div className="horse-workspace">
      <div className="horse-back-row"><Link to={`/horses/${id}`}>← {horse.name}</Link></div>
      <section className="horse-page-heading">
        <div><p className="eyebrow">{t('horseFlow.bloodlineEyebrow')}</p><h1>{t('horseFlow.pedigreeTitle')}</h1><p className="muted">{t('horseFlow.pedigreeDescription')}</p></div>
      </section>
      <HorseRecordNav horseId={id} />
      <div className="pedigree-canvas"><PedigreeBranch node={tree} root /></div>
      <p className="horse-footnote">{t('horseFlow.pedigreeLimit')}</p>
    </div>
  );
}

function PedigreeBranch({ node, root = false }: { node: PedigreeNode; root?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={`pedigree-branch${root ? ' pedigree-root' : ''}`}>
      <article className="pedigree-node">
        <span className="pedigree-node-label">{root ? t('horseFlow.subjectHorse') : t('horseFlow.ancestor')}</span>
        <strong>{node.name}</strong>
        {node.fitnessScore != null && <small>{t('horseFlow.fitnessScore')}: {node.fitnessScore}/100</small>}
      </article>
      {(node.sire || node.dam) && (
        <div className="pedigree-children">
          <div className="pedigree-side">
            <span className="pedigree-side-label">{t('horseFlow.sire')}</span>
            {node.sire ? <PedigreeBranch node={node.sire} /> : <div className="pedigree-node pedigree-node-empty">{t('horseFlow.unknown')}</div>}
          </div>
          <div className="pedigree-side">
            <span className="pedigree-side-label">{t('horseFlow.dam')}</span>
            {node.dam ? <PedigreeBranch node={node.dam} /> : <div className="pedigree-node pedigree-node-empty">{t('horseFlow.unknown')}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

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

  const enteredRaceIds = new Set(entries.map((entry) => entry.race.id));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const availableRaces = races.filter((race) => (
    new Date(race.date) >= today && !enteredRaceIds.has(race.id)
  ));

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

  const wins = entries.filter((entry) => entry.position === 1).length;
  const podiums = entries.filter((entry) => entry.position != null && entry.position <= 3).length;
  const bestPlace = entries.reduce<number | null>((best, entry) => entry.position != null && (best == null || entry.position < best) ? entry.position : best, null);

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