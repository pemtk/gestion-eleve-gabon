import { STUDENT_CSV_HEADER } from '@sge/shared';
import { PageHeader } from '~/components/blocks';
import { FileBanner } from '~/components/import/FileBanner';
import { downloadCsv } from '~/components/import/csv-download';
import { ImportDone } from '~/components/import/ImportDone';
import { ImportStepper } from '~/components/import/ImportStepper';
import { ImportSummary } from '~/components/import/ImportSummary';
import { ReviewTable } from '~/components/import/ReviewTable';
import { UploadStep } from '~/components/import/UploadStep';
import { useStudentImport } from '~/components/import/use-student-import';
import { Button, Notice } from '~/components/ui';
import { run, spaceApi } from '~/lib/api.server';
import { str } from '~/lib/form';
import type { ClassRow } from '~/lib/types';
import type { Route } from './+types/import';

export async function loader({ request }: Route.LoaderArgs) {
  const api = await spaceApi(request, 'ecole');
  return { classNames: (await api.get<ClassRow[]>('/school/classes')).map((c) => c.name) };
}

export async function action({ request }: Route.ActionArgs) {
  const api = await spaceApi(request, 'ecole');
  const fd = await request.formData();
  return run(
    () =>
      api.post<{ imported: number; skipped: number }>('/school/students/import/confirm', {
        csv: str(fd, 'csv'),
      }),
    (r) =>
      `Import terminé : ${r.imported} compte${r.imported > 1 ? 's' : ''} créé${r.imported > 1 ? 's' : ''}${r.skipped ? `, ${r.skipped} ligne${r.skipped > 1 ? 's' : ''} ignorée${r.skipped > 1 ? 's' : ''}` : ''}. Chaque élève active son compte avec le code SMS.`,
  );
}

const STEPS = ['Modèle', 'Fichier', 'Vérification', 'Validation'];

/** Import d'élèves en quatre étapes : modèle, fichier, vérification ligne par ligne, validation. */
export default function ImportStudents({ loaderData: { classNames } }: Route.ComponentProps) {
  const upload = useStudentImport(classNames);
  const template = `${STUDENT_CSV_HEADER}\nMboumba,Ruth,+241 07 55 12 90,${classNames[0] ?? '3ème B'}`;
  const currentStep = upload.step === 'upload' ? 2 : 3;

  return (
    <>
      <PageHeader
        kicker="Utilisateurs › Élèves"
        title="Importer des élèves"
        action={
          <Button
            variant="secondary"
            icon="download"
            onClick={() => downloadCsv('modele_import_eleves.csv', template)}
          >
            Télécharger le modèle
          </Button>
        }
      />
      <ImportStepper steps={STEPS} current={currentStep} done={upload.done} />

      {upload.problem && <Notice tone="error">{upload.problem}</Notice>}
      {upload.submitError && <Notice tone="error">{upload.submitError}</Notice>}

      {upload.done ? (
        <ImportDone count={upload.valid} onRestart={upload.restart} />
      ) : upload.step === 'upload' ? (
        <UploadStep onFile={upload.loadFile} onSample={upload.loadSample} />
      ) : (
        <>
          <FileBanner
            name={upload.fileName}
            lines={upload.rows.length}
            onChange={upload.changeFile}
          />
          <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <ReviewTable
              rows={upload.shown}
              errors={upload.errors}
              onlyErrors={upload.onlyErrors}
              onOnlyErrorsChange={upload.setOnlyErrors}
              fixing={upload.fixing}
              onFixing={upload.setFixing}
              onFix={upload.fix}
            />
            <ImportSummary
              valid={upload.valid}
              errors={upload.errors}
              submitting={upload.submitting}
              onConfirm={upload.confirm}
            />
          </div>
        </>
      )}
    </>
  );
}
