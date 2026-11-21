import { OrganizationBrandingSettings } from "../../../components/organization-branding-settings";
import { FirmPage, PageHeaderShell } from "@/components/firm-ui";

export default function OrganizationBrandingPage() {
  return (
    <FirmPage>
      <PageHeaderShell
        description="Firmanızın admin ve personel ekranlarında görünecek logosunu yönetin."
        title="Firma Logosu"
      />
      <OrganizationBrandingSettings />
    </FirmPage>
  );
}
