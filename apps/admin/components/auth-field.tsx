"use client";

import { Eye, EyeOff } from "lucide-react";
import { InputHTMLAttributes, ReactNode, useId, useState } from "react";

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
  error?: string;
  hint?: string;
  icon: ReactNode;
  label: string;
}

export function AuthField({
  "aria-describedby": describedBy,
  containerClassName,
  error,
  hint,
  icon,
  id,
  label,
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
    <div className={["auth-field", containerClassName, error ? "has-error" : ""].filter(Boolean).join(" ")}>
      <label htmlFor={inputId}>{label}</label>
      <div className="auth-input-shell">
        <span aria-hidden className="auth-input-icon">{icon}</span>
        <input
          {...inputProps}
          aria-describedby={ariaDescribedBy}
          aria-invalid={error ? true : undefined}
          id={inputId}
          type={isPassword && passwordVisible ? "text" : type}
        />
        {isPassword ? (
          <button
            aria-label={passwordVisible ? "Parolayı gizle" : "Parolayı göster"}
            aria-pressed={passwordVisible}
            className="auth-password-toggle"
            onClick={() => setPasswordVisible((visible) => !visible)}
            type="button"
          >
            {passwordVisible ? <EyeOff aria-hidden size={18} /> : <Eye aria-hidden size={18} />}
          </button>
        ) : null}
      </div>
      {hint ? <span className="auth-field-hint" id={hintId}>{hint}</span> : null}
      {error ? <span className="auth-field-error" id={errorId}>{error}</span> : null}
    </div>
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
    <div className="password-strength" aria-live="polite">
      <div className="password-strength-heading">
        <span>Parola gücü</span>
        <strong>{labels[Math.max(0, score - 1)]}</strong>
      </div>
      <div aria-hidden className="password-strength-track">
        {checks.map((passed, index) => <span className={passed ? "passed" : ""} key={index} />)}
      </div>
      <p>En az 10 karakter kullanın; büyük-küçük harf, sayı ve sembol eklemek güvenliği artırır.</p>
    </div>
  );
}
