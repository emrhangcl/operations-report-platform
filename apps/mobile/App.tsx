import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import NetInfo from "@react-native-community/netinfo";
import { createClient, type Session } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";
import { Children, isValidElement, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  type ImageStyle,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import type { Belt, Company, CompanyLine, OfflineDraft, Profile, ReportFormValues, ReportWorkItem, Vehicle } from "@tunca/types";
import {
  emptyReportFormValues,
  processActions,
  productTypes,
  reportFormSchema
} from "@tunca/validation";
import type { PhotoDraft } from "./src/types";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    })
  : null;

const draftKey = "tunca.offlineDrafts";
const defaultPhotoCategory = "Genel";
const turkeyTimeZone = "Europe/Istanbul";
const turkishMonths = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık"
];

type Screen = "home" | "form" | "drafts" | "submitted" | "submittedDetail";
type DateTarget = keyof Pick<
  ReportFormValues,
  | "report_date"
  | "workshop_departure_at"
  | "customer_arrival_at"
  | "customer_departure_at"
  | "factory_return_at"
  | "press_start_time"
  | "press_end_time"
>;
type DatePickerTarget = {
  field: DateTarget;
  mode: "date" | "time";
};
type SubmittedReportDetailRow = Record<string, unknown> & {
  id: string;
  report_number: string | null;
  report_date: string;
  company_name_snapshot: string | null;
  created_by_name_snapshot: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  report_personnel?: Array<{ name_snapshot: string | null }>;
  report_photos?: Array<{
    category: string | null;
    caption: string | null;
    storage_path: string | null;
    created_at: string;
  }>;
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [belts, setBelts] = useState<Belt[]>([]);
  const [companyLines, setCompanyLines] = useState<CompanyLine[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [personnel, setPersonnel] = useState<Profile[]>([]);
  const [submittedReports, setSubmittedReports] = useState<Array<Record<string, string | null>>>([]);
  const [selectedSubmittedReportId, setSelectedSubmittedReportId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<OfflineDraft[]>([]);
  const [values, setValues] = useState<ReportFormValues>(newReportValues());
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [dateTarget, setDateTarget] = useState<DatePickerTarget | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected));
    });

    return () => {
      listener.subscription.unsubscribe();
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    loadDrafts().catch(() => setMessage("Taslaklar okunamadı."));
  }, []);

  useEffect(() => {
    if (!session || !supabase) return;
    loadBootstrapData().catch(() => setMessage("Veriler alınamadı. Bağlantınızı kontrol edin."));
  }, [session]);

  useEffect(() => {
    if (screen !== "submitted" || !session || !supabase) return;
    loadBootstrapData().catch(() => setMessage("Gönderilen raporlar yenilenemedi."));
  }, [screen, session]);

  async function loadBootstrapData() {
    if (!supabase || !session?.user.id) return;

    const [profileResult, companyResult, beltResult, lineResult, vehicleResult, personnelResult, reportResult] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle(),
        supabase.from("companies").select("*").eq("is_active", true).order("name"),
        supabase.from("belts").select("*").eq("is_active", true).order("name"),
        supabase.from("company_lines").select("*").order("name"),
        supabase.from("vehicles").select("*").order("plate"),
        supabase
          .from("profiles")
          .select("*")
          .eq("role", "PERSONNEL")
          .eq("is_active", true)
          .order("first_name"),
        supabase
          .from("reports")
          .select("id,report_number,report_date,company_name_snapshot,status")
          .eq("status", "SUBMITTED")
          .order("submitted_at", { ascending: false })
          .limit(50)
      ]);

    setProfile(profileResult.data as Profile | null);
    setCompanies((companyResult.data ?? []) as Company[]);
    setBelts((beltResult.data ?? []) as Belt[]);
    setCompanyLines((lineResult.data ?? []) as CompanyLine[]);
    setVehicles((vehicleResult.data ?? []) as Vehicle[]);
    setPersonnel((personnelResult.data ?? []) as Profile[]);
    setSubmittedReports((reportResult.data ?? []) as Array<Record<string, string | null>>);
  }

  async function loadDrafts() {
    const raw = await AsyncStorage.getItem(draftKey);
    setDrafts(raw ? JSON.parse(raw) as OfflineDraft[] : []);
  }

  async function writeDrafts(next: OfflineDraft[]) {
    await AsyncStorage.setItem(draftKey, JSON.stringify(next));
    setDrafts(next);
  }

  async function signIn() {
    if (!supabase) {
      setMessage("Supabase bilgileri girilmedi. .env dosyasını doldurun.");
      return;
    }
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage("Giriş yapılamadı. E-posta ve şifrenizi kontrol edin.");
    setLoading(false);
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setProfile(null);
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

  async function saveLocalDraft(status: OfflineDraft["status"] = "DEVICE_SAVED") {
    const nextDraft: OfflineDraft = {
      local_id: values.client_request_id,
      values,
      status,
      updated_at: new Date().toISOString()
    };
    const next = [nextDraft, ...drafts.filter((draft) => draft.local_id !== values.client_request_id)];
    await writeDrafts(next);
    setMessage(status === "WAITING_SYNC" ? "Senkronizasyon bekliyor." : "Cihazda kaydedildi.");
  }

  async function pickPhoto(source: "camera" | "library") {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessage("Fotoğraf izni verilmedi.");
      return;
    }

    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images });

    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset?.uri) return;
    setPhotos([
      ...photos,
      {
        localId: Crypto.randomUUID(),
        uri: asset.uri,
        category: defaultPhotoCategory,
        caption: ""
      }
    ]);
  }

  async function submitReport(status: "DRAFT" | "SUBMITTED") {
    if (!supabase) return;
    setMessage("");

    const parsed = reportFormSchema.safeParse(values);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Form bilgilerini kontrol edin.");
      return;
    }

    if (!online) {
      await saveLocalDraft("WAITING_SYNC");
      return;
    }

    setLoading(true);
    try {
      const payload = reportPayload(parsed.data, status);
      const { data, error } = await supabase
        .from("reports")
        .upsert(payload, { onConflict: "client_request_id" })
        .select("id,report_number")
        .single();

      if (error || !data) {
        await saveLocalDraft("SYNC_ERROR");
        setMessage("Rapor kaydedilemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.");
        return;
      }

      await replaceReportPersonnel(data.id as string);
      await uploadPhotos(data.id as string);
      await writeDrafts(drafts.filter((draft) => draft.local_id !== values.client_request_id));
      setMessage(status === "SUBMITTED"
        ? `Rapor gönderildi: ${String(data.report_number ?? "")}`
        : "Taslak senkronize edildi.");
      setValues(newReportValues());
      setPhotos([]);
      setScreen("home");
      await loadBootstrapData();
    } finally {
      setLoading(false);
    }
  }

  async function replaceReportPersonnel(reportId: string) {
    if (!supabase || !profile) return;
    await supabase.from("report_personnel").delete().eq("report_id", reportId);

    const selectedProfiles = [
      profile,
      ...personnel.filter((item) => values.visiting_personnel_ids.includes(item.id) && item.id !== profile.id)
    ];

    if (selectedProfiles.length === 0) return;

    await supabase.from("report_personnel").insert(
      selectedProfiles.map((item) => ({
        report_id: reportId,
        profile_id: item.id,
        name_snapshot: `${item.first_name} ${item.last_name}`.trim()
      }))
    );
  }

  async function uploadPhotos(reportId: string) {
    if (!supabase || !session) return;
    for (const photo of photos) {
      const extension = photo.uri.split(".").pop() ?? "jpg";
      const storagePath = `${reportId}/${photo.localId}.${extension}`;
      const response = await fetch(photo.uri);
      const blob = await response.blob();
      const upload = await supabase.storage.from("report-photos").upload(storagePath, blob, {
        upsert: true,
        contentType: blob.type || "image/jpeg"
      });
      if (upload.error) continue;
      await supabase.from("report_photos").insert({
        report_id: reportId,
        storage_path: storagePath,
        category: photo.category,
        caption: photo.caption || null,
        created_by: session.user.id
      });
    }
  }

  async function syncDraft(draft: OfflineDraft) {
    setValues(draft.values);
    setScreen("form");
    setTimeout(() => {
      submitReport("SUBMITTED").catch(() => setMessage("Senkronizasyon hatası."));
    }, 0);
  }

  const draftCount = drafts.length;
  const submittedCount = submittedReports.length;

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.centered}>
          <Brand />
          <View style={styles.panel}>
            <Text style={styles.title}>Personel Girişi</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="E-posta"
              style={styles.input}
              value={email}
            />
            <TextInput
              onChangeText={setPassword}
              placeholder="Şifre"
              secureTextEntry
              style={styles.input}
              value={password}
            />
            {message ? <Text style={styles.error}>{message}</Text> : null}
            <Pressable disabled={loading} onPress={signIn} style={styles.primaryButton}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Giriş Yap</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topbar}>
        <Brand compact />
        <Pressable onPress={signOut} style={styles.iconButton}>
          <Text style={styles.iconButtonText}>Çıkış</Text>
        </Pressable>
      </View>
      {message ? <Text style={styles.banner}>{message}</Text> : null}
      {screen === "home" ? (
        <Home
          draftCount={draftCount}
          online={online}
          profile={profile}
          setScreen={setScreen}
          submittedCount={submittedCount}
        />
      ) : null}
      {screen === "drafts" ? (
        <DraftList
          drafts={drafts}
          onBack={() => setScreen("home")}
          onOpen={(draft) => {
            setValues(draft.values);
            setScreen("form");
          }}
          onSync={syncDraft}
        />
      ) : null}
      {screen === "submitted" ? (
        <ReportList
          reports={submittedReports}
          onBack={() => setScreen("home")}
          onOpen={(reportId) => {
            setSelectedSubmittedReportId(reportId);
            setScreen("submittedDetail");
          }}
        />
      ) : null}
      {screen === "submittedDetail" && selectedSubmittedReportId ? (
        <SubmittedReportDetail
          reportId={selectedSubmittedReportId}
          onBack={() => setScreen("submitted")}
        />
      ) : null}
      {screen === "form" ? (
        <ReportForm
          belts={belts}
          companies={companies}
          companyLines={companyLines}
          dateTarget={dateTarget}
          loading={loading}
          personnel={personnel}
          photos={photos}
          profile={profile}
          setDateTarget={setDateTarget}
          setPhotos={setPhotos}
          setScreen={setScreen}
          submitReport={submitReport}
          toggleArray={toggleArray}
          update={update}
          values={values}
          vehicles={vehicles}
          onPickPhoto={pickPhoto}
          onSaveDraft={() => saveLocalDraft()}
        />
      ) : null}
    </SafeAreaView>
  );
}

function newReportValues(): ReportFormValues {
  return {
    ...emptyReportFormValues,
    client_request_id: Crypto.randomUUID(),
    report_date: formatDateValue(new Date())
  } as ReportFormValues;
}

function getTurkeyParts(date: Date) {
  try {
    const parts = new Intl.DateTimeFormat("tr-TR", {
      timeZone: turkeyTimeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(date);
    const numberPart = (type: string, fallback: number) => {
      const raw = parts.find((item) => item.type === type)?.value;
      if (!raw) return fallback;

      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    return {
      year: numberPart("year", date.getFullYear()),
      month: numberPart("month", date.getMonth() + 1),
      day: numberPart("day", date.getDate()),
      hour: numberPart("hour", date.getHours()) % 24,
      minute: numberPart("minute", date.getMinutes())
    };
  } catch {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes()
    };
  }
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateValue(date: Date) {
  const parts = getTurkeyParts(date);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function formatTimeValue(date: Date) {
  const parts = getTurkeyParts(date);
  return `${pad(parts.hour)}:${pad(parts.minute)}`;
}

function parseDateValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
}

function parseTimeValue(value: string) {
  const match = /^(\d{1,2})[:.](\d{2})$/.exec(value);
  if (!match) return null;

  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date;
}

function formatBeltLabel(belt: Belt) {
  return belt.name ? `${belt.code} - ${belt.name}` : belt.code;
}

function emptyReportWorkItem(): ReportWorkItem {
  return { line_name: "", belt_id: "", belt_code: "", belt_name: "" };
}

function compactReportWorkItems(items: ReportWorkItem[]) {
  return items
    .map((item) => ({
      line_name: item.line_name.trim(),
      belt_id: item.belt_id.trim(),
      belt_code: item.belt_code.trim(),
      belt_name: item.belt_name.trim()
    }))
    .filter((item) => item.line_name || item.belt_id || item.belt_code || item.belt_name);
}

function workItemsFromValues(values: ReportFormValues) {
  const compactItems = compactReportWorkItems(values.work_items);
  if (compactItems.length > 0) return compactItems;
  return compactReportWorkItems([
    { line_name: values.line_name, belt_id: values.belt_id, belt_code: "", belt_name: "" }
  ]);
}

function validDate(value: Date) {
  return Number.isFinite(value.getTime());
}

function parseDatePickerValue(field: DateTarget, value: string) {
  if (field === "report_date") {
    return parseDateValue(value) ?? new Date();
  }

  if (field === "press_start_time" || field === "press_end_time") {
    return parseTimeValue(value) ?? new Date();
  }

  const date = value ? new Date(value) : new Date();
  return validDate(date) ? date : new Date();
}

function mergeDatePart(current: Date, selected: Date) {
  const next = new Date(current);
  next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
  return next;
}

function mergeTimePart(current: Date, selected: Date) {
  const next = new Date(current);
  next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
  return next;
}

function datePickerTitle(target: DatePickerTarget) {
  const labels: Record<DateTarget, string> = {
    report_date: "Rapor Tarihi",
    workshop_departure_at: "Atölyeden Çıkış",
    customer_arrival_at: "Müşteriye Varış",
    customer_departure_at: "Müşteriden Çıkış",
    factory_return_at: "Fabrikaya Dönüş",
    press_start_time: "Pres Başlama Saati",
    press_end_time: "Pres Bitiş Saati"
  };

  if (target.mode === "time" && target.field !== "press_start_time" && target.field !== "press_end_time") {
    return `${labels[target.field]} Saati`;
  }

  return labels[target.field];
}

function formatDateDisplay(value: string) {
  const date = parseDateValue(value);
  if (!date) return "";
  return `${date.getDate()} ${turkishMonths[date.getMonth()]} ${date.getFullYear()}`;
}

function formatDateTimeDisplay(value: string) {
  if (!value) return "";

  const date = new Date(value);
  if (!validDate(date)) return "";

  const parts = getTurkeyParts(date);
  return `${parts.day} ${turkishMonths[parts.month - 1]} ${parts.year} ${pad(parts.hour)}.${pad(parts.minute)}`;
}

function formatTimeDisplay(value: string) {
  const time = parseTimeValue(value);
  if (!time) return "";

  const parts = getTurkeyParts(time);
  return `${pad(parts.hour)}.${pad(parts.minute)}`;
}

function reportPayload(values: ReportFormValues, status: "DRAFT" | "SUBMITTED") {
  const nullable = (value: string) => value.trim() || null;
  const workItems = workItemsFromValues(values);
  const primaryWorkItem = workItems[0] ?? emptyReportWorkItem();

  return {
    client_request_id: values.client_request_id,
    status,
    report_date: values.report_date,
    company_id: values.company_id,
    company_contact_name: nullable(values.company_contact_name),
    company_contact_phone: nullable(values.company_contact_phone),
    line_name: nullable(primaryWorkItem.line_name || values.line_name),
    work_items: workItems,
    machine_brand_model: nullable(values.machine_brand_model),
    customer_machine_name: nullable(values.customer_machine_name),
    belt_id: primaryWorkItem.belt_id || values.belt_id || null,
    vehicle_plate: nullable(values.vehicle_plate),
    used_equipment: nullable(values.used_equipment),
    workshop_departure_at: nullable(values.workshop_departure_at),
    customer_arrival_at: nullable(values.customer_arrival_at),
    customer_departure_at: nullable(values.customer_departure_at),
    factory_return_at: nullable(values.factory_return_at),
    product_code: nullable(values.product_code),
    product_measure: nullable(values.product_measure),
    product_width: nullable(values.product_width),
    product_length: nullable(values.product_length),
    product_quantity: nullable(values.product_quantity),
    product_item_coil_code: nullable(values.product_item_coil_code),
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

function Brand({ compact = false }: { compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={[styles.brand, compact && styles.brandCompact]}>
      {!failed ? (
        <Image
          onError={() => setFailed(true)}
          resizeMode="contain"
          source={require("./assets/tunca-logo.png")}
          style={(compact ? styles.logoSmall : styles.logo) as ImageStyle}
        />
      ) : (
        <View>
          <Text style={styles.brandTitle}>TUNCA</Text>
          <Text style={styles.brandSub}>Montaj ve Tamir Rapor Sistemi</Text>
        </View>
      )}
    </View>
  );
}

function Home({
  draftCount,
  online,
  profile,
  setScreen,
  submittedCount
}: {
  draftCount: number;
  online: boolean;
  profile: Profile | null;
  setScreen: (screen: Screen) => void;
  submittedCount: number;
}) {
  const firstName = profile?.first_name?.trim() || "Personel";

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.homeHero}>
        <View style={styles.homeHeroTop}>
          <View style={styles.homeHeroText}>
            <Text style={styles.homeKicker}>TUNCA Rapor</Text>
            <Text style={styles.homeTitle}>Merhaba {firstName}</Text>
            <Text style={styles.homeDate}>{formatDateDisplay(formatDateValue(new Date()))}</Text>
          </View>
          <View style={[styles.connectionPill, online ? styles.connectionPillOn : styles.connectionPillOff]}>
            <Text style={[styles.connectionText, online ? styles.connectionTextOn : styles.connectionTextOff]}>
              {online ? "Çevrimiçi" : "Çevrimdışı"}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.homeGrid}>
        <HomeButton label="Yeni Rapor" tone="primary" value="" onPress={() => setScreen("form")} />
        <View style={styles.homeStatsRow}>
          <HomeButton label="Taslaklarım" value={String(draftCount)} onPress={() => setScreen("drafts")} />
          <HomeButton label="Gönderdiğim Raporlar" value={String(submittedCount)} onPress={() => setScreen("submitted")} />
        </View>
      </View>
    </ScrollView>
  );
}

function HomeButton({
  label,
  value,
  onPress,
  tone = "default"
}: {
  label: string;
  value: string;
  onPress: () => void;
  tone?: "default" | "primary";
}) {
  const primary = tone === "primary";

  return (
    <Pressable onPress={onPress} style={[styles.tile, primary && styles.tilePrimary]}>
      {primary ? null : <View style={styles.tileAccent} />}
      <Text style={[styles.tileLabel, primary && styles.tileLabelPrimary]}>{label}</Text>
      {value ? <Text style={[styles.tileValue, primary && styles.tileValuePrimary]}>{value}</Text> : null}
    </Pressable>
  );
}

function DraftList({
  drafts,
  onBack,
  onOpen,
  onSync
}: {
  drafts: OfflineDraft[];
  onBack: () => void;
  onOpen: (draft: OfflineDraft) => void;
  onSync: (draft: OfflineDraft) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <BackHeader title="Taslaklarım" onBack={onBack} />
      {drafts.length === 0 ? <Text style={styles.empty}>Henüz taslak rapor yok.</Text> : null}
      {drafts.map((draft) => (
        <View key={draft.local_id} style={styles.card}>
          <Text style={styles.cardTitle}>Taslak</Text>
          <Text>{draft.values.report_date}</Text>
          <Text>{syncLabel(draft.status)}</Text>
          <View style={styles.row}>
            <Pressable onPress={() => onOpen(draft)} style={styles.secondaryButton}>
              <Text>Düzenle</Text>
            </Pressable>
            <Pressable onPress={() => onSync(draft)} style={styles.primaryButtonSmall}>
              <Text style={styles.primaryText}>Senkronize Et</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function ReportList({
  reports,
  onBack,
  onOpen
}: {
  reports: Array<Record<string, string | null>>;
  onBack: () => void;
  onOpen: (reportId: string) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <BackHeader title="Gönderdiğim Raporlar" onBack={onBack} />
      {reports.length === 0 ? <Text style={styles.empty}>Henüz rapor oluşturulmamış.</Text> : null}
      {reports.map((report) => {
        const reportId = String(report.id ?? "");

        return (
          <Pressable
            disabled={!reportId}
            key={reportId}
            onPress={() => onOpen(reportId)}
            style={styles.card}
          >
            <Text style={styles.cardTitle}>{report.report_number ?? "Taslak"}</Text>
            <Text style={styles.cardText}>{formatDateDisplay(String(report.report_date ?? "")) || "-"}</Text>
            <Text style={styles.cardText}>{report.company_name_snapshot ?? "-"}</Text>
            <Text style={styles.cardActionText}>Detayı Gör</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function SubmittedReportDetail({
  reportId,
  onBack
}: {
  reportId: string;
  onBack: () => void;
}) {
  const [report, setReport] = useState<SubmittedReportDetailRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!supabase) {
        setMessage("Supabase bilgileri girilmedi.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("reports")
        .select("*, report_personnel(name_snapshot), report_photos(category,caption,storage_path,created_at)")
        .eq("id", reportId)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        setMessage("Rapor detayı alınamadı veya rapor silinmiş olabilir.");
        setReport(null);
      } else {
        setReport(data as SubmittedReportDetailRow);
      }
      setLoading(false);
    }

    load().catch(() => {
      if (!cancelled) {
        setMessage("Rapor detayı alınamadı.");
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [reportId]);

  const observer = report
    ? fallbackText(readonlyText(report.observer_name_snapshot), readonlyText(report.observer_external_name))
    : "-";

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <BackHeader title="Rapor Detayı" onBack={onBack} />
      {loading ? <ActivityIndicator color="#bd3332" /> : null}
      {message ? <Text style={styles.error}>{message}</Text> : null}
      {report ? (
        <>
          <Section defaultOpen title="Genel Bilgiler">
            <ReadOnlyRows
              rows={[
                ["Rapor No", report.report_number ?? "Taslak"],
                ["Tarih", readonlyDate(report.report_date)],
                ["Firma", readonlyText(report.company_name_snapshot)],
                ["Yetkili Kişi", readonlyText(report.company_contact_name)],
                ["Yetkili Telefon", readonlyText(report.company_contact_phone)],
                ["Hat Adı", readonlyText(report.line_name)],
                ["Makina Marka Model", readonlyText(report.machine_brand_model)],
                ["Giden Personel", report.report_personnel?.map((item) => item.name_snapshot).filter(Boolean).join(", ") || "-"]
              ]}
            />
          </Section>
          <Section title="Zaman Bilgileri">
            <ReadOnlyRows
              rows={[
                ["Atölyeden Çıkış", readonlyDateTime(report.workshop_departure_at)],
                ["Müşteriye Varış", readonlyDateTime(report.customer_arrival_at)],
                ["Müşteriden Çıkış", readonlyDateTime(report.customer_departure_at)],
                ["Fabrikaya Dönüş", readonlyDateTime(report.factory_return_at)]
              ]}
            />
          </Section>
          <Section title="Ürün Bilgileri">
            <ReadOnlyRows
              rows={[
                ["Ürün Kodu", readonlyText(report.product_code)],
                ["Ölçü", readonlyText(report.product_measure)],
                ["En", readonlyText(report.product_width)],
                ["Boy", readonlyText(report.product_length)],
                ["Miktar", readonlyText(report.product_quantity)],
                ["Ürün Item / Coil Kodu", readonlyText(report.product_item_coil_code)],
                ["Ürün Türü", readonlyArray(report.product_types)]
              ]}
            />
          </Section>
          <Section title="Yapılan İşlemler">
            <ReadOnlyRows
              rows={[
                ["İşlemler", readonlyArray(report.process_actions)],
                ["Kenar Kesim", readonlyText(report.edge_cut_method)],
                ["Açıklama", readonlyText(report.process_description)],
                ["Mekanik Bağlantı", readonlyText(report.mechanical_connection)],
                ["Profil", readonlyText(report.profile_material)],
                ["Değiştirme Sebebi", readonlyArray(report.replacement_reasons)]
              ]}
            />
          </Section>
          <Section title="Pres ve Test">
            <ReadOnlyRows
              rows={[
                ["Test Parçası", readonlyText(report.has_test_piece)],
                ["Test Durumu", readonlyText(report.test_status)],
                ["Gözlemci", observer],
                ["Pres Başlama", readonlyText(report.press_start_time)],
                ["Pres Bitiş", readonlyText(report.press_end_time)],
                ["Enerji Kesintisi", readonlyText(report.power_outage)],
                ["Basınç Düşmesi", readonlyText(report.pressure_drop)],
                ["Isı Dengesi", readonlyText(report.heat_balance_ok)]
              ]}
            />
          </Section>
          <Section title="Teknik Detaylar">
            <ReadOnlyRows
              rows={[
                ["Faturalandırma", readonlyText(report.billing_status)],
                ["Teknik Detaylar", readonlyText(report.technical_details)]
              ]}
            />
          </Section>
          <Section title="Gerdirme">
            <ReadOnlyRows
              rows={[
                ["Gerdirme Yapıldı mı?", readonlyText(report.tensioning_done)],
                ["Müşteri Sonra Yapacak", readonlyBool(report.customer_will_tension)],
                ["Müşteri Otomatik Sistemde Yaptı", readonlyBool(report.customer_tensioned_auto)],
                ["Uygulanan Basınç", [readonlyText(report.pressure_value), readonlyText(report.pressure_unit)].filter((value) => value !== "-").join(" ") || "-"],
                ["Ön Gerdirme %", readonlyText(report.pre_tension_percent)],
                ["Hat Çalışır Teslim Edildi", readonlyBool(report.line_delivered_running)]
              ]}
            />
          </Section>
          <Section title="Fotoğraflar">
            <ReadOnlyRows
              rows={(report.report_photos ?? []).length === 0
                ? [["Fotoğraf", "Fotoğraf eklenmemiş."]]
                : (report.report_photos ?? []).map((photo, index) => [
                    `Fotoğraf ${index + 1}`,
                    [photo.caption, photo.category].filter(Boolean).join(" - ") || "Fotoğraf eklendi."
                  ])}
            />
          </Section>
        </>
      ) : null}
    </ScrollView>
  );
}

function ReadOnlyRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <View style={styles.detailRows}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.detailRow}>
          <Text style={styles.detailLabel}>{label}</Text>
          <Text style={styles.detailValue}>{value || "-"}</Text>
        </View>
      ))}
    </View>
  );
}

function readonlyText(value: unknown) {
  if (typeof value === "string" && value.trim()) return value;
  return "-";
}

function fallbackText(...values: string[]) {
  return values.find((value) => value !== "-") ?? "-";
}

function readonlyArray(value: unknown) {
  return Array.isArray(value) ? value.filter(Boolean).join(", ") || "-" : "-";
}

function readonlyBool(value: unknown) {
  if (typeof value !== "boolean") return "-";
  return value ? "Evet" : "Hayır";
}

function readonlyDate(value: unknown) {
  if (typeof value !== "string") return "-";
  return formatDateDisplay(value) || "-";
}

function readonlyDateTime(value: unknown) {
  if (typeof value !== "string" || !value) return "-";
  return formatDateTimeDisplay(value) || "-";
}

function ReportForm(props: {
  belts: Belt[];
  companies: Company[];
  companyLines: CompanyLine[];
  dateTarget: DatePickerTarget | null;
  loading: boolean;
  personnel: Profile[];
  photos: PhotoDraft[];
  profile: Profile | null;
  setDateTarget: (target: DatePickerTarget | null) => void;
  setPhotos: (photos: PhotoDraft[]) => void;
  setScreen: (screen: Screen) => void;
  submitReport: (status: "DRAFT" | "SUBMITTED") => Promise<void>;
  toggleArray: (
    key: "visiting_personnel_ids" | "product_types" | "process_actions" | "replacement_reasons",
    value: string
  ) => void;
  update: <K extends keyof ReportFormValues>(key: K, value: ReportFormValues[K]) => void;
  values: ReportFormValues;
  vehicles: Vehicle[];
  onPickPhoto: (source: "camera" | "library") => void;
  onSaveDraft: () => void;
}) {
  const {
    belts,
    companies,
    companyLines,
    dateTarget,
    loading,
    personnel,
    photos,
    profile,
    setDateTarget,
    setPhotos,
    setScreen,
    submitReport,
    toggleArray,
    update,
    values,
    vehicles,
    onPickPhoto,
    onSaveDraft
  } = props;
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const activeDatePickerValue = dateTarget ? values[dateTarget.field] : "";
  const [iosPickerDate, setIosPickerDate] = useState<Date | null>(null);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === values.company_id),
    [companies, values.company_id]
  );
  const selectedCompanyLines = useMemo(
    () => companyLines.filter((line) => line.company_id === values.company_id),
    [companyLines, values.company_id]
  );

  useEffect(() => {
    if (selectedCompany) {
      update("company_contact_name", selectedCompany.contact_name ?? "");
      update("company_contact_phone", selectedCompany.contact_phone ?? "");
    }
  }, [selectedCompany?.id]);

  useEffect(() => {
    if (!values.company_id && values.line_name) {
      update("line_name", "");
      return;
    }

    if (
      values.company_id &&
      values.line_name &&
      !selectedCompanyLines.some((line) => line.name === values.line_name)
    ) {
      update("line_name", "");
    }
  }, [selectedCompanyLines, values.company_id, values.line_name]);

  useEffect(() => {
    if (Platform.OS !== "ios" || !dateTarget) {
      setIosPickerDate(null);
      return;
    }

    setIosPickerDate(parseDatePickerValue(dateTarget.field, activeDatePickerValue));
  }, [activeDatePickerValue, dateTarget?.field, dateTarget?.mode]);

  function applyDatePickerSelection(target: DatePickerTarget, date: Date) {
    if (target.field === "report_date") {
      update("report_date", formatDateValue(date));
      setDateTarget(null);
      return;
    }

    if (target.field === "press_start_time" || target.field === "press_end_time") {
      update(target.field, formatTimeValue(date));
      setDateTarget(null);
      return;
    }

    const current = parseDatePickerValue(target.field, values[target.field]);
    if (target.mode === "date") {
      const merged = mergeDatePart(current, date);
      update(target.field, merged.toISOString());
      setIosPickerDate(merged);
      setDateTarget({ field: target.field, mode: "time" });
      return;
    }

    update(target.field, mergeTimePart(current, date).toISOString());
    setDateTarget(null);
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <BackHeader title="Rapor Formu" onBack={() => setScreen("home")} />
      {companies.length === 0 ? (
        <Text style={styles.error}>Firma bulunamadı. Yetkili amirden firma eklemesini isteyin.</Text>
      ) : null}

      <Section defaultOpen title="1. Genel Bilgiler">
        <PickerField
          label="Rapor Tarihi"
          onPress={() => setDateTarget({ field: "report_date", mode: "date" })}
          placeholder="Tarih seçin"
          value={formatDateDisplay(values.report_date)}
        />
        <Select label="Müşteri Ünvanı ve Adresi / Firma" value={values.company_id} onChange={(value) => update("company_id", value)}>
          <SelectOption label="Firma seçin" value="" />
          {companies.map((company) => <SelectOption key={company.id} label={company.name} value={company.id} />)}
        </Select>
        <Input label="Yetkili Kişi" value={values.company_contact_name} onChange={(value) => update("company_contact_name", value)} />
        <Input label="Yetkili Telefon" value={values.company_contact_phone} onChange={(value) => update("company_contact_phone", value)} />
        <Select label="İşlem Görecek Olan Hat Adı" value={values.line_name} onChange={(value) => update("line_name", value)}>
          <SelectOption label={values.company_id ? "Hat seçin" : "Önce firma seçin"} value="" />
          {selectedCompanyLines.map((line) => <SelectOption key={line.id} label={line.name} value={line.name} />)}
        </Select>
        <Input label="Makina Marka Modeli" value={values.machine_brand_model} onChange={(value) => update("machine_brand_model", value)} />
        <Select label="Bant Seç" value={values.belt_id} onChange={(value) => update("belt_id", value)}>
          <SelectOption label="Bant seçin" value="" />
          {belts.map((belt) => <SelectOption key={belt.id} label={formatBeltLabel(belt)} value={belt.id} />)}
        </Select>
        <Text style={styles.readonly}>Formu Dolduran Personel: {profile ? `${profile.first_name} ${profile.last_name}` : "-"}</Text>
        <Checklist
          label="Giden Personel"
          options={personnel.filter((item) => item.id !== profile?.id).map((item) => ({ label: `${item.first_name} ${item.last_name}`, value: item.id }))}
          selected={values.visiting_personnel_ids}
          onToggle={(value) => toggleArray("visiting_personnel_ids", value)}
        />
        <Select label="Kullanılan Araç Plakası" value={values.vehicle_plate} onChange={(value) => update("vehicle_plate", value)}>
          <SelectOption label="Plaka seçin" value="" />
          {vehicles.map((vehicle) => <SelectOption key={vehicle.id} label={vehicle.plate} value={vehicle.plate} />)}
        </Select>
        <Input multiline label="Kullanılan Makine ve Ekipmanları" value={values.used_equipment} onChange={(value) => update("used_equipment", value)} />
      </Section>

      <Section title="2. Zaman Bilgileri">
        <PickerField
          label="Atölyeden Çıkış Tarih Saati"
          onPress={() => setDateTarget({ field: "workshop_departure_at", mode: "date" })}
          placeholder="Tarih ve saat seçin"
          value={formatDateTimeDisplay(values.workshop_departure_at)}
        />
        <PickerField
          label="Müşteriye Varış Tarih Saati"
          onPress={() => setDateTarget({ field: "customer_arrival_at", mode: "date" })}
          placeholder="Tarih ve saat seçin"
          value={formatDateTimeDisplay(values.customer_arrival_at)}
        />
        <PickerField
          label="Müşteriden Çıkış Tarih Saati"
          onPress={() => setDateTarget({ field: "customer_departure_at", mode: "date" })}
          placeholder="Tarih ve saat seçin"
          value={formatDateTimeDisplay(values.customer_departure_at)}
        />
        <PickerField
          label="Fabrikaya Dönüş Tarih Saati"
          onPress={() => setDateTarget({ field: "factory_return_at", mode: "date" })}
          placeholder="Tarih ve saat seçin"
          value={formatDateTimeDisplay(values.factory_return_at)}
        />
      </Section>

      <Section title="3. Ürün Bilgileri">
        <Input label="Ürün Kodu" value={values.product_code} onChange={(value) => update("product_code", value)} />
        <Input label="Ölçü" value={values.product_measure} onChange={(value) => update("product_measure", value)} />
        <Input label="En" value={values.product_width} onChange={(value) => update("product_width", value)} />
        <Input label="Boy" value={values.product_length} onChange={(value) => update("product_length", value)} />
        <Input keyboardType="numeric" label="Miktar" value={values.product_quantity} onChange={(value) => update("product_quantity", value)} />
        <Input label="Ürün Item ve Coil Kodu" value={values.product_item_coil_code} onChange={(value) => update("product_item_coil_code", value)} />
        <Checklist label="İşlem Görecek Ürün Türü" options={productTypes.map((value) => ({ label: value, value }))} selected={values.product_types} onToggle={(value) => toggleArray("product_types", value)} />
        {values.product_types.includes("Diğer") ? <Input label="Diğer Açıklama" value={values.product_type_other} onChange={(value) => update("product_type_other", value)} /> : null}
      </Section>

      <Section title="4. Yapılan İşlemler">
        <Checklist label="Yapılacak İşlem" options={processActions.map((value) => ({ label: value, value }))} selected={values.process_actions} onToggle={(value) => toggleArray("process_actions", value)} />
        {values.process_actions.includes("Kenar Kesim") ? (
          <RadioGroup label="Kenar Kesim" value={values.edge_cut_method} options={["Makine ile", "El ile"]} onChange={(value) => update("edge_cut_method", value as ReportFormValues["edge_cut_method"])} />
        ) : null}
        {values.process_actions.includes("Diğer") ? <Input label="Diğer İşlem Açıklama" value={values.process_action_other} onChange={(value) => update("process_action_other", value)} /> : null}
        <Input multiline label="Kullanılan Mekanik Bağlantı Tipi ve Miktarı" value={values.mechanical_connection} onChange={(value) => update("mechanical_connection", value)} />
        <Input multiline label="Kullanılan Profil Tipi ve Miktarı" value={values.profile_material} onChange={(value) => update("profile_material", value)} />
        <Input label="Kaç Yıldır Çalışıyordu?" value={values.removed_belt_years} onChange={(value) => update("removed_belt_years", value)} />
        <Checklist
          label="Değiştirme Sebebi Nedir?"
          options={[
            "Mekanik sıkıntılardan dolayı",
            "Ek yeri açtı",
            "Sorun yoktu, bant ortalama ömrü doldu",
            "Diğer"
          ].map((value) => ({ label: value, value }))}
          selected={values.replacement_reasons}
          onToggle={(value) => toggleArray("replacement_reasons", value)}
        />
        {values.replacement_reasons.includes("Diğer") ? <Input label="Diğer Sebep" value={values.replacement_reason_other} onChange={(value) => update("replacement_reason_other", value)} /> : null}
      </Section>

      <Section title="5. Test ve Pres Bilgileri">
        <RadioGroup label="Ürün Test Parçası Var mı?" value={values.has_test_piece} options={["Var", "Yok"]} onChange={(value) => update("has_test_piece", value as ReportFormValues["has_test_piece"])} />
        <RadioGroup label="Test Durumu" value={values.test_status} options={["Test Yapıldı", "Test Yapılmadı"]} onChange={(value) => update("test_status", value as ReportFormValues["test_status"])} />
        <Select label="Gözlemci Personel" value={values.observer_personnel_id} onChange={(value) => update("observer_personnel_id", value)}>
          <SelectOption label="Personel seçilmedi" value="" />
          {personnel.map((item) => <SelectOption key={item.id} label={`${item.first_name} ${item.last_name}`} value={item.id} />)}
        </Select>
        <Input label="Dış Personel Açıklama" value={values.observer_external_name} onChange={(value) => update("observer_external_name", value)} />
        <PickerField
          label="Pres İşlemi Başlama Saati"
          onPress={() => setDateTarget({ field: "press_start_time", mode: "time" })}
          placeholder="Saat seçin"
          value={formatTimeDisplay(values.press_start_time)}
        />
        <PickerField
          label="Pres İşlemi Bitiş Saati"
          onPress={() => setDateTarget({ field: "press_end_time", mode: "time" })}
          placeholder="Saat seçin"
          value={formatTimeDisplay(values.press_end_time)}
        />
        <RadioGroup label="Enerji Kesintisi Oldu mu?" value={values.power_outage} options={["Hayır", "Evet"]} onChange={(value) => update("power_outage", value as ReportFormValues["power_outage"])} />
        <RadioGroup label="Basınç Düşmesi Oldu mu?" value={values.pressure_drop} options={["Hayır", "Evet"]} onChange={(value) => update("pressure_drop", value as ReportFormValues["pressure_drop"])} />
        <RadioGroup label="Üst Isı Alt Isı Dengesi Uygun mu?" value={values.heat_balance_ok} options={["Hayır", "Evet"]} onChange={(value) => update("heat_balance_ok", value as ReportFormValues["heat_balance_ok"])} />
      </Section>

      <Section title="6. Teknik Detaylar">
        <Input multiline label="Yapılan İşlem Açıklama" value={values.process_description} onChange={(value) => update("process_description", value)} />
        <RadioGroup
          label="Faturalandırma Durumu"
          value={values.billing_status}
          options={["Yapılan İşlem Tarafınıza Fatura Edilecektir", "Bedelsiz İşlem Yapılmıştır"]}
          onChange={(value) => update("billing_status", value as ReportFormValues["billing_status"])}
        />
        <Input multiline label="Teknik Detaylar" value={values.technical_details} onChange={(value) => update("technical_details", value)} />
      </Section>

      <Section title="7. Gerdirme ve Blanket">
        <RadioGroup label="Gerdirme İşlemi Yapıldı mı?" value={values.tensioning_done} options={["Evet", "Hayır"]} onChange={(value) => update("tensioning_done", value as ReportFormValues["tensioning_done"])} />
        <SwitchRow label="Müşteri Daha Sonra Kendisi Yapacak" value={values.customer_will_tension} onChange={(value) => update("customer_will_tension", value)} />
        <SwitchRow label="Gerdirme İşlemini Müşteri Kendisi Otomatik Sistemde Yaptı" value={values.customer_tensioned_auto} onChange={(value) => update("customer_tensioned_auto", value)} />
        <Input label="Uygulanan Basınç Miktarı" value={values.pressure_value} onChange={(value) => update("pressure_value", value)} />
        <Input label="Birim" value={values.pressure_unit} onChange={(value) => update("pressure_unit", value)} />
        <Input keyboardType="numeric" label="Ön Gerdirme Değeri %" value={values.pre_tension_percent} onChange={(value) => update("pre_tension_percent", value)} />
        <SwitchRow label="Hat Çalışır Durumda Teslim Edildi" value={values.line_delivered_running} onChange={(value) => update("line_delivered_running", value)} />
        <RadioGroup label="Blanketler İçin Pürüzlendirme Bilgisi Verildi mi?" value={values.blanket_roughening_info_given} options={["Evet", "Hayır"]} onChange={(value) => update("blanket_roughening_info_given", value as ReportFormValues["blanket_roughening_info_given"])} />
        <Input label="Bilgilendirme Yapılan Kişi Ad Soyad" value={values.blanket_info_person_name} onChange={(value) => update("blanket_info_person_name", value)} />
      </Section>

      <Section title="8. Fotoğraflar">
        <Pressable onPress={() => setPhotoPickerOpen(true)} style={styles.primaryButton}>
          <Text style={styles.primaryText}>Fotoğraf Yükle</Text>
        </Pressable>
        {photos.map((photo) => (
          <View key={photo.localId} style={styles.photoRow}>
            <Image source={{ uri: photo.uri }} style={styles.photo as ImageStyle} />
            <View style={{ flex: 1 }}>
              <TextInput
                onChangeText={(caption) => setPhotos(photos.map((item) => item.localId === photo.localId ? { ...item, caption } : item))}
                placeholder="Fotoğraf açıklaması (isteğe bağlı)"
                style={styles.input}
                value={photo.caption}
              />
              <Pressable onPress={() => setPhotos(photos.filter((item) => item.localId !== photo.localId))} style={styles.secondaryButton}>
                <Text>Sil</Text>
              </Pressable>
            </View>
          </View>
        ))}
        <OptionSheet onClose={() => setPhotoPickerOpen(false)} title="Fotoğraf Kaynağı" visible={photoPickerOpen}>
          <Pressable
            onPress={() => {
              setPhotoPickerOpen(false);
              onPickPhoto("camera");
            }}
            style={styles.optionRow}
          >
            <Text style={styles.optionText}>Kamera ile çek</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setPhotoPickerOpen(false);
              onPickPhoto("library");
            }}
            style={styles.optionRow}
          >
            <Text style={styles.optionText}>Galeriden seç</Text>
          </Pressable>
        </OptionSheet>
      </Section>

      {dateTarget && Platform.OS === "ios" ? (
        <OptionSheet onClose={() => setDateTarget(null)} title={datePickerTitle(dateTarget)} visible>
          <DateTimePicker
            display="spinner"
            locale="tr-TR"
            mode={dateTarget.mode}
            onChange={(_event, date) => {
              if (date) setIosPickerDate(date);
            }}
            style={styles.iosDatePicker}
            value={iosPickerDate ?? parseDatePickerValue(dateTarget.field, values[dateTarget.field])}
          />
          <View style={styles.sheetActions}>
            <Pressable onPress={() => setDateTarget(null)} style={[styles.secondaryButton, styles.sheetActionButton]}>
              <Text>İptal</Text>
            </Pressable>
            <Pressable
              onPress={() => applyDatePickerSelection(dateTarget, iosPickerDate ?? parseDatePickerValue(dateTarget.field, values[dateTarget.field]))}
              style={[styles.primaryButtonSmall, styles.sheetActionButton]}
            >
              <Text style={styles.primaryText}>Tamam</Text>
            </Pressable>
          </View>
        </OptionSheet>
      ) : null}

      {dateTarget && Platform.OS !== "ios" ? (
        <DateTimePicker
          display="default"
          locale="tr-TR"
          mode={dateTarget.mode}
          onChange={(event, date) => {
            if ((event as { type?: string }).type === "dismissed") {
              setDateTarget(null);
              return;
            }

            if (!date) return;
            applyDatePickerSelection(dateTarget, date);
          }}
          value={parseDatePickerValue(dateTarget.field, values[dateTarget.field])}
        />
      ) : null}

      <View style={styles.footerActions}>
        <Pressable disabled={loading} onPress={onSaveDraft} style={styles.secondaryButton}>
          <Text>Taslak Kaydet</Text>
        </Pressable>
        <Pressable disabled={loading || companies.length === 0} onPress={() => submitReport("SUBMITTED")} style={styles.primaryButton}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Raporu Gönder</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Section({
  title,
  children,
  defaultOpen = false
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={styles.section}>
      <Pressable onPress={() => setOpen((current) => !current)} style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionAction}>{open ? "Kapat" : "Aç"}</Text>
      </Pressable>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

function Input({
  label,
  value,
  onChange,
  multiline = false,
  keyboardType = "default",
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  keyboardType?: "default" | "numeric" | "email-address";
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChange}
        placeholder={placeholder}
        style={[styles.input, multiline && styles.textarea]}
        value={value}
      />
    </View>
  );
}

type SelectOptionProps = {
  label: string;
  value: string;
};

function Select({
  label,
  value,
  onChange,
  children
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const parsed = Children.toArray(children)
    .filter((child): child is React.ReactElement<SelectOptionProps> =>
      isValidElement<SelectOptionProps>(child)
    )
    .map((option) => option.props);
  const selectedOption = parsed.find((option) => option.value === value);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={() => setOpen(true)} style={styles.inputLike}>
        <Text numberOfLines={2} style={[styles.inputLikeText, !selectedOption && styles.placeholderText]}>
          {selectedOption?.label ?? "Seçin"}
        </Text>
        <Text style={styles.inputAction}>Seç</Text>
      </Pressable>
      <OptionSheet onClose={() => setOpen(false)} title={label} visible={open}>
        {parsed.map((option) => {
          const active = value === option.value;

          return (
            <Pressable
              key={`${option.value || "empty"}-${option.label}`}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
              }}
              style={[styles.optionRow, active && styles.optionRowActive]}
            >
              <Text style={[styles.optionText, active && styles.optionTextActive]}>{option.label}</Text>
              {active ? <Text style={styles.optionCheck}>Seçili</Text> : null}
            </Pressable>
          );
        })}
      </OptionSheet>
    </View>
  );
}

function SelectOption(_props: SelectOptionProps) {
  return null;
}

function Checklist({
  label,
  options,
  selected,
  onToggle
}: {
  label: string;
  options: Array<{ label: string; value: string }>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabels = options
    .filter((option) => selected.includes(option.value))
    .map((option) => option.label);
  const summary = selectedLabels.length > 0
    ? selectedLabels.join(", ")
    : options.length > 0
      ? "Seçim yapın"
      : "Seçilebilir kayıt yok";

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        disabled={options.length === 0}
        onPress={() => setOpen(true)}
        style={[styles.inputLike, options.length === 0 && styles.inputDisabled]}
      >
        <Text numberOfLines={2} style={[styles.inputLikeText, selectedLabels.length === 0 && styles.placeholderText]}>
          {summary}
        </Text>
        {options.length > 0 ? <Text style={styles.inputAction}>Seç</Text> : null}
      </Pressable>
      <OptionSheet onClose={() => setOpen(false)} title={label} visible={open}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => onToggle(option.value)}
            style={[styles.optionRow, selected.includes(option.value) && styles.optionRowActive]}
          >
            <Text style={[styles.optionText, selected.includes(option.value) && styles.optionTextActive]}>{option.label}</Text>
            {selected.includes(option.value) ? <Text style={styles.optionCheck}>Seçili</Text> : null}
          </Pressable>
        ))}
        <Pressable onPress={() => setOpen(false)} style={styles.optionFooter}>
          <Text style={styles.primaryText}>Tamam</Text>
        </Pressable>
      </OptionSheet>
    </View>
  );
}

function RadioGroup({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const parsed = [
    { label: "Seçilmedi", value: "" },
    ...options.map((option) => ({ label: option, value: option }))
  ];
  const selectedOption = parsed.find((option) => option.value === value);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={() => setOpen(true)} style={styles.inputLike}>
        <Text numberOfLines={2} style={[styles.inputLikeText, !value && styles.placeholderText]}>
          {selectedOption?.label ?? "Seçilmedi"}
        </Text>
        <Text style={styles.inputAction}>Seç</Text>
      </Pressable>
      <OptionSheet onClose={() => setOpen(false)} title={label} visible={open}>
        {parsed.map((option) => {
          const active = value === option.value;

          return (
          <Pressable
            key={`${option.value || "empty"}-${option.label}`}
            onPress={() => {
              onChange(option.value);
              setOpen(false);
            }}
            style={[styles.optionRow, active && styles.optionRowActive]}
          >
            <Text style={[styles.optionText, active && styles.optionTextActive]}>{option.label}</Text>
            {active ? <Text style={styles.optionCheck}>Seçili</Text> : null}
          </Pressable>
          );
        })}
      </OptionSheet>
    </View>
  );
}

function PickerField({
  label,
  value,
  onPress,
  placeholder = "Seçin"
}: {
  label: string;
  value: string;
  onPress: () => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={onPress} style={styles.inputLike}>
        <Text numberOfLines={2} style={[styles.inputLikeText, !value && styles.placeholderText]}>
          {value || placeholder}
        </Text>
        <Text style={styles.inputAction}>Seç</Text>
      </Pressable>
    </View>
  );
}

function OptionSheet({
  visible,
  title,
  children,
  onClose
}: {
  visible: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalBackdrop}>
        <Pressable accessibilityLabel="Kapat" onPress={onClose} style={styles.modalDismiss} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView style={styles.optionList}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.switchRow}>
      <View style={[styles.checkbox, value && styles.checkboxOn]} />
      <Text style={styles.switchText}>{label}</Text>
    </Pressable>
  );
}

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.backHeader}>
      <Pressable onPress={onBack} style={styles.secondaryButton}><Text>Geri</Text></Pressable>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

function syncLabel(status: OfflineDraft["status"]) {
  if (status === "DEVICE_SAVED") return "Cihazda Kaydedildi";
  if (status === "WAITING_SYNC") return "Senkronizasyon Bekliyor";
  if (status === "SYNCED") return "Senkronize Edildi";
  return "Senkronizasyon Hatası";
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f2f3f5"
  },
  centered: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 22
  },
  topbar: {
    alignItems: "center",
    backgroundColor: "#fbfbfc",
    borderBottomColor: "#d7dbe0",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  content: {
    gap: 16,
    padding: 16,
    paddingBottom: 34
  },
  brand: {
    alignItems: "center",
    marginBottom: 20
  },
  brandCompact: {
    alignItems: "flex-start",
    marginBottom: 0
  },
  logo: {
    height: 64,
    width: 220
  },
  logoSmall: {
    height: 42,
    width: 178
  },
  brandTitle: {
    color: "#30343a",
    fontSize: 28,
    fontWeight: "800"
  },
  brandSub: {
    color: "#6e747c",
    fontSize: 12
  },
  panel: {
    backgroundColor: "#fff",
    borderColor: "#d9dde2",
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 18
  },
  title: {
    color: "#25282c",
    fontSize: 24,
    fontWeight: "800"
  },
  input: {
    backgroundColor: "#fff",
    borderColor: "#d0d5da",
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  textarea: {
    minHeight: 92,
    textAlignVertical: "top"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#bd3332",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 14
  },
  primaryButtonSmall: {
    alignItems: "center",
    backgroundColor: "#bd3332",
    borderRadius: 6,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 12
  },
  primaryText: {
    color: "#fff",
    fontWeight: "800"
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#eef0f2",
    borderColor: "#d9dde2",
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 12
  },
  iconButton: {
    backgroundColor: "#30343a",
    borderRadius: 6,
    borderTopColor: "#bd3332",
    borderTopWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  iconButtonText: {
    color: "#fff",
    fontWeight: "700"
  },
  banner: {
    backgroundColor: "#edf2f7",
    color: "#34404c",
    padding: 10
  },
  error: {
    backgroundColor: "#faeaea",
    borderRadius: 6,
    color: "#8e2526",
    padding: 10
  },
  grid: {
    gap: 12
  },
  homeHero: {
    backgroundColor: "#2f3338",
    borderColor: "#3e444b",
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    padding: 18
  },
  homeHeroTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between"
  },
  homeHeroText: {
    flex: 1,
    gap: 5
  },
  homeKicker: {
    color: "#f0c9c9",
    fontSize: 12,
    fontWeight: "800"
  },
  homeTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34
  },
  homeDate: {
    color: "#d8dde2",
    fontSize: 14,
    fontWeight: "600"
  },
  connectionPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  connectionPillOn: {
    backgroundColor: "#e8f4ef",
    borderColor: "#b8ded1"
  },
  connectionPillOff: {
    backgroundColor: "#faeaea",
    borderColor: "#efcaca"
  },
  connectionText: {
    fontSize: 12,
    fontWeight: "800"
  },
  connectionTextOn: {
    color: "#19735a"
  },
  connectionTextOff: {
    color: "#8e2526"
  },
  homeGrid: {
    gap: 12
  },
  homeStatsRow: {
    flexDirection: "row",
    gap: 12
  },
  tile: {
    flex: 1,
    backgroundColor: "#fff",
    borderColor: "#d7dbe0",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 116,
    overflow: "hidden",
    padding: 16
  },
  tilePrimary: {
    alignItems: "center",
    backgroundColor: "#bd3332",
    borderColor: "#a22d2c",
    justifyContent: "center",
    minHeight: 88
  },
  tileAccent: {
    backgroundColor: "#bd3332",
    borderRadius: 99,
    height: 4,
    marginBottom: 14,
    width: 38
  },
  tileLabel: {
    color: "#2f3338",
    fontSize: 17,
    fontWeight: "800"
  },
  tileLabelPrimary: {
    color: "#fff",
    fontSize: 22,
    textAlign: "center"
  },
  tileValue: {
    color: "#bd3332",
    fontSize: 36,
    fontWeight: "800",
    marginTop: 8
  },
  tileValuePrimary: {
    color: "#fff",
    fontSize: 24,
    marginTop: 14
  },
  card: {
    backgroundColor: "#fff",
    borderColor: "#d9dde2",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 14
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800"
  },
  cardText: {
    color: "#30343a",
    fontWeight: "600"
  },
  cardActionText: {
    color: "#bd3332",
    fontWeight: "800",
    marginTop: 4
  },
  detailRows: {
    gap: 0
  },
  detailRow: {
    borderBottomColor: "#edf0f2",
    borderBottomWidth: 1,
    gap: 4,
    paddingVertical: 10
  },
  detailLabel: {
    color: "#6e747c",
    fontSize: 12,
    fontWeight: "800"
  },
  detailValue: {
    color: "#30343a",
    fontSize: 15,
    fontWeight: "600"
  },
  empty: {
    color: "#6e747c"
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  section: {
    backgroundColor: "#fff",
    borderColor: "#d9dde2",
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden"
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  sectionBody: {
    borderTopColor: "#edf0f2",
    borderTopWidth: 1,
    gap: 12,
    padding: 14
  },
  sectionTitle: {
    color: "#25282c",
    flex: 1,
    fontSize: 18,
    fontWeight: "800"
  },
  sectionAction: {
    color: "#bd3332",
    fontSize: 13,
    fontWeight: "800"
  },
  field: {
    gap: 6
  },
  label: {
    color: "#464d55",
    fontSize: 13,
    fontWeight: "700"
  },
  readonly: {
    backgroundColor: "#eef0f2",
    borderRadius: 6,
    color: "#30343a",
    padding: 10
  },
  inputLike: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#d0d5da",
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  inputLikeText: {
    color: "#30343a",
    flex: 1,
    fontWeight: "600"
  },
  placeholderText: {
    color: "#7a828c",
    fontWeight: "500"
  },
  inputAction: {
    color: "#bd3332",
    fontSize: 13,
    fontWeight: "800"
  },
  inputDisabled: {
    backgroundColor: "#f0f2f4"
  },
  modalBackdrop: {
    backgroundColor: "rgba(0,0,0,0.38)",
    flex: 1,
    justifyContent: "flex-end"
  },
  modalDismiss: {
    ...StyleSheet.absoluteFillObject
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    maxHeight: "75%",
    paddingBottom: 18,
    paddingHorizontal: 16,
    paddingTop: 10
  },
  sheetHandle: {
    alignSelf: "center",
    backgroundColor: "#d0d5da",
    borderRadius: 99,
    height: 4,
    marginBottom: 14,
    width: 42
  },
  sheetTitle: {
    color: "#25282c",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12
  },
  iosDatePicker: {
    alignSelf: "stretch"
  },
  sheetActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6
  },
  sheetActionButton: {
    flex: 1
  },
  optionList: {
    width: "100%"
  },
  optionRow: {
    alignItems: "center",
    borderColor: "#d9dde2",
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    marginBottom: 8,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  optionRowActive: {
    backgroundColor: "#faeeee",
    borderColor: "#bd3332"
  },
  optionText: {
    color: "#30343a",
    flex: 1,
    fontWeight: "600"
  },
  optionTextActive: {
    color: "#8e2526"
  },
  optionCheck: {
    color: "#bd3332",
    fontSize: 12,
    fontWeight: "800"
  },
  optionFooter: {
    alignItems: "center",
    backgroundColor: "#bd3332",
    borderRadius: 6,
    justifyContent: "center",
    marginTop: 4,
    minHeight: 46
  },
  switchRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    minHeight: 38
  },
  checkbox: {
    borderColor: "#9aa2ac",
    borderRadius: 4,
    borderWidth: 2,
    height: 22,
    width: 22
  },
  checkboxOn: {
    backgroundColor: "#bd3332",
    borderColor: "#bd3332"
  },
  switchText: {
    color: "#30343a",
    flex: 1
  },
  photoRow: {
    flexDirection: "row",
    gap: 12
  },
  photo: {
    backgroundColor: "#eef0f2",
    borderRadius: 6,
    height: 92,
    width: 92
  },
  footerActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    marginTop: 8
  },
  backHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12
  }
});
