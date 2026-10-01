import { redirect } from "next/navigation";
import { canViewPortfolio, hasSession } from "@/lib/auth";
import PortfolioLogin from "./PortfolioLogin";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const asAdmin = (await searchParams).as === "admin";
  if (asAdmin ? await hasSession("manage") : await canViewPortfolio()) {
    redirect(asAdmin ? "/manage" : "/");
  }
  return <PortfolioLogin asAdmin={asAdmin} />;
}
