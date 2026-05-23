"use client";

import { useEffect, useMemo, useState } from "react";
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
  payment_method: string | null;
  delivery_fee: number | null;
  delivery_distance_km: number | null;
  stamp_discount: number | null;
};

type MenuLine = {
  name: string;
  qty: number;
  total: number;
  options?: {
    groupName: string;
    optionName: string;
    price: number;
  }[];
};

export default function AdminSalesPage() {
  const router = useRouter();

  const todayText = new Date().toISOString().slice(0, 10);
  const currentMonthText = todayText.slice(0, 7);

  const [viewMode, setViewMode] = useState<"day" | "month">("day");
  const [selectedDate, setSelectedDate] = useState(todayText);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthText);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [openOrderIds, setOpenOrderIds] = useState<number[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/admin");
  };

  const getBusinessRange = (dateText: string) => {
    const start = new Date(`${dateText}T03:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return { start, end };
  };

  const getMonthRange = (monthText: string) => {
    const [year, month] = monthText.split("-").map(Number);

    const start = new Date(year, month - 1, 1, 3, 0, 0);
    const end = new Date(year, month, 1, 3, 0, 0);

    return { start, end };
  };

  const fetchSales = async () => {
    setLoading(true);

    const { start, end } =
      viewMode === "month"
        ? getMonthRange(selectedMonth)
        : getBusinessRange(selectedDate);

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "완료")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      alert("매출 불러오기 실패: " + error.message);
      setLoading(false);
      return;
    }

    const nextOrders = (data || []) as Order[];
    setOrders(nextOrders);

    if (nextOrders.length > 0) {
      setSelectedOrderId((prev) =>
        prev && nextOrders.some((order) => order.id === prev)
          ? prev
          : nextOrders[0].id,
      );
    } else {
      setSelectedOrderId(null);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchSales();
  }, [selectedDate, selectedMonth, viewMode]);

  const summary = useMemo(() => {
    const orderCount = orders.length;
    const totalSales = orders.reduce((sum, order) => sum + (order.total || 0), 0);
    const deliveryFeeTotal = orders.reduce(
      (sum, order) => sum + (order.delivery_fee || 0),
      0,
    );
    const stampDiscountTotal = orders.reduce(
      (sum, order) => sum + (order.stamp_discount || 0),
      0,
    );

    const cashTotal = orders
      .filter((order) => order.payment_method === "만나서 현금결제")
      .reduce((sum, order) => sum + (order.total || 0), 0);

    const cardTotal = orders
      .filter((order) => order.payment_method === "만나서 카드결제")
      .reduce((sum, order) => sum + (order.total || 0), 0);

    const transferTotal = orders
      .filter((order) => order.payment_method === "계좌이체")
      .reduce((sum, order) => sum + (order.total || 0), 0);

    const unknownTotal = orders
      .filter((order) => !order.payment_method)
      .reduce((sum, order) => sum + (order.total || 0), 0);

    const averageOrder =
      orderCount > 0 ? Math.round(totalSales / orderCount) : 0;

    return {
      orderCount,
      totalSales,
      deliveryFeeTotal,
      stampDiscountTotal,
      cashTotal,
      cardTotal,
      transferTotal,
      unknownTotal,
      averageOrder,
    };
  }, [orders]);

  const setQuickDate = (offset: number) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    setSelectedDate(date.toISOString().slice(0, 10));
    setViewMode("day");
  };

  const setQuickMonth = (offset: number) => {
    const date = new Date();
    date.setMonth(date.getMonth() + offset);
    setSelectedMonth(date.toISOString().slice(0, 7));
    setViewMode("month");
  };

  const toDateText = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const toMonthText = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");

    return `${year}-${month}`;
  };

  const shiftSelectedDate = (amount: number) => {
    const date = new Date(`${selectedDate}T00:00:00`);
    date.setDate(date.getDate() + amount);
    setSelectedDate(toDateText(date));
    setViewMode("day");
  };

  const shiftSelectedMonth = (amount: number) => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() + amount);
    setSelectedMonth(toMonthText(date));
    setViewMode("month");
  };

  const shiftCalendarMonth = (amount: number) => {
    const date = new Date(`${selectedDate}T00:00:00`);
    date.setMonth(date.getMonth() + amount);
    setSelectedDate(toDateText(date));
    setViewMode("day");
  };

  const selectedDateObject = new Date(`${selectedDate}T00:00:00`);
  const selectedMonthParts = selectedMonth.split("-").map(Number);
  const selectedMonthYear = selectedMonthParts[0];
  const selectedMonthNumber = selectedMonthParts[1];

  const dayCalendarDays = useMemo(() => {
    const base = new Date(`${selectedDate}T00:00:00`);
    const firstDay = new Date(base.getFullYear(), base.getMonth(), 1);
    const startDay = new Date(firstDay);

    startDay.setDate(firstDay.getDate() - firstDay.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDay);
      date.setDate(startDay.getDate() + index);
      return date;
    });
  }, [selectedDate]);

  const selectCalendarDate = (date: Date) => {
    setSelectedDate(toDateText(date));
    setViewMode("day");
  };

  const selectCalendarMonth = (monthNumber: number) => {
    const next = new Date(selectedMonthYear, monthNumber - 1, 1);
    setSelectedMonth(toMonthText(next));
    setViewMode("month");
  };

  const selectedPeriodText =
    viewMode === "month"
      ? `${selectedMonth.replace("-", "년 ")}월`
      : selectedDate;

  const toggleOpen = (id: number) => {
    setOpenOrderIds((prev) =>
      prev.includes(id) ? prev.filter((orderId) => orderId !== id) : [...prev, id],
    );
  };

  const menuLines = (menuText: string): MenuLine[] => {
    try {
      return JSON.parse(menuText) as MenuLine[];
    } catch {
      return [];
    }
  };

  const menuSummary = (menuText: string) => {
    const lines = menuLines(menuText);

    if (lines.length === 0) return "메뉴 정보 없음";

    const first = lines[0];
    const totalQty = lines.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

    if (lines.length === 1) {
      return `${first.name} x${first.qty}`;
    }

    return `${first.name} 외 ${lines.length - 1}개 / 총 ${totalQty}개`;
  };

  const formatTime = (dateText: string) => {
    const date = new Date(dateText);
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateTime = (dateText: string) => {
    const date = new Date(dateText);

    return date.toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const selectedOrder =
    orders.find((order) => order.id === selectedOrderId) || orders[0] || null;

  const selectedLines = selectedOrder ? menuLines(selectedOrder.menu) : [];

  const selectedMenuTotal = selectedLines.reduce((sum, line) => {
    return sum + Number(line.total || 0);
  }, 0);

  const paymentCards = [
    {
      label: "현금",
      value: summary.cashTotal,
      accent: "text-zinc-100",
    },
    {
      label: "카드",
      value: summary.cardTotal,
      accent: "text-zinc-100",
    },
    {
      label: "계좌이체",
      value: summary.transferTotal,
      accent: "text-[#f0d98a]",
    },
    {
      label: "미설정",
      value: summary.unknownTotal,
      accent: "text-zinc-500",
    },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-[#070707] pt-9 text-zinc-100">
      <div className="fixed left-0 right-0 top-0 z-[1000] flex h-9 items-center justify-between border-b border-[#d4af3720] bg-[#080808]/95 px-3 text-xs text-zinc-400 backdrop-blur-xl [-webkit-app-region:drag]">
        <div className="flex items-center gap-2 font-black tracking-[-0.03em] text-[#d4af37]">
          <span className="h-2 w-2 rounded-full bg-[#d4af37]" />
          황제POS · 매출관리
        </div>

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

      <div className="grid min-h-[calc(100vh-36px)] grid-cols-1 lg:grid-cols-[228px_minmax(390px,500px)_1fr]">
        <aside className="hidden border-r border-[#d4af37]/15 bg-[linear-gradient(180deg,#111111_0%,#070707_100%)] lg:flex lg:flex-col">
          <div className="border-b border-[#d4af37]/10 px-6 py-7">
            <div className="text-[11px] font-black tracking-[0.28em] text-[#d4af37]">
              HWANGJEE
            </div>
            <div className="mt-1 text-4xl font-black tracking-[-0.08em] text-[#f0d98a]">
              POS
            </div>
            <div className="mt-1 text-xs font-bold text-[#d4af37]/80">
              황제떡볶이 효자점
            </div>
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

            <a
              href="/admin"
              className="block rounded-[10px] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white"
            >
              주문 관리
            </a>

            <button className="flex w-full items-center justify-between rounded-[10px] border border-[#d4af37]/20 bg-[#d4af37]/10 px-4 py-3 text-sm font-bold text-[#f0d98a]">
              <span>매출 관리</span>
              <span className="rounded-full bg-[#d4af37] px-2 py-0.5 text-xs text-black">
                {summary.orderCount}
              </span>
            </button>

            <a
              href="/admin/menu"
              className="block rounded-[10px] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white"
            >
              메뉴 관리
            </a>

            <a
              href="/rider"
              className="block rounded-[10px] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white"
            >
              라이더 관리
            </a>

            <a
              href="/kitchen"
              className="block rounded-[10px] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white"
            >
              주방 모니터
            </a>
          </nav>

          <div className="mx-4 mb-4 rounded-[12px] border border-[#d4af37]/20 bg-black/40 p-4">
            <div className="text-xs font-bold text-zinc-500">조회 기간</div>
            <div className="mt-1 text-lg font-black tracking-[-0.04em] text-[#f0d98a]">
              {selectedPeriodText}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-zinc-500">완료</div>
                <div className="font-black text-zinc-100">{summary.orderCount}건</div>
              </div>

              <div>
                <div className="text-zinc-500">객단가</div>
                <div className="font-black text-[#d4af37]">
                  {summary.averageOrder.toLocaleString()}원
                </div>
              </div>
            </div>
          </div>
        </aside>

        <section className="flex min-h-[calc(100vh-36px)] flex-col border-r border-zinc-800/80 bg-[#0b0b0b]">
          <header className="border-b border-zinc-800 bg-[#0c0c0c] px-4 py-4 lg:px-6">
            <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
              <button
                type="button"
                onClick={goBack}
                className="rounded-[9px] border border-[#d4af37]/35 bg-[#15120a] px-3 py-2 text-xs font-black text-[#d4af37]"
              >
                ← 뒤로가기
              </button>

              <div className="text-sm font-black text-[#f0d98a]">
                매출관리
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-zinc-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_14px_rgba(16,185,129,.8)]" />
                  <span>완료 주문 기준</span>
                </div>

                <div className="mt-1 text-xs text-zinc-500">
                  새벽 3시 기준 영업일 / 일매출 · 월매출 조회
                </div>
              </div>

              <button
                type="button"
                onClick={fetchSales}
                className="rounded-[9px] border border-[#d4af37]/35 bg-[#111111] px-3 py-2 text-xs font-black text-[#d4af37] transition hover:bg-[#17130a]"
              >
                새로고침
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setViewMode("day")}
                className={`rounded-[10px] border px-4 py-3 text-sm font-black ${
                  viewMode === "day"
                    ? "border-[#d4af37] bg-[#d4af37] text-black"
                    : "border-zinc-800 bg-[#111111] text-zinc-400"
                }`}
              >
                일매출
              </button>

              <button
                type="button"
                onClick={() => setViewMode("month")}
                className={`rounded-[10px] border px-4 py-3 text-sm font-black ${
                  viewMode === "month"
                    ? "border-[#d4af37] bg-[#d4af37] text-black"
                    : "border-zinc-800 bg-[#111111] text-zinc-400"
                }`}
              >
                월매출
              </button>
            </div>

            <div className="mt-3">
              {viewMode === "day" ? (
                <div className="rounded-[12px] border border-zinc-800 bg-[#080808] p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => shiftSelectedDate(-1)}
                      className="flex h-10 w-10 items-center justify-center rounded-[9px] border border-[#d4af37]/25 bg-[#111111] text-lg font-black text-[#d4af37] transition hover:border-[#d4af37] hover:bg-[#17130a]"
                    >
                      ‹
                    </button>

                    <div className="min-w-0 flex-1 rounded-[9px] border border-[#d4af37]/20 bg-black px-3 py-2 text-center">
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
                        일매출 조회
                      </div>
                      <div className="mt-1 text-sm font-black text-[#f0d98a]">
                        {selectedDateObject.toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          weekday: "short",
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => shiftSelectedDate(1)}
                      className="flex h-10 w-10 items-center justify-center rounded-[9px] border border-[#d4af37]/25 bg-[#111111] text-lg font-black text-[#d4af37] transition hover:border-[#d4af37] hover:bg-[#17130a]"
                    >
                      ›
                    </button>
                  </div>

                  <div className="mb-3 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => shiftCalendarMonth(-1)}
                      className="rounded-[9px] border border-zinc-800 bg-[#111111] px-3 py-2 text-xs font-black text-zinc-300 transition hover:border-[#d4af37]/50"
                    >
                      이전달
                    </button>

                    <button
                      type="button"
                      onClick={() => setQuickDate(0)}
                      className="rounded-[9px] border border-[#d4af37]/50 bg-[#d4af37] px-3 py-2 text-xs font-black text-black transition hover:bg-[#f0d98a]"
                    >
                      오늘
                    </button>

                    <button
                      type="button"
                      onClick={() => shiftCalendarMonth(1)}
                      className="rounded-[9px] border border-zinc-800 bg-[#111111] px-3 py-2 text-xs font-black text-zinc-300 transition hover:border-[#d4af37]/50"
                    >
                      다음달
                    </button>
                  </div>

                  <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-black text-zinc-500">
                    {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                      <div key={day} className="py-1">
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {dayCalendarDays.map((date) => {
                      const dateText = toDateText(date);
                      const selected = dateText === selectedDate;
                      const today = dateText === todayText;
                      const outside =
                        date.getMonth() !== selectedDateObject.getMonth();

                      return (
                        <button
                          key={dateText}
                          type="button"
                          onClick={() => selectCalendarDate(date)}
                          className={`h-9 rounded-[8px] border text-xs font-black transition ${
                            selected
                              ? "border-[#d4af37] bg-[#d4af37] text-black"
                              : today
                                ? "border-[#d4af37]/50 bg-[#d4af37]/10 text-[#f0d98a]"
                                : outside
                                  ? "border-transparent bg-transparent text-zinc-700 hover:border-zinc-800"
                                  : "border-zinc-800 bg-[#101010] text-zinc-300 hover:border-[#d4af37]/40"
                          }`}
                        >
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-[12px] border border-zinc-800 bg-[#080808] p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => shiftSelectedMonth(-1)}
                      className="flex h-10 w-10 items-center justify-center rounded-[9px] border border-[#d4af37]/25 bg-[#111111] text-lg font-black text-[#d4af37] transition hover:border-[#d4af37] hover:bg-[#17130a]"
                    >
                      ‹
                    </button>

                    <div className="min-w-0 flex-1 rounded-[9px] border border-[#d4af37]/20 bg-black px-3 py-2 text-center">
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
                        월매출 조회
                      </div>
                      <div className="mt-1 text-sm font-black text-[#f0d98a]">
                        {selectedMonthYear}년 {selectedMonthNumber}월
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => shiftSelectedMonth(1)}
                      className="flex h-10 w-10 items-center justify-center rounded-[9px] border border-[#d4af37]/25 bg-[#111111] text-lg font-black text-[#d4af37] transition hover:border-[#d4af37] hover:bg-[#17130a]"
                    >
                      ›
                    </button>
                  </div>

                  <div className="mb-3 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const date = new Date(selectedMonthYear - 1, selectedMonthNumber - 1, 1);
                        setSelectedMonth(toMonthText(date));
                        setViewMode("month");
                      }}
                      className="rounded-[9px] border border-zinc-800 bg-[#111111] px-3 py-2 text-xs font-black text-zinc-300 transition hover:border-[#d4af37]/50"
                    >
                      이전년
                    </button>

                    <button
                      type="button"
                      onClick={() => setQuickMonth(0)}
                      className="rounded-[9px] border border-[#d4af37]/50 bg-[#d4af37] px-3 py-2 text-xs font-black text-black transition hover:bg-[#f0d98a]"
                    >
                      이번달
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const date = new Date(selectedMonthYear + 1, selectedMonthNumber - 1, 1);
                        setSelectedMonth(toMonthText(date));
                        setViewMode("month");
                      }}
                      className="rounded-[9px] border border-zinc-800 bg-[#111111] px-3 py-2 text-xs font-black text-zinc-300 transition hover:border-[#d4af37]/50"
                    >
                      다음년
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 12 }, (_, index) => index + 1).map(
                      (monthNumber) => {
                        const selected = monthNumber === selectedMonthNumber;
                        const isCurrent =
                          selectedMonthYear === Number(currentMonthText.slice(0, 4)) &&
                          monthNumber === Number(currentMonthText.slice(5, 7));

                        return (
                          <button
                            key={monthNumber}
                            type="button"
                            onClick={() => selectCalendarMonth(monthNumber)}
                            className={`rounded-[9px] border px-3 py-3 text-xs font-black transition ${
                              selected
                                ? "border-[#d4af37] bg-[#d4af37] text-black"
                                : isCurrent
                                  ? "border-[#d4af37]/50 bg-[#d4af37]/10 text-[#f0d98a]"
                                  : "border-zinc-800 bg-[#101010] text-zinc-300 hover:border-[#d4af37]/40"
                            }`}
                          >
                            {monthNumber}월
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>
              )}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-5">
            <div className="mb-3 flex items-center justify-between text-sm">
              <div className="font-bold text-zinc-400">매출 주문 목록</div>
              <div className="rounded-full border border-zinc-800 px-3 py-1 text-xs font-bold text-zinc-500">
                {selectedPeriodText}
              </div>
            </div>

            {loading && (
              <div className="rounded-[12px] border border-zinc-800 bg-[#101010] p-10 text-center text-sm font-bold text-zinc-500">
                매출 불러오는 중...
              </div>
            )}

            {!loading && orders.length === 0 && (
              <div className="rounded-[12px] border border-zinc-800 bg-[#101010] p-10 text-center text-sm font-bold text-zinc-500">
                선택한 기간의 완료 주문이 없습니다.
              </div>
            )}

            <div className="space-y-3">
              {orders.map((order) => {
                const isSelected = selectedOrder?.id === order.id;

                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`w-full rounded-[12px] border bg-[#101010] p-4 text-left transition ${
                      isSelected
                        ? "border-[#d4af37]/80 bg-[#12100a]"
                        : "border-zinc-800 hover:border-zinc-600"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md border border-lime-500/40 bg-lime-500/10 px-2 py-1 text-[11px] font-black text-lime-300">
                            완료
                          </span>
                          <span className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] font-black text-zinc-400">
                            {order.payment_method || "미설정"}
                          </span>
                        </div>

                        <div className="mt-3 text-2xl font-black tracking-[-0.05em] text-zinc-100">
                          #{order.id} · {order.customer || "고객"}
                        </div>

                        <div className="mt-1 truncate text-sm text-zinc-400">
                          {formatDateTime(order.created_at)}
                        </div>

                        <div className="mt-2 truncate text-sm font-bold text-zinc-300">
                          {menuSummary(order.menu)}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-xs text-zinc-500">결제금액</div>
                        <div className="mt-1 text-xl font-black text-[#f0d98a]">
                          {order.total.toLocaleString()}원
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="min-h-[calc(100vh-36px)] overflow-y-auto bg-[#090909]">
          <header className="border-b border-zinc-800 bg-[#0b0b0b] px-5 py-4 lg:px-8">
            <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
              <div className="rounded-[10px] border border-zinc-800 bg-[#111111] px-3 py-2">
                <span className="text-zinc-500">총매출</span>
                <div className="mt-1 font-black text-[#f0d98a]">
                  {summary.totalSales.toLocaleString()}원
                </div>
              </div>

              <div className="rounded-[10px] border border-zinc-800 bg-[#111111] px-3 py-2">
                <span className="text-zinc-500">완료주문</span>
                <div className="mt-1 font-black text-zinc-100">
                  {summary.orderCount}건
                </div>
              </div>

              <div className="rounded-[10px] border border-zinc-800 bg-[#111111] px-3 py-2">
                <span className="text-zinc-500">객단가</span>
                <div className="mt-1 font-black text-zinc-100">
                  {summary.averageOrder.toLocaleString()}원
                </div>
              </div>

              <div className="rounded-[10px] border border-zinc-800 bg-[#111111] px-3 py-2">
                <span className="text-zinc-500">배달비</span>
                <div className="mt-1 font-black text-[#f0d98a]">
                  {summary.deliveryFeeTotal.toLocaleString()}원
                </div>
              </div>

              <div className="rounded-[10px] border border-zinc-800 bg-[#111111] px-3 py-2">
                <span className="text-zinc-500">할인</span>
                <div className="mt-1 font-black text-red-300">
                  -{summary.stampDiscountTotal.toLocaleString()}원
                </div>
              </div>
            </div>
          </header>

          <div className="px-5 py-5 lg:px-8">
            <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
              <div className="rounded-[12px] border border-zinc-800 bg-[#101010]">
                <div className="border-b border-zinc-800 px-5 py-4">
                  <div className="text-lg font-black text-[#f0d98a]">
                    결제수단별 매출
                  </div>

                  <div className="mt-1 text-xs text-zinc-500">
                    완료 주문 기준 / {selectedPeriodText}
                  </div>
                </div>

                <div className="divide-y divide-zinc-800">
                  {paymentCards.map((card) => (
                    <div
                      key={card.label}
                      className="flex items-center justify-between px-5 py-4 text-sm"
                    >
                      <div className="font-bold text-zinc-400">{card.label}</div>
                      <div className={`text-xl font-black ${card.accent}`}>
                        {card.value.toLocaleString()}원
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[12px] border border-zinc-800 bg-[#101010]">
                <div className="border-b border-zinc-800 px-5 py-4">
                  <div className="text-lg font-black text-[#f0d98a]">
                    선택 주문 상세
                  </div>

                  <div className="mt-1 text-xs text-zinc-500">
                    주문 목록에서 항목을 선택하면 상세가 표시됩니다.
                  </div>
                </div>

                {selectedOrder ? (
                  <div className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-black text-[#d4af37]">
                          주문번호
                        </div>

                        <div className="mt-2 text-5xl font-black tracking-[-0.08em] text-zinc-100">
                          #{selectedOrder.id}
                        </div>

                        <div className="mt-2 text-sm text-zinc-500">
                          {formatDateTime(selectedOrder.created_at)}
                        </div>
                      </div>

                      <div className="rounded-md border border-lime-500/40 bg-lime-500/10 px-3 py-2 text-xs font-black text-lime-300">
                        완료
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 xl:grid-cols-2">
                      <div className="rounded-[10px] border border-zinc-800 bg-black/35 p-3">
                        <div className="text-xs font-black text-zinc-500">고객</div>
                        <div className="mt-2 text-xl font-black text-[#f0d98a]">
                          {selectedOrder.customer || "고객"}
                        </div>
                        <div className="mt-2 text-sm text-zinc-300">
                          {selectedOrder.phone}
                        </div>
                      </div>

                      <div className="rounded-[10px] border border-zinc-800 bg-black/35 p-3">
                        <div className="text-xs font-black text-zinc-500">결제</div>
                        <div className="mt-2 text-xl font-black text-[#f0d98a]">
                          {selectedOrder.total.toLocaleString()}원
                        </div>
                        <div className="mt-2 text-sm text-zinc-300">
                          {selectedOrder.payment_method || "미설정"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 rounded-[10px] border border-zinc-800 bg-black/35 p-3 text-sm leading-relaxed text-zinc-300">
                      {selectedOrder.address}
                    </div>

                    <div className="mt-5 rounded-[12px] border border-zinc-800 bg-[#0c0c0c]">
                      <div className="border-b border-zinc-800 px-4 py-3 text-sm font-black text-[#f0d98a]">
                        메뉴 상세
                      </div>

                      <div className="divide-y divide-zinc-800">
                        {selectedLines.map((item, index) => (
                          <div
                            key={index}
                            className="grid grid-cols-[1fr_56px_100px] gap-3 px-4 py-3 text-sm"
                          >
                            <div>
                              <div className="font-black text-zinc-100">
                                {item.name}
                              </div>

                              {item.options && item.options.length > 0 && (
                                <div className="mt-2 space-y-1 text-xs text-zinc-500">
                                  {item.options.map((option, optionIndex) => (
                                    <div key={optionIndex}>
                                      - {option.groupName}: {option.optionName}
                                      {option.price > 0
                                        ? ` +${option.price.toLocaleString()}원`
                                        : ""}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="text-center font-black text-[#d4af37]">
                              {item.qty}
                            </div>

                            <div className="text-right font-black text-zinc-100">
                              {Number(item.total || 0).toLocaleString()}원
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-2 border-t border-zinc-800 px-4 py-4 text-sm">
                        <div className="flex justify-between text-zinc-400">
                          <span>상품 금액</span>
                          <span>{selectedMenuTotal.toLocaleString()}원</span>
                        </div>

                        <div className="flex justify-between text-zinc-400">
                          <span>배달비</span>
                          <span>{Number(selectedOrder.delivery_fee || 0).toLocaleString()}원</span>
                        </div>

                        {Number(selectedOrder.stamp_discount || 0) > 0 && (
                          <div className="flex justify-between text-emerald-300">
                            <span>스탬프 할인</span>
                            <span>
                              -{Number(selectedOrder.stamp_discount || 0).toLocaleString()}원
                            </span>
                          </div>
                        )}

                        <div className="flex justify-between border-t border-zinc-800 pt-3 text-xl font-black text-[#f0d98a]">
                          <span>총 결제 금액</span>
                          <span>{selectedOrder.total.toLocaleString()}원</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleOpen(selectedOrder.id)}
                      className="mt-4 w-full rounded-[10px] border border-zinc-700 bg-[#111111] px-4 py-3 text-sm font-black text-zinc-200 transition hover:border-[#d4af37]/50"
                    >
                      {openOrderIds.includes(selectedOrder.id)
                        ? "요청사항 숨기기"
                        : "요청사항 보기"}
                    </button>

                    {openOrderIds.includes(selectedOrder.id) && (
                      <div className="mt-3 rounded-[10px] border border-zinc-800 bg-black/35 p-3">
                        <div className="text-xs font-black text-zinc-500">
                          요청사항
                        </div>

                        <div className="mt-2 text-sm leading-relaxed text-zinc-300">
                          {selectedOrder.memo?.trim()
                            ? selectedOrder.memo
                            : "요청사항 없음"}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-10 text-center text-sm font-bold text-zinc-500">
                    선택된 주문이 없습니다.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 rounded-[12px] border border-zinc-800 bg-[#101010] p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-lg font-black text-[#f0d98a]">
                    전체 주문 내역
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    펼치기 없이도 우측 상세에서 전체 정보를 확인할 수 있습니다.
                  </div>
                </div>

                <div className="text-sm font-black text-zinc-500">
                  {orders.length}건
                </div>
              </div>

              <div className="overflow-hidden rounded-[10px] border border-zinc-800">
                <div className="grid grid-cols-[90px_1fr_1.5fr_150px_140px] gap-3 border-b border-zinc-800 bg-black/40 px-4 py-3 text-xs font-black text-zinc-500">
                  <div>주문</div>
                  <div>고객</div>
                  <div>메뉴</div>
                  <div>결제수단</div>
                  <div className="text-right">금액</div>
                </div>

                <div className="divide-y divide-zinc-800">
                  {orders.map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => setSelectedOrderId(order.id)}
                      className="grid w-full grid-cols-[90px_1fr_1.5fr_150px_140px] gap-3 px-4 py-3 text-left text-sm transition hover:bg-white/[0.03]"
                    >
                      <div className="font-black text-[#d4af37]">#{order.id}</div>
                      <div className="truncate text-zinc-300">{order.customer}</div>
                      <div className="truncate text-zinc-400">{menuSummary(order.menu)}</div>
                      <div className="truncate text-zinc-400">{order.payment_method || "미설정"}</div>
                      <div className="text-right font-black text-[#f0d98a]">
                        {order.total.toLocaleString()}원
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
