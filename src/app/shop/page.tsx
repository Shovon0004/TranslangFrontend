"use client";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import {
  Coins,
  Star,
  Zap,
  CheckCircle2,
  Loader2,
  ShoppingCart,
  CreditCard,
} from "lucide-react";

// ── Razorpay types ────────────────────────────────────────────────────────────
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: new (options: Record<string, any>) => { open(): void };
  }
}

/** Dynamically load the Razorpay checkout script */
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload  = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

interface XpPackage   { id: string; coins: number; xp: number }
interface CoinPackage { id: string; coins: number; priceINR: number }

/* ── XP-package display meta ───────────────────────────────────────────────── */
const XP_META: Record<string, { label: string; description: string; badge?: string; color: string; iconBg: string }> = {
  small:  { label: "Starter Boost",   description: "Quick XP injection",            color: "from-sky-400 to-cyan-500",     iconBg: "bg-sky-100 text-sky-600" },
  medium: { label: "Power Pack",      description: "Great value for steady growth",  badge: "Popular",   color: "from-violet-500 to-purple-600", iconBg: "bg-purple-100 text-purple-600" },
  large:  { label: "Mega Surge",      description: "Level up fast",                  color: "from-orange-400 to-amber-500", iconBg: "bg-orange-100 text-orange-600" },
  jumbo:  { label: "Ultimate Bundle", description: "Best value — max XP gain",       badge: "Best Value", color: "from-rose-500 to-pink-600",    iconBg: "bg-rose-100 text-rose-600" },
};

/* ── Coin-package display meta ─────────────────────────────────────────────── */
const COIN_META: Record<string, { label: string; description: string; badge?: string; color: string }> = {
  coins_50:  { label: "Handful",  description: "Get started",                    color: "from-amber-400 to-yellow-500" },
  coins_150: { label: "Pouch",    description: "Great for a few XP upgrades",    color: "from-amber-500 to-orange-500" },
  coins_350: { label: "Treasury", description: "Stock up & save",                badge: "Popular",    color: "from-orange-500 to-red-500" },
  coins_800: { label: "Vault",    description: "Ultimate value — never run out", badge: "Best Value", color: "from-rose-600 to-pink-700" },
};

/* ── Component ─────────────────────────────────────────────────────────────── */
export default function ShopPage() {
  const { user, updateUser } = useAuth();

  const [tab, setTab]                   = useState<"coins" | "xp">("coins");
  const [xpPackages, setXpPackages]     = useState<XpPackage[]>([]);
  const [coinPackages, setCoinPackages] = useState<CoinPackage[]>([]);
  const [purchasing, setPurchasing]     = useState<string | null>(null);
  const [toast, setToast]               = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    api.get("/users/shop/packages").then((r) => setXpPackages(r.data)).catch(() => {});
    api.get("/users/shop/coin-packages").then((r) => setCoinPackages(r.data)).catch(() => {});
  }, []);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  /* Buy XP with coins */
  const handleBuyXp = async (pkg: XpPackage) => {
    if (purchasing) return;
    if ((user?.coins ?? 0) < pkg.coins) {
      showToast("error", `Not enough coins! Need ${pkg.coins} but you have ${user?.coins ?? 0}.`);
      return;
    }
    setPurchasing(pkg.id);
    try {
      const res = await api.post("/users/me/buy-xp", { packageId: pkg.id });
      updateUser({ coins: res.data.coins, xp: res.data.xp });
      showToast("success", `+${pkg.xp} XP added! Remaining coins: ${res.data.coins}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast("error", msg || "Purchase failed. Try again.");
    } finally {
      setPurchasing(null);
    }
  };

  /* Buy coins with ₹ — Razorpay checkout */
  const handleBuyCoins = async (pkg: CoinPackage) => {
    if (purchasing) return;
    setPurchasing(pkg.id);

    try {
      // 1. Load the Razorpay checkout script
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        showToast("error", "Failed to load payment gateway. Check your connection.");
        return;
      }

      // 2. Create a Razorpay order on the server
      const { data } = await api.post("/payment/create-order", { packageId: pkg.id });

      // 3. Open the Razorpay checkout popup
      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key:         data.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount:      data.amount,
          currency:    data.currency,
          order_id:    data.orderId,
          name:        "Translingua App",
          description: `${pkg.coins} coins`,
          image:       "/favicon.ico",
          prefill: {
            name:  user?.name  ?? "",
            email: user?.email ?? "",
          },
          theme: { color: "#06555A" },

          // Only show domestic (India) payment methods
          config: {
            display: {
              preferences: { show_default_blocks: true },
              hide: [{ method: "international" }],
            },
          },
          method: {
            card:       true,   // Indian debit/credit cards only
            netbanking: true,
            upi:        true,
            wallet:     true,
            emi:        false,
          },

          // 4. On successful payment, verify signature on the server
          handler: async (response: {
            razorpay_order_id:   string;
            razorpay_payment_id: string;
            razorpay_signature:  string;
          }) => {
            try {
              const verifyRes = await api.post("/payment/verify", {
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                packageId:           pkg.id,
              });
              updateUser({ coins: verifyRes.data.coins });
              showToast("success", `+${pkg.coins} coins added! Total: ${verifyRes.data.coins}`);
              resolve();
            } catch (err) {
              reject(err);
            }
          },

          modal: {
            // Treat modal close as cancellation
            ondismiss: () => reject(new Error("Payment cancelled")),
          },
        });
        rzp.open();
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })
        ?.response?.data?.message ??
        (err as { message?: string })?.message ??
        "Purchase failed. Try again.";
      if (msg !== "Payment cancelled") showToast("error", msg);
    } finally {
      setPurchasing(null);
    }
  };

  const coins = user?.coins ?? 0;
  const xp    = user?.xp    ?? 0;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2.5 tracking-tight">
              <span className="w-9 h-9 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow">
                <Coins className="w-5 h-5" />
              </span>
              TransLang Treasury &amp; Shop
            </h1>
            <p className="text-slate-600 text-xs sm:text-sm mt-1">Acquire coins &amp; activate instant XP boosters for your fluency progression</p>
          </div>
        </div>

        {/* Balance strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="glass-card-light rounded-3xl p-5 border border-white/80 shadow-md flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100/80 text-amber-600 flex items-center justify-center flex-shrink-0 shadow-sm text-2xl">
              🪙
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Coin Reserve</p>
              <p className="text-3xl font-extrabold text-slate-900 leading-tight">{coins}</p>
            </div>
          </div>
          <div className="glass-card-light rounded-3xl p-5 border border-white/80 shadow-md flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-100/80 text-[#06555A] flex items-center justify-center flex-shrink-0 shadow-sm">
              <Star className="w-6 h-6 text-[#06555A] fill-[#06555A]" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Experience (XP)</p>
              <p className="text-3xl font-extrabold text-slate-900 leading-tight">{xp}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 glass-pill p-1.5 rounded-full shadow-sm w-fit">
          <button
            onClick={() => setTab("coins")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all ${
              tab === "coins" ? "bg-slate-950 text-white shadow" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Acquire Coins
          </button>
          <button
            onClick={() => setTab("xp")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all ${
              tab === "xp" ? "bg-slate-950 text-white shadow" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Zap className="w-4 h-4 text-amber-400" />
            Convert Coins → XP Boosts
          </button>
        </div>

        {/* ── BUY COINS tab ────────────────────────────────────────────────────── */}
        {tab === "coins" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {coinPackages.map((pkg) => {
                const meta = COIN_META[pkg.id] ?? { label: pkg.id, description: "", color: "from-amber-400 to-yellow-500" };
                const isLoading = purchasing === pkg.id;

                return (
                  <div
                    key={pkg.id}
                    className="relative glass-card-light rounded-3xl border border-white/80 shadow-md overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                  >
                    <div className="p-6">
                      {meta.badge && (
                        <span className="absolute top-5 right-5 text-[10px] font-extrabold px-3 py-1 rounded-full bg-slate-950 text-amber-400 border border-white/20 shadow-sm uppercase tracking-wider">
                          {meta.badge}
                        </span>
                      )}

                      <div className="flex items-center gap-3.5 mb-5">
                        <div className="w-14 h-14 rounded-2xl bg-amber-100/80 flex items-center justify-center text-3xl select-none shadow-sm">
                          🪙
                        </div>
                        <div>
                          <h3 className="font-extrabold text-slate-900 text-lg leading-tight">{meta.label}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">{meta.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mb-6 p-4 rounded-2xl bg-white/70 border border-slate-100">
                        <div className="flex items-center gap-2">
                          <Coins className="w-5 h-5 text-amber-500" />
                          <span className="text-2xl font-black text-slate-900">{pkg.coins}</span>
                          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">coins</span>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-black text-slate-900">₹{pkg.priceINR}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Secure Razorpay</p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleBuyCoins(pkg)}
                        disabled={!!purchasing}
                        className={`w-full py-3.5 rounded-full font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg ${
                          !purchasing
                            ? "bg-slate-950 hover:bg-slate-800 text-white hover:-translate-y-0.5"
                            : "bg-slate-200 text-slate-400 cursor-not-allowed"
                        }`}
                      >
                        {isLoading ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Authorizing…</>
                        ) : (
                          <><ShoppingCart className="w-4 h-4" /> Purchase for ₹{pkg.priceINR}</>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── SPEND COINS → XP tab ─────────────────────────────────────────────── */}
        {tab === "xp" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {xpPackages.map((pkg) => {
              const meta = XP_META[pkg.id] ?? { label: pkg.id, description: "", color: "from-teal-400 to-emerald-500", iconBg: "bg-teal-100 text-[#06555A]" };
              const canAfford = coins >= pkg.coins;
              const isLoading = purchasing === pkg.id;

              return (
                <div
                  key={pkg.id}
                  className={`relative glass-card-light rounded-3xl border shadow-md overflow-hidden transition-all duration-300 flex flex-col justify-between ${
                    canAfford ? "border-white/80 hover:shadow-2xl hover:-translate-y-1" : "border-white/40 opacity-60"
                  }`}
                >
                  <div className="p-6">
                    {meta.badge && (
                      <span className="absolute top-5 right-5 text-[10px] font-extrabold px-3 py-1 rounded-full bg-slate-950 text-white border border-white/20 shadow-sm uppercase tracking-wider">
                        {meta.badge}
                      </span>
                    )}

                    <div className="flex items-center gap-3.5 mb-5">
                      <div className="w-14 h-14 rounded-2xl bg-teal-50 text-[#06555A] flex items-center justify-center shadow-sm">
                        <Zap className="w-7 h-7 text-amber-500 fill-amber-500" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-lg leading-tight">{meta.label}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{meta.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-6 p-4 rounded-2xl bg-white/70 border border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <Coins className="w-4 h-4 text-amber-500" />
                        <span className="text-xl font-black text-slate-900">{pkg.coins}</span>
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">coins</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400 font-bold">→</span>
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        <span className="text-2xl font-black text-slate-900">+{pkg.xp}</span>
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">XP</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleBuyXp(pkg)}
                      disabled={!canAfford || !!purchasing}
                      className={`w-full py-3.5 rounded-full font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg ${
                        canAfford && !purchasing
                          ? "bg-slate-950 hover:bg-slate-800 text-white hover:-translate-y-0.5"
                          : "bg-slate-200 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      {isLoading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Unlocking…</>
                      ) : canAfford ? (
                        <>Convert {pkg.coins} Coins → +{pkg.xp} XP</>
                      ) : (
                        <>Need {pkg.coins - coins} more coins</>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-3.5 rounded-full shadow-2xl text-white font-bold text-xs sm:text-sm z-50 animate-bounce ${
            toast.type === "success" ? "bg-slate-950 border border-emerald-400" : "bg-rose-600"
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          {toast.msg}
        </div>
      )}
    </DashboardLayout>
  );
}

