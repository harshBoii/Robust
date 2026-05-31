import { redirect } from 'next/navigation';

export default function ManagerShopifyRedirectPage() {
  redirect('/profile/integration?modal=shopify');
}
