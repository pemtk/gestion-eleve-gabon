import type { DashboardData } from '@sge/shared';
import { BarChart, Cell, DataGrid, KpiGrid, LockedCard, PageHeader, SideList } from './blocks';
import { LinkButton } from './ui';

/** Tableau de bord générique (kpis, graphique, à traiter, tableau) commun aux quatre espaces. */
export function DashboardView({ data, actionTo, statsLocked }: { data: Omit<DashboardData, 'head'> & { head: DashboardData['head'] }; actionTo?: string; statsLocked?: boolean }) {
  return (
    <>
      <PageHeader kicker={data.head.kicker} title={data.head.title} filters={data.head.filters}
        action={actionTo ? <LinkButton to={actionTo} icon={data.head.actionIcon}>{data.head.action}</LinkButton> : undefined} />
      <KpiGrid kpis={data.kpis} />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {statsLocked ? (
          <LockedCard plan="Standard" title="Tableaux de bord avancés"
            text="Complétion des tâches par classe, détection des classes peu engagées et suivi de l’activation des comptes parents, avec exports CSV et PDF." />
        ) : (
          <BarChart chart={data.chart} />
        )}
        <SideList title={data.side.title} items={data.side.items} />
      </div>
      {!statsLocked && (
        <DataGrid title={data.table.title} note={data.table.note} columns={data.table.columns} head={data.table.head}
          rows={data.table.rows.map((r) => r.map((c) => <Cell key={c}>{c}</Cell>))} />
      )}
    </>
  );
}
