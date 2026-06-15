import { redirect, notFound } from 'next/navigation';
import { nfcPublicApi } from '@/lib/api';

/**
 * Server-Side Routing nach Scan-Status:
 *   - inactive → /activate (Eltern fuellen Formular)
 *   - active   → /help (Finder sieht Daten + Anruf-Button)
 *   - notfound → 404
 */
export default async function CodeRouter({ params }: { params: { code: string } }) {
  let status;
  try {
    status = await nfcPublicApi.getStatus(params.code);
  } catch {
    notFound();
  }
  if (status.status === 'notfound') notFound();
  if (status.status === 'inactive') redirect(`/${params.code}/activate`);
  if (status.status === 'active') redirect(`/${params.code}/help`);
  notFound();
}

export const dynamic = 'force-dynamic'; // immer frisch — sonst koennte ein
                                         // schon aktiviertes Band weiter
                                         // /activate zeigen
