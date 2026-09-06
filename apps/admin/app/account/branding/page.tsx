import { OrganizationBrandingSettings } from "../../../components/organization-branding-settings";
import { PageHeaderShell } from "../../../components/ui";

export default function OrganizationBrandingPage() {
  return (
    <>
      <PageHeaderShell
        description="Firmanızın admin ve personel ekranlarında görünecek logosunu yönetin."
        title="Firma Logosu"
      />
      <OrganizationBrandingSettings />
    </>
  );
}
