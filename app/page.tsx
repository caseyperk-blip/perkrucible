import { isCollectionOwner } from "@/lib/auth/server";
import { HomePageClient } from "./HomePageClient";

export default async function HomePage() {
  return <HomePageClient canEdit={await isCollectionOwner()} />;
}
