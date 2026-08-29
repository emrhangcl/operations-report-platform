import Link from "next/link";
import { AuthShell } from "../../components/auth-shell";
import { RegisterForm } from "../../components/register-form";

export default function RegisterPage() {
  return (
    <AuthShell
      description="Firma hesabını ve ilk yetkili kullanıcıyı oluşturun. Uygulama erişimi e-posta ve ödeme doğrulamasından sonra açılır."
      footer={<span>Zaten hesabınız var mı? <Link href="/login">Giriş yapın</Link></span>}
      title="Firma Kaydı"
    >
      <RegisterForm />
    </AuthShell>
  );
}
