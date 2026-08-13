import { redirect } from "next/navigation";
import { getUserIdOrNull } from "@/lib/auth/session";

export default async function Home() {
  const userId = await getUserIdOrNull();
  redirect(userId ? "/dashboard" : "/login");
}
