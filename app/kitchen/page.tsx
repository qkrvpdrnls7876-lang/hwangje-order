"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Order = {
  id: number;
  created_at: string;
  customer: string;
  phone: string;
  address: string;
  menu: string;
  total: number;
  status: string;
  memo: string | null;
  estimated_time: string | null;
  payment_method: string | null;
  delivery_fee: number | null;
  delivery_distance_km: number | null;
};

type MenuOptionLine = {
  groupName: string;
  optionName: string;
  price: number;
};

type MenuLine = {
  name: string;
  qty: number | string;
  total: number;
  options?: MenuOptionLine[];
};

type Toast = {
  id: number;
  tone: "success" | "error" | "info";
  title: string;
  message?: string;
};

export default function KitchenPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const [openMemoIds, setOpenMemoIds] = useState<number[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const SOUND_STORAGE_KEY = "hwangje_kitchen_sound_enabled";

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const firstLoadRef = useRef(true);
  const lastIdsRef = useRef<number[]>([]);
  const alarmRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = (toast: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    const nextToast = { ...toast, id };

    setToasts((prev) => [nextToast, ...prev].slice(0, 4));

    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4200);
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  };

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/admin");
  };

  const getBusinessStartDate = () => {
    const now = new Date();

    if (now.getHours() < 4) {
      now.setDate(now.getDate() - 1);
    }

    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      4,
      0,
      0,
    );
  };

  const fetchOrders = async () => {
    const startDate = getBusinessStartDate();

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .gte("created_at", startDate.toISOString())
      .in("status", ["접수대기", "접수완료", "조리중"])
      .order("created_at", { ascending: true });

    if (error) {
      console.log(error);
      return;
    }

    const nextOrders = (data || []) as Order[];
    const nextIds = nextOrders.map((order) => order.id);
    const hasNewOrder = nextIds.some((id) => !lastIdsRef.current.includes(id));

    if (!firstLoadRef.current && hasNewOrder) {
      startAlarm();
      setNewOrderAlert(true);
      setTimeout(() => setNewOrderAlert(false), 5000);
    }

    firstLoadRef.current = false;
    lastIdsRef.current = nextIds;
    setOrders(nextOrders);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedSound = window.localStorage.getItem(SOUND_STORAGE_KEY);

    if (savedSound === "true") {
      setSoundEnabled(true);
    }
  }, []);

  useEffect(() => {
    fetchOrders();

    const interval = setInterval(() => {
      fetchOrders();
    }, 2500);

    return () => {
      clearInterval(interval);
      stopAlarm();
    };
  }, []);

  const enableSound = async () => {
    try {
      if (!audioRef.current) return;

      await audioRef.current.play();
      audioRef.current.pause();
      audioRef.current.currentTime = 0;

      setSoundEnabled(true);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(SOUND_STORAGE_KEY, "true");
      }

      showToast({
        tone: "success",
        title: "주방 알림음 ON",
        message: "다른 화면으로 이동해도 주방 알림 설정을 유지합니다.",
      });
    } catch {
      showToast({
        tone: "error",
        title: "알림음 차단됨",
        message: "화면을 한 번 누른 뒤 다시 알림 켜기를 눌러주세요.",
      });
    }
  };

  const playAlarm = () => {
    if (!audioRef.current || !soundEnabled) return;

    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  };

  const startAlarm = () => {
    if (!soundEnabled) return;
    if (alarmRef.current) return;

    playAlarm();

    alarmRef.current = setInterval(() => {
      playAlarm();
    }, 3000);
  };

  const stopAlarm = () => {
    if (alarmRef.current) {
      clearInterval(alarmRef.current);
      alarmRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const menuLines = (menuText: string): MenuLine[] => {
    try {
      return JSON.parse(menuText) as MenuLine[];
    } catch {
      return [];
    }
  };

  const formatOrderTime = (dateText: string) => {
    const date = new Date(dateText);

    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getTodayOrderNumber = (orderId: number) => {
    const sortedOrders = [...orders].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    const index = sortedOrders.findIndex((order) => order.id === orderId);

    return index >= 0 ? index + 1 : orderId;
  };

  const changeStatus = async (order: Order, status: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", order.id);

    if (error) {
      showToast({
        tone: "error",
        title: "상태 변경 실패",
        message: error.message,
      });
      return;
    }

    if (status === "접수완료") {
      stopAlarm();
      setNewOrderAlert(false);
    }

    fetchOrders();
  };

  const toggleMemo = (id: number) => {
    setOpenMemoIds((prev) =>
      prev.includes(id) ? prev.filter((orderId) => orderId !== id) : [...prev, id],
    );
  };

  const getStatusBadge = (status: string) => {
    if (status === "접수대기") {
      return "border-red-500/40 bg-red-600/20 text-red-300";
    }

    if (status === "접수완료") {
      return "border-[#d4af37]/45 bg-[#d4af37]/10 text-[#f0d98a]";
    }

    if (status === "조리중") {
      return "border-blue-400/40 bg-blue-500/15 text-blue-200";
    }

    return "border-zinc-600 bg-zinc-800 text-zinc-300";
  };

  const waitingOrders = orders.filter((order) => order.status === "접수대기");
  const acceptedOrders = orders.filter((order) => order.status === "접수완료");
  const cookingOrders = orders.filter((order) => order.status === "조리중");

  const totalMenuCount = orders.reduce((sum, order) => {
    return sum + menuLines(order.menu).reduce((innerSum, item) => innerSum + Number(item.qty || 0), 0);
  }, 0);

  const dashboardCards = [
    { label: "전체", value: orders.length, tone: "text-[#f0d98a]" },
    { label: "접수대기", value: waitingOrders.length, tone: "text-red-300" },
    { label: "접수완료", value: acceptedOrders.length, tone: "text-[#f0d98a]" },
    { label: "조리중", value: cookingOrders.length, tone: "text-blue-300" },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-[#070707] pt-9 text-zinc-100">
      <style jsx global>{`
        .hwangje-scroll::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }

        .hwangje-scroll::-webkit-scrollbar-track {
          background: #070707;
          border-radius: 999px;
        }

        .hwangje-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #d4af37 0%, #7a6320 100%);
          border: 2px solid #070707;
          border-radius: 999px;
        }

        .hwangje-scroll::-webkit-scrollbar-thumb:hover {
          background: #f0d98a;
        }
      `}</style>

      <audio ref={audioRef} preload="auto">
        <source src="/sounds/order.mp3" type="audio/mpeg" />
      </audio>

      <div className="fixed left-0 right-0 top-0 z-[1000] flex h-9 items-center justify-between border-b border-[#d4af3720] bg-[#080808]/95 px-3 text-xs text-zinc-400 backdrop-blur-xl [-webkit-app-region:drag]">
        <button
          type="button"
          onClick={goBack}
          className="flex items-center gap-2 rounded-md px-2 py-1 font-black tracking-[-0.03em] text-[#d4af37] hover:bg-white/[0.04] [-webkit-app-region:no-drag]"
        >
          <span className="h-2 w-2 rounded-full bg-[#d4af37]" />← 황제POS / 주방모드
        </button>

        <div className="flex items-center gap-1 [-webkit-app-region:no-drag]">
          <button
            type="button"
            onClick={() => (window as any).hwangjePOS?.minimizeWindow?.()}
            className="flex h-7 w-9 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            —
          </button>

          <button
            type="button"
            onClick={() => (window as any).hwangjePOS?.toggleMaximizeWindow?.()}
            className="flex h-7 w-9 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            □
          </button>

          <button
            type="button"
            onClick={() => (window as any).hwangjePOS?.closeWindow?.()}
            className="flex h-7 w-9 items-center justify-center rounded-md text-zinc-400 hover:bg-red-600 hover:text-white"
          >
            ×
          </button>
        </div>
      </div>

      {newOrderAlert && (
        <div className="fixed left-1/2 top-14 z-50 w-[520px] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-[16px] border border-[#d4af37]/60 bg-[#0b0b0b]/95 p-4 text-center shadow-[0_18px_80px_rgba(0,0,0,.7)] backdrop-blur">
          <div className="text-sm font-black uppercase tracking-[0.22em] text-[#d4af37]">NEW ORDER</div>
          <div className="mt-1 text-3xl font-black tracking-[-0.06em] text-[#f0d98a]">신규 주문 들어옴</div>
        </div>
      )}

      <div className="grid min-h-[calc(100vh-36px)] grid-cols-1 lg:grid-cols-[228px_1fr]">
        <aside className="hidden border-r border-[#d4af37]/15 bg-[linear-gradient(180deg,#111111_0%,#070707_100%)] lg:flex lg:flex-col">
          <div className="border-b border-[#d4af37]/10 px-6 py-7">
            <div className="text-[11px] font-black tracking-[0.28em] text-[#d4af37]">HWANGJEE</div>
            <div className="mt-1 text-4xl font-black tracking-[-0.08em] text-[#f0d98a]">KITCHEN</div>
            <div className="mt-1 text-xs font-bold text-[#d4af37]/80">황제떡볶이 효자점</div>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-5">
            <button
              type="button"
              onClick={goBack}
              className="mb-3 flex w-full items-center justify-between rounded-[10px] border border-[#d4af37]/20 bg-[#d4af37]/10 px-4 py-3 text-sm font-bold text-[#f0d98a]"
            >
              <span>← 뒤로가기</span>
              <span>관리자</span>
            </button>

            <a href="/admin" className="block rounded-[10px] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white">주문 관리</a>
            <a href="/admin/sales" className="block rounded-[10px] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white">매출 관리</a>
            <a href="/admin/menu" className="block rounded-[10px] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white">메뉴 관리</a>
            <a href="/rider" className="block rounded-[10px] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white">라이더 관리</a>

            <div className="flex w-full items-center justify-between rounded-[10px] border border-[#d4af37]/20 bg-[#d4af37]/10 px-4 py-3 text-sm font-bold text-[#f0d98a]">
              <span>주방 모니터</span>
              <span className="rounded-full bg-[#d4af37] px-2 py-0.5 text-xs text-black">ON</span>
            </div>
          </nav>

          <div className="mx-4 mb-4 rounded-[12px] border border-[#d4af37]/20 bg-black/40 p-4">
            <div className="text-xs font-bold text-zinc-500">주방 현황</div>
            <div className="mt-1 text-2xl font-black tracking-[-0.05em] text-[#f0d98a]">{orders.length}건</div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-zinc-500">메뉴수량</div>
                <div className="font-black text-zinc-100">{totalMenuCount}개</div>
              </div>
              <div>
                <div className="text-zinc-500">알림</div>
                <div className={`font-black ${soundEnabled ? "text-emerald-300" : "text-zinc-500"}`}>
                  {soundEnabled ? "ON" : "OFF"}
                </div>
              </div>
            </div>
          </div>
        </aside>

        <section className="h-[calc(100vh-36px)] overflow-y-auto bg-[#090909] hwangje-scroll">
          <header className="sticky top-0 z-30 border-b border-zinc-800 bg-[#0b0b0b]/95 px-4 py-4 backdrop-blur lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <button
                  type="button"
                  onClick={goBack}
                  className="mb-3 inline-flex items-center rounded-[9px] border border-zinc-700 bg-[#111111] px-3 py-2 text-xs font-black text-zinc-300 transition hover:border-[#d4af37]/50 hover:text-[#f0d98a] lg:hidden"
                >
                  ← 뒤로가기
                </button>

                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#d4af37]">KITCHEN CONTROL</div>
                <h1 className="mt-1 text-4xl font-black tracking-[-0.07em] text-zinc-100">주방모드</h1>
                <p className="mt-2 text-sm text-zinc-500">접수대기 · 접수완료 · 조리중 주문을 실시간 확인합니다.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={enableSound}
                  className={`rounded-[10px] border px-4 py-3 text-sm font-black transition ${
                    soundEnabled
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-[#d4af37]/50 bg-[#d4af37] text-black hover:bg-[#f0c75a]"
                  }`}
                >
                  {soundEnabled ? "알림 ON" : "알림 켜기"}
                </button>

                <button
                  onClick={() => {
                    stopAlarm();
                    setNewOrderAlert(false);
                    showToast({
                      tone: "info",
                      title: "현재 알림 정지",
                      message: "알림음 ON 설정은 유지됩니다.",
                    });
                  }}
                  className="rounded-[10px] border border-red-500/35 bg-red-950/30 px-4 py-3 text-sm font-black text-red-300 transition hover:bg-red-900/40"
                >
                  알림 끄기
                </button>

                <button
                  onClick={fetchOrders}
                  className="rounded-[10px] border border-zinc-700 bg-[#111111] px-4 py-3 text-sm font-black text-zinc-300 transition hover:border-[#d4af37]/50 hover:text-[#f0d98a]"
                >
                  새로고침
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
              {dashboardCards.map((card) => (
                <div key={card.label} className="rounded-[10px] border border-zinc-800 bg-[#111111] px-3 py-2">
                  <span className="text-zinc-500">{card.label}</span>
                  <div className={`mt-1 text-lg font-black ${card.tone}`}>{card.value}건</div>
                </div>
              ))}
            </div>
          </header>

          {orders.length === 0 ? (
            <div className="m-4 rounded-[14px] border border-zinc-800 bg-[#101010] p-14 text-center text-2xl font-black text-zinc-500 lg:m-8">
              현재 주방 주문이 없습니다.
            </div>
          ) : (
            <div className="grid gap-4 p-4 xl:grid-cols-3 lg:p-8">
              <KitchenColumn
                title="접수대기"
                count={waitingOrders.length}
                tone="red"
                orders={waitingOrders}
                openMemoIds={openMemoIds}
                menuLines={menuLines}
                getTodayOrderNumber={getTodayOrderNumber}
                formatOrderTime={formatOrderTime}
                getStatusBadge={getStatusBadge}
                onAccept={(order) => changeStatus(order, "접수완료")}
                onCook={(order) => changeStatus(order, "조리중")}
                onDeliver={(order) => changeStatus(order, "배달중")}
                onToggleMemo={toggleMemo}
              />

              <KitchenColumn
                title="접수완료"
                count={acceptedOrders.length}
                tone="gold"
                orders={acceptedOrders}
                openMemoIds={openMemoIds}
                menuLines={menuLines}
                getTodayOrderNumber={getTodayOrderNumber}
                formatOrderTime={formatOrderTime}
                getStatusBadge={getStatusBadge}
                onAccept={(order) => changeStatus(order, "접수완료")}
                onCook={(order) => changeStatus(order, "조리중")}
                onDeliver={(order) => changeStatus(order, "배달중")}
                onToggleMemo={toggleMemo}
              />

              <KitchenColumn
                title="조리중"
                count={cookingOrders.length}
                tone="blue"
                orders={cookingOrders}
                openMemoIds={openMemoIds}
                menuLines={menuLines}
                getTodayOrderNumber={getTodayOrderNumber}
                formatOrderTime={formatOrderTime}
                getStatusBadge={getStatusBadge}
                onAccept={(order) => changeStatus(order, "접수완료")}
                onCook={(order) => changeStatus(order, "조리중")}
                onDeliver={(order) => changeStatus(order, "배달중")}
                onToggleMemo={toggleMemo}
              />
            </div>
          )}
        </section>
      </div>


      <div className="fixed bottom-5 right-5 z-[1300] flex w-[420px] max-w-[calc(100vw-40px)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-[14px] border bg-[#0b0b0b]/96 p-4 shadow-[0_20px_80px_rgba(0,0,0,.68)] backdrop-blur-xl ${
              toast.tone === "success"
                ? "border-[#d4af37]/45"
                : toast.tone === "error"
                  ? "border-red-500/45"
                  : "border-zinc-700"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div
                  className={`text-sm font-black ${
                    toast.tone === "error" ? "text-red-300" : "text-[#f0d98a]"
                  }`}
                >
                  {toast.title}
                </div>

                {toast.message && (
                  <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                    {toast.message}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-xl leading-none text-zinc-500 transition hover:text-white"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

function KitchenColumn({
  title,
  count,
  tone,
  orders,
  openMemoIds,
  menuLines,
  getTodayOrderNumber,
  formatOrderTime,
  getStatusBadge,
  onAccept,
  onCook,
  onDeliver,
  onToggleMemo,
}: {
  title: string;
  count: number;
  tone: "red" | "gold" | "blue";
  orders: Order[];
  openMemoIds: number[];
  menuLines: (menuText: string) => MenuLine[];
  getTodayOrderNumber: (orderId: number) => number;
  formatOrderTime: (dateText: string) => string;
  getStatusBadge: (status: string) => string;
  onAccept: (order: Order) => void;
  onCook: (order: Order) => void;
  onDeliver: (order: Order) => void;
  onToggleMemo: (orderId: number) => void;
}) {
  const toneClass =
    tone === "red"
      ? "border-red-500/35 bg-red-950/20 text-red-300"
      : tone === "blue"
        ? "border-blue-500/35 bg-blue-950/20 text-blue-300"
        : "border-[#d4af37]/35 bg-[#d4af37]/10 text-[#f0d98a]";

  return (
    <section className="min-h-[420px]">
      <div className={`sticky top-[152px] z-10 mb-3 rounded-[12px] border px-4 py-3 text-center text-xl font-black backdrop-blur ${toneClass}`}>
        {title} {count}
      </div>

      <div className="max-h-[calc(100vh-250px)] space-y-3 overflow-y-auto pr-1 hwangje-scroll">
        {orders.length === 0 && (
          <div className="rounded-[14px] border border-zinc-800 bg-[#101010] p-8 text-center text-lg font-black text-zinc-600">없음</div>
        )}

        {orders.map((order) => {
          const lines = menuLines(order.menu);
          const memoOpen = openMemoIds.includes(order.id);
          const isWaiting = order.status === "접수대기";

          return (
            <div
              key={order.id}
              className={`overflow-hidden rounded-[14px] border bg-[#101010] shadow-[0_18px_60px_rgba(0,0,0,.32)] ${
                isWaiting ? "animate-pulse border-red-500/35" : "border-zinc-800"
              }`}
            >
              <div className="border-b border-zinc-800 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">오늘주문</div>
                    <div className="mt-1 text-4xl font-black tracking-[-0.08em] text-[#f0d98a]">#{getTodayOrderNumber(order.id)}</div>
                    <div className="mt-1 text-sm font-bold text-zinc-500">{formatOrderTime(order.created_at)}</div>
                  </div>

                  <div className={`rounded-md border px-2 py-1 text-xs font-black ${getStatusBadge(order.status)}`}>{order.status}</div>
                </div>

                <div className="mt-4 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-2xl font-black text-zinc-100">{order.customer || "고객"}</div>
                    <div className="mt-1 text-sm font-bold text-zinc-500">{order.payment_method || "결제미정"}</div>
                  </div>
                  <div className="shrink-0 text-right text-xl font-black text-[#f0d98a]">{order.total.toLocaleString()}원</div>
                </div>
              </div>

              <div className="space-y-2 p-3">
                {lines.map((item, index) => (
                  <div key={index} className="rounded-[12px] border border-zinc-800 bg-[#070707] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 text-xl font-black leading-tight text-zinc-100">{item.name}</div>
                      <div className="shrink-0 rounded-[9px] border border-[#d4af37]/35 bg-[#d4af37] px-3 py-1 text-lg font-black text-black">x{item.qty}</div>
                    </div>

                    {item.options && item.options.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {item.options.map((option, optionIndex) => (
                          <div key={optionIndex} className="rounded-[9px] border border-zinc-800 bg-[#0f0f0f] px-3 py-2 text-sm font-bold text-zinc-300">
                            <span className="text-zinc-500">{option.groupName}: </span>
                            <span>{option.optionName}</span>
                            {option.price > 0 && <span className="text-[#f0d98a]"> +{option.price.toLocaleString()}원</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                <div className="rounded-[12px] border border-zinc-800 bg-[#070707]">
                  <button
                    type="button"
                    onClick={() => onToggleMemo(order.id)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                  >
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">요청사항</div>
                      <div className="mt-1 line-clamp-1 text-sm font-bold text-zinc-300">{order.memo?.trim() ? order.memo : "요청사항 없음"}</div>
                    </div>
                    <div className="shrink-0 rounded-md border border-[#d4af37]/30 bg-[#d4af37]/10 px-2 py-1 text-[11px] font-black text-[#d4af37]">
                      {memoOpen ? "접기 ▲" : "열기 ▼"}
                    </div>
                  </button>

                  {memoOpen && (
                    <div className="border-t border-zinc-800 px-3 py-3 text-base font-bold leading-relaxed text-zinc-200">
                      {order.memo?.trim() ? order.memo : "요청사항 없음"}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-zinc-800 p-3">
                <button
                  onClick={() => onAccept(order)}
                  disabled={order.status !== "접수대기"}
                  className={`rounded-[10px] py-3 text-sm font-black ${
                    order.status === "접수대기" ? "border border-[#d4af37]/60 bg-[#d4af37] text-black" : "border border-zinc-800 bg-zinc-900 text-zinc-600"
                  }`}
                >
                  접수
                </button>

                <button
                  onClick={() => onCook(order)}
                  disabled={order.status === "조리중"}
                  className={`rounded-[10px] py-3 text-sm font-black ${
                    order.status !== "조리중" ? "border border-blue-500/40 bg-blue-500/15 text-blue-200" : "border border-zinc-800 bg-zinc-900 text-zinc-600"
                  }`}
                >
                  조리
                </button>

                <button
                  onClick={() => onDeliver(order)}
                  className="rounded-[10px] border border-emerald-500/40 bg-emerald-500/15 py-3 text-sm font-black text-emerald-300"
                >
                  배달
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
