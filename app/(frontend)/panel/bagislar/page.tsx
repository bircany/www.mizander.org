import { ManagementShell } from "@/components/admin/management-shell";
import { PanelPageHeader } from "@/components/admin/panel-ui";
import { DonationDashboardView } from "@/components/admin/donation-dashboard-view";
import { getDonationDashboardData } from "@/lib/admin/donation-analytics";
import { requireAdminUser } from "@/lib/admin/data";
import { PANEL_ROUTE_ACCESS } from "@/lib/auth/panel-access";

export const dynamic = "force-dynamic";

export default async function DonationsAdminDashboardPage() {
  const user = await requireAdminUser(PANEL_ROUTE_ACCESS.donations);
  const data = await getDonationDashboardData();

  return (
    <ManagementShell
      currentPath="/panel/bagislar"
      name={user.name || user.email}
      role={user.role}
    >
      <div className="space-y-6">
        <PanelPageHeader
          description="Alınan tüm bağışların ücret hacmini, kullanılan grup türlerini, ödeme yöntemlerini pasta grafikler ve filtreli tablolarla tek ekrandan analiz edin."
          eyebrow="Finans ve Operasyon Analitiği"
          title="Bağış Dashboard"
        />
        <DonationDashboardView data={data} />
      </div>
    </ManagementShell>
  );
}
