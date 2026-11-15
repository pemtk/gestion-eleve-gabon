import { Link } from 'react-router';
import { Icon } from '../icon';

/** Abonnement suspendu : consultation seule. */
export function SuspendedBanner() {
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-lg border border-accent-400 bg-accent-100 px-4 py-3 text-[13.5px] text-accent-900"
    >
      <Icon name="circle-pause" size={18} />
      <div className="flex-1 leading-snug">
        <strong className="font-semibold">Abonnement suspendu</strong> · consultation seule. Les
        données sont conservées ; réglez la facture pour réactiver toutes les fonctions.
      </div>
      <Link to="/ecole/abonnement" className="font-semibold">
        Mon abonnement
      </Link>
    </div>
  );
}
