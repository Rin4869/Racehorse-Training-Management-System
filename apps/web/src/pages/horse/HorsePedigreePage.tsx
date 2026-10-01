import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ErrorText } from '../../components/ErrorText';
import { api } from '../../lib/api';
import type { Horse, PedigreeNode } from '../../lib/types';
import { HorseRecordNav } from './HorseRecordNav';

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
