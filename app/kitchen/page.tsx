"use client";

import { useEffect, useRef, useState } from "react";
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

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [newOrderAlert, setNewOrderAlert] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const firstLoadRef = useRef(true);
  const lastIdsRef = useRef<number[]>([]);
  const alarmRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    const nextOrders = data || [];
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
      alert("주방 알림음 켜짐");
    } catch {
      alert("브라우저가 소리를 막고 있습니다. 화면을 누른 뒤 다시 시도해주세요.");
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
        new Date(a.created_at).getTime() -
        new Date(b.created_at).getTime(),
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
      alert("상태 변경 실패: " + error.message);
      return;
    }

    if (status === "접수완료") {
      stopAlarm();
      setNewOrderAlert(false);
    }

    fetchOrders();
  };

  const getStatusBadge = (status: string) => {
    if (status === "접수대기") {
      return "border-red-500/40 bg-red-600/20 text-red-300";
    }

    if (status === "접수완료") {
      return "border-amber-400/40 bg-amber-500/15 text-amber-200";
    }

    if (status === "조리중") {
      return "border-blue-400/40 bg-blue-500/15 text-blue-200";
    }

    return "border-zinc-600 bg-zinc-800 text-zinc-300";
  };

  const waitingOrders = orders.filter((order) => order.status === "접수대기");
  const acceptedOrders = orders.filter((order) => order.status === "접수완료");
  const cookingOrders = orders.filter((order) => order.status === "조리중");

  return (
    <main className="min-h-screen bg-[#050505] bg-[radial-gradient(circle_at_top,#3b2f0b_0%,#050505_35%)] p-3 text-white md:p-5">
      <audio ref={audioRef} preload="auto">
        <source src="/sounds/order.mp3" type="audio/mpeg" />
      </audio>

      {newOrderAlert && (
        <div className="fixed inset-x-3 top-3 z-50 rounded-3xl border border-[#d4af37] bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] p-4 text-center text-3xl font-black text-black shadow-[0_0_45px_rgba(212,175,55,.45)]">
          🔔 신규 주문 들어옴
        </div>
      )}

      <div className="mx-auto max-w-[1800px]">
        <header className="mb-4 rounded-3xl border border-[#d4af3735] bg-black/80 p-4 shadow-[0_0_35px_rgba(212,175,55,.12)] backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] bg-clip-text text-4xl font-black text-transparent md:text-6xl">
                황제 주방모드
              </h1>

              <div className="mt-2 text-sm font-bold text-zinc-400 md:text-lg">
                접수대기 {waitingOrders.length}건 · 접수완료 {acceptedOrders.length}건 · 조리중 {cookingOrders.length}건
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 md:flex">
              <button
                onClick={enableSound}
                className={`rounded-2xl px-5 py-3 text-lg font-black ${
                  soundEnabled
                    ? "border border-green-400 bg-green-600/20 text-green-300"
                    : "bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] text-black"
                }`}
              >
                {soundEnabled ? "🔊 알림 켜짐" : "🔊 알림켜기"}
              </button>

              <button
                onClick={() => {
                  stopAlarm();
                  setNewOrderAlert(false);
                }}
                className="rounded-2xl border border-red-500/40 bg-red-600/20 px-5 py-3 text-lg font-black text-red-300"
              >
                알림끄기
              </button>

              <button
                onClick={fetchOrders}
                className="rounded-2xl border border-[#d4af3735] bg-black px-5 py-3 text-lg font-black text-[#f4d56d]"
              >
                새로고침
              </button>
            </div>
          </div>
        </header>

        {orders.length === 0 ? (
          <div className="rounded-3xl border border-[#d4af3725] bg-black/80 p-12 text-center text-3xl font-black text-zinc-500">
            현재 주방 주문이 없습니다.
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-3">
            <section>
              <h2 className="mb-3 rounded-2xl border border-red-500/30 bg-red-600/15 p-3 text-center text-2xl font-black text-red-300">
                접수대기 {waitingOrders.length}
              </h2>

              <OrderColumn
                orders={waitingOrders}
                menuLines={menuLines}
                getTodayOrderNumber={getTodayOrderNumber}
                formatOrderTime={formatOrderTime}
                getStatusBadge={getStatusBadge}
                onAccept={(order) => changeStatus(order, "접수완료")}
                onCook={(order) => changeStatus(order, "조리중")}
                onDeliver={(order) => changeStatus(order, "배달중")}
              />
            </section>

            <section>
              <h2 className="mb-3 rounded-2xl border border-[#d4af3735] bg-[#d4af37]/10 p-3 text-center text-2xl font-black text-[#f4d56d]">
                접수완료 {acceptedOrders.length}
              </h2>

              <OrderColumn
                orders={acceptedOrders}
                menuLines={menuLines}
                getTodayOrderNumber={getTodayOrderNumber}
                formatOrderTime={formatOrderTime}
                getStatusBadge={getStatusBadge}
                onAccept={(order) => changeStatus(order, "접수완료")}
                onCook={(order) => changeStatus(order, "조리중")}
                onDeliver={(order) => changeStatus(order, "배달중")}
              />
            </section>

            <section>
              <h2 className="mb-3 rounded-2xl border border-blue-500/30 bg-blue-600/15 p-3 text-center text-2xl font-black text-blue-300">
                조리중 {cookingOrders.length}
              </h2>

              <OrderColumn
                orders={cookingOrders}
                menuLines={menuLines}
                getTodayOrderNumber={getTodayOrderNumber}
                formatOrderTime={formatOrderTime}
                getStatusBadge={getStatusBadge}
                onAccept={(order) => changeStatus(order, "접수완료")}
                onCook={(order) => changeStatus(order, "조리중")}
                onDeliver={(order) => changeStatus(order, "배달중")}
              />
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

function OrderColumn({
  orders,
  menuLines,
  getTodayOrderNumber,
  formatOrderTime,
  getStatusBadge,
  onAccept,
  onCook,
  onDeliver,
}: {
  orders: Order[];
  menuLines: (menuText: string) => MenuLine[];
  getTodayOrderNumber: (orderId: number) => number;
  formatOrderTime: (dateText: string) => string;
  getStatusBadge: (status: string) => string;
  onAccept: (order: Order) => void;
  onCook: (order: Order) => void;
  onDeliver: (order: Order) => void;
}) {
  return (
    <div className="space-y-3">
      {orders.length === 0 && (
        <div className="rounded-3xl border border-zinc-800 bg-black/70 p-6 text-center text-xl font-black text-zinc-600">
          없음
        </div>
      )}

      {orders.map((order) => {
        const lines = menuLines(order.menu);

        return (
          <div
            key={order.id}
            className="overflow-hidden rounded-3xl border border-[#d4af3730] bg-gradient-to-b from-[#111111] to-[#050505] shadow-[0_0_24px_rgba(212,175,55,.12)]"
          >
            <div className="border-b border-[#d4af371f] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-black text-[#f4d56d]">
                    오늘주문 #{getTodayOrderNumber(order.id)}
                  </div>

                  <div className="mt-1 text-sm font-bold text-zinc-500">
                    {formatOrderTime(order.created_at)}
                  </div>
                </div>

                <div
                  className={`rounded-full border px-3 py-1 text-sm font-black ${getStatusBadge(
                    order.status,
                  )}`}
                >
                  {order.status}
                </div>
              </div>

              <div className="mt-3 text-3xl font-black">
                {order.customer || "고객"}
              </div>

              <div className="mt-1 text-lg font-black text-[#f4d56d]">
                {order.total.toLocaleString()}원
              </div>
            </div>

            <div className="space-y-2 p-3">
              {lines.map((item, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-zinc-800 bg-black/70 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 text-xl font-black leading-tight">
                      {item.name}
                    </div>

                    <div className="shrink-0 rounded-xl bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] px-3 py-1 text-xl font-black text-black">
                      x{item.qty}
                    </div>
                  </div>

                  {item.options && item.options.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {item.options.map((option, optionIndex) => (
                        <div
                          key={optionIndex}
                          className="rounded-xl bg-[#0b0b0b] px-3 py-2 text-base font-bold text-zinc-300"
                        >
                          <span className="text-zinc-500">{option.groupName}: </span>
                          <span>{option.optionName}</span>
                          {option.price > 0 && (
                            <span className="text-[#f4d56d]">
                              {" "}
                              +{option.price.toLocaleString()}원
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <div className="rounded-2xl border border-zinc-800 bg-black/70 p-3">
                <div className="mb-1 text-sm font-black text-zinc-500">
                  요청사항
                </div>

                <div className="text-lg font-bold leading-relaxed">
                  {order.memo?.trim() ? order.memo : "요청사항 없음"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-[#d4af371f] p-3">
              <button
                onClick={() => onAccept(order)}
                disabled={order.status !== "접수대기"}
                className={`rounded-2xl py-4 text-lg font-black ${
                  order.status === "접수대기"
                    ? "bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] text-black"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                접수
              </button>

              <button
                onClick={() => onCook(order)}
                disabled={order.status === "조리중"}
                className={`rounded-2xl py-4 text-lg font-black ${
                  order.status !== "조리중"
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                조리
              </button>

              <button
                onClick={() => onDeliver(order)}
                className="rounded-2xl bg-green-600 py-4 text-lg font-black text-white"
              >
                배달
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
