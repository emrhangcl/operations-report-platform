"use client";

import { Eye, EyeOff } from "lucide-react";
import { InputHTMLAttributes, useId, useState } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/shadcn/field";
import { Input } from "@/components/shadcn/input";
import { cn } from "@/lib/utils";

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
  error?: string;
  hint?: string;
  label: string;
  labelAction?: React.ReactNode;
}

// shadcn "login-02" Field yapisi: FieldLabel + Input (+ aciklama). Parola alaninda goster/gizle.
export function AuthField({
  "aria-describedby": describedBy,
  containerClassName,
  error,
  hint,
  id,
  label,
  labelAction,
  type,
  ...inputProps
}: AuthFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = type === "password";
  const ariaDescribedBy = [describedBy, errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <Field className={containerClassName} data-invalid={error ? true : undefined}>
      {labelAction ? (
        <div className="flex items-center">
          <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
          <div className="ml-auto text-sm">{labelAction}</div>
        </div>
      ) : (
        <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      )}
      <div className="relative">
        <Input
          {...inputProps}
          aria-describedby={ariaDescribedBy}
          aria-invalid={error ? true : undefined}
          className={cn(isPassword && "pr-9")}
          id={inputId}
          type={isPassword && passwordVisible ? "text" : type}
        />
        {isPassword ? (
          <button
            aria-label={passwordVisible ? "Parolayı gizle" : "Parolayı göster"}
            aria-pressed={passwordVisible}
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={() => setPasswordVisible((visible) => !visible)}
            type="button"
          >
            {passwordVisible ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
          </button>
        ) : null}
      </div>
      {hint ? <FieldDescription id={hintId}>{hint}</FieldDescription> : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </Field>
  );
}

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  const checks = [
    password.length >= 10,
    /[A-ZÇĞİÖŞÜ]/.test(password),
    /[a-zçğıöşü]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9ÇĞİÖŞÜçğıöşü]/.test(password)
  ];
  const score = checks.filter(Boolean).length;
  const labels = ["Çok zayıf", "Zayıf", "Orta", "İyi", "Güçlü"];

  return (
    <div aria-live="polite" className="grid gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Parola gücü</span>
        <span className="font-medium">{labels[Math.max(0, score - 1)]}</span>
      </div>
      <div aria-hidden className="grid grid-cols-5 gap-1">
        {checks.map((passed, index) => (
          <span className={cn("h-1 rounded-full", passed ? "bg-primary" : "bg-muted")} key={index} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        En az 10 karakter kullanın; büyük-küçük harf, sayı ve sembol eklemek güvenliği artırır.
      </p>
    </div>
  );
}
