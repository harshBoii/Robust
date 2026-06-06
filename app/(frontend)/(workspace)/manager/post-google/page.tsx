import PostToGoogleClient from '@/app/components/manager/PostToGoogleClient';

export default function PostToGooglePage() {
  return (
    <div className="p-6 h-full flex flex-col">
      <h1 className="text-xl font-semibold text-foreground mb-6">Post to Google Ads</h1>
      <PostToGoogleClient />
    </div>
  );
}
