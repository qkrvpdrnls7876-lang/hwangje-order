"use client";

import { useEffect, useState } from "react";
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
  used_stamp_reward: boolean | null;
  stamp_processed: boolean | null;
};

type MenuLine = {
  name: string;
  qty: number | string;
  total: number;
  options?: {
    groupName: string;
    optionName: string;
    price: number;
  }[];
};

type StampCustomer = {
  phone: string;
  stamp_count: number;
  total_orders: number;
};

export default function RiderPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [openAddressIds, setOpenAddressIds] = useState<number[]>([]);
  const [openMenuIds, setOpenMenuIds] = useState<number[]>([]);

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
    setLoading(true);

    const startDate = getBusinessStartDate();

    const { data: todayData, error: todayError } = await supabase
      .from("orders")
      .select("*")
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: true });

    if (todayError) {
      alert("오늘 주문 불러오기 실패: " + todayError.message);
      setLoading(false);
      return;
    }

    const allTodayOrders = (todayData || []) as Order[];
    const deliveryOrders = allTodayOrders.filter(
      (order) =>
        order.status === "접수완료" ||
        order.status === "조리중" ||
        order.status === "배달중",
    );

    setTodayOrders(allTodayOrders);
    setOrders(deliveryOrders);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();

    const interval = setInterval(() => {
      fetchOrders();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const menuLines = (menuText: string): MenuLine[] => {
    try {
      return JSON.parse(menuText) as MenuLine[];
    } catch {
      return [];
    }
  };

  const normalizePhone = (phone: string) => {
    return phone.replace(/[^0-9]/g, "");
  };

  const shortAddress = (address: string) => {
    if (!address) return "주소 없음";
    if (address.length <= 24) return address;
    return `${address.slice(0, 24)}...`;
  };

  const getMenuSummary = (menuText: string) => {
    const lines = menuLines(menuText);

    if (lines.length === 0) return "메뉴정보 없음";

    const first = lines[0];
    const totalQty = lines.reduce((sum, item) => sum + Number(item.qty || 0), 0);

    if (lines.length === 1) {
      return `${first.name} x${first.qty}`;
    }

    return `${first.name} x${first.qty} 외 ${lines.length - 1}개 / 총 ${totalQty}개`;
  };

  const getTodayOrderNumber = (orderId: number) => {
    const sortedOrders = [...todayOrders].sort(
      (a, b) =>
        new Date(a.created_at).getTime() -
        new Date(b.created_at).getTime(),
    );

    const index = sortedOrders.findIndex((order) => order.id === orderId);

    return index >= 0 ? index + 1 : orderId;
  };

  const toggleAddress = (id: number) => {
    setOpenAddressIds((prev) =>
      prev.includes(id) ? prev.filter((orderId) => orderId !== id) : [...prev, id],
    );
  };

  const toggleMenu = (id: number) => {
    setOpenMenuIds((prev) =>
      prev.includes(id) ? prev.filter((orderId) => orderId !== id) : [...prev, id],
    );
  };

  const openKakaoMap = (address: string) => {
    const url = `https://map.kakao.com/link/search/${encodeURIComponent(address)}`;
    window.open(url, "_blank");
  };

  const openNaverMap = (address: string) => {
    const url = `https://map.naver.com/p/search/${encodeURIComponent(address)}`;
    window.open(url, "_blank");
  };

  const callCustomer = (phone: string) => {
    const cleanPhone = normalizePhone(phone);
    window.location.href = `tel:${cleanPhone}`;
  };

  const processStamp = async (order: Order) => {
    if (order.stamp_processed) return;

    const phone = normalizePhone(order.phone);
    if (!phone) return;

    const { data: customerData, error: customerError } = await supabase
      .from("stamp_customers")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();

    if (customerError) {
      alert("스탬프 고객 조회 실패: " + customerError.message);
      return;
    }

    const customer = customerData as StampCustomer | null;

    if (order.used_stamp_reward) {
      if (customer) {
        const { error } = await supabase
          .from("stamp_customers")
          .update({
            stamp_count: 0,
            total_orders: customer.total_orders + 1,
          })
          .eq("phone", phone);

        if (error) {
          alert("스탬프 초기화 실패: " + error.message);
          return;
        }
      } else {
        const { error } = await supabase.from("stamp_customers").insert({
          phone,
          stamp_count: 0,
          total_orders: 1,
        });

        if (error) {
          alert("스탬프 고객 생성 실패: " + error.message);
          return;
        }
      }
    } else {
      if (customer) {
        const { error } = await supabase
          .from("stamp_customers")
          .update({
            stamp_count: customer.stamp_count + 1,
            total_orders: customer.total_orders + 1,
          })
          .eq("phone", phone);

        if (error) {
          alert("스탬프 적립 실패: " + error.message);
          return;
        }
      } else {
        const { error } = await supabase.from("stamp_customers").insert({
          phone,
          stamp_count: 1,
          total_orders: 1,
        });

        if (error) {
          alert("스탬프 신규 적립 실패: " + error.message);
          return;
        }
      }
    }

    await supabase
      .from("orders")
      .update({
        stamp_processed: true,
      })
      .eq("id", order.id);
  };

  const completeDelivery = async (order: Order) => {
    const ok = confirm(`오늘주문 #${getTodayOrderNumber(order.id)}\n배달완료 처리할까요?`);

    if (!ok) return;

    const { error } = await supabase
      .from("orders")
      .update({
        status: "완료",
      })
      .eq("id", order.id);

    if (error) {
      alert("완료 처리 실패: " + error.message);
      return;
    }

    await processStamp(order);

    alert("배달완료 처리됨");
    fetchOrders();
  };

  const formatTime = (dateText: string) => {
    const date = new Date(dateText);

    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusClass = (status: string) => {
    if (status === "접수완료") {
      return "border-amber-500/45 bg-amber-500/10 text-amber-300";
    }

    if (status === "조리중") {
      return "border-sky-500/40 bg-sky-500/10 text-sky-300";
    }

    if (status === "배달중") {
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    }

    return "border-zinc-700 bg-zinc-900 text-zinc-300";
  };

  const acceptedCount = orders.filter((order) => order.status === "접수완료").length;
  const cookingCount = orders.filter((order) => order.status === "조리중").length;
  const deliveringCount = orders.filter((order) => order.status === "배달중").length;
  const transferCount = orders.filter((order) => order.payment_method === "계좌이체").length;
  const totalDeliveryFee = orders.reduce((sum, order) => sum + Number(order.delivery_fee || 0), 0);

  return (
    <main className="min-h-screen overflow-hidden bg-[#070707] pt-9 text-zinc-100">
      <div className="fixed left-0 right-0 top-0 z-[1000] flex h-9 items-center justify-between border-b border-[#d4af3720] bg-[#080808]/95 px-3 text-xs text-zinc-400 backdrop-blur-xl [-webkit-app-region:drag]">
        <button
          type="button"
          onClick={goBack}
          className="flex items-center gap-2 rounded-md px-2 py-1 font-black tracking-[-0.03em] text-[#d4af37] hover:bg-white/[0.04] [-webkit-app-region:no-drag]"
        >
          <span className="h-2 w-2 rounded-full bg-[#d4af37]" />← 황제POS /
          라이더관리
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

      <div className="grid min-h-[calc(100vh-36px)] grid-cols-1 lg:grid-cols-[228px_1fr]">
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
            <a
              href="/admin"
              className="block rounded-[10px] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white"
            >
              주문 관리
            </a>
            <a
              href="/admin/sales"
              className="block rounded-[10px] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white"
            >
              매출 관리
            </a>
            <a
              href="/admin/menu"
              className="block rounded-[10px] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white"
            >
              메뉴 관리
            </a>
            <div className="flex w-full items-center justify-between rounded-[10px] border border-[#d4af37]/20 bg-[#d4af37]/10 px-4 py-3 text-sm font-bold text-[#f0d98a]">
              <span>라이더 관리</span>
              <span className="rounded-full bg-[#d4af37] px-2 py-0.5 text-xs text-black">
                ON
              </span>
            </div>
            <a
              href="/kitchen"
              className="block rounded-[10px] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white"
            >
              주방 모니터
            </a>
          </nav>

          <div className="mx-4 mb-4 rounded-[12px] border border-[#d4af37]/20 bg-black/40 p-4">
            <div className="text-xs font-bold text-zinc-500">라이더 현황</div>
            <div className="mt-1 text-2xl font-black tracking-[-0.05em] text-[#f0d98a]">
              {deliveringCount > 0 ? `배달중 ${deliveringCount}` : "대기중"}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-zinc-500">준비</div>
                <div className="font-black text-zinc-100">
                  {acceptedCount + cookingCount}건
                </div>
              </div>
              <div>
                <div className="text-zinc-500">배달비</div>
                <div className="font-black text-[#d4af37]">
                  {totalDeliveryFee.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </aside>

        <section className="min-h-[calc(100vh-36px)] overflow-y-auto bg-[#090909]">
          <header className="border-b border-zinc-800 bg-[#0b0b0b] px-4 py-5 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <button
                  type="button"
                  onClick={goBack}
                  className="mb-3 inline-flex items-center rounded-[9px] border border-zinc-700 bg-[#111111] px-3 py-2 text-xs font-black text-zinc-300 transition hover:border-[#d4af37]/50 hover:text-[#f0d98a]"
                >
                  ← 뒤로가기
                </button>

                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#d4af37]">
                  DELIVERY CONTROL
                </div>
                <h1 className="mt-1 text-4xl font-black tracking-[-0.07em] text-zinc-100">
                  라이더관리
                </h1>
                <p className="mt-2 text-sm text-zinc-500">
                  접수완료 · 조리중 · 배달중 주문만 표시합니다. 3초 자동갱신.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={fetchOrders}
                  className="rounded-[10px] border border-[#d4af37]/60 bg-[#d4af37] px-4 py-3 text-sm font-black text-black transition hover:bg-[#f0c75a]"
                >
                  새로고침
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
              <div className="rounded-[10px] border border-zinc-800 bg-[#111111] px-3 py-2">
                <span className="text-zinc-500">배달대상</span>
                <div className="mt-1 font-black text-[#f0d98a]">
                  {orders.length}건
                </div>
              </div>
              <div className="rounded-[10px] border border-zinc-800 bg-[#111111] px-3 py-2">
                <span className="text-zinc-500">접수완료</span>
                <div className="mt-1 font-black text-amber-300">
                  {acceptedCount}건
                </div>
              </div>
              <div className="rounded-[10px] border border-zinc-800 bg-[#111111] px-3 py-2">
                <span className="text-zinc-500">조리중</span>
                <div className="mt-1 font-black text-sky-300">
                  {cookingCount}건
                </div>
              </div>
              <div className="rounded-[10px] border border-zinc-800 bg-[#111111] px-3 py-2">
                <span className="text-zinc-500">배달중</span>
                <div className="mt-1 font-black text-emerald-300">
                  {deliveringCount}건
                </div>
              </div>
              <div className="rounded-[10px] border border-zinc-800 bg-[#111111] px-3 py-2">
                <span className="text-zinc-500">입금확인</span>
                <div className="mt-1 font-black text-red-300">
                  {transferCount}건
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 lg:hidden">
              <a
                href="/admin"
                className="rounded-[9px] border border-zinc-700 px-3 py-2 text-xs font-black text-zinc-300"
              >
                주문
              </a>
              <a
                href="/admin/sales"
                className="rounded-[9px] border border-zinc-700 px-3 py-2 text-xs font-black text-zinc-300"
              >
                매출
              </a>
              <a
                href="/admin/menu"
                className="rounded-[9px] border border-zinc-700 px-3 py-2 text-xs font-black text-zinc-300"
              >
                메뉴
              </a>
              <a
                href="/kitchen"
                className="rounded-[9px] border border-zinc-700 px-3 py-2 text-xs font-black text-zinc-300"
              >
                주방
              </a>
            </div>
          </header>

          <div className="px-4 py-5 lg:px-8">
            {loading && (
              <div className="rounded-[14px] border border-zinc-800 bg-[#101010] p-8 text-center text-sm font-bold text-zinc-500">
                불러오는 중...
              </div>
            )}

            {!loading && orders.length === 0 && (
              <div className="rounded-[14px] border border-zinc-800 bg-[#101010] p-12 text-center">
                <div className="text-2xl font-black text-zinc-300">
                  현재 배달중 주문이 없습니다.
                </div>
                <div className="mt-2 text-sm text-zinc-500">
                  접수완료/조리중/배달중 주문이 생기면 자동으로 표시됩니다.
                </div>
              </div>
            )}

            <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {orders.map((order) => {
                const lines = menuLines(order.menu);
                const addressOpen = openAddressIds.includes(order.id);
                const menuOpen = openMenuIds.includes(order.id);

                return (
                  <div
                    key={order.id}
                    className="overflow-hidden rounded-[14px] border border-zinc-800 bg-[#101010] shadow-[0_18px_60px_rgba(0,0,0,.28)]"
                  >
                    <div className="border-b border-zinc-800 bg-[#0b0b0b] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-zinc-500">
                            오늘주문 #{getTodayOrderNumber(order.id)} ·{" "}
                            {formatTime(order.created_at)}
                          </div>

                          <div className="mt-1 truncate text-2xl font-black tracking-[-0.05em] text-[#f0d98a]">
                            {order.customer || "고객"}
                          </div>
                        </div>

                        <div
                          className={`shrink-0 rounded-md border px-2.5 py-1.5 text-xs font-black ${statusClass(order.status)}`}
                        >
                          {order.status}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-[10px] border border-zinc-800 bg-[#070707] p-3">
                          <div className="text-[11px] font-bold text-zinc-500">
                            결제금액
                          </div>
                          <div className="mt-1 text-xl font-black text-[#f0d98a]">
                            {order.total.toLocaleString()}원
                          </div>
                        </div>

                        <div className="rounded-[10px] border border-zinc-800 bg-[#070707] p-3">
                          <div className="text-[11px] font-bold text-zinc-500">
                            결제수단
                          </div>
                          <div className="mt-1 truncate text-sm font-black text-zinc-100">
                            {order.payment_method || "미설정"}
                          </div>
                        </div>
                      </div>

                      {order.payment_method === "계좌이체" && (
                        <div className="mt-3 rounded-[10px] border border-red-500/35 bg-red-950/30 px-3 py-2 text-center text-sm font-black text-red-300">
                          입금확인 필요
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <button
                        type="button"
                        onClick={() => toggleAddress(order.id)}
                        className="w-full rounded-[10px] border border-zinc-800 bg-[#070707] p-3 text-left transition hover:border-[#d4af37]/40"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
                              배달주소
                            </div>
                            <div className="mt-1 truncate text-sm font-black text-zinc-100">
                              {addressOpen ? order.address : shortAddress(order.address)}
                            </div>
                          </div>

                          <div className="shrink-0 rounded-md border border-[#d4af37]/30 bg-[#d4af37]/10 px-2 py-1 text-[11px] font-black text-[#d4af37]">
                            {addressOpen ? "접기 ▲" : "열기 ▼"}
                          </div>
                        </div>
                      </button>

                      {addressOpen && (
                        <div className="mt-2 rounded-[10px] border border-zinc-800 bg-[#0b0b0b] p-3">
                          <div className="text-base font-black leading-relaxed text-zinc-100">
                            {order.address}
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                            <div className="rounded-[9px] border border-zinc-800 bg-[#070707] p-2.5">
                              <div className="text-[11px] text-zinc-500">거리</div>
                              <div className="font-black text-[#d4af37]">
                                {Number(order.delivery_distance_km || 0).toFixed(1)}km
                              </div>
                            </div>

                            <div className="rounded-[9px] border border-zinc-800 bg-[#070707] p-2.5">
                              <div className="text-[11px] text-zinc-500">배달비</div>
                              <div className="font-black text-[#d4af37]">
                                {(order.delivery_fee || 0).toLocaleString()}원
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => openKakaoMap(order.address)}
                          className="rounded-[10px] border border-[#d4af37]/60 bg-[#d4af37] p-3 text-sm font-black text-black transition hover:bg-[#f0c75a]"
                        >
                          카카오맵
                        </button>

                        <button
                          onClick={() => openNaverMap(order.address)}
                          className="rounded-[10px] border border-[#d4af37]/35 bg-[#111111] p-3 text-sm font-black text-[#d4af37] transition hover:bg-[#17130a]"
                        >
                          네이버맵
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleMenu(order.id)}
                        className="mt-2 w-full rounded-[10px] border border-zinc-800 bg-[#070707] p-3 text-left transition hover:border-[#d4af37]/40"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
                              메뉴
                            </div>
                            <div className="mt-1 truncate text-sm font-black text-zinc-100">
                              {getMenuSummary(order.menu)}
                            </div>
                          </div>

                          <div className="shrink-0 rounded-md border border-[#d4af37]/30 bg-[#d4af37]/10 px-2 py-1 text-[11px] font-black text-[#d4af37]">
                            {menuOpen ? "접기 ▲" : "상세 ▼"}
                          </div>
                        </div>
                      </button>

                      {menuOpen && (
                        <div className="mt-2 space-y-2">
                          {lines.map((item, index) => (
                            <div
                              key={index}
                              className="rounded-[10px] border border-zinc-800 bg-[#0b0b0b] p-3"
                            >
                              <div className="flex justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-black leading-tight text-zinc-100">
                                    {item.name}
                                  </div>
                                  <div className="mt-1 text-xs font-bold text-zinc-500">
                                    수량 {item.qty}개
                                  </div>

                                  {item.options && item.options.length > 0 && (
                                    <div className="mt-2 space-y-0.5 text-[11px] leading-relaxed text-zinc-500">
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

                                <div className="shrink-0 text-sm font-black text-[#d4af37]">
                                  {Number(item.total || 0).toLocaleString()}원
                                </div>
                              </div>
                            </div>
                          ))}

                          <div className="rounded-[10px] border border-zinc-800 bg-[#0b0b0b] p-3">
                            <div className="mb-1 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                              요청사항
                            </div>
                            <div className="text-xs leading-relaxed text-zinc-300">
                              {order.memo?.trim() ? order.memo : "요청사항 없음"}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 border-t border-zinc-800 p-4">
                      <button
                        onClick={() => callCustomer(order.phone)}
                        className="rounded-[10px] border border-zinc-700 bg-[#111111] p-3 text-sm font-black text-zinc-300 transition hover:border-[#d4af37]/40 hover:text-[#d4af37]"
                      >
                        전화걸기
                      </button>

                      <button
                        onClick={() => completeDelivery(order)}
                        className="rounded-[10px] border border-[#d4af37]/60 bg-[#d4af37] p-3 text-sm font-black text-black transition hover:bg-[#f0c75a]"
                      >
                        배달완료
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
