"use client";

import Image from "next/image";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock,
  ClipboardCheck,
  ClipboardList,
  Download,
  FileText,
  ImageIcon,
  LogOut,
  Plus,
  Save,
  Send,
  Share2,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type {
  Belt,
  Company,
  CompanyLine,
  Equipment,
  InstallationAssignment,
  Profile,
  ReportFormValues,
  ReportStatus,
  ReportWorkItem,
  Vehicle
} from "@operations/types";
import {
  emptyReportFormValues,
  processActions,
  productTypes,
  reportFormSchema,
  reportReturnCloseoutSchema
} from "@operations/validation";
import { customerSignatureSchema, type CustomerSignature } from "@operations/validation";
import { CustomerSignatureApproval, CustomerSignatureView, SignaturePhotoPreview } from "../../components/customer-signature";
import { ProductBrand } from "../../components/logo";
import { OrganizationBrand } from "../../components/organization-brand";
import { Button, EmptyState } from "../../components/ui";
import { clearAccountContextCache, loadAccountContext } from "../../lib/account-context-client";
import { downloadOrShareReportPdf } from "../../lib/report-pdf-client";
import { getBrowserSupabase } from "../../lib/supabase-browser";

type Screen = "home" | "form" | "drafts" | "submitted" | "assignments" | "detail";

type ReportRow = Record<string, unknown> & {
  id: string;
  client_request_id: string | null;
  report_number: string | null;
  report_date: string;
  company_name_snapshot: string | null;
  status: ReportStatus;
  created_at: string;
  submitted_at: string | null;
  report_personnel?: Array<{ profile_id: string | null; name_snapshot: string | null }>;
};

type ReportDetail = ReportRow & {
  created_by_name_snapshot: string | null;
  updated_at: string;
  report_personnel?: Array<{ profile_id?: string | null; name_snapshot: string | null }>;
  report_photos?: Array<{
    id?: string;
    category: string | null;
    caption: string | null;
    storage_path: string | null;
    created_at: string;
  }>;
};

type SavedPhoto = { id: string; storage_path: string; caption: string | null; url: string };

type PhotoDraft = {
  localId: string;
  file: File;
  caption: string;
};

const defaultPhotoCategory = "Genel";
const turkeyTimeZone = "Europe/Istanbul";
const replacementReasonOptions = [
  "Mekanik sıkıntılardan dolayı",
  "Ek yeri açtı",
  "Sorun yoktu, bant ortalama ömrü doldu",
  "Diğer"
];

function getPersonnelSupabase() {
  return getBrowserSupabase("personnel");
}

export default function PersonnelWebPage() {
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accessMessage, setAccessMessage] = useState("");
  const [readOnlyMode, setReadOnlyMode] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "error">("info");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [belts, setBelts] = useState<Belt[]>([]);
  const [companyLines, setCompanyLines] = useState<CompanyLine[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [personnel, setPersonnel] = useState<Profile[]>([]);
  const [draftReports, setDraftReports] = useState<ReportRow[]>([]);
  const [submittedReports, setSubmittedReports] = useState<ReportRow[]>([]);
  const [assignments, setAssignments] = useState<InstallationAssignment[]>([]);
  const [activeAssignment, setActiveAssignment] = useState<InstallationAssignment | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [values, setValues] = useState<ReportFormValues>(() => newReportValues());
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [savedPhotos, setSavedPhotos] = useState<SavedPhoto[]>([]);
  const submitting = useRef(false);

  useEffect(() => {
    const supabase = getPersonnelSupabase();
    if (!supabase) {
      setAccessMessage("Supabase bilgileri girilmedi.");
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSessionUserId(data.session?.user.id ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUserId(session?.user.id ?? null);
      if (!session?.user) {
        setProfile(null);
        setScreen("home");
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!sessionUserId) return;
    loadBootstrapData().catch(() => showMessage("Veriler alınamadı. Bağlantınızı kontrol edin.", "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUserId]);

  function showMessage(text: string, tone: "info" | "error" = "info") {
    setMessage(text);
    setMessageTone(tone);
  }

  async function loadBootstrapData() {
    const supabase = getPersonnelSupabase();
    if (!supabase || !sessionUserId) return;

    let accessBody;
    try {
      accessBody = await loadAccountContext("personnel");
    } catch (accessError) {
      setReadOnlyMode(false);
      setAccessMessage(accessError instanceof Error ? accessError.message : "Abonelik erişimi doğrulanamadı.");
      return;
    }

    if (accessBody.role !== "PERSONNEL") {
      setReadOnlyMode(false);
      setAccessMessage("Bu alan aktif personel hesabı ile kullanılabilir.");
      return;
    }

    setReadOnlyMode(accessBody.accessMode === "read");

    const [
      profileResult,
      companyResult,
      beltResult,
      lineResult,
      vehicleResult,
      equipmentResult,
      personnelResult,
      draftResult,
      submittedResult,
      assignmentResult
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", sessionUserId).maybeSingle(),
      supabase.from("companies").select("*").eq("is_active", true).order("name"),
      supabase.from("belts").select("*").eq("is_active", true).order("code"),
      supabase.from("company_lines").select("*").order("name"),
      supabase.from("vehicles").select("*").order("plate"),
      supabase.from("equipment").select("*").eq("is_active", true).order("name"),
      supabase
        .from("profiles")
        .select("*")
        .eq("role", "PERSONNEL")
        .eq("is_active", true)
        .order("first_name"),
      supabase
        .from("reports")
        .select("*, report_personnel(profile_id,name_snapshot)")
        .eq("status", "DRAFT")
        .order("updated_at", { ascending: false })
        .limit(50),
      supabase
        .from("reports")
        .select("id,client_request_id,report_number,report_date,company_name_snapshot,status,created_at,submitted_at")
        .eq("status", "SUBMITTED")
        .order("submitted_at", { ascending: false })
        .limit(100),
      supabase
        .from("installation_assignments")
        .select("*")
        .in("status", ["ASSIGNED", "IN_PROGRESS"])
        .order("scheduled_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .limit(100)
    ]);

    if (profileResult.error) {
      setAccessMessage("Personel profili alınamadı.");
      return;
    }

    const nextProfile = profileResult.data as Profile | null;
    setProfile(nextProfile);

    if (!nextProfile || nextProfile.role !== "PERSONNEL" || nextProfile.is_active !== true) {
      setReadOnlyMode(false);
      setAccessMessage("Bu alan aktif personel hesabı ile kullanılabilir.");
      return;
    }

    setAccessMessage("");
    setCompanies((companyResult.data ?? []) as Company[]);
    setBelts((beltResult.data ?? []) as Belt[]);
    setCompanyLines((lineResult.data ?? []) as CompanyLine[]);
    setVehicles((vehicleResult.data ?? []) as Vehicle[]);
    setEquipment((equipmentResult.data ?? []) as Equipment[]);
    setPersonnel((personnelResult.data ?? []) as Profile[]);
    setDraftReports((draftResult.data ?? []) as ReportRow[]);
    setSubmittedReports((submittedResult.data ?? []) as ReportRow[]);
    setAssignments((assignmentResult.data ?? []) as InstallationAssignment[]);
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getPersonnelSupabase();
    if (!supabase) {
      showMessage("Supabase bilgileri girilmedi.", "error");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        showMessage("Giriş yapılamadı. E-posta ve şifrenizi kontrol edin.", "error");
      }
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    if (submitting.current || loading) return;
    clearAccountContextCache("personnel");
    await getPersonnelSupabase()?.auth.signOut();
    setProfile(null);
    setSessionUserId(null);
    setReadOnlyMode(false);
    setActiveAssignment(null);
    setValues(newReportValues());
    clearPhotos();
  }

  function update<K extends keyof ReportFormValues>(key: K, value: ReportFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function toggleArray<K extends "visiting_personnel_ids" | "product_types" | "process_actions" | "replacement_reasons">(
    key: K,
    value: string
  ) {
    const current = values[key] as string[];
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    update(key, next as ReportFormValues[K]);
  }

  function toggleEquipment(equipmentId: string) {
    setValues((current) => {
      const nextIds = current.used_equipment_ids.includes(equipmentId)
        ? current.used_equipment_ids.filter((item) => item !== equipmentId)
        : [...current.used_equipment_ids, equipmentId];

      return {
        ...current,
        used_equipment_ids: nextIds,
        used_equipment: equipmentNamesFromIds(nextIds, equipment)
      };
    });
  }

  function startNewReport() {
    if (readOnlyMode) {
      showMessage("Aboneliğiniz salt okunur durumda. Yeni rapor oluşturamazsınız.", "error");
      return;
    }
    setActiveAssignment(null);
    setValues(newReportValues());
    clearPhotos();
    setMessage("");
    setScreen("form");
  }

  async function openDraft(report: ReportRow) {
    if (readOnlyMode) {
      showMessage("Aboneliğiniz salt okunur durumda. Taslaklar düzenlenemez.", "error");
      return;
    }
    if (loading) return;
    setLoading(true);
    try { await loadSavedPhotos(report.id); }
    catch { showMessage("Taslak fotoğrafları alınamadı. Bağlantınızı kontrol edip taslağı yeniden açın.", "error"); return; }
    finally { setLoading(false); }
    setActiveAssignment(assignments.find((assignment) => assignment.report_id === report.id) ?? null);
    setValues(reportToValues(report, equipment));
    setPhotos([]);
    setMessage("");
    setScreen("form");
  }

  function openDetail(reportId: string) {
    setSelectedReportId(reportId);
    setScreen("detail");
  }

  async function openAssignment(assignment: InstallationAssignment) {
    setActiveAssignment(assignment);
    setValues(assignmentToValues(assignment, equipment));
    clearPhotos();
    setMessage("");
    setScreen("form");

    if (assignment.report_id) {
      setLoading(true);
      try { await loadSavedPhotos(assignment.report_id); }
      catch { setScreen("assignments"); showMessage("Taslak fotoğrafları alınamadı. Atamayı yeniden açın.", "error"); return; }
      finally { setLoading(false); }
      const draftValues = await loadAssignmentDraftValues(assignment.report_id);
      if (draftValues) {
        setValues(draftValues);
      } else {
        openDetail(assignment.report_id);
        showMessage("Atamanın kayıtlı raporu açıldı. Gönderilmiş bir rapordan yeni taslak oluşturulmaz.");
        return;
      }
    }

    if (assignment.status !== "ASSIGNED" || readOnlyMode) return;

    const supabase = getPersonnelSupabase();
    if (!supabase) return;

    const { error } = await supabase
      .from("installation_assignments")
      .update({ status: "IN_PROGRESS" })
      .eq("id", assignment.id);

    if (!error) {
      const nextAssignment: InstallationAssignment = { ...assignment, status: "IN_PROGRESS" };
      setActiveAssignment(nextAssignment);
      setAssignments((current) => current.map((item) => item.id === assignment.id ? nextAssignment : item));
    }
  }

  function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const next = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({
        localId: createId(),
        file,
        caption: ""
      }));
    setPhotos((current) => [...current, ...next]);
  }

  function updatePhotoCaption(localId: string, caption: string) {
    setPhotos((current) => current.map((photo) => photo.localId === localId ? { ...photo, caption } : photo));
  }

  function removePhoto(localId: string) {
    setPhotos((current) => current.filter((photo) => photo.localId !== localId));
  }

  function clearPhotos() {
    setPhotos([]);
    setSavedPhotos([]);
  }

  async function loadSavedPhotos(reportId: string) {
    const supabase = getPersonnelSupabase();
    if (!supabase) throw new Error("Oturum bulunamadı.");
    const result = await supabase.from("report_photos").select("id,storage_path,caption").eq("report_id", reportId).order("created_at");
    if (result.error) throw result.error;
    const resolved = await Promise.all((result.data ?? []).map(async (photo) => {
      const signed = await supabase.storage.from("report-photos").createSignedUrl(photo.storage_path, 60 * 60);
      if (signed.error || !signed.data?.signedUrl) throw new Error("Fotoğraf görüntülenemiyor.");
      return { ...photo, url: signed.data.signedUrl } as SavedPhoto;
    }));
    setSavedPhotos(resolved);
  }

  async function removeSavedPhoto(photo: SavedPhoto) {
    const supabase = getPersonnelSupabase();
    if (!supabase || loading) return;
    setLoading(true);
    try {
      const removed = await supabase.from("report_photos").delete().eq("id", photo.id).select("id");
      if (removed.error || !removed.data?.length) throw new Error("Fotoğraf silinemedi. Rapor gönderilmiş olabilir.");
      setSavedPhotos((current) => current.filter((item) => item.id !== photo.id));
      await supabase.storage.from("report-photos").remove([photo.storage_path]);
    } catch (error) { showMessage(error instanceof Error ? error.message : "Fotoğraf silinemedi.", "error"); }
    finally { setLoading(false); }
  }

  async function submitReport(status: ReportStatus, signature?: CustomerSignature) {
    const supabase = getPersonnelSupabase();
    if (!supabase || !profile || submitting.current) return;
    if (readOnlyMode) {
      showMessage("Aboneliğiniz salt okunur durumda. Rapor kaydedilemez.", "error");
      return;
    }
    setMessage("");
    const preparedValues = prepareReportValues(values, belts, equipment);
    if (status === "SUBMITTED") {
      const parsed = reportFormSchema.safeParse(preparedValues);
      if (!parsed.success) {
        showMessage(parsed.error.issues[0]?.message ?? "Form bilgilerini kontrol edin.", "error");
        return;
      }
      if (!customerSignatureSchema.safeParse(signature).success) {
        showMessage("Firma yetkilisinin teslim onayını ve imzasını alın.", "error");
        return;
      }
    }
    submitting.current = true;
    setLoading(true);
    try {
      // A lost final response must not cause another report or overwrite signed evidence.
      const existing = await supabase.from("reports").select("*")
        .eq("client_request_id", preparedValues.client_request_id).maybeSingle();
      if (existing.error) throw new Error("Rapor durumu doğrulanamadı. Bağlantınızı kontrol edip tekrar deneyin.");
      if (existing.data?.status === "SUBMITTED") {
        const expected = reportPayload(preparedValues, "SUBMITTED");
        const matches = status === "SUBMITTED" && Object.entries(expected).every(([key, value]) =>
          JSON.stringify(existing.data[key]) === JSON.stringify(value))
          && JSON.stringify(existing.data.customer_signature) === JSON.stringify(signature);
        if (!matches) {
          openDetail(existing.data.id);
          showMessage("Bu rapor daha önce gönderilmiş. Son değişiklikler uygulanmadı; kayıtlı rapor açıldı.", "error");
          return;
        }
      }
      let saved = existing.data?.status === "SUBMITTED" ? existing.data : null;
      if (!saved) {
        const draft = await supabase.from("reports")
          .upsert(reportPayload(preparedValues, "DRAFT"), { onConflict: "client_request_id" })
          .select("id,report_number,status,updated_at").single();
        if (draft.error || !draft.data) throw new Error("Rapor taslağı kaydedilemedi. Bilgileriniz korunuyor; tekrar deneyin.");
        await replaceReportPersonnel(draft.data.id);
        if (photos.length > 0) await uploadPhotos(draft.data.id);
        if (status === "SUBMITTED") {
          // The report remains a draft until all attachments exist. Signature and status commit together.
          const finalized = await supabase.from("reports")
            .update({ status: "SUBMITTED", customer_signature: signature })
            .eq("id", draft.data.id).eq("status", "DRAFT")
            .eq("updated_at", draft.data.updated_at)
            .select("id,report_number,status").single();
          if (finalized.error || !finalized.data) throw new Error("İmzalı rapor gönderilemedi. Bilgileriniz ve imzanız korunuyor; bağlantınızı kontrol edip tekrar deneyin.");
          saved = finalized.data;
        } else saved = draft.data;
      }
      if (activeAssignment) {
        const result = await supabase.from("installation_assignments")
          .update({ report_id: saved.id, status: saved.status === "SUBMITTED" ? "COMPLETED" : "IN_PROGRESS" })
          .eq("id", activeAssignment.id);
        if (result.error) throw new Error("İmzalı rapor kaydedildi ancak montaj ataması güncellenemedi. Tekrar göndererek atamayı tamamlayabilirsiniz; ikinci bir rapor oluşturulmaz.");
      }
      await loadBootstrapData();
      clearPhotos();
      setValues(newReportValues());
      setActiveAssignment(null);
      setScreen("home");
      showMessage(saved.status === "SUBMITTED" ? "İmzalı rapor gönderildi: " + String(saved.report_number ?? "") : "Taslak kaydedildi.");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Rapor kaydedilemedi. Tekrar deneyin.", "error");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  async function loadAssignmentDraftValues(reportId: string) {
    const supabase = getPersonnelSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("reports")
      .select("*, report_personnel(profile_id,name_snapshot)")
      .eq("id", reportId)
      .eq("status", "DRAFT")
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return reportToValues(data as ReportRow, equipment);
  }

  async function replaceReportPersonnel(reportId: string) {
    const supabase = getPersonnelSupabase();
    if (!supabase || !profile) return;

    const removed = await supabase.from("report_personnel").delete().eq("report_id", reportId);
    if (removed.error) throw new Error("Rapor personeli kaydedilemedi. Tekrar deneyin.");

    const selectedProfiles = [
      profile,
      ...personnel.filter((item) => values.visiting_personnel_ids.includes(item.id) && item.id !== profile.id)
    ];

    if (selectedProfiles.length === 0) return;

    const inserted = await supabase.from("report_personnel").insert(
      selectedProfiles.map((item) => ({
        report_id: reportId,
        profile_id: item.id,
        name_snapshot: `${item.first_name} ${item.last_name}`.trim()
      }))
    );
    if (inserted.error) throw new Error("Rapor personeli kaydedilemedi. Tekrar deneyin.");
  }

  async function uploadPhotos(reportId: string) {
    const supabase = getPersonnelSupabase();
    if (!supabase || !sessionUserId || !profile?.organization_id) throw new Error("Fotoğraflar için oturum doğrulanamadı. Rapor gönderilmedi.");

    for (const photo of photos) {
      const extension = safeExtension(photo.file.name, photo.file.type);
      const storagePath = `${profile.organization_id}/${reportId}/${photo.localId}.${extension}`;
      const existingPhoto = await supabase.from("report_photos").select("id,caption").eq("report_id", reportId).eq("storage_path", storagePath).maybeSingle();
      if (existingPhoto.error) throw new Error("Fotoğraf durumu doğrulanamadı. Tekrar deneyin.");
      if (existingPhoto.data) {
        const updated = await supabase.from("report_photos").update({ caption: photo.caption.trim() || null }).eq("id", existingPhoto.data.id);
        if (updated.error) throw new Error("Fotoğraf açıklaması kaydedilemedi. Tekrar deneyin.");
        await loadSavedPhotos(reportId);
        setPhotos((current) => current.filter((item) => item.localId !== photo.localId));
        continue;
      }
      const upload = await supabase.storage.from("report-photos").upload(storagePath, photo.file, {
        contentType: photo.file.type || "image/jpeg",
        upsert: false
      });

      if (upload.error) {
        // A prior upload can succeed before its response reaches the device.
        const stored = await supabase.storage.from("report-photos").download(storagePath);
        if (stored.error) throw new Error("Fotoğraf yüklenemedi. Rapor taslak olarak korundu; tekrar deneyin.");
      }

      const insertedPhoto = await supabase.from("report_photos").insert({
        report_id: reportId,
        storage_path: storagePath,
        category: defaultPhotoCategory,
        caption: photo.caption.trim() || null,
        created_by: sessionUserId
      });
      if (insertedPhoto.error) throw new Error("Fotoğraf rapora eklenemedi. Tekrar deneyin.");
      await loadSavedPhotos(reportId);
      setPhotos((current) => current.filter((item) => item.localId !== photo.localId));
    }
  }

  if (!sessionUserId) {
    return <PersonnelLogin email={email} loading={loading} message={message} password={password} setEmail={setEmail} setPassword={setPassword} signIn={signIn} />;
  }

  if (accessMessage) {
    return (
      <main className="personnel-page personnel-center">
        <section className="personnel-login-panel">
          <div className="personnel-brand">
            <OrganizationBrand scope="personnel" />
          </div>
          <div className="message error">{accessMessage}</div>
          <Button icon={<LogOut aria-hidden size={18} />} onClick={signOut}>
            Çıkış Yap
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="personnel-page">
      <header className="personnel-topbar">
        <div className="personnel-brand">
          <OrganizationBrand scope="personnel" />
        </div>
        <Button icon={<LogOut aria-hidden size={18} />} onClick={signOut} variant="subtle">
          Çıkış
        </Button>
      </header>

      {message ? <div className={`message ${messageTone}`}>{message}</div> : null}
      {readOnlyMode ? (
        <div className="message info">
          Aboneliğiniz salt okunur durumda. Mevcut rapor ve montajları görüntüleyebilirsiniz; yeni kayıt ve değişiklik yapamazsınız.
        </div>
      ) : null}

      {screen === "home" ? (
        <PersonnelHome
          draftCount={draftReports.length}
          assignmentCount={assignments.length}
          assignments={assignments}
          drafts={draftReports}
          onDrafts={() => setScreen("drafts")}
          onAssignments={() => setScreen("assignments")}
          onAssignmentOpen={openAssignment}
          onDraftOpen={openDraft}
          onNewReport={startNewReport}
          onSubmitted={() => setScreen("submitted")}
          profile={profile}
          readOnlyMode={readOnlyMode}
          submittedCount={submittedReports.length}
        />
      ) : null}

      {screen === "drafts" ? (
        <ReportCards
          emptyText="Henüz taslak rapor yok."
          reports={draftReports}
          title="Taslaklarım"
          onBack={() => setScreen("home")}
          onOpen={openDraft}
        />
      ) : null}

      {screen === "submitted" ? (
        <ReportCards
          emptyText="Henüz gönderilmiş rapor yok."
          reports={submittedReports}
          title="Gönderdiğim Raporlar"
          onBack={() => setScreen("home")}
          onOpen={(report) => openDetail(report.id)}
        />
      ) : null}

      {screen === "assignments" ? (
        <AssignmentCards
          assignments={assignments}
          emptyText="Aktif montaj ataması yok."
          title="Montajlarım"
          onBack={() => setScreen("home")}
          onOpen={openAssignment}
        />
      ) : null}

      {screen === "detail" && selectedReportId ? (
        <ReportDetailView readOnly={readOnlyMode} reportId={selectedReportId} onBack={() => setScreen("submitted")} />
      ) : null}

      {screen === "form" ? (
        <ReportForm
          belts={belts}
          companies={companies}
          companyLines={companyLines}
          equipment={equipment}
          loading={loading}
          personnel={personnel}
          photos={photos}
          savedPhotos={savedPhotos}
          removeSavedPhoto={removeSavedPhoto}
          profile={profile}
          readOnly={readOnlyMode}
          values={values}
          vehicles={vehicles}
          assignmentTitle={activeAssignment?.title ?? null}
          addPhotos={addPhotos}
          onBack={() => { if (!loading) setScreen(activeAssignment ? "assignments" : "home"); }}
          removePhoto={removePhoto}
          submitReport={submitReport}
          toggleArray={toggleArray}
          toggleEquipment={toggleEquipment}
          update={update}
          updatePhotoCaption={updatePhotoCaption}
        />
      ) : null}
    </main>
  );
}

function PersonnelLogin({
  email,
  loading,
  message,
  password,
  setEmail,
  setPassword,
  signIn
}: {
  email: string;
  loading: boolean;
  message: string;
  password: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  signIn: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <main className="personnel-page personnel-center">
      <form className="personnel-login-panel" onSubmit={signIn}>
        <div className="personnel-brand">
          <ProductBrand />
        </div>
        <h1>Personel Girişi</h1>
        <Field label="E-posta">
          <input
            autoComplete="email"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </Field>
        <Field label="Şifre">
          <input
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </Field>
        {message ? <div className="message error">{message}</div> : null}
        <Button className="personnel-primary-action" disabled={loading} type="submit">
          {loading ? "Giriş yapılıyor" : "Giriş Yap"}
        </Button>
      </form>
    </main>
  );
}

function PersonnelHome({
  assignmentCount,
  assignments,
  draftCount,
  drafts,
  onAssignments,
  onAssignmentOpen,
  onDrafts,
  onDraftOpen,
  onNewReport,
  onSubmitted,
  profile,
  readOnlyMode,
  submittedCount
}: {
  assignmentCount: number;
  assignments: InstallationAssignment[];
  draftCount: number;
  drafts: ReportRow[];
  onAssignments: () => void;
  onAssignmentOpen: (assignment: InstallationAssignment) => void;
  onDrafts: () => void;
  onDraftOpen: (report: ReportRow) => void;
  onNewReport: () => void;
  onSubmitted: () => void;
  profile: Profile | null;
  readOnlyMode: boolean;
  submittedCount: number;
}) {
  const firstName = profile?.first_name?.trim() || "Personel";
  const nextAssignments = assignments.slice(0, 3);
  const nextDrafts = drafts.slice(0, 3);

  return (
    <section className="personnel-stack">
      <div className="personnel-hero">
        <span>Saha çalışma alanı</span>
        <h1>Merhaba {firstName}</h1>
        <p>{formatDateDisplay(formatDateValue(new Date()))}</p>
      </div>

      <div className="personnel-grid">
        <button className="personnel-tile primary" disabled={readOnlyMode} onClick={onNewReport} type="button">
          <Plus aria-hidden size={24} />
          Yeni Rapor
        </button>
        <PersonnelMetricTile icon={<ClipboardCheck aria-hidden size={22} />} label="Montaj" value={assignmentCount} onClick={onAssignments} />
        <PersonnelMetricTile icon={<FileText aria-hidden size={22} />} label="Taslak" value={draftCount} onClick={onDrafts} />
        <PersonnelMetricTile icon={<ClipboardList aria-hidden size={22} />} label="Gönderilen" value={submittedCount} onClick={onSubmitted} />
      </div>

      <section className="personnel-section">
        <h2><Clock aria-hidden size={18} /> İş Sırası</h2>
        {nextAssignments.length === 0 ? (
          <EmptyState className="personnel-empty compact" title="Aktif montaj yok">
            Size atanmış açık montaj bulunmuyor.
          </EmptyState>
        ) : (
          <div className="personnel-card-list">
            {nextAssignments.map((assignment) => (
              <button className="personnel-report-card" key={assignment.id} onClick={() => onAssignmentOpen(assignment)} type="button">
                <span>{assignment.report_id ? "Taslak hazır" : assignment.status === "IN_PROGRESS" ? "Devam ediyor" : "Atandı"}</span>
                <strong>{assignment.title}</strong>
                <small>{[assignment.company_name_snapshot, assignmentWorkItemsText(assignment)].filter(Boolean).join(" / ") || "Firma bilgisi yok"}</small>
                <small>{assignment.scheduled_date ? formatDateDisplay(assignment.scheduled_date) : "Tarih seçilmedi"}</small>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="personnel-section">
        <h2><FileText aria-hidden size={18} /> Devam Eden Taslaklar</h2>
        {nextDrafts.length === 0 ? (
          <EmptyState className="personnel-empty compact" title="Taslak yok">
            Kaydedilmiş taslak rapor bulunmuyor.
          </EmptyState>
        ) : (
          <div className="personnel-card-list">
            {nextDrafts.map((report) => (
              <button className="personnel-report-card" key={report.id} onClick={() => onDraftOpen(report)} type="button">
                <span>Taslak</span>
                <strong>{report.company_name_snapshot ?? "Firma seçilmedi"}</strong>
                <small>{reportWorkItemsText(report)}</small>
                <small>{formatDateDisplay(report.report_date) || "-"}</small>
              </button>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function PersonnelMetricTile({
  icon,
  label,
  value,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  onClick: () => void;
}) {
  return (
    <button className="personnel-tile" onClick={onClick} type="button">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </button>
  );
}

function AssignmentCards({
  assignments,
  emptyText,
  title,
  onBack,
  onOpen
}: {
  assignments: InstallationAssignment[];
  emptyText: string;
  title: string;
  onBack: () => void;
  onOpen: (assignment: InstallationAssignment) => void;
}) {
  return (
    <section className="personnel-stack">
      <BackHeader title={title} onBack={onBack} />
      {assignments.length === 0 ? (
        <EmptyState className="personnel-empty" title="Sırada iş yok">
          {emptyText}
        </EmptyState>
      ) : null}
      <div className="personnel-card-list">
        {assignments.map((assignment) => (
          <button className="personnel-report-card" key={assignment.id} onClick={() => onOpen(assignment)} type="button">
            <span>{assignment.report_id ? "Taslak var" : assignment.status === "IN_PROGRESS" ? "Devam ediyor" : "Atandı"}</span>
            <strong>{assignment.title}</strong>
            <small>
              {[assignment.company_name_snapshot, assignmentWorkItemsText(assignment)].filter(Boolean).join(" / ") || "Firma bilgisi yok"}
            </small>
            <small>{assignment.scheduled_date ? formatDateDisplay(assignment.scheduled_date) : "Tarih seçilmedi"}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function ReportCards({
  emptyText,
  reports,
  title,
  onBack,
  onOpen
}: {
  emptyText: string;
  reports: ReportRow[];
  title: string;
  onBack: () => void;
  onOpen: (report: ReportRow) => void;
}) {
  return (
    <section className="personnel-stack">
      <BackHeader title={title} onBack={onBack} />
      {reports.length === 0 ? (
        <EmptyState className="personnel-empty" title="Kayıt yok">
          {emptyText}
        </EmptyState>
      ) : null}
      <div className="personnel-card-list">
        {reports.map((report) => (
          <button className="personnel-report-card" key={report.id} onClick={() => onOpen(report)} type="button">
            <span>{report.status === "SUBMITTED" ? report.report_number ?? "Rapor" : "Taslak"}</span>
            <strong>{report.company_name_snapshot ?? "Firma seçilmedi"}</strong>
            <small>{formatDateDisplay(report.report_date) || "-"}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function ReportDetailView({ reportId, readOnly, onBack }: { reportId: string; readOnly: boolean; onBack: () => void }) {
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [pdfLoading, setPdfLoading] = useState<"download" | "share" | null>(null);
  const [closeoutSaving, setCloseoutSaving] = useState(false);
  const [returnAt, setReturnAt] = useState("");
  const [returnKm, setReturnKm] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "error">("error");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = getPersonnelSupabase();
      if (!supabase) {
        setMessage("Supabase bilgileri girilmedi.");
        return;
      }

      const { data, error } = await supabase
        .from("reports")
        .select("*, report_personnel(name_snapshot), report_photos(id,category,caption,storage_path,created_at)")
        .eq("id", reportId)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setMessage("Rapor detayı alınamadı veya rapor silinmiş olabilir.");
        setReport(null);
        return;
      }

      const nextReport = data as ReportDetail;
      setReport(nextReport);
      setReturnAt(stringValue(nextReport.factory_return_at));
      setReturnKm(stringValue(nextReport.vehicle_end_km));

      const signedEntries = await Promise.all(
        (nextReport.report_photos ?? [])
          .filter((photo) => photo.storage_path)
          .map(async (photo) => {
            const path = String(photo.storage_path);
            const signed = await supabase.storage.from("report-photos").createSignedUrl(path, 60 * 30);
            return [path, signed.data?.signedUrl ?? ""] as const;
          })
      );

      if (!cancelled) {
        setPhotoUrls(Object.fromEntries(signedEntries.filter((entry) => entry[1])));
      }
    }

    load().catch(() => {
      if (!cancelled) setMessage("Rapor detayı alınamadı.");
    });

    return () => {
      cancelled = true;
    };
  }, [reportId]);

  async function handlePdf(mode: "download" | "share") {
    if (!report) return;

    setMessage("");
    setMessageTone("error");
    setPdfLoading(mode);
    try {
      const result = await downloadOrShareReportPdf({
        mode,
        reportId,
        reportNumber: report.report_number,
        scope: "personnel"
      });

      if (!result.ok) {
        setMessage(result.message);
      }
    } finally {
      setPdfLoading(null);
    }
  }

  async function saveReturnCloseout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!report || closeoutSaving || readOnly) return;

    const parsed = reportReturnCloseoutSchema.safeParse({
      customer_departure_at: stringValue(report.customer_departure_at),
      factory_return_at: returnAt,
      vehicle_plate: stringValue(report.vehicle_plate),
      vehicle_start_km: stringValue(report.vehicle_start_km),
      vehicle_end_km: returnKm
    });
    if (!parsed.success) {
      setMessageTone("error");
      setMessage(parsed.error.issues[0]?.message ?? "Dönüş bilgilerini kontrol edin.");
      return;
    }

    const supabase = getPersonnelSupabase();
    if (!supabase) {
      setMessageTone("error");
      setMessage("Supabase bilgileri girilmedi.");
      return;
    }

    setCloseoutSaving(true);
    setMessage("");
    try {
      const result = await supabase
        .from("reports")
        .update({
          factory_return_at: parsed.data.factory_return_at,
          vehicle_end_km: parsed.data.vehicle_end_km || null
        })
        .eq("id", report.id)
        .eq("status", "SUBMITTED")
        .not("customer_signature", "is", null)
        .select("factory_return_at,vehicle_end_km,updated_at")
        .maybeSingle();

      if (result.error || !result.data) throw new Error(result.error?.message || "Dönüş bilgileri kaydedilemedi.");

      setReport((current) => current ? { ...current, ...result.data } : current);
      setReturnAt(stringValue(result.data.factory_return_at));
      setReturnKm(stringValue(result.data.vehicle_end_km));
      setMessageTone("info");
      setMessage("Dönüş kapanışı kaydedildi. Güncel bilgiler PDF ve rapor dokümanlarında görünecek.");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Dönüş bilgileri kaydedilemedi.");
    } finally {
      setCloseoutSaving(false);
    }
  }

  return (
    <section className="personnel-stack">
      <BackHeader title={report?.report_number ?? "Rapor Detayı"} onBack={onBack} />
      {report ? (
        <div className="personnel-detail-actions">
          <Button icon={<Download aria-hidden size={18} />} disabled={pdfLoading !== null} onClick={() => handlePdf("download")} variant="secondary">
            {pdfLoading === "download" ? "Hazırlanıyor" : "PDF İndir"}
          </Button>
          <Button icon={<Share2 aria-hidden size={18} />} className="personnel-primary-action" disabled={pdfLoading !== null} onClick={() => handlePdf("share")}>
            {pdfLoading === "share" ? "Hazırlanıyor" : "Paylaş"}
          </Button>
        </div>
      ) : null}
      {message ? <div role={messageTone === "error" ? "alert" : "status"} className={`message ${messageTone}`}>{message}</div> : null}
      {!report ? (
        <EmptyState className="personnel-empty" title="Rapor yükleniyor">
          Detaylar ve fotoğraf bağlantıları hazırlanıyor.
        </EmptyState>
      ) : null}
      {report ? (
        <>
          <CustomerSignatureView signature={report.customer_signature} signedAt={typeof report.customer_signed_at === "string" ? report.customer_signed_at : null} />
          <form className="personnel-section personnel-return-closeout" onSubmit={saveReturnCloseout}>
            <h2><Clock aria-hidden size={18} /> Dönüş kapanışı</h2>
            <p className="personnel-section-note">Müşteri imzası iş ve teslim kaydını korur. Eve veya ofise ulaştığınızda aşağıdaki dönüş bilgilerini tamamlayabilirsiniz.</p>
            <fieldset className="personnel-form-grid" disabled={closeoutSaving || readOnly}>
              <DateTimeField label="Eve / Ofise Giriş Tarih Saati" value={returnAt} onChange={setReturnAt} />
              {stringValue(report.vehicle_plate) || stringValue(report.vehicle_start_km) ? (
                <TextField inputMode="numeric" label="Dönüş Araç Kilometresi" value={returnKm} onChange={setReturnKm} />
              ) : (
                <div className="personnel-readonly"><strong>Araç kilometresi</strong><span>Bu raporda araç kullanımı kaydedilmemiş.</span></div>
              )}
            </fieldset>
            <div className="personnel-closeout-actions">
              <Button className="personnel-primary-action" disabled={closeoutSaving || readOnly} icon={<Save aria-hidden size={18} />} type="submit">
                {closeoutSaving ? "Kaydediliyor" : "Dönüş bilgilerini kaydet"}
              </Button>
            </div>
          </form>
          <DetailSection
            title="Genel Bilgiler"
            rows={[
              ["Rapor No", report.report_number ?? "Taslak"],
              ["Tarih", formatDateDisplay(report.report_date)],
              ["Firma", text(report.company_name_snapshot)],
              ["Yetkili Kişi", text(report.company_contact_name)],
              ["Yetkili Telefon", text(report.company_contact_phone)],
              ["Hat Adı", text(report.line_name)],
              ["Bant Kodu", reportBeltCodesText(report)],
              ["İş Kalemleri", reportWorkItemsText(report)],
              ["Giden Personel", report.report_personnel?.map((item) => item.name_snapshot).filter(Boolean).join(", ") || "-"],
              ["Araç Plakası", text(report.vehicle_plate)],
              ["Araç Alış KM", text(report.vehicle_start_km)],
              ["Dönüş Araç KM", text(report.vehicle_end_km)],
              ["Kullanılan Makine ve Ekipman", text(report.used_equipment)]
            ]}
          />
          <DetailSection
            title="Zaman Bilgileri"
            rows={[
              ["Atölyeden Çıkış", formatDateTimeDisplay(report.workshop_departure_at)],
              ["Müşteriye Varış", formatDateTimeDisplay(report.customer_arrival_at)],
              ["Müşteriden Çıkış", formatDateTimeDisplay(report.customer_departure_at)],
              ["Eve / Ofise Giriş", formatDateTimeDisplay(report.factory_return_at)]
            ]}
          />
          <DetailSection
            title="Ürün ve İşlem"
            rows={[
              ["Ürün Kodları", reportProductCodesText(report)],
              ["Ürün Ölçüleri", reportProductMeasurementsText(report)],
              ["Ürün Türü", arrayText(report.product_types)],
              ["Yapılan İşlem", arrayText(report.process_actions)],
              ["Açıklama", text(report.process_description)]
            ]}
          />
          <DetailSection
            title="Pres ve Teknik"
            rows={[
              ["Test Parçası", text(report.has_test_piece)],
              ["Test Durumu", text(report.test_status)],
              ["Gözlemci", fallbackText(text(report.observer_name_snapshot), text(report.observer_external_name))],
              ["Pres Başlama", text(report.press_start_time)],
              ["Pres Bitiş", text(report.press_end_time)],
              ["Enerji Kesintisi", text(report.power_outage)],
              ["Basınç Düşmesi", text(report.pressure_drop)],
              ["Isı Dengesi", text(report.heat_balance_ok)],
              ["Teknik Detaylar", text(report.technical_details)]
            ]}
          />
          <DetailSection
            title="Gerdirme"
            rows={[
              ["Gerdirme Yapıldı mı?", text(report.tensioning_done)],
              ["Müşteri Sonra Yapacak", boolText(report.customer_will_tension)],
              ["Müşteri Otomatik Sistemde Yaptı", boolText(report.customer_tensioned_auto)],
              ["Uygulanan Basınç", [text(report.pressure_value), text(report.pressure_unit)].filter((value) => value !== "-").join(" ") || "-"],
              ["Ön Gerdirme %", text(report.pre_tension_percent)],
              ["Hat Çalışır Teslim Edildi", boolText(report.line_delivered_running)]
            ]}
          />
          <section className="personnel-section">
            <h2><ImageIcon aria-hidden size={18} /> Fotoğraflar</h2>
            {(report.report_photos ?? []).length === 0 ? (
              <EmptyState className="personnel-empty" title="Fotoğraf yok">
                Fotoğraf eklenmemiş.
              </EmptyState>
            ) : (
              <div className="personnel-photo-grid">
                {(report.report_photos ?? []).map((photo) => {
                  const path = photo.storage_path ?? "";
                  const signedUrl = photoUrls[path];

                  return (
                    <div className="personnel-photo-card" key={photo.id ?? path}>
                      {signedUrl ? (
                        <Image
                          alt={photo.caption || "Rapor fotoğrafı"}
                          height={180}
                          src={signedUrl}
                          unoptimized
                          width={240}
                        />
                      ) : (
                        <div className="personnel-photo-placeholder">
                          <ImageIcon aria-hidden size={24} />
                        </div>
                      )}
                      <span>{photo.caption || "Açıklama yok"}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}

function ReportForm({
  addPhotos,
  assignmentTitle,
  belts,
  companies,
  companyLines,
  equipment,
  loading,
  personnel,
  photos,
  savedPhotos,
  removeSavedPhoto,
  profile,
  readOnly,
  removePhoto,
  submitReport,
  toggleArray,
  toggleEquipment,
  update,
  updatePhotoCaption,
  values,
  vehicles,
  onBack
}: {
  addPhotos: (files: FileList | null) => void;
  assignmentTitle?: string | null;
  belts: Belt[];
  companies: Company[];
  companyLines: CompanyLine[];
  equipment: Equipment[];
  loading: boolean;
  personnel: Profile[];
  photos: PhotoDraft[];
  savedPhotos: SavedPhoto[];
  removeSavedPhoto: (photo: SavedPhoto) => Promise<void>;
  profile: Profile | null;
  readOnly: boolean;
  removePhoto: (localId: string) => void;
  submitReport: (status: ReportStatus, signature?: CustomerSignature) => Promise<void>;
  toggleArray: (
    key: "visiting_personnel_ids" | "product_types" | "process_actions" | "replacement_reasons",
    value: string
  ) => void;
  toggleEquipment: (value: string) => void;
  update: <K extends keyof ReportFormValues>(key: K, value: ReportFormValues[K]) => void;
  updatePhotoCaption: (localId: string, caption: string) => void;
  values: ReportFormValues;
  vehicles: Vehicle[];
  onBack: () => void;
}) {
  const [reviewing, setReviewing] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const isAssignedReport = Boolean(assignmentTitle);
  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === values.company_id),
    [companies, values.company_id]
  );
  const selectedCompanyLines = useMemo(
    () => companyLines.filter((line) => line.company_id === values.company_id),
    [companyLines, values.company_id]
  );
  const beltsById = useMemo(
    () => new Map(belts.map((belt) => [belt.id, belt])),
    [belts]
  );
  const formWorkItems = useMemo(
    () => enrichReportWorkItems(
      workItemsFromValue(
        values.work_items,
        values.line_name,
        values.belt_id,
        "",
        "",
        values.product_width,
        values.product_length,
        values.product_quantity,
        values.machine_brand_model,
        values.product_item_coil_code
      ),
      beltsById
    ),
    [
      beltsById,
      values.belt_id,
      values.line_name,
      values.machine_brand_model,
      values.product_item_coil_code,
      values.product_length,
      values.product_quantity,
      values.product_width,
      values.work_items
    ]
  );
  const beltCodesText = workItemBeltCodesText(formWorkItems, values.belt_id, beltsById);

  function updateWorkItems(nextItems: ReportWorkItem[]) {
    const enriched = enrichReportWorkItems(normalizeReportWorkItems(nextItems), beltsById);
    const primaryWorkItem = compactReportWorkItems(enriched)[0] ?? enriched[0] ?? emptyReportWorkItem();
    update("work_items", enriched);
    update("line_name", primaryWorkItem.line_name);
    update("belt_id", primaryWorkItem.belt_id);
    update("machine_brand_model", primaryWorkItem.machine_name);
    update("product_item_coil_code", primaryWorkItem.coil_code);
  }

  function updateReportWorkItem(index: number, key: keyof ReportWorkItem, value: string) {
    const nextItems = normalizeReportWorkItems(formWorkItems).map((item, itemIndex) => {
      if (itemIndex !== index) return item;

      if (key === "belt_id") {
        const belt = beltsById.get(value);
        return {
          ...item,
          belt_id: value,
          belt_code: belt?.code ?? "",
          belt_name: belt?.name ?? ""
        };
      }

      return { ...item, [key]: value };
    });

    updateWorkItems(nextItems);
  }

  function addWorkItem() {
    updateWorkItems([...normalizeReportWorkItems(formWorkItems), emptyReportWorkItem()]);
  }

  function removeWorkItem(index: number) {
    const nextItems = normalizeReportWorkItems(formWorkItems).filter((_, itemIndex) => itemIndex !== index);
    updateWorkItems(nextItems.length > 0 ? nextItems : [emptyReportWorkItem()]);
  }

  useEffect(() => {
    if (!selectedCompany) return;
    update("company_contact_name", selectedCompany.contact_name ?? "");
    update("company_contact_phone", selectedCompany.contact_phone ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany?.id]);

  useEffect(() => {
    const validLineNames = new Set(selectedCompanyLines.map((line) => line.name));
    const nextItems = formWorkItems.map((item) => {
      if (!values.company_id) return { ...item, line_name: "" };
      if (item.line_name && !validLineNames.has(item.line_name)) return { ...item, line_name: "" };
      return item;
    });
    const changed = nextItems.some((item, index) => item.line_name !== formWorkItems[index]?.line_name);

    if (changed) {
      updateWorkItems(nextItems);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formWorkItems, selectedCompanyLines, values.company_id]);

  return (
    <section className="personnel-stack">
      <BackHeader title={isAssignedReport ? "Montaj Raporu" : "Rapor Formu"} onBack={onBack} />
      {isAssignedReport ? (
        <div className="message info">
          {assignmentTitle} için ön bilgiler dolduruldu. İşlem sonrası bilgileri tamamlayıp raporu gönderin.
        </div>
      ) : null}
      {companies.length === 0 ? (
        <div className="message error">Firma bulunamadı. Yetkili amirden firma eklemesini isteyin.</div>
      ) : null}

      <fieldset className="personnel-disabled-form personnel-report-form" disabled={readOnly || loading} hidden={reviewing} style={reviewing ? { display: "none" } : undefined}>
      <details className="personnel-section" open>
        <summary><span className="section-number">1</span><span>Genel Bilgiler</span></summary>
        <div className="personnel-form-grid">
          <Field label="Rapor Tarihi">
            <input type="date" value={values.report_date} onChange={(event) => update("report_date", event.target.value)} />
          </Field>
          <Field label="Müşteri Ünvanı ve Adresi / Firma">
            <select value={values.company_id} onChange={(event) => update("company_id", event.target.value)}>
              <option value="">Firma seçin</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </Field>
          <TextField label="Yetkili Kişi" value={values.company_contact_name} onChange={(value) => update("company_contact_name", value)} />
          <TextField label="Yetkili Telefon" value={values.company_contact_phone} onChange={(value) => update("company_contact_phone", value)} />
          <ReportWorkItemsField
            belts={belts}
            companySelected={Boolean(values.company_id)}
            items={formWorkItems}
            lines={selectedCompanyLines}
            onAdd={addWorkItem}
            onRemove={removeWorkItem}
            onUpdate={updateReportWorkItem}
          />
          <Field label="Bant Kodu">
            <div className="personnel-readonly">{beltCodesText}</div>
          </Field>
          <Field label="Formu Dolduran Personel">
            <div className="personnel-readonly">{profile ? `${profile.first_name} ${profile.last_name}` : "-"}</div>
          </Field>
          <Field label="Araç Alış KM">
            <input
              inputMode="numeric"
              onChange={(event) => update("vehicle_start_km", event.target.value)}
              value={values.vehicle_start_km}
            />
          </Field>
          <Field label="Dönüş Araç Kilometresi">
            <input
              inputMode="numeric"
              onChange={(event) => update("vehicle_end_km", event.target.value)}
              value={values.vehicle_end_km}
            />
          </Field>
          <CheckPicker
            label="Giden Personel"
            options={personnel
              .filter((item) => item.id !== profile?.id)
              .map((item) => ({ label: `${item.first_name} ${item.last_name}`, value: item.id }))}
            selected={values.visiting_personnel_ids}
            onToggle={(value) => toggleArray("visiting_personnel_ids", value)}
          />
          <Field label="Kullanılan Araç Plakası">
            <select value={values.vehicle_plate} onChange={(event) => update("vehicle_plate", event.target.value)}>
              <option value="">Plaka seçin</option>
              {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.plate}>{vehicle.plate}</option>)}
            </select>
          </Field>
          <CheckPicker
            className="span-2 personnel-compact-picker"
            label="Kullanılan Makine ve Ekipmanları"
            options={equipment.map((item) => ({ label: item.name, value: item.id }))}
            selected={values.used_equipment_ids}
            onToggle={toggleEquipment}
          />
        </div>
      </details>

      <details className="personnel-section">
        <summary><span className="section-number">2</span><span>Zaman Bilgileri</span></summary>
        <div className="personnel-form-grid">
          <DateTimeField label="Atölyeden Çıkış Tarih Saati" value={values.workshop_departure_at} onChange={(value) => update("workshop_departure_at", value)} />
          <DateTimeField label="Müşteriye Varış Tarih Saati" value={values.customer_arrival_at} onChange={(value) => update("customer_arrival_at", value)} />
          <DateTimeField label="Müşteriden Çıkış Tarih Saati" value={values.customer_departure_at} onChange={(value) => update("customer_departure_at", value)} />
          <DateTimeField label="Eve / Ofise Giriş Tarih Saati" value={values.factory_return_at} onChange={(value) => update("factory_return_at", value)} />
        </div>
      </details>

      <details className="personnel-section">
        <summary><span className="section-number">3</span><span>Ürün Bilgileri</span></summary>
        <div className="personnel-form-grid personnel-product-grid">
          <ProductItemsField items={formWorkItems} onUpdate={updateReportWorkItem} />
          <CheckPicker
            className="span-2 personnel-compact-picker"
            label="İşlem Görecek Ürün Türü"
            options={productTypes.map((value) => ({ label: value, value }))}
            selected={values.product_types}
            onToggle={(value) => toggleArray("product_types", value)}
          />
          {values.product_types.includes("Diğer") ? (
            <TextField label="Diğer Açıklama" value={values.product_type_other} onChange={(value) => update("product_type_other", value)} />
          ) : null}
        </div>
      </details>

      <details className="personnel-section">
        <summary><span className="section-number">4</span><span>Yapılan İşlemler</span></summary>
        <div className="personnel-form-grid personnel-process-grid">
          <CheckPicker
            className="span-2 personnel-compact-picker"
            label="Yapılacak İşlem"
            options={processActions.map((value) => ({ label: value, value }))}
            selected={values.process_actions}
            onToggle={(value) => toggleArray("process_actions", value)}
          />
          {values.process_actions.includes("Kenar Kesim") ? (
            <RadioField
              label="Kenar Kesim"
              options={["Makine ile", "El ile"]}
              value={values.edge_cut_method}
              onChange={(value) => update("edge_cut_method", value as ReportFormValues["edge_cut_method"])}
            />
          ) : null}
          {values.process_actions.includes("Diğer") ? (
            <TextField label="Diğer İşlem Açıklama" value={values.process_action_other} onChange={(value) => update("process_action_other", value)} />
          ) : null}
          <TextField className="span-2" multiline label="Kullanılan Mekanik Bağlantı Tipi ve Miktarı" value={values.mechanical_connection} onChange={(value) => update("mechanical_connection", value)} />
          <TextField className="span-2" multiline label="Kullanılan Profil Tipi ve Miktarı" value={values.profile_material} onChange={(value) => update("profile_material", value)} />
          <TextField label="Kaç Yıldır Çalışıyordu?" value={values.removed_belt_years} onChange={(value) => update("removed_belt_years", value)} />
          <CheckPicker
            className="span-2 personnel-compact-picker"
            label="Değiştirme Sebebi Nedir?"
            options={replacementReasonOptions.map((value) => ({ label: value, value }))}
            selected={values.replacement_reasons}
            onToggle={(value) => toggleArray("replacement_reasons", value)}
          />
          {values.replacement_reasons.includes("Diğer") ? (
            <TextField label="Diğer Sebep" value={values.replacement_reason_other} onChange={(value) => update("replacement_reason_other", value)} />
          ) : null}
        </div>
      </details>

      <details className="personnel-section">
        <summary><span className="section-number">5</span><span>Test ve Pres Bilgileri</span></summary>
        <div className="personnel-form-grid">
          <RadioField label="Ürün Test Parçası Var mı?" options={["Var", "Yok"]} value={values.has_test_piece} onChange={(value) => update("has_test_piece", value as ReportFormValues["has_test_piece"])} />
          <RadioField label="Test Durumu" options={["Test Yapıldı", "Test Yapılmadı"]} value={values.test_status} onChange={(value) => update("test_status", value as ReportFormValues["test_status"])} />
          <Field label="Gözlemci Personel">
            <select value={values.observer_personnel_id} onChange={(event) => update("observer_personnel_id", event.target.value)}>
              <option value="">Personel seçilmedi</option>
              {personnel.map((item) => <option key={item.id} value={item.id}>{item.first_name} {item.last_name}</option>)}
            </select>
          </Field>
          <TextField label="Dış Personel Açıklama" value={values.observer_external_name} onChange={(value) => update("observer_external_name", value)} />
          <Field label="Pres İşlemi Başlama Saati">
            <input type="time" value={values.press_start_time} onChange={(event) => update("press_start_time", event.target.value)} />
          </Field>
          <Field label="Pres İşlemi Bitiş Saati">
            <input type="time" value={values.press_end_time} onChange={(event) => update("press_end_time", event.target.value)} />
          </Field>
          <RadioField label="Enerji Kesintisi Oldu mu?" options={["Hayır", "Evet"]} value={values.power_outage} onChange={(value) => update("power_outage", value as ReportFormValues["power_outage"])} />
          <RadioField label="Basınç Düşmesi Oldu mu?" options={["Hayır", "Evet"]} value={values.pressure_drop} onChange={(value) => update("pressure_drop", value as ReportFormValues["pressure_drop"])} />
          <RadioField label="Üst Isı Alt Isı Dengesi Uygun mu?" options={["Hayır", "Evet"]} value={values.heat_balance_ok} onChange={(value) => update("heat_balance_ok", value as ReportFormValues["heat_balance_ok"])} />
        </div>
      </details>

      <details className="personnel-section">
        <summary><span className="section-number">6</span><span>Teknik Detaylar</span></summary>
        <div className="personnel-form-grid">
          <TextField multiline label="Yapılan İşlem Açıklama" value={values.process_description} onChange={(value) => update("process_description", value)} />
          <RadioField
            label="Faturalandırma Durumu"
            options={["Yapılan İşlem Tarafınıza Fatura Edilecektir", "Bedelsiz İşlem Yapılmıştır"]}
            value={values.billing_status}
            onChange={(value) => update("billing_status", value as ReportFormValues["billing_status"])}
          />
          <TextField multiline label="Teknik Detaylar" value={values.technical_details} onChange={(value) => update("technical_details", value)} />
        </div>
      </details>

      <details className="personnel-section">
        <summary><span className="section-number">7</span><span>Gerdirme ve Blanket</span></summary>
        <div className="personnel-form-grid">
          <RadioField label="Gerdirme İşlemi Yapıldı mı?" options={["Evet", "Hayır"]} value={values.tensioning_done} onChange={(value) => update("tensioning_done", value as ReportFormValues["tensioning_done"])} />
          <ToggleField label="Müşteri Daha Sonra Kendisi Yapacak" value={values.customer_will_tension} onChange={(value) => update("customer_will_tension", value)} />
          <ToggleField label="Gerdirme İşlemini Müşteri Kendisi Otomatik Sistemde Yaptı" value={values.customer_tensioned_auto} onChange={(value) => update("customer_tensioned_auto", value)} />
          <TextField label="Uygulanan Basınç Miktarı" value={values.pressure_value} onChange={(value) => update("pressure_value", value)} />
          <TextField label="Birim" value={values.pressure_unit} onChange={(value) => update("pressure_unit", value)} />
          <TextField inputMode="numeric" label="Ön Gerdirme Değeri %" value={values.pre_tension_percent} onChange={(value) => update("pre_tension_percent", value)} />
          <ToggleField label="Hat Çalışır Durumda Teslim Edildi" value={values.line_delivered_running} onChange={(value) => update("line_delivered_running", value)} />
          <RadioField label="Blanketler İçin Pürüzlendirme Bilgisi Verildi mi?" options={["Evet", "Hayır"]} value={values.blanket_roughening_info_given} onChange={(value) => update("blanket_roughening_info_given", value as ReportFormValues["blanket_roughening_info_given"])} />
          <TextField label="Bilgilendirme Yapılan Kişi Ad Soyad" value={values.blanket_info_person_name} onChange={(value) => update("blanket_info_person_name", value)} />
        </div>
      </details>

      <details className="personnel-section">
        <summary><span className="section-number">8</span><span>Fotoğraflar</span></summary>
        <div className="personnel-photo-actions">
          <details className="personnel-choice-panel personnel-photo-picker">
            <summary>
              <Upload aria-hidden size={18} />
              Fotoğraf Yükle
            </summary>
            <div>
              <label className="button">
                <Camera aria-hidden size={18} />
                Kamera
                <input
                  accept="image/*"
                  capture="environment"
                  hidden
                  type="file"
                  onChange={(event) => {
                    addPhotos(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
              <label className="button secondary">
                <ImageIcon aria-hidden size={18} />
                Galeri
                <input
                  accept="image/*"
                  hidden
                  multiple
                  type="file"
                  onChange={(event) => {
                    addPhotos(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
          </details>
        </div>
        {photos.length === 0 && savedPhotos.length === 0 ? <div className="personnel-empty compact">Fotoğraf seçilmedi.</div> : null}
        {savedPhotos.map((photo) => <div key={photo.id} className="personnel-photo-card">
          <SignaturePhotoPreview url={photo.url} caption={photo.caption ?? "Kayıtlı fotoğraf"} />
          <Button variant="subtle" disabled={loading} icon={<Trash2 aria-hidden size={16} />} onClick={() => removeSavedPhoto(photo)}>Kayıtlı fotoğrafı kaldır</Button>
        </div>)}
        <div className="personnel-selected-photos">
          {photos.map((photo) => (
            <div className="personnel-selected-photo" key={photo.localId}>
              <ImageIcon aria-hidden size={20} />
              <span>{photo.file.name}</span>
              <input
                aria-label="Fotoğraf açıklaması"
                placeholder="Açıklama"
                value={photo.caption}
                onChange={(event) => updatePhotoCaption(photo.localId, event.target.value)}
              />
              <button className="button subtle" onClick={() => removePhoto(photo.localId)} type="button">
                <Trash2 aria-hidden size={16} />
                Sil
              </button>
            </div>
          ))}
        </div>
      </details>

      {validationMessage ? <div role="alert" className="message error">{validationMessage}</div> : null}
      <div className="personnel-footer-actions">
        <Button icon={<Save aria-hidden size={18} />} disabled={loading} onClick={() => submitReport("DRAFT")} variant="secondary">
          Taslak Kaydet
        </Button>
        <Button icon={<Send aria-hidden size={18} />} className="personnel-primary-action" disabled={loading || companies.length === 0} onClick={() => {
          const parsed = reportFormSchema.safeParse(prepareReportValues(values, belts, equipment));
          if (!parsed.success) { setValidationMessage(parsed.error.issues[0]?.message ?? "Formu kontrol edin."); return; }
          setValidationMessage(""); setReviewing(true); window.scrollTo({ top: 0, behavior: "instant" });
        }}>
          {loading ? "Kaydediliyor" : "Teslim ve imza"}
        </Button>
      </div>
      </fieldset>
      {reviewing ? <CustomerSignatureApproval companyName={selectedCompany?.name ?? "Firma"} reportDate={values.report_date}
        initialName={values.company_contact_name} loading={loading} onBack={() => setReviewing(false)}
        onSubmit={(signature) => submitReport("SUBMITTED", signature)}
        summary={<>
          <span>{values.process_actions.join(" · ")}</span>
          <span>{values.process_description || "İşlem açıklaması girilmedi."}</span>
          <span>{values.work_items.map((item) => [item.line_name, item.belt_code || item.belt_name, item.product_quantity && item.product_quantity + " adet"].filter(Boolean).join(" / ")).join(" · ")}</span>
          <span>{values.line_delivered_running ? "Hat çalışır durumda teslim edildi." : "Hat çalışır teslim olarak işaretlenmedi."}</span>
          {values.technical_details ? <span>{values.technical_details}</span> : null}
          {values.billing_status ? <strong>{values.billing_status}</strong> : null}
          <span>{savedPhotos.length + photos.length} fotoğraf · Raporun tamamını incelemek için “Rapora dön” seçeneğini kullanın.</span>
          {savedPhotos.map((photo) => <SignaturePhotoPreview key={photo.id} url={photo.url} caption={photo.caption ?? "Kayıtlı fotoğraf"} />)}
          {photos.map((photo) => <SignaturePhotoPreview key={photo.localId} file={photo.file} caption={photo.caption || photo.file.name} />)}
        </>} /> : null}
    </section>
  );
}

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="personnel-back-header">
      <Button icon={<ArrowLeft aria-hidden size={18} />} onClick={onBack} variant="subtle">
        Geri
      </Button>
      <h1>{title}</h1>
    </div>
  );
}

function DetailSection({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <section className="personnel-section">
      <h2>{title}</h2>
      <dl className="personnel-kv">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || "-"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Field({
  children,
  className,
  label
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <label className={["personnel-field", className].filter(Boolean).join(" ")}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function TextField({
  className,
  inputMode,
  label,
  multiline = false,
  value,
  onChange
}: {
  className?: string;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
  label: string;
  multiline?: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field {...(className ? { className } : {})} label={label}>
      {multiline ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input inputMode={inputMode} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </Field>
  );
}

function DateTimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <input type="datetime-local" value={toDatetimeLocal(value)} onChange={(event) => onChange(fromDatetimeLocal(event.target.value))} />
    </Field>
  );
}

function RadioField({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Seçilmedi</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </Field>
  );
}

function CheckPicker({
  className,
  label,
  options,
  selected,
  onToggle
}: {
  className?: string;
  label: string;
  options: Array<{ label: string; value: string }>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const selectedLabels = options
    .filter((option) => selected.includes(option.value))
    .map((option) => option.label);

  return (
    <div className={["personnel-field", className].filter(Boolean).join(" ")}>
      <span>{label}</span>
      <details className="personnel-choice-panel">
        <summary>{selectedLabels.length > 0 ? selectedLabels.join(", ") : options.length > 0 ? "Seçim yapın" : "Seçilebilir kayıt yok"}</summary>
        <div>
          {options.map((option) => (
            <label className="personnel-check-row" key={option.value}>
              <input
                checked={selected.includes(option.value)}
                onChange={() => onToggle(option.value)}
                type="checkbox"
              />
              <span>{option.label}</span>
              {selected.includes(option.value) ? <CheckCircle2 aria-hidden size={16} /> : null}
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}

function ProductItemsField({
  items,
  onUpdate
}: {
  items: ReportWorkItem[];
  onUpdate: (index: number, key: keyof ReportWorkItem, value: string) => void;
}) {
  const rows = normalizeReportWorkItems(items);

  return (
    <div className="personnel-field span-2 product-items-field">
      <span>Ürün Detayları</span>
      <div className="product-item-list">
        <div className="product-item-row product-item-head">
          <span>Ürün Kodu</span>
          <span>Makine Adı</span>
          <span>Item / Coil Kodu</span>
          <span>En</span>
          <span>Boy</span>
          <span>Miktar</span>
        </div>
        {rows.map((item, index) => (
          <div className="product-item-row" key={index}>
            <div className="product-code-chip">{item.belt_code || "Bant kodu seçin"}</div>
            <input
              aria-label={`${item.belt_code || index + 1}. satır makine adı`}
              onChange={(event) => onUpdate(index, "machine_name", event.target.value)}
              placeholder="Makine adı"
              value={item.machine_name}
            />
            <input
              aria-label={`${item.belt_code || index + 1}. satır item veya coil kodu`}
              onChange={(event) => onUpdate(index, "coil_code", event.target.value)}
              placeholder="Item / Coil kodu"
              value={item.coil_code}
            />
            <input
              aria-label={`${item.belt_code || index + 1}. satır en`}
              onChange={(event) => onUpdate(index, "product_width", event.target.value)}
              placeholder="En"
              value={item.product_width}
            />
            <input
              aria-label={`${item.belt_code || index + 1}. satır boy`}
              onChange={(event) => onUpdate(index, "product_length", event.target.value)}
              placeholder="Boy"
              value={item.product_length}
            />
            <input
              aria-label={`${item.belt_code || index + 1}. satır miktar`}
              inputMode="numeric"
              onChange={(event) => onUpdate(index, "product_quantity", event.target.value)}
              placeholder="Miktar"
              value={item.product_quantity}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportWorkItemsField({
  belts,
  companySelected,
  items,
  lines,
  onAdd,
  onRemove,
  onUpdate
}: {
  belts: Belt[];
  companySelected: boolean;
  items: ReportWorkItem[];
  lines: CompanyLine[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, key: keyof ReportWorkItem, value: string) => void;
}) {
  const rows = normalizeReportWorkItems(items);

  return (
    <div className="personnel-field span-2 work-items-field">
      <span>İş Kalemleri</span>
      <div className="work-item-list">
        {rows.map((item, index) => (
          <div className="work-item-row" key={index}>
            <select
              disabled={!companySelected}
              onChange={(event) => onUpdate(index, "line_name", event.target.value)}
              value={item.line_name}
            >
              <option value="">{companySelected ? "Hat seçin" : "Önce firma seçin"}</option>
              {lines.map((line) => <option key={line.id} value={line.name}>{line.name}</option>)}
            </select>
            <select onChange={(event) => onUpdate(index, "belt_id", event.target.value)} value={item.belt_id}>
              <option value="">Bant kodu seçin</option>
              {belts.map((belt) => <option key={belt.id} value={belt.id}>{formatBeltLabel(belt)}</option>)}
            </select>
            {rows.length > 1 ? (
              <button className="button subtle icon-button" onClick={() => onRemove(index)} type="button">
                <X aria-hidden size={16} />
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <button className="button secondary contact-add-button" onClick={onAdd} type="button">
        <Plus aria-hidden size={16} />
        Kalem Ekle
      </button>
    </div>
  );
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="personnel-toggle-row">
      <input checked={value} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <span>{label}</span>
    </label>
  );
}

function newReportValues(): ReportFormValues {
  return {
    ...emptyReportFormValues,
    client_request_id: createId(),
    report_date: formatDateValue(new Date())
  } as ReportFormValues;
}

function reportPayload(values: ReportFormValues, status: ReportStatus) {
  const nullable = (value: string) => value.trim() || null;
  const workItems = compactReportWorkItems(values.work_items);
  const primaryWorkItem = workItems[0] ?? emptyReportWorkItem();
  const productCodes = workItemProductCodes(workItems);

  return {
    client_request_id: values.client_request_id,
    customer_signature_required: true,
    status,
    report_date: values.report_date || formatDateValue(new Date()),
    company_id: values.company_id || null,
    company_contact_name: nullable(values.company_contact_name),
    company_contact_phone: nullable(values.company_contact_phone),
    line_name: nullable(primaryWorkItem.line_name || values.line_name),
    work_items: workItems,
    machine_brand_model: nullable(primaryWorkItem.machine_name || values.machine_brand_model),
    customer_machine_name: nullable(values.customer_machine_name),
    belt_id: primaryWorkItem.belt_id || values.belt_id || null,
    vehicle_plate: nullable(values.vehicle_plate),
    vehicle_start_km: nullable(values.vehicle_start_km),
    vehicle_end_km: nullable(values.vehicle_end_km),
    used_equipment: nullable(values.used_equipment),
    workshop_departure_at: nullable(values.workshop_departure_at),
    customer_arrival_at: nullable(values.customer_arrival_at),
    customer_departure_at: nullable(values.customer_departure_at),
    factory_return_at: nullable(values.factory_return_at),
    product_code: nullable(productCodes.join("\n") || values.product_code),
    product_measure: null,
    product_width: nullable(primaryWorkItem.product_width || values.product_width),
    product_length: nullable(primaryWorkItem.product_length || values.product_length),
    product_quantity: nullable(primaryWorkItem.product_quantity || values.product_quantity),
    product_item_coil_code: nullable(primaryWorkItem.coil_code || values.product_item_coil_code),
    product_types: values.product_types,
    product_type_other: nullable(values.product_type_other),
    process_actions: values.process_actions,
    edge_cut_method: nullable(values.edge_cut_method),
    process_action_other: nullable(values.process_action_other),
    mechanical_connection: nullable(values.mechanical_connection),
    profile_material: nullable(values.profile_material),
    removed_belt_years: nullable(values.removed_belt_years),
    replacement_reasons: values.replacement_reasons,
    replacement_reason_other: nullable(values.replacement_reason_other),
    has_test_piece: nullable(values.has_test_piece),
    test_status: nullable(values.test_status),
    observer_personnel_id: values.observer_personnel_id || null,
    observer_external_name: nullable(values.observer_external_name),
    press_start_time: nullable(values.press_start_time),
    press_end_time: nullable(values.press_end_time),
    power_outage: nullable(values.power_outage),
    pressure_drop: nullable(values.pressure_drop),
    heat_balance_ok: nullable(values.heat_balance_ok),
    process_description: nullable(values.process_description),
    billing_status: nullable(values.billing_status),
    technical_details: nullable(values.technical_details),
    tensioning_done: nullable(values.tensioning_done),
    customer_will_tension: values.customer_will_tension,
    customer_tensioned_auto: values.customer_tensioned_auto,
    pressure_value: nullable(values.pressure_value),
    pressure_unit: nullable(values.pressure_unit),
    pre_tension_percent: nullable(values.pre_tension_percent),
    line_delivered_running: values.line_delivered_running,
    blanket_roughening_info_given: nullable(values.blanket_roughening_info_given),
    blanket_info_person_name: nullable(values.blanket_info_person_name)
  };
}

function reportToValues(report: ReportRow, equipment: Equipment[]): ReportFormValues {
  const workItems = workItemsFromValue(
    report.work_items,
    stringValue(report.line_name),
    stringValue(report.belt_id),
    stringValue(report.belt_code_snapshot),
    stringValue(report.belt_name_snapshot),
    stringValue(report.product_width),
    stringValue(report.product_length),
    stringValue(report.product_quantity),
    stringValue(report.machine_brand_model),
    stringValue(report.product_item_coil_code)
  );
  const primaryWorkItem = compactReportWorkItems(workItems)[0] ?? workItems[0] ?? emptyReportWorkItem();
  const equipmentIds = equipmentIdsFromValue(report.used_equipment_ids, stringValue(report.used_equipment), equipment);

  return {
    ...emptyReportFormValues,
    client_request_id: stringValue(report.client_request_id) || createId(),
    report_date: stringValue(report.report_date) || formatDateValue(new Date()),
    company_id: stringValue(report.company_id),
    company_contact_name: stringValue(report.company_contact_name),
    company_contact_phone: stringValue(report.company_contact_phone),
    line_name: primaryWorkItem.line_name,
    work_items: workItems,
    machine_brand_model: primaryWorkItem.machine_name || stringValue(report.machine_brand_model),
    customer_machine_name: stringValue(report.customer_machine_name),
    belt_id: primaryWorkItem.belt_id,
    visiting_personnel_ids: (report.report_personnel ?? [])
      .map((item) => item.profile_id)
      .filter((value): value is string => Boolean(value)),
    vehicle_plate: stringValue(report.vehicle_plate),
    vehicle_start_km: stringValue(report.vehicle_start_km),
    vehicle_end_km: stringValue(report.vehicle_end_km),
    used_equipment_ids: equipmentIds,
    used_equipment: equipmentNamesFromIds(equipmentIds, equipment) || stringValue(report.used_equipment),
    workshop_departure_at: stringValue(report.workshop_departure_at),
    customer_arrival_at: stringValue(report.customer_arrival_at),
    customer_departure_at: stringValue(report.customer_departure_at),
    factory_return_at: stringValue(report.factory_return_at),
    product_code: stringValue(report.product_code),
    product_measure: stringValue(report.product_measure),
    product_width: primaryWorkItem.product_width || stringValue(report.product_width),
    product_length: primaryWorkItem.product_length || stringValue(report.product_length),
    product_quantity: primaryWorkItem.product_quantity || stringValue(report.product_quantity),
    product_item_coil_code: primaryWorkItem.coil_code || stringValue(report.product_item_coil_code),
    product_types: arrayValue(report.product_types) as ReportFormValues["product_types"],
    product_type_other: stringValue(report.product_type_other),
    process_actions: arrayValue(report.process_actions) as ReportFormValues["process_actions"],
    edge_cut_method: stringValue(report.edge_cut_method) as ReportFormValues["edge_cut_method"],
    process_action_other: stringValue(report.process_action_other),
    mechanical_connection: stringValue(report.mechanical_connection),
    profile_material: stringValue(report.profile_material),
    removed_belt_years: stringValue(report.removed_belt_years),
    replacement_reasons: arrayValue(report.replacement_reasons),
    replacement_reason_other: stringValue(report.replacement_reason_other),
    has_test_piece: stringValue(report.has_test_piece) as ReportFormValues["has_test_piece"],
    test_status: stringValue(report.test_status) as ReportFormValues["test_status"],
    observer_personnel_id: stringValue(report.observer_personnel_id),
    observer_external_name: stringValue(report.observer_external_name),
    press_start_time: stringValue(report.press_start_time).slice(0, 5),
    press_end_time: stringValue(report.press_end_time).slice(0, 5),
    power_outage: stringValue(report.power_outage) as ReportFormValues["power_outage"],
    pressure_drop: stringValue(report.pressure_drop) as ReportFormValues["pressure_drop"],
    heat_balance_ok: stringValue(report.heat_balance_ok) as ReportFormValues["heat_balance_ok"],
    process_description: stringValue(report.process_description),
    billing_status: stringValue(report.billing_status) as ReportFormValues["billing_status"],
    technical_details: stringValue(report.technical_details),
    tensioning_done: stringValue(report.tensioning_done) as ReportFormValues["tensioning_done"],
    customer_will_tension: booleanValue(report.customer_will_tension),
    customer_tensioned_auto: booleanValue(report.customer_tensioned_auto),
    pressure_value: stringValue(report.pressure_value),
    pressure_unit: stringValue(report.pressure_unit),
    pre_tension_percent: stringValue(report.pre_tension_percent),
    line_delivered_running: booleanValue(report.line_delivered_running),
    blanket_roughening_info_given: stringValue(report.blanket_roughening_info_given) as ReportFormValues["blanket_roughening_info_given"],
    blanket_info_person_name: stringValue(report.blanket_info_person_name)
  };
}

function assignmentToValues(assignment: InstallationAssignment, equipment: Equipment[]): ReportFormValues {
  const values = toRecord(assignment.report_values);
  const workItems = workItemsFromValue(
    values.work_items,
    (stringValue(values.line_name) || assignment.line_name) ?? "",
    stringValue(values.belt_id),
    stringValue(values.belt_code),
    stringValue(values.belt_name),
    stringValue(values.product_width),
    stringValue(values.product_length),
    stringValue(values.product_quantity),
    stringValue(values.machine_brand_model),
    stringValue(values.product_item_coil_code)
  );
  const primaryWorkItem = compactReportWorkItems(workItems)[0] ?? workItems[0] ?? emptyReportWorkItem();
  const equipmentIds = equipmentIdsFromValue(values.used_equipment_ids, stringValue(values.used_equipment), equipment);

  return {
    ...emptyReportFormValues,
    client_request_id: createId(),
    report_date: stringValue(values.report_date) || assignment.scheduled_date || formatDateValue(new Date()),
    company_id: (stringValue(values.company_id) || assignment.company_id) ?? "",
    company_contact_name: stringValue(values.company_contact_name),
    company_contact_phone: stringValue(values.company_contact_phone),
    line_name: primaryWorkItem.line_name,
    work_items: workItems,
    machine_brand_model: primaryWorkItem.machine_name || stringValue(values.machine_brand_model),
    customer_machine_name: stringValue(values.customer_machine_name),
    belt_id: primaryWorkItem.belt_id,
    visiting_personnel_ids: arrayValue(values.visiting_personnel_ids),
    vehicle_plate: stringValue(values.vehicle_plate),
    vehicle_start_km: stringValue(values.vehicle_start_km),
    vehicle_end_km: stringValue(values.vehicle_end_km),
    used_equipment_ids: equipmentIds,
    used_equipment: equipmentNamesFromIds(equipmentIds, equipment) || stringValue(values.used_equipment),
    workshop_departure_at: stringValue(values.workshop_departure_at),
    customer_arrival_at: stringValue(values.customer_arrival_at),
    customer_departure_at: stringValue(values.customer_departure_at),
    factory_return_at: stringValue(values.factory_return_at),
    product_code: stringValue(values.product_code),
    product_measure: stringValue(values.product_measure),
    product_width: primaryWorkItem.product_width || stringValue(values.product_width),
    product_length: primaryWorkItem.product_length || stringValue(values.product_length),
    product_quantity: primaryWorkItem.product_quantity || stringValue(values.product_quantity),
    product_item_coil_code: primaryWorkItem.coil_code || stringValue(values.product_item_coil_code),
    product_types: arrayValue(values.product_types) as ReportFormValues["product_types"],
    product_type_other: stringValue(values.product_type_other),
    process_actions: arrayValue(values.process_actions) as ReportFormValues["process_actions"],
    edge_cut_method: stringValue(values.edge_cut_method) as ReportFormValues["edge_cut_method"],
    process_action_other: stringValue(values.process_action_other),
    mechanical_connection: stringValue(values.mechanical_connection),
    profile_material: stringValue(values.profile_material),
    removed_belt_years: stringValue(values.removed_belt_years),
    replacement_reasons: arrayValue(values.replacement_reasons),
    replacement_reason_other: stringValue(values.replacement_reason_other),
    has_test_piece: stringValue(values.has_test_piece) as ReportFormValues["has_test_piece"],
    test_status: stringValue(values.test_status) as ReportFormValues["test_status"],
    observer_personnel_id: stringValue(values.observer_personnel_id),
    observer_external_name: stringValue(values.observer_external_name),
    press_start_time: stringValue(values.press_start_time).slice(0, 5),
    press_end_time: stringValue(values.press_end_time).slice(0, 5),
    power_outage: stringValue(values.power_outage) as ReportFormValues["power_outage"],
    pressure_drop: stringValue(values.pressure_drop) as ReportFormValues["pressure_drop"],
    heat_balance_ok: stringValue(values.heat_balance_ok) as ReportFormValues["heat_balance_ok"],
    process_description: stringValue(values.process_description),
    billing_status: stringValue(values.billing_status) as ReportFormValues["billing_status"],
    technical_details: stringValue(values.technical_details),
    tensioning_done: stringValue(values.tensioning_done) as ReportFormValues["tensioning_done"],
    customer_will_tension: booleanValue(values.customer_will_tension),
    customer_tensioned_auto: booleanValue(values.customer_tensioned_auto),
    pressure_value: stringValue(values.pressure_value),
    pressure_unit: stringValue(values.pressure_unit),
    pre_tension_percent: stringValue(values.pre_tension_percent),
    line_delivered_running: booleanValue(values.line_delivered_running),
    blanket_roughening_info_given: stringValue(values.blanket_roughening_info_given) as ReportFormValues["blanket_roughening_info_given"],
    blanket_info_person_name: stringValue(values.blanket_info_person_name)
  };
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (char) => {
    const random = globalThis.crypto?.getRandomValues
      ? globalThis.crypto.getRandomValues(new Uint8Array(1))[0] ?? Math.floor(Math.random() * 256)
      : Math.floor(Math.random() * 256);
    return (Number(char) ^ (random & (15 >> (Number(char) / 4)))).toString(16);
  });
}

function safeExtension(fileName: string, contentType: string) {
  const rawExtension = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (rawExtension === "png" || rawExtension === "webp" || rawExtension === "jpg" || rawExtension === "jpeg") {
    return rawExtension === "jpeg" ? "jpg" : rawExtension;
  }
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

function formatDateValue(date: Date) {
  const parts = new Intl.DateTimeFormat("tr-TR", {
    timeZone: turkeyTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? String(date.getFullYear());
  const month = parts.find((part) => part.type === "month")?.value ?? String(date.getMonth() + 1).padStart(2, "0");
  const day = parts.find((part) => part.type === "day")?.value ?? String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(value: string) {
  if (!value) return "";
  const date = parseDateOnly(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: turkeyTimeZone,
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

function formatDateTimeDisplay(value: unknown) {
  if (typeof value !== "string" || !value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: turkeyTimeZone,
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
}

function toDatetimeLocal(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDatetimeLocal(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function toRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function equipmentIdsFromValue(value: unknown, fallbackText: string, equipment: Equipment[]) {
  const directIds = arrayValue(value).filter((id) => equipment.some((item) => item.id === id));
  if (directIds.length > 0 || !fallbackText.trim()) return directIds;

  const selectedNames = fallbackText
    .split(/[,;\n]/)
    .map((item) => item.trim().toLocaleLowerCase("tr-TR"))
    .filter(Boolean);

  return equipment
    .filter((item) => selectedNames.includes(item.name.trim().toLocaleLowerCase("tr-TR")))
    .map((item) => item.id);
}

function equipmentNamesFromIds(ids: string[], equipment: Equipment[]) {
  const equipmentById = new Map(equipment.map((item) => [item.id, item]));
  return ids
    .map((id) => equipmentById.get(id)?.name ?? "")
    .filter(Boolean)
    .join(", ");
}

function prepareReportValues(values: ReportFormValues, belts: Belt[], equipment: Equipment[]): ReportFormValues {
  const beltsById = new Map(belts.map((belt) => [belt.id, belt]));
  const workItems = compactReportWorkItems(
    enrichReportWorkItems(
      workItemsFromValue(
        values.work_items,
        values.line_name,
        values.belt_id,
        "",
        "",
        values.product_width,
        values.product_length,
        values.product_quantity,
        values.machine_brand_model,
        values.product_item_coil_code
      ),
      beltsById
    )
  );
  const primaryWorkItem = workItems[0] ?? emptyReportWorkItem();
  const productCodes = workItemProductCodes(workItems);
  const usedEquipment = equipmentNamesFromIds(values.used_equipment_ids, equipment) || values.used_equipment;

  return {
    ...values,
    line_name: primaryWorkItem.line_name || values.line_name,
    belt_id: primaryWorkItem.belt_id || values.belt_id,
    work_items: workItems,
    product_code: productCodes.join("\n") || values.product_code,
    product_measure: "",
    product_width: primaryWorkItem.product_width || values.product_width,
    product_length: primaryWorkItem.product_length || values.product_length,
    product_quantity: primaryWorkItem.product_quantity || values.product_quantity,
    machine_brand_model: primaryWorkItem.machine_name || values.machine_brand_model,
    product_item_coil_code: primaryWorkItem.coil_code || values.product_item_coil_code,
    used_equipment: usedEquipment
  };
}

function formatBeltLabel(belt: Belt) {
  return belt.name ? `${belt.code} - ${belt.name}` : belt.code;
}

function emptyReportWorkItem(): ReportWorkItem {
  return { line_name: "", belt_id: "", belt_code: "", belt_name: "", machine_name: "", coil_code: "", product_width: "", product_length: "", product_quantity: "" };
}

function normalizeReportWorkItems(items: ReportWorkItem[]) {
  return items.length > 0 ? items : [emptyReportWorkItem()];
}

function compactReportWorkItems(items: ReportWorkItem[]) {
  return items
    .map((item) => ({
      line_name: item.line_name.trim(),
      belt_id: item.belt_id.trim(),
      belt_code: item.belt_code.trim(),
      belt_name: item.belt_name.trim(),
      machine_name: (item.machine_name ?? "").trim(),
      coil_code: (item.coil_code ?? "").trim(),
      product_width: item.product_width.trim(),
      product_length: item.product_length.trim(),
      product_quantity: item.product_quantity.trim()
    }))
    .filter((item) => item.line_name || item.belt_id || item.belt_code || item.belt_name || item.machine_name || item.coil_code || item.product_width || item.product_length || item.product_quantity);
}

function workItemsFromValue(
  value: unknown,
  fallbackLineName: string,
  fallbackBeltId: string,
  fallbackBeltCode = "",
  fallbackBeltName = "",
  fallbackProductWidth = "",
  fallbackProductLength = "",
  fallbackProductQuantity = "",
  fallbackMachineName = "",
  fallbackCoilCode = ""
): ReportWorkItem[] {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => toRecord(item))
      .map((item, index) => ({
        line_name: stringValue(item.line_name),
        belt_id: stringValue(item.belt_id),
        belt_code: stringValue(item.belt_code),
        belt_name: stringValue(item.belt_name),
        machine_name: stringValue(item.machine_name) || (index === 0 ? fallbackMachineName : ""),
        coil_code: stringValue(item.coil_code) || (index === 0 ? fallbackCoilCode : ""),
        product_width: stringValue(item.product_width),
        product_length: stringValue(item.product_length),
        product_quantity: stringValue(item.product_quantity)
      }))
      .filter((item) => item.line_name || item.belt_id || item.belt_code || item.belt_name || item.machine_name || item.coil_code || item.product_width || item.product_length || item.product_quantity);

    if (items.length > 0) {
      return items;
    }
  }

  return normalizeReportWorkItems([
    {
      line_name: fallbackLineName,
      belt_id: fallbackBeltId,
      belt_code: fallbackBeltCode,
      belt_name: fallbackBeltName,
      machine_name: fallbackMachineName,
      coil_code: fallbackCoilCode,
      product_width: fallbackProductWidth,
      product_length: fallbackProductLength,
      product_quantity: fallbackProductQuantity
    }
  ]);
}

function enrichReportWorkItems(items: ReportWorkItem[], beltsById: Map<string, Belt>) {
  return normalizeReportWorkItems(items).map((item) => {
    const belt = beltsById.get(item.belt_id);
    return {
      ...item,
      belt_code: item.belt_code || belt?.code || "",
      belt_name: item.belt_name || belt?.name || ""
    };
  });
}

function formatReportWorkItemLabel(item: ReportWorkItem) {
  const beltLabel = item.belt_code ? (item.belt_name ? `${item.belt_code} - ${item.belt_name}` : item.belt_code) : "";
  const machineAndCoil = [item.machine_name, item.coil_code].filter(Boolean).join(" / ");
  return [item.line_name, beltLabel, machineAndCoil].filter(Boolean).join(" / ");
}

function workItemBeltCodesText(items: ReportWorkItem[], fallbackBeltId: string, beltsById: Map<string, Belt>) {
  const codes = compactReportWorkItems(items)
    .map((item) => item.belt_code || beltsById.get(item.belt_id)?.code || "")
    .filter(Boolean);

  if (codes.length > 0) {
    return Array.from(new Set(codes)).join(", ");
  }

  return beltsById.get(fallbackBeltId)?.code ?? "-";
}

function workItemProductCodes(items: ReportWorkItem[], fallbackBeltId = "", beltsById?: Map<string, Belt>) {
  const codes = compactReportWorkItems(items)
    .map((item) => item.belt_code || beltsById?.get(item.belt_id)?.code || "")
    .filter(Boolean);

  if (codes.length > 0) {
    return codes;
  }

  const fallbackCode = fallbackBeltId ? beltsById?.get(fallbackBeltId)?.code : "";
  return fallbackCode ? [fallbackCode] : [];
}

function reportWorkItemsText(report: Record<string, unknown>) {
  const items = compactReportWorkItems(
    workItemsFromValue(
      report.work_items,
      stringValue(report.line_name),
      stringValue(report.belt_id),
      stringValue(report.belt_code_snapshot),
      stringValue(report.belt_name_snapshot),
      stringValue(report.product_width),
      stringValue(report.product_length),
      stringValue(report.product_quantity),
      stringValue(report.machine_brand_model),
      stringValue(report.product_item_coil_code)
    )
  );

  return items.map(formatReportWorkItemLabel).filter(Boolean).join(" • ") || "-";
}

function reportBeltCodesText(report: Record<string, unknown>) {
  const items = compactReportWorkItems(
    workItemsFromValue(
      report.work_items,
      stringValue(report.line_name),
      stringValue(report.belt_id),
      stringValue(report.belt_code_snapshot),
      stringValue(report.belt_name_snapshot),
      stringValue(report.product_width),
      stringValue(report.product_length),
      stringValue(report.product_quantity)
    )
  );
  const codes = items.map((item) => item.belt_code).filter(Boolean);

  if (codes.length > 0) {
    return Array.from(new Set(codes)).join(", ");
  }

  return text(report.belt_code_snapshot);
}

function reportProductCodesText(report: Record<string, unknown>) {
  const items = compactReportWorkItems(
    workItemsFromValue(
      report.work_items,
      stringValue(report.line_name),
      stringValue(report.belt_id),
      stringValue(report.belt_code_snapshot),
      stringValue(report.belt_name_snapshot),
      stringValue(report.product_width),
      stringValue(report.product_length),
      stringValue(report.product_quantity)
    )
  );
  const codes = items.map((item) => item.belt_code).filter(Boolean);

  if (codes.length > 0) {
    return codes.join(" • ");
  }

  return text(report.product_code || report.belt_code_snapshot);
}

function reportProductMeasurementsText(report: Record<string, unknown>) {
  const items = compactReportWorkItems(
    workItemsFromValue(
      report.work_items,
      stringValue(report.line_name),
      stringValue(report.belt_id),
      stringValue(report.belt_code_snapshot),
      stringValue(report.belt_name_snapshot),
      stringValue(report.product_width),
      stringValue(report.product_length),
      stringValue(report.product_quantity)
    )
  );
  const rows = items
    .map((item) => {
      const code = item.belt_code || "Ürün";
      const size = [item.product_width, item.product_length].filter(Boolean).join(" x ");
      const quantity = item.product_quantity ? `${item.product_quantity} adet` : "";
      const detail = [size, quantity].filter(Boolean).join(" / ");
      return detail ? `${code}: ${detail}` : "";
    })
    .filter(Boolean);

  return rows.join(" • ") || "-";
}

function assignmentWorkItemsText(assignment: InstallationAssignment) {
  const values = toRecord(assignment.report_values);
  const items = compactReportWorkItems(
    workItemsFromValue(
      values.work_items,
      assignment.line_name ?? "",
      stringValue(values.belt_id),
      "",
      "",
      stringValue(values.product_width),
      stringValue(values.product_length),
      stringValue(values.product_quantity),
      stringValue(values.machine_brand_model),
      stringValue(values.product_item_coil_code)
    )
  );
  return items.map(formatReportWorkItemLabel).filter(Boolean).join(" • ") || assignment.line_name || "";
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function text(value: unknown) {
  const content = stringValue(value).trim();
  return content || "-";
}

function fallbackText(first: string, second: string) {
  return first !== "-" ? first : second;
}

function arrayText(value: unknown) {
  const items = arrayValue(value);
  return items.length > 0 ? items.join(", ") : "-";
}

function boolText(value: unknown) {
  if (typeof value !== "boolean") return "-";
  return value ? "Evet" : "Hayır";
}
