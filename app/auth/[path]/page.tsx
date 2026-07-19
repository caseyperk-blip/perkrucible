import { AuthView } from "@neondatabase/auth-ui";

export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "#030303" }}><AuthView path={path} /></main>;
}
