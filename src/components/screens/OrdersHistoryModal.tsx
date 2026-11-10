"use client";

import { X, Package, Check, ArrowRight } from "lucide-react";
import type { SandboxOrder } from "@/lib/commerce/types";

export function OrdersHistoryModal({
  isOpen,
  onClose,
  orders,
  onSelectOrder,
}: {
  isOpen: boolean;
  onClose: () => void;
  orders: SandboxOrder[];
  onSelectOrder: (order: SandboxOrder) => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 border border-[#E5DDD0] shadow-2xl space-y-6 relative max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#F0EBE2]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FFEAD8] flex items-center justify-center text-[#FF7A00]">
              <Package size={18} />
            </div>
            <div>
              <h2 className="font-extrabold text-lg text-[#1F1F1F] font-display">
                Your Orders
              </h2>
              <p className="text-xs text-[#5D5953]">
                {orders.length} simulated transaction{orders.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close orders modal"
            className="w-8 h-8 rounded-full bg-[#F8F5EE] hover:bg-[#F3ECE1] text-[#1F1F1F] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Orders List */}
        <div className="overflow-y-auto space-y-3 flex-1 pr-1">
          {orders.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <span className="text-4xl">🛍️</span>
              <p className="text-sm font-bold text-[#1F1F1F]">No orders placed yet</p>
              <p className="text-xs text-[#5D5953] max-w-xs mx-auto">
                Speak or type to find what you want, compare options, and complete a demo checkout.
              </p>
            </div>
          ) : (
            orders.map((order) => {
              const total = Math.round(order.quote.offer.totalPaise / 100);
              const dateStr = new Date(order.confirmedAt).toLocaleDateString("en-IN", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <div
                  key={order.reference}
                  className="bg-[#F8F5EE] rounded-2xl p-4 border border-[#E5DDD0] flex items-center justify-between gap-4 hover:border-[#FF7A00]/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#FF7A00]">
                        #{order.reference}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#16866E] bg-[#EBF7F5] px-2 py-0.5 rounded-full">
                        <Check size={10} className="stroke-[3]" />
                        <span>Confirmed</span>
                      </span>
                    </div>
                    <div className="text-sm font-bold text-[#1F1F1F]">
                      {order.quote.offer.listing.name}
                    </div>
                    <div className="text-xs text-[#5D5953]">
                      From {order.quote.offer.listing.seller} • {dateStr}
                    </div>
                  </div>

                  <div className="text-right space-y-1.5 shrink-0">
                    <div className="font-extrabold text-base text-[#1F1F1F]">
                      ₹{total}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectOrder(order);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#FF7A00] hover:text-[#E56A00] transition-colors cursor-pointer"
                    >
                      <span>Track</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-[#F0EBE2] flex items-center justify-between text-xs text-[#6F6B65]">
          <span>All orders are simulated sandbox transactions.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full bg-[#1F1F1F] text-white font-bold cursor-pointer hover:bg-black transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}