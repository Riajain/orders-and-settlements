import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserIdOrNull } from "@/lib/auth/session";
import { SignupForm } from "@/components/auth/SignupForm";

export default async function SignupPage() {
  const userId = await getUserIdOrNull();
  if (userId) redirect("/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-semibold text-slate-900">Create account</h1>
        <p className="mt-1 text-sm text-slate-600">
          Start tracking orders and payments in seconds.
        </p>
        <div className="mt-6">
          <SignupForm />
        </div>
        <p className="mt-6 text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-slate-900 underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
