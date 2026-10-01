import { Card, Skeleton } from "antd";

export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <Skeleton active paragraph={{ rows: 1 }} className="mb-6 max-w-md" />
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <Card key={item} size="small"><Skeleton active paragraph={false} /></Card>)}
        </div>
        <div className="border border-zinc-200 bg-white p-5"><Skeleton active paragraph={{ rows: 8 }} /></div>
      </div>
    </main>
  );
}
