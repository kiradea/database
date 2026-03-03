import { lusitana } from '@/app/ui/fonts';
import Search from '@/app/ui/search';
import { CreateInvoice } from '@/app/ui/invoices/buttons';
import InvoicesTable from '@/app/ui/invoices/table';

export default async function Page(props: {
  searchParams?: Promise<{
    query?: string;
    page?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  const query = searchParams?.query || '';
  const currentPage = Number(searchParams?.page) || 1;

  return (
    <div className="w-full">
      <div className="flex w-full items-center justify-between">
        <h1 className={`${lusitana.className} text-2xl`}>Invoices</h1>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 md:mt-8">
        <Search placeholder="Search invoices..." />
        <CreateInvoice />
      </div>
      <InvoicesTable query={query} currentPage={currentPage} />
    </div>
  );
}
