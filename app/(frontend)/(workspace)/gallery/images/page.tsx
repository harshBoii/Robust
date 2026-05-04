import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import GalleryClient from "../galleryClient";

export default async function GalleryImagesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <GalleryClient
      companyId={session.companyId}
      assetTypeFilter="IMAGE"
      pageTitle="Images"
      pageSubtitle="Image assets in this workspace."
      hideFoldersView
      hideInlineUploader
    />
  );
}
