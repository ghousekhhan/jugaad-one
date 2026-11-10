import { apiFailure, apiSuccess, enforceRateLimit } from "@/lib/marketplace/http";
import { MarketplaceError, marketplaceProvider } from "@/lib/marketplace/provider";
import { foodProviderSchema, reviewQuerySchema } from "@/lib/marketplace/schemas";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const provider = foodProviderSchema.safeParse(params.get("provider"));
    const query = reviewQuerySchema.safeParse({ branchId: params.get("branchId"), limit: 3 });
    if (!provider.success || !query.success) throw new MarketplaceError("INVALID_MARKETPLACE_INPUT", 400);
    enforceRateLimit("marketplace-reviews", 24);
    return apiSuccess(await marketplaceProvider(provider.data).getReviews(query.data, request.signal));
  } catch (error) {
    return apiFailure(error);
  }
}
