"use client";

import { useEffect, useState } from "react";
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [openAddressIds, setOpenAddressIds] = useState<number[]>([]);
  const [openMenuIds, setOpenMenuIds] = useState<number[]>([]);

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

    const allTodayOrders = todayData || [];
    const deliveryOrders = allTodayOrders.filter(
      (order) => order.status === "배달중",
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
    if (address.length <= 22) return address;
    return `${address.slice(0, 22)}...`;
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

  return (
    <main className="min-h-screen bg-[#050505] p-3 text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.16),transparent_32%),linear-gradient(180deg,#050505,#0a0a0a)]" />

      <div className="mx-auto max-w-xl">
        <div className="sticky top-0 z-20 mb-3 rounded-2xl border border-yellow-400/25 bg-black/90 p-3 shadow-2xl shadow-yellow-900/10 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black tracking-[-0.01em] text-yellow-400">
                HWANGJE RIDER
              </h1>

              <div className="mt-1 text-xs font-bold text-zinc-400">
                배달중 {orders.length}건 · 3초 자동갱신
              </div>
            </div>

            <button
              onClick={fetchOrders}
              className="rounded-xl border border-yellow-400/30 bg-yellow-400 px-4 py-2 text-sm font-black text-black"
            >
              새로고침
            </button>
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-center text-sm text-zinc-400">
            불러오는 중...
          </div>
        )}

        {!loading && orders.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center text-zinc-400">
            현재 배달중 주문이 없습니다.
          </div>
        )}

        <div className="space-y-3">
          {orders.map((order) => {
            const lines = menuLines(order.menu);
            const addressOpen = openAddressIds.includes(order.id);
            const menuOpen = openMenuIds.includes(order.id);

            return (
              <div
                key={order.id}
                className="overflow-hidden rounded-2xl border border-yellow-400/20 bg-zinc-950/95 shadow-2xl shadow-black"
              >
                <div className="border-b border-yellow-400/10 bg-gradient-to-r from-zinc-950 to-black p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-zinc-500">
                        오늘주문 #{getTodayOrderNumber(order.id)}
                      </div>

                      <div className="mt-1 truncate text-xl font-black text-yellow-400">
                        {order.customer || "고객"}
                      </div>
                    </div>

                    <div className="shrink-0 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1.5 text-xs font-black text-yellow-300">
                      배달중
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-yellow-400/10 bg-black p-2.5">
                      <div className="text-[11px] font-bold text-zinc-500">결제금액</div>
                      <div className="mt-1 text-lg font-black text-yellow-400">
                        {order.total.toLocaleString()}원
                      </div>
                    </div>

                    <div className="rounded-xl border border-yellow-400/10 bg-black p-2.5">
                      <div className="text-[11px] font-bold text-zinc-500">결제수단</div>
                      <div className="mt-1 truncate text-sm font-black text-yellow-300">
                        {order.payment_method || "미설정"}
                      </div>
                    </div>
                  </div>

                  {order.payment_method === "계좌이체" && (
                    <div className="mt-2 rounded-xl border border-yellow-400/40 bg-yellow-400/10 p-2 text-center text-sm font-black text-yellow-300">
                      입금확인 필요
                    </div>
                  )}
                </div>

                <div className="p-3">
                  <button
                    type="button"
                    onClick={() => toggleAddress(order.id)}
                    className="w-full rounded-xl border border-yellow-400/15 bg-black p-3 text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-zinc-500">
                          배달주소
                        </div>
                        <div className="mt-1 truncate text-sm font-black text-white">
                          {addressOpen ? order.address : shortAddress(order.address)}
                        </div>
                      </div>

                      <div className="shrink-0 text-xs font-black text-yellow-400">
                        {addressOpen ? "접기 ▲" : "열기 ▼"}
                      </div>
                    </div>
                  </button>

                  {addressOpen && (
                    <div className="mt-2 rounded-xl border border-yellow-400/10 bg-zinc-900 p-3">
                      <div className="text-base font-black leading-relaxed text-white">
                        {order.address}
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-lg bg-black p-2">
                          <div className="text-[11px] text-zinc-500">거리</div>
                          <div className="font-black text-yellow-400">
                            {Number(order.delivery_distance_km || 0).toFixed(1)}km
                          </div>
                        </div>

                        <div className="rounded-lg bg-black p-2">
                          <div className="text-[11px] text-zinc-500">배달비</div>
                          <div className="font-black text-yellow-400">
                            {(order.delivery_fee || 0).toLocaleString()}원
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => openKakaoMap(order.address)}
                      className="rounded-xl bg-yellow-400 p-3 text-sm font-black text-black"
                    >
                      카카오맵
                    </button>

                    <button
                      onClick={() => openNaverMap(order.address)}
                      className="rounded-xl border border-yellow-400/25 bg-black p-3 text-sm font-black text-yellow-300"
                    >
                      네이버맵
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleMenu(order.id)}
                    className="mt-2 w-full rounded-xl border border-yellow-400/15 bg-black p-3 text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-zinc-500">메뉴</div>
                        <div className="mt-1 truncate text-sm font-black text-white">
                          {getMenuSummary(order.menu)}
                        </div>
                      </div>

                      <div className="shrink-0 text-xs font-black text-yellow-400">
                        {menuOpen ? "접기 ▲" : "상세 ▼"}
                      </div>
                    </div>
                  </button>

                  {menuOpen && (
                    <div className="mt-2 space-y-2">
                      {lines.map((item, index) => (
                        <div key={index} className="rounded-xl border border-yellow-400/10 bg-zinc-900 p-2.5">
                          <div className="flex justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-black leading-tight">
                                {item.name}
                              </div>
                              <div className="mt-1 text-xs font-bold text-zinc-400">
                                수량 {item.qty}개
                              </div>

                              {item.options && item.options.length > 0 && (
                                <div className="mt-1.5 space-y-0.5 text-[11px] leading-relaxed text-zinc-400">
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

                            <div className="shrink-0 text-sm font-black text-yellow-400">
                              {Number(item.total || 0).toLocaleString()}원
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className="rounded-xl border border-yellow-400/10 bg-zinc-900 p-2.5">
                        <div className="mb-1 text-xs font-bold text-zinc-500">요청사항</div>
                        <div className="text-xs leading-relaxed text-zinc-300">
                          {order.memo?.trim() ? order.memo : "요청사항 없음"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-yellow-400/10 p-3">
                  <button
                    onClick={() => callCustomer(order.phone)}
                    className="rounded-xl border border-yellow-400/25 bg-black p-3 text-sm font-black text-yellow-300"
                  >
                    전화걸기
                  </button>

                  <button
                    onClick={() => completeDelivery(order)}
                    className="rounded-xl bg-yellow-400 p-3 text-sm font-black text-black"
                  >
                    배달완료
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
