import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserIdOrNull } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage() {
  const userId = await getUserIdOrNull();
  if (userId) redirect("/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-semibold text-slate-900">Sign in</h1>
        <p className="mt-1 text-sm text-slate-600">
          Welcome back to Orders &amp; Settlements.
        </p>
        <div className="mt-6">
          <LoginForm />
        </div>
        <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
          Demo account: <span className="font-mono">demo@example.com</span> /{" "}
          <span className="font-mono">demo1234</span>
        </div>
        <p className="mt-6 text-sm text-slate-600">
          No account?{" "}
          <Link href="/signup" className="font-medium text-slate-900 underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
