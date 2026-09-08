import { WorkflowSection } from "../../components/feature-sections";
import { MarketingShell } from "../../components/marketing-shell";

export default function WorkflowPage() {
  return (
    <MarketingShell>
      <section className="public-band">
        <div className="public-container public-section-heading">
          <span>İş Akışı</span>
          <h1>Saha işi, kontrol ve teslim adımlarını netleştirin</h1>
          <p>Her operasyon aynı adımlarla ilerlesin; ekip ve yöneticiler güncel durumu tek kayıt üzerinden takip etsin.</p>
        </div>
      </section>
      <WorkflowSection />
    </MarketingShell>
  );
}
