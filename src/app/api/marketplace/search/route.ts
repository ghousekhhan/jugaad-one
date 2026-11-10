import { searchFood } from "@/lib/marketplace/discovery";
import { searchInputSchema } from "@/lib/marketplace/discovery-types";
import { apiFailure, apiSuccess, assertSameOrigin, enforceRateLimit, readJson } from "@/lib/marketplace/http";
import { MarketplaceError } from "@/lib/marketplace/provider";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = searchInputSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new MarketplaceError("INVALID_MARKETPLACE_INPUT", 400);
    enforceRateLimit("marketplace-search", 6);
    return apiSuccess(await searchFood(parsed.data, request.signal));
  } catch (error) {
    return apiFailure(error);
  }
}
