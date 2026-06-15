import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <AuthForm />
    </main>
  );
}
