import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import GalleryClient from "../galleryClient";

export default async function GalleryVideosPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <GalleryClient
      companyId={session.companyId}
      assetTypeFilter="VIDEO"
      pageTitle="Videos"
      pageSubtitle="Video assets in this workspace. Stream when playback is ready."
      hideFoldersView
      hideInlineUploader
    />
  );
}
