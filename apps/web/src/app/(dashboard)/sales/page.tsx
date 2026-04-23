import { redirect } from 'next/navigation';

export default function SalesRoot() {
  redirect('/sales/orders');
}
