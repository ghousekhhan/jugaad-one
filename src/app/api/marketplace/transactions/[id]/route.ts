import type { NextRequest } from "next/server";
import { z } from "zod";
import { checkoutCookie, checkoutOwner, readTransaction } from "@/lib/marketplace/checkout";
import { apiFailure, apiSuccess, enforceRateLimit } from "@/lib/marketplace/http";
import { MarketplaceError } from "@/lib/marketplace/provider";

export async function GET(request: NextRequest, { params }: RouteContext<"/api/marketplace/transactions/[id]">) {
  try {
    const owner = checkoutOwner(request.cookies.get(checkoutCookie)?.value);
    const id = z.uuid().safeParse((await params).id);
    if (!owner || !id.success) throw new MarketplaceError("TRANSACTION_NOT_FOUND", 404);
    enforceRateLimit("marketplace-tracking", 90);
    return apiSuccess(await readTransaction(owner, id.data, request.signal));
  } catch (error) { return apiFailure(error); }
}
