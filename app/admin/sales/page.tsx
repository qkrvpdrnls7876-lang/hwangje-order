"use client";

import { useEffect, useMemo, useState } from "react";
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
  const todayText = new Date().toISOString().slice(0, 10);
  const currentMonthText = todayText.slice(0, 7);

  const [viewMode, setViewMode] = useState<"day" | "month">("day");
  const [selectedDate, setSelectedDate] = useState(todayText);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthText);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [openOrderIds, setOpenOrderIds] = useState<number[]>([]);

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

    setOrders(data || []);
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

    return {
      orderCount,
      totalSales,
      deliveryFeeTotal,
      stampDiscountTotal,
      cashTotal,
      cardTotal,
      transferTotal,
      unknownTotal,
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

  return (
    <main className="min-h-screen bg-black p-4 text-white md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 rounded-2xl border border-yellow-400/20 bg-zinc-950 p-4 shadow-2xl md:rounded-3xl md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-sm font-bold text-zinc-400">황제 관리자</div>
              <h1 className="mt-1 text-3xl font-black text-yellow-400 md:text-4xl">
                매출보기
              </h1>
              <p className="mt-2 text-sm text-zinc-400">
                일매출/월매출 선택 가능 · 새벽 3시 기준 영업일 / 완료 주문만 집계
              </p>
            </div>

        
          </div>

          <div className="mt-5 grid gap-3">
            <div className="grid grid-cols-2 gap-2 md:w-[320px]">
              <button
                type="button"
                onClick={() => setViewMode("day")}
                className={`rounded-xl px-5 py-3 text-base font-black ${
                  viewMode === "day"
                    ? "bg-yellow-400 text-black"
                    : "bg-zinc-800 text-white"
                }`}
              >
                일매출
              </button>

              <button
                type="button"
                onClick={() => setViewMode("month")}
                className={`rounded-xl px-5 py-3 text-base font-black ${
                  viewMode === "month"
                    ? "bg-yellow-400 text-black"
                    : "bg-zinc-800 text-white"
                }`}
              >
                월매출
              </button>
            </div>

            {viewMode === "day" ? (
              <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setViewMode("day");
                  }}
                  className="rounded-xl border border-zinc-700 bg-black p-4 text-lg font-black text-white"
                />

                <button
                  type="button"
                  onClick={() => setQuickDate(0)}
                  className="rounded-xl bg-yellow-400 px-6 py-4 text-lg font-black text-black"
                >
                  오늘
                </button>

                <button
                  type="button"
                  onClick={() => setQuickDate(-1)}
                  className="rounded-xl bg-zinc-800 px-6 py-4 text-lg font-black"
                >
                  어제
                </button>

                <button
                  type="button"
                  onClick={fetchSales}
                  className="rounded-xl bg-green-600 px-6 py-4 text-lg font-black"
                >
                  새로고침
                </button>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setViewMode("month");
                  }}
                  className="rounded-xl border border-zinc-700 bg-black p-4 text-lg font-black text-white"
                />

                <button
                  type="button"
                  onClick={() => setQuickMonth(0)}
                  className="rounded-xl bg-yellow-400 px-6 py-4 text-lg font-black text-black"
                >
                  이번달
                </button>

                <button
                  type="button"
                  onClick={() => setQuickMonth(-1)}
                  className="rounded-xl bg-zinc-800 px-6 py-4 text-lg font-black"
                >
                  지난달
                </button>

                <button
                  type="button"
                  onClick={fetchSales}
                  className="rounded-xl bg-green-600 px-6 py-4 text-lg font-black"
                >
                  새로고침
                </button>
              </div>
            )}

            <div className="rounded-xl border border-yellow-400/20 bg-black px-4 py-3 text-sm font-black text-yellow-400">
              현재 조회: {selectedPeriodText}
            </div>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-zinc-950 p-5">
            <div className="text-base text-zinc-400">
              {viewMode === "month" ? "월 완료 주문" : "완료 주문"}
            </div>
            <div className="mt-1 text-4xl font-black text-yellow-400">
              {summary.orderCount}건
            </div>
          </div>

          <div className="rounded-2xl bg-zinc-950 p-5">
            <div className="text-base text-zinc-400">
              {viewMode === "month" ? "월 총 매출" : "총 매출"}
            </div>
            <div className="mt-1 text-3xl font-black text-yellow-400">
              {summary.totalSales.toLocaleString()}원
            </div>
          </div>

          <div className="rounded-2xl bg-zinc-950 p-5">
            <div className="text-base text-zinc-400">배달비 합계</div>
            <div className="mt-1 text-3xl font-black text-green-400">
              {summary.deliveryFeeTotal.toLocaleString()}원
            </div>
          </div>

          <div className="rounded-2xl bg-zinc-950 p-5">
            <div className="text-base text-zinc-400">스탬프 할인</div>
            <div className="mt-1 text-3xl font-black text-red-400">
              -{summary.stampDiscountTotal.toLocaleString()}원
            </div>
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="mb-3 text-2xl font-black text-yellow-400">
            결제수단별 매출
          </h2>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-black p-4">
              <div className="text-base text-zinc-400">현금</div>
              <div className="mt-1 text-2xl font-black">
                {summary.cashTotal.toLocaleString()}원
              </div>
            </div>

            <div className="rounded-xl bg-black p-4">
              <div className="text-base text-zinc-400">카드</div>
              <div className="mt-1 text-2xl font-black">
                {summary.cardTotal.toLocaleString()}원
              </div>
            </div>

            <div className="rounded-xl bg-black p-4">
              <div className="text-base text-zinc-400">계좌이체</div>
              <div className="mt-1 text-2xl font-black text-green-400">
                {summary.transferTotal.toLocaleString()}원
              </div>
            </div>

            <div className="rounded-xl bg-black p-4">
              <div className="text-base text-zinc-400">미설정</div>
              <div className="mt-1 text-2xl font-black text-zinc-400">
                {summary.unknownTotal.toLocaleString()}원
              </div>
            </div>
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl bg-zinc-900 p-6 text-center text-xl font-black text-zinc-400">
            매출 불러오는 중...
          </div>
        )}

        {!loading && orders.length === 0 && (
          <div className="rounded-2xl bg-zinc-900 p-8 text-center text-lg text-zinc-400">
            선택한 기간의 완료 주문이 없습니다.
          </div>
        )}

        <div className="space-y-2">
          {orders.map((order) => {
            const isOpen = openOrderIds.includes(order.id);

            return (
              <div
                key={order.id}
                className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950"
              >
                <div className="grid gap-3 p-4 md:grid-cols-[120px_1.2fr_1.7fr_1fr_120px] md:items-center">
                  <div>
                    <div className="text-sm text-zinc-500">주문</div>
                    <div className="text-xl font-black text-yellow-400">#{order.id}</div>
                    <div className="text-sm text-zinc-400">{formatTime(order.created_at)}</div>
                  </div>

                  <div>
                    <div className="text-lg font-black">{order.customer}</div>
                    <div className="mt-1 text-sm text-zinc-400">📞 {order.phone}</div>
                  </div>

                  <div>
                    <div className="line-clamp-1 text-base font-black text-yellow-400">
                      {menuSummary(order.menu)}
                    </div>
                    <div className="mt-1 line-clamp-1 text-sm text-zinc-400">
                      📍 {order.address}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-zinc-500">결제금액</div>
                    <div className="text-2xl font-black text-yellow-400">
                      {order.total.toLocaleString()}원
                    </div>
                    <div className="mt-1 text-sm font-bold text-green-400">
                      {order.payment_method || "미설정"}
                    </div>
                  </div>

                  <button
                    onClick={() => toggleOpen(order.id)}
                    className="rounded-xl bg-zinc-800 px-4 py-4 text-base font-black"
                  >
                    {isOpen ? "숨기기" : "메뉴"}
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-zinc-800 p-4">
                    <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                      <div className="rounded-xl bg-black p-3">
                        <div className="text-xs text-zinc-500">배달비</div>
                        <div className="font-black">
                          {(order.delivery_fee || 0).toLocaleString()}원
                        </div>
                      </div>

                      <div className="rounded-xl bg-black p-3">
                        <div className="text-xs text-zinc-500">거리</div>
                        <div className="font-black">
                          {order.delivery_distance_km
                            ? `${Number(order.delivery_distance_km).toFixed(1)}km`
                            : "0km"}
                        </div>
                      </div>

                      <div className="rounded-xl bg-black p-3">
                        <div className="text-xs text-zinc-500">할인</div>
                        <div className="font-black text-red-400">
                          -{(order.stamp_discount || 0).toLocaleString()}원
                        </div>
                      </div>

                      <div className="rounded-xl bg-black p-3">
                        <div className="text-xs text-zinc-500">결제수단</div>
                        <div className="font-black text-green-400">
                          {order.payment_method || "미설정"}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      {menuLines(order.menu).map((item, index) => (
                        <div key={index} className="rounded-xl bg-zinc-900 p-3">
                          <div className="flex justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate font-black">{item.name}</div>
                              <div className="mt-1 text-sm text-zinc-400">
                                수량 {item.qty}개
                              </div>

                              {item.options && item.options.length > 0 && (
                                <div className="mt-2 space-y-1 text-xs text-zinc-500">
                                  {item.options.map((option, optionIndex) => (
                                    <div key={optionIndex}>
                                      - {option.groupName}: {option.optionName}
                                      {option.price > 0 &&
                                        ` +${option.price.toLocaleString()}원`}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="shrink-0 whitespace-nowrap font-black text-yellow-400">
                              {item.total.toLocaleString()}원
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 rounded-xl bg-zinc-900 p-3">
                      <div className="mb-1 text-sm text-zinc-400">요청사항</div>
                      <div className="text-sm">
                        {order.memo?.trim() ? order.memo : "요청사항 없음"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
