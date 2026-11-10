import { apiFailure, apiSuccess, enforceRateLimit } from "@/lib/marketplace/http";
import { getMarketplaceCities } from "@/lib/marketplace/provider";

export async function GET(request: Request) {
  try {
    enforceRateLimit("marketplace-cities", 30);
    return apiSuccess(await getMarketplaceCities(request.signal));
  } catch (error) {
    return apiFailure(error);
  }
}
