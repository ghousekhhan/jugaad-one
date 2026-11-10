"use client";

import { Check, Phone, MessageSquare, Bike, Home, Utensils, ChevronDown } from "lucide-react";
import { BrandMark } from "@/components/brand";

export function OrderTrackingScreen({
  orderReference = "JO784562",
  restaurantName = "The Chaat House",
  cuisine = "Indian • Street Food",
  totalPaid = 345,
  etaMinutes = 12,
  providerName = "Wiggy",
  partnerName = "Rohit Sharma",
  partnerVehicle = "On a bike • DL 4S AB 2387",
  items,
  onStartNewOrder,
  onOpenOrders,
  onOpenHome,
}: {
  orderReference?: string;
  restaurantName?: string;
  cuisine?: string;
  totalPaid?: number;
  etaMinutes?: number;
  providerName?: string;
  partnerName?: string;
  partnerVehicle?: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
  onStartNewOrder?: () => void;
  onOpenOrders?: () => void;
  onOpenHome?: () => void;
}) {
  const lineItems = items && items.length > 0 ? items : [
    { name: "Aloo Tikki Chaat", quantity: 1, price: 149 },
    { name: "Pani Puri (6 pcs)", quantity: 1, price: 99 },
    { name: "Masala Coke", quantity: 1, price: 59 },
  ];

  const itemTotal = lineItems.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const taxesAndFees = Math.max(0, totalPaid - itemTotal);

  return (
    <div className="w-full max-w-6xl mx-auto py-6 px-4 sm:px-8 space-y-8">
      {/* 1. Top Navigation Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-[#E5DDD0]/70">
        <div className="flex items-center gap-2.5">
          <BrandMark size={32} />
          <span className="font-extrabold text-xl tracking-tight text-[#1F1F1F]">
            Jugaad<span className="text-[#FF7A00]">One</span>
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-2 bg-white/70 border border-[#E5DDD0] p-1 rounded-full text-xs font-semibold">
          <button
            type="button"
            onClick={onOpenHome}
            className="px-3.5 py-1.5 rounded-full text-[#5D5953] hover:text-[#1F1F1F] transition-colors cursor-pointer"
          >
            Home
          </button>
          <button
            type="button"
            onClick={onOpenOrders}
            className="px-3.5 py-1.5 rounded-full bg-[#FFEAD8] text-[#C2410C] transition-colors cursor-pointer"
          >
            Orders
          </button>
          <div className="px-3.5 py-1.5 rounded-full text-[#5D5953] opacity-60">
            Saved
          </div>
          <div className="px-3.5 py-1.5 rounded-full text-[#5D5953] opacity-60">
            Support
          </div>
        </nav>

        <div className="flex items-center gap-1.5 bg-white border border-[#E5DDD0] px-3 py-1.5 rounded-full text-xs font-bold text-[#5D5953]">
          <span>👤</span>
          <ChevronDown size={14} />
        </div>
      </div>

      {/* 2. Top Hero Banner with 3D Delivery Bag Illustration */}
      <div className="bg-[#FFF8F3] border border-[#FFD2B3] rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center gap-8 shadow-sm relative overflow-hidden">
        {/* Left: Stylized 3D Paper Delivery Bag */}
        <div className="relative w-40 h-40 shrink-0 flex items-center justify-center">
          {/* Subtle sunburst rays */}
          <div className="absolute inset-0 flex items-center justify-center text-[#FF7A00]/30 animate-pulse pointer-events-none">
            <svg width="160" height="160" viewBox="0 0 160 160" fill="none">
              <path d="M80 10V25M25 80H10M135 80H150M80 135V150M35 35L45 45M125 125L115 115M125 35L115 45M35 125L45 115" stroke="#FF7A00" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>

          {/* Craft Paper Bag SVG */}
          <div className="relative z-10 w-32 h-36 bg-[#E8CDB0] rounded-xl border-2 border-[#D4B595] shadow-xl flex flex-col items-center justify-center transform -rotate-2">
            {/* Bag Handles */}
            <div className="absolute -top-6 w-14 h-8 rounded-t-full border-4 border-[#C4A381] border-b-0" />
            {/* Bag Logo Mark */}
            <div className="w-12 h-12 rounded-xl bg-[#F7E7D7] flex items-center justify-center text-[#FF7A00] shadow-sm">
              <Utensils size={24} />
            </div>
          </div>
        </div>

        {/* Right: Confirmation Message */}
        <div className="space-y-3 text-center md:text-left flex-1">
          <div className="inline-flex items-center gap-2 bg-[#FFEAD8] text-[#C2410C] text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full border border-[#FFD2B3]">
            <Check size={14} className="stroke-[3]" />
            <span>Order Confirmed</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-display tracking-tight text-[#1F1F1F]">
            Your food is <span className="text-[#FF7A00]">on the way!</span>
          </h1>

          <p className="text-sm sm:text-base text-[#5D5953] leading-relaxed">
            Sit back and get ready to enjoy your meal. Tracking advances in real time.
          </p>
        </div>
      </div>

      {/* 3. Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Receipt & Order Summary */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-[#E5DDD0] shadow-sm space-y-5">
          {/* Order Reference & Provider */}
          <div className="flex items-center justify-between pb-4 border-b border-[#F0EBE2]">
            <div>
              <div className="font-extrabold text-base text-[#1F1F1F] font-display">
                Order #{orderReference}
              </div>
              <p className="text-xs text-[#5D5953]">Placed today</p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFF8F3] border border-[#FFD2B3] text-xs font-bold text-[#FF7A00]">
              <span>{providerName}</span>
              <ChevronDown size={13} />
            </div>
          </div>

          {/* Restaurant Details */}
          <div className="flex items-center justify-between pb-4 border-b border-[#F0EBE2]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FFF4EC] flex items-center justify-center text-xl shrink-0">
                🍜
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-[#1F1F1F] font-display">
                  {restaurantName}
                </h3>
                <p className="text-xs text-[#5D5953]">{cuisine}</p>
              </div>
            </div>
            <span className="text-xs text-[#6F6B65]">›</span>
          </div>

          {/* Line Items List */}
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6F6B65]">
              Order Summary
            </span>
            <div className="space-y-2 text-xs text-[#1F1F1F]">
              {lineItems.map((item, idx) => (
                <div key={idx} className="flex justify-between items-baseline">
                  <span className="text-[#5D5953]">
                    {item.name} <strong className="text-[#1F1F1F]">×{item.quantity}</strong>
                  </span>
                  <span className="font-semibold">₹{item.price * item.quantity}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-3 border-t border-[#F0EBE2] text-xs text-[#5D5953]">
              <div className="flex justify-between">
                <span>Item Total</span>
                <span>₹{itemTotal}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxes &amp; Fees</span>
                <span>₹{taxesAndFees}</span>
              </div>
            </div>
          </div>

          {/* Total Paid Box */}
          <div className="bg-[#FFF8F3] border border-[#FFD2B3] rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-[#5D5953]">Total Paid</span>
              <div className="flex items-center gap-1 text-[11px] font-bold text-[#16866E] pt-0.5">
                <Check size={12} className="stroke-[3]" />
                <span>Paid via Simulated Jugaad Pay</span>
              </div>
            </div>
            <span className="text-2xl font-black font-display text-[#1F1F1F]">
              ₹{totalPaid}
            </span>
          </div>
        </div>

        {/* Right Column: Tracking Map & Progress Stepper */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-[#E5DDD0] shadow-sm space-y-6">
          {/* Estimated Delivery Header */}
          <div className="space-y-1">
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#6F6B65]">
              ESTIMATED DELIVERY
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold font-display tracking-tight text-[#1F1F1F]">
              Arriving in <span className="text-[#FF7A00]">{etaMinutes} min</span>
            </h2>
            <p className="text-xs text-[#5D5953]">Estimated arrival in your area</p>
          </div>

          {/* Illustrated Interactive Map Track */}
          <div className="w-full h-32 rounded-3xl bg-[#FFF8F3] border border-[#FFD2B3] p-4 flex items-center justify-between relative overflow-hidden">
            {/* Background Map Contours */}
            <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 500 120" fill="none">
              <path d="M0 60C150 20 300 100 500 40" stroke="#FF7A00" strokeWidth="3" strokeDasharray="6 6" />
            </svg>

            {/* Restaurant Pin */}
            <div className="relative z-10 flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-full bg-[#FF7A00] text-white flex items-center justify-center shadow-md">
                <Utensils size={18} />
              </div>
              <span className="text-[10px] font-bold text-[#1F1F1F] bg-white px-2 py-0.5 rounded-full border border-[#E5DDD0]">
                Kitchen
              </span>
            </div>

            {/* Moving Scooter in Transit */}
            <div className="relative z-10 flex flex-col items-center gap-1 animate-pulse">
              <div className="w-11 h-11 rounded-full bg-white border-2 border-[#FF7A00] text-[#FF7A00] flex items-center justify-center shadow-lg">
                <Bike size={20} />
              </div>
              <span className="text-[10px] font-bold text-[#FF7A00] bg-white px-2 py-0.5 rounded-full border border-[#FFD2B3]">
                In Transit
              </span>
            </div>

            {/* Customer Home Pin */}
            <div className="relative z-10 flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-full bg-[#16866E] text-white flex items-center justify-center shadow-md">
                <Home size={18} />
              </div>
              <span className="text-[10px] font-bold text-[#1F1F1F] bg-white px-2 py-0.5 rounded-full border border-[#E5DDD0]">
                Your Door
              </span>
            </div>
          </div>

          {/* 4-Step Progress Stepper */}
          <div className="grid grid-cols-4 gap-2 pt-2 text-center">
            {/* Step 1: Placed */}
            <div className="space-y-1.5 flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-[#FF7A00] text-white flex items-center justify-center">
                <Check size={14} className="stroke-[3]" />
              </div>
              <div className="text-xs font-bold text-[#1F1F1F]">Order Placed</div>
              <span className="text-[10px] text-[#6F6B65]">Confirmed</span>
            </div>

            {/* Step 2: Preparing */}
            <div className="space-y-1.5 flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-[#FF7A00] text-white flex items-center justify-center">
                <Check size={14} className="stroke-[3]" />
              </div>
              <div className="text-xs font-bold text-[#1F1F1F]">Preparing</div>
              <span className="text-[10px] text-[#6F6B65]">In kitchen</span>
            </div>

            {/* Step 3: Picked Up */}
            <div className="space-y-1.5 flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-[#FF7A00] text-white flex items-center justify-center">
                <Check size={14} className="stroke-[3]" />
              </div>
              <div className="text-xs font-bold text-[#1F1F1F]">Picked Up</div>
              <span className="text-[10px] text-[#6F6B65]">On road</span>
            </div>

            {/* Step 4: Arriving */}
            <div className="space-y-1.5 flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-[#FFEAD8] border-2 border-[#FF7A00] text-[#FF7A00] flex items-center justify-center animate-bounce">
                <Bike size={14} />
              </div>
              <div className="text-xs font-extrabold text-[#FF7A00]">Arriving</div>
              <span className="text-[10px] font-bold text-[#FF7A00]">~{etaMinutes} min</span>
            </div>
          </div>

          {/* Delivery Partner Card */}
          <div className="bg-[#F8F5EE] border border-[#E5DDD0] rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#FF7A00] text-white font-bold flex items-center justify-center text-lg border-2 border-white shadow-sm shrink-0">
                👨‍🦱
              </div>
              <div>
                <span className="text-[11px] font-bold text-[#FF7A00] uppercase tracking-wider">
                  Delivered by {providerName}
                </span>
                <div className="text-sm font-extrabold text-[#1F1F1F]">{partnerName}</div>
                <div className="text-xs text-[#5D5953]">{partnerVehicle}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Call simulated partner"
                className="w-10 h-10 rounded-full bg-white border border-[#DDD4C7] flex items-center justify-center text-[#1F1F1F] hover:bg-[#F0EBE2] transition-colors"
              >
                <Phone size={16} />
              </button>
              <button
                type="button"
                aria-label="Message simulated partner"
                className="w-10 h-10 rounded-full bg-white border border-[#DDD4C7] flex items-center justify-center text-[#1F1F1F] hover:bg-[#F0EBE2] transition-colors"
              >
                <MessageSquare size={16} />
              </button>
            </div>
          </div>
          {/* Start New Order CTA Button */}
          {onStartNewOrder && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onStartNewOrder}
                className="w-full inline-flex items-center justify-center gap-2 bg-[#FF7A00] hover:bg-[#E56A00] text-white py-4 rounded-2xl font-bold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <Utensils size={18} />
                <span>Start New Order or Ask Anything →</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
