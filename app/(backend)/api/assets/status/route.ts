import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// Client connects with ?ids=id1,id2,id3
// Server pushes status updates every 3s until all are READY or ERROR
export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids")?.split(",").filter(Boolean);

  if (!ids?.length) {
    return new Response("Missing ids", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let active = true;

      const poll = async () => {
        if (!active) return;

        const assets = await prisma.asset.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            status: true,
            streamId: true,
            playbackUrl: true,
            thumbnailUrl: true,
            duration: true,
            resolution: true,
          },
        });

        send({ assets });

        // Stop polling once all are terminal (READY or ERROR)
        const allDone = assets.every(
          (a) => a.status === "READY" || a.status === "ERROR"
        );

        if (allDone) {
          send({ done: true });
          controller.close();
          return;
        }

        setTimeout(poll, 3000);
      };

      await poll();

      // Cleanup if client disconnects
      req.signal.addEventListener("abort", () => {
        active = false;
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}