import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserIdOrNull } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await getUserIdOrNull();
  if (!userId) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="text-lg font-semibold text-slate-900">
            Orders &amp; Settlements
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-slate-700 hover:text-slate-900">
              Dashboard
            </Link>
            <Link
              href="/orders/new"
              className="text-slate-700 hover:text-slate-900"
            >
              New order
            </Link>
            <span className="text-slate-400">|</span>
            <span className="text-slate-500">{user?.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
