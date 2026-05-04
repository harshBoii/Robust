// app/gallery/page.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import GalleryClient from "./galleryClient";

// ✅ Server Component — no "use client"
export default async function GalleryPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <GalleryClient companyId={session.companyId} />;
}