import { AuthScenery } from "@/components/AuthScenery";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthScenery>{children}</AuthScenery>;
}
