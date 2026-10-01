import { HorsesPage } from './HorsesPage';

export { HorseFormPage } from './horse/HorseFormPage';
export { HorseOwnershipPage } from './horse/HorseOwnershipPage';
export { HorsePedigreePage } from './horse/HorsePedigreePage';
export { HorseRaceHistoryPage } from './horse/HorseRaceHistoryPage';
export { HorseRecordNav } from './horse/HorseRecordNav';

export function MyHorsesPage() {
  return <HorsesPage personal />;
}
