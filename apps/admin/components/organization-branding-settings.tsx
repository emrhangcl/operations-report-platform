"use client";

import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Trash2, Upload } from "lucide-react";
import { loadAccountContext, updateAccountBrandingCache } from "../lib/account-context-client";
import { getBrowserSupabase } from "../lib/supabase-browser";
import { Alert, Button, ConfirmDialog, EmptyState, FormActions, FormField, LoadingState } from "./ui";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

interface BrandingPayload {
  organizationName: string;
  logoUrl: string | null;
}

async function authorizationHeader() {
  const supabase = getBrowserSupabase();
  const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
  return data.session?.access_token ? `Bearer ${data.session.access_token}` : null;
}

export function OrganizationBrandingSettings() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [branding, setBranding] = useState<BrandingPayload | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmLogoRemoval, setConfirmLogoRemoval] = useState(false);

  async function load() {
    try {
      setBranding(await loadAccountContext("admin"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Firma marka bilgileri alınamadı.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  function selectFile(nextFile: File | null) {
    setMessage("");
    setError("");
    if (!nextFile) {
      setFile(null);
      return;
    }
    if (!ALLOWED_LOGO_TYPES.includes(nextFile.type)) {
      setError("PNG, JPG veya WebP biçiminde bir görsel seçin.");
      return;
    }
    if (nextFile.size > MAX_LOGO_BYTES) {
      setError("Logo dosyası en fazla 2 MB olabilir.");
      return;
    }
    setFile(nextFile);
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Önce bir logo dosyası seçin.");
      return;
    }

    const authorization = await authorizationHeader();
    if (!authorization) {
      setError("Oturum bulunamadı.");
      return;
    }

    setBusy(true);
    setMessage("");
    setError("");
    try {
      const formData = new FormData();
      formData.set("logo", file);
      const response = await fetch("/api/admin/organization/logo", {
        method: "POST",
        body: formData,
        headers: { Authorization: authorization }
      });
      const body = await response.json().catch(() => ({})) as BrandingPayload & { message?: string };
      if (!response.ok) {
        setError(body.message ?? "Logo yüklenemedi.");
        return;
      }
      setBranding(body);
      updateAccountBrandingCache("admin", body);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setMessage("Firma logosu güncellendi.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!branding?.logoUrl) return;

    const authorization = await authorizationHeader();
    if (!authorization) {
      setError("Oturum bulunamadı.");
      return;
    }

    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/organization/logo", {
        method: "DELETE",
        headers: { Authorization: authorization }
      });
      const body = await response.json().catch(() => ({})) as BrandingPayload & { message?: string };
      if (!response.ok) {
        setError(body.message ?? "Logo kaldırılamadı.");
        return;
      }
      setBranding(body);
      updateAccountBrandingCache("admin", body);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setMessage("Firma logosu kaldırıldı. Varsayılan portal markası gösterilecek.");
    } finally {
      setBusy(false);
      setConfirmLogoRemoval(false);
    }
  }

  if (loading) {
    return <LoadingState aria-busy="true" className="branding-loading" label="Marka bilgileri yükleniyor" />;
  }

  return (
    <>
      <section className="branding-settings" aria-labelledby="branding-title">
        <div className="branding-preview-panel">
          <div className="branding-section-heading">
            <span className="branding-heading-icon"><ImagePlus aria-hidden size={20} /></span>
            <div>
              <h2 id="branding-title">Panel logosu</h2>
              <p>Admin ve personel ekranlarında firmanızın markası gösterilir.</p>
            </div>
          </div>
          <div className="branding-preview">
            {previewUrl || branding?.logoUrl ? (
              <Image
                alt={`${branding?.organizationName ?? "Firma"} logo önizlemesi`}
                height={120}
                src={previewUrl ?? branding?.logoUrl ?? ""}
                unoptimized
                width={320}
              />
            ) : (
              <EmptyState className="branding-empty-preview" title="Henüz logo yüklenmedi">
                Varsayılan Operasyon Portalı markası kullanılıyor.
              </EmptyState>
            )}
          </div>
        </div>

        <form className="branding-upload-panel" onSubmit={upload}>
          <FormField
            hint="PNG, JPG veya WebP. En fazla 2 MB. Yatay logolar panelde daha iyi görünür."
            htmlFor="organization-logo"
            label="Logo dosyası"
          >
            <input
              accept="image/png,image/jpeg,image/webp"
              id="organization-logo"
              onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
              ref={inputRef}
              type="file"
            />
          </FormField>
          {file ? <div className="branding-file-summary"><strong>{file.name}</strong><span>{(file.size / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} KB</span></div> : null}
          {message ? <Alert tone="success">{message}</Alert> : null}
          {error ? <Alert tone="error">{error}</Alert> : null}
          <FormActions className="branding-actions">
            <Button disabled={busy || !file} icon={busy ? <LoaderCircle aria-hidden className="spin" size={18} /> : <Upload aria-hidden size={18} />} type="submit">
              {busy ? "Kaydediliyor" : "Logoyu Kaydet"}
            </Button>
            {branding?.logoUrl ? (
              <Button disabled={busy} icon={<Trash2 aria-hidden size={18} />} onClick={() => setConfirmLogoRemoval(true)} variant="danger">
                Logoyu Kaldır
              </Button>
            ) : null}
          </FormActions>
        </form>
      </section>
      <ConfirmDialog
        confirmLabel="Logoyu Kaldır"
        description="Firma logosu kaldırılsın mı?"
        onCancel={() => setConfirmLogoRemoval(false)}
        onConfirm={() => {
          void remove();
        }}
        open={confirmLogoRemoval}
        title="Logo kaldırma onayı"
      />
    </>
  );
}
