import { redirect } from 'next/navigation';

export default function ManagerMetaRedirectPage() {
  redirect('/profile/integration?modal=meta');
}
