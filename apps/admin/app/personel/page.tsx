"use client";

import { FormEvent, useRef, useState, useEffect } from "react";
import type {
  Belt,
  Company,
  CompanyLine,
  Equipment,
  InstallationAssignment,
  Profile,
  ReportFormValues,
  ReportStatus,
  Vehicle
} from "@operations/types";
import { reportFormSchema } from "@operations/validation";
import { customerSignatureSchema, type CustomerSignature } from "@operations/validation";
import { Alert, Button, FirmPage } from "@/components/firm-ui";
import { OrganizationBrand } from "@/components/organization-brand";
import { clearAccountContextCache, loadAccountContext } from "@/lib/account-context-client";
import { PersonnelLogin } from "./_components/personnel-login";
import { AssignmentCards, PersonnelHome, ReportCards } from "./_components/personnel-lists";
import { PersonnelRoot, PersonnelShell, type PersonnelNavScreen } from "./_components/personnel-shell";
import { ReportDetailView } from "./_components/report-detail";
import { ReportForm } from "./_components/report-form";
import {
  assignmentToValues,
  createId,
  defaultPhotoCategory,
  equipmentNamesFromIds,
  getPersonnelClient,
  newReportValues,
  prepareReportValues,
  reportPayload,
  reportToValues,
  safeExtension,
  type PhotoDraft,
  type ReportRow,
  type SavedPhoto,
  type Screen
} from "./_components/report-utils";

const screenTitles: Record<Exclude<Screen, "form">, string> = {
  home: "Ana sayfa",
  assignments: "Montajlarım",
  drafts: "Taslaklarım",
  submitted: "Gönderdiğim Raporlar",
  detail: "Rapor Detayı"
};

export default function PersonnelWebPage() {
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accessMessage, setAccessMessage] = useState("");
  const [organizationName, setOrganizationName] = useState("");
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
    const db = getPersonnelClient();

    db.auth.getSession().then(({ data }) => {
      setSessionUserId(data.session?.user.id ?? null);
    });

    const { data: listener } = db.auth.onAuthStateChange((_event, session) => {
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
    const db = getPersonnelClient();
    if (!db || !sessionUserId) return;

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
    setOrganizationName(accessBody.organizationName);

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
      db.from("profiles").select("*").eq("id", sessionUserId).maybeSingle(),
      db.from("companies").select("*").eq("is_active", true).order("name"),
      db.from("belts").select("*").eq("is_active", true).order("code"),
      db.from("company_lines").select("*").order("name"),
      db.from("vehicles").select("*").order("plate"),
      db.from("equipment").select("*").eq("is_active", true).order("name"),
      db
        .from("profiles")
        .select("*")
        .eq("role", "PERSONNEL")
        .eq("is_active", true)
        .order("first_name"),
      db
        .from("reports")
        .select("*, report_personnel(profile_id,name_snapshot)")
        .eq("status", "DRAFT")
        .order("updated_at", { ascending: false })
        .limit(50),
      db
        .from("reports")
        .select("id,client_request_id,report_number,report_date,company_name_snapshot,status,created_at,submitted_at")
        .eq("status", "SUBMITTED")
        .order("submitted_at", { ascending: false })
        .limit(100),
      db
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
    const db = getPersonnelClient();

    setLoading(true);
    setMessage("");
    try {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error || !data) {
        showMessage(error?.message ?? "Giriş yapılamadı. E-posta ve şifrenizi kontrol edin.", "error");
      } else if (data.scope !== "personnel") {
        // Yonetici hesabi ile giris yapildi; sunucunun belirledigi alana gec.
        window.location.assign(data.redirectTo);
      }
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    if (submitting.current || loading) return;
    clearAccountContextCache("personnel");
    await getPersonnelClient()?.auth.signOut();
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

    const db = getPersonnelClient();
    if (!db) return;

    const { error } = await db
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
    const db = getPersonnelClient();
    if (!db) throw new Error("Oturum bulunamadı.");
    const result = await db.from("report_photos").select("id,storage_path,caption").eq("report_id", reportId).order("created_at");
    if (result.error) throw result.error;
    const resolved = await Promise.all((result.data ?? []).map(async (photo) => {
      const signed = await db.storage.from("report-photos").createSignedUrl(photo.storage_path, 60 * 60);
      if (signed.error || !signed.data?.signedUrl) throw new Error("Fotoğraf görüntülenemiyor.");
      return { ...photo, url: signed.data.signedUrl } as SavedPhoto;
    }));
    setSavedPhotos(resolved);
  }

  async function removeSavedPhoto(photo: SavedPhoto) {
    const db = getPersonnelClient();
    if (!db || loading) return;
    setLoading(true);
    try {
      const removed = await db.from("report_photos").delete().eq("id", photo.id).select("id");
      if (removed.error || !removed.data?.length) throw new Error("Fotoğraf silinemedi. Rapor gönderilmiş olabilir.");
      setSavedPhotos((current) => current.filter((item) => item.id !== photo.id));
      await db.storage.from("report-photos").remove([photo.storage_path]);
    } catch (error) { showMessage(error instanceof Error ? error.message : "Fotoğraf silinemedi.", "error"); }
    finally { setLoading(false); }
  }

  async function submitReport(status: ReportStatus, signature?: CustomerSignature) {
    const db = getPersonnelClient();
    if (!db || !profile || submitting.current) return;
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
      const existing = await db.from("reports").select("*")
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
        const draft = await db.from("reports")
          .upsert(reportPayload(preparedValues, "DRAFT"), { onConflict: "client_request_id" })
          .select("id,report_number,status,updated_at").single();
        if (draft.error || !draft.data) throw new Error("Rapor taslağı kaydedilemedi. Bilgileriniz korunuyor; tekrar deneyin.");
        await replaceReportPersonnel(draft.data.id);
        if (photos.length > 0) await uploadPhotos(draft.data.id);
        if (status === "SUBMITTED") {
          // The report remains a draft until all attachments exist. Signature and status commit together.
          const finalized = await db.from("reports")
            .update({ status: "SUBMITTED", customer_signature: signature })
            .eq("id", draft.data.id).eq("status", "DRAFT")
            .eq("updated_at", draft.data.updated_at)
            .select("id,report_number,status").single();
          if (finalized.error || !finalized.data) throw new Error("İmzalı rapor gönderilemedi. Bilgileriniz ve imzanız korunuyor; bağlantınızı kontrol edip tekrar deneyin.");
          saved = finalized.data;
        } else saved = draft.data;
      }
      if (activeAssignment) {
        const result = await db.from("installation_assignments")
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
    const db = getPersonnelClient();
    if (!db) return null;

    const { data, error } = await db
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
    const db = getPersonnelClient();
    if (!db || !profile) return;

    const removed = await db.from("report_personnel").delete().eq("report_id", reportId);
    if (removed.error) throw new Error("Rapor personeli kaydedilemedi. Tekrar deneyin.");

    const selectedProfiles = [
      profile,
      ...personnel.filter((item) => values.visiting_personnel_ids.includes(item.id) && item.id !== profile.id)
    ];

    if (selectedProfiles.length === 0) return;

    const inserted = await db.from("report_personnel").insert(
      selectedProfiles.map((item) => ({
        report_id: reportId,
        profile_id: item.id,
        name_snapshot: `${item.first_name} ${item.last_name}`.trim()
      }))
    );
    if (inserted.error) throw new Error("Rapor personeli kaydedilemedi. Tekrar deneyin.");
  }

  async function uploadPhotos(reportId: string) {
    const db = getPersonnelClient();
    if (!db || !sessionUserId || !profile?.organization_id) throw new Error("Fotoğraflar için oturum doğrulanamadı. Rapor gönderilmedi.");

    for (const photo of photos) {
      const extension = safeExtension(photo.file.name, photo.file.type);
      const storagePath = `${profile.organization_id}/${reportId}/${photo.localId}.${extension}`;
      const existingPhoto = await db.from("report_photos").select("id,caption").eq("report_id", reportId).eq("storage_path", storagePath).maybeSingle();
      if (existingPhoto.error) throw new Error("Fotoğraf durumu doğrulanamadı. Tekrar deneyin.");
      if (existingPhoto.data) {
        const updated = await db.from("report_photos").update({ caption: photo.caption.trim() || null }).eq("id", existingPhoto.data.id);
        if (updated.error) throw new Error("Fotoğraf açıklaması kaydedilemedi. Tekrar deneyin.");
        await loadSavedPhotos(reportId);
        setPhotos((current) => current.filter((item) => item.localId !== photo.localId));
        continue;
      }
      const upload = await db.storage.from("report-photos").upload(storagePath, photo.file, {
        contentType: photo.file.type || "image/jpeg",
        upsert: false
      });

      if (upload.error) {
        // A prior upload can succeed before its response reaches the device.
        const stored = await db.storage.from("report-photos").download(storagePath);
        if (stored.error) throw new Error("Fotoğraf yüklenemedi. Rapor taslak olarak korundu; tekrar deneyin.");
      }

      const insertedPhoto = await db.from("report_photos").insert({
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
      <PersonnelRoot>
        <main className="flex min-h-svh items-center justify-center p-6">
          <div className="grid w-full max-w-sm gap-4">
            <div className="flex items-center gap-2 font-semibold">
              <OrganizationBrand scope="personnel" />
            </div>
            <Alert tone="error">{accessMessage}</Alert>
            <Button onClick={signOut}>Çıkış Yap</Button>
          </div>
        </main>
      </PersonnelRoot>
    );
  }

  // Form acikken menuden ayrilmak kaydedilmemis girdiyi siler; once onay iste.
  function confirmLeaveForm() {
    if (screen !== "form" || readOnlyMode) return true;
    return window.confirm("Kaydedilmemiş rapor bilgileri silinecek. Formdan çıkmak istiyor musunuz?");
  }

  const activeScreen: PersonnelNavScreen | null =
    screen === "form" ? null : screen === "detail" ? "submitted" : screen;
  const title = screen === "form" ? (activeAssignment ? "Montaj Raporu" : "Rapor Formu") : screenTitles[screen];
  const userName = profile ? `${profile.first_name} ${profile.last_name}`.trim() || "Personel" : "Personel";

  return (
    <PersonnelRoot
      render={({ theme, toggleTheme }) => (
        <PersonnelShell
          activeScreen={activeScreen}
          newReportDisabled={readOnlyMode}
          onNavigate={(next) => { if (!loading && confirmLeaveForm()) setScreen(next); }}
          onNewReport={() => { if (!loading && confirmLeaveForm()) startNewReport(); }}
          onSignOut={() => { void signOut(); }}
          theme={theme}
          title={title}
          toggleTheme={toggleTheme}
          userDetail={organizationName || "Personel hesabı"}
          userName={userName}
        >
          <FirmPage>
            {message ? <Alert tone={messageTone === "error" ? "error" : "info"}>{message}</Alert> : null}
            {readOnlyMode ? (
              <Alert tone="warning">
                Aboneliğiniz salt okunur durumda. Mevcut rapor ve montajları görüntüleyebilirsiniz; yeni kayıt ve değişiklik yapamazsınız.
              </Alert>
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
                onBack={() => setScreen("home")}
                onOpen={openDraft}
              />
            ) : null}

            {screen === "submitted" ? (
              <ReportCards
                emptyText="Henüz gönderilmiş rapor yok."
                reports={submittedReports}
                onBack={() => setScreen("home")}
                onOpen={(report) => openDetail(report.id)}
              />
            ) : null}

            {screen === "assignments" ? (
              <AssignmentCards
                assignments={assignments}
                emptyText="Aktif montaj ataması yok."
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
          </FirmPage>
        </PersonnelShell>
      )}
    />
  );
}
