import { getMarketplaceImage } from "@/lib/marketplace/provider";

export async function GET(request: Request, { params }: RouteContext<"/api/marketplace/image/[file]">) {
  try {
    const { file } = await params;
    const body = await getMarketplaceImage(file, request.signal);
    return new Response(body, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response(null, { status: 404 });
  }
}
