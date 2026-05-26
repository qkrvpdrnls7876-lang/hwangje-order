"use client";

export const runtime = "edge";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Order = {
  id: number;
  customer: string;
  phone: string;
  address: string;
  menu: string;
  total: number;
  status: string;
  memo: string | null;
  estimated_time: string | null;
  created_at: string;
  payment_method?: string | null;
  delivery_fee?: number | null;
  delivery_distance_km?: number | null;
  stamp_discount?: number | null;
  earned_stamps?: number | null;
  used_stamps?: number | null;
};

type MenuItem = {
  name: string;
  qty: number;
  basePrice?: number;
  total: number;
  options?: {
    groupName: string;
    optionName: string;
    price: number;
  }[];
};

export default function OrderStatusPage() {
  const [orderId, setOrderId] = useState<number>(0);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayOrderNumber, setDisplayOrderNumber] = useState<number | null>(
    null,
  );

  useEffect(() => {
    const path = window.location.pathname;
    const parts = path.split("/");
    const id = parts[parts.length - 1];

    setOrderId(Number(id));
  }, []);

  const getBusinessStartDate = () => {
    const now = new Date();

    if (now.getHours() < 4) {
      now.setDate(now.getDate() - 1);
    }

    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 4, 0, 0);
  };

  const fetchOrder = async () => {
    if (!orderId || Number.isNaN(orderId)) {
      setOrder(null);
      setDisplayOrderNumber(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();

    if (error || !data) {
      console.log(error);
      setOrder(null);
      setDisplayOrderNumber(null);
      setLoading(false);
      return;
    }

    const startDate = getBusinessStartDate();

    const { data: todayOrders, error: todayError } = await supabase
      .from("orders")
      .select("id, created_at")
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: true });

    if (todayError) {
      console.log(todayError);
      setDisplayOrderNumber(data.id);
    } else {
      const index = (todayOrders || []).findIndex((item) => item.id === data.id);
      setDisplayOrderNumber(index >= 0 ? index + 1 : data.id);
    }

    setOrder(data as Order);
    setLoading(false);
  };

  useEffect(() => {
    if (!orderId) return;

    fetchOrder();

    const interval = setInterval(() => {
      fetchOrder();
    }, 3000);

    return () => clearInterval(interval);
  }, [orderId]);

  const steps = ["접수대기", "접수완료", "조리중", "배달중", "완료"];
  const currentIndex = order ? steps.indexOf(order.status) : -1;

  const getStepStyle = (index: number) => {
    if (!order || order.status === "주문취소") {
      return "bg-zinc-900 text-zinc-600 border-zinc-800";
    }

    if (index <= currentIndex) {
      return "bg-[#d4af37] text-black border-[#f4d56d]";
    }

    return "bg-zinc-900 text-zinc-500 border-zinc-800";
  };

  const menuLines = (): MenuItem[] => {
    if (!order) return [];

    try {
      return JSON.parse(order.menu) as MenuItem[];
    } catch {
      return [];
    }
  };

  const formatDateTime = (dateText: string) => {
    return new Date(dateText).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusMessage = () => {
    if (!order) return "";

    if (order.status === "주문취소") {
      return "주문이 취소되었습니다. 자세한 내용은 매장으로 문의해주세요.";
    }

    if (order.status === "접수대기") {
      return "주문이 들어왔습니다. 매장에서 곧 확인합니다.";
    }

    if (order.status === "접수완료") {
      return "매장에서 주문을 확인했습니다.";
    }

    if (order.status === "조리중") {
      return "맛있게 조리 중입니다.";
    }

    if (order.status === "배달중") {
      return "라이더가 출발했습니다.";
    }

    if (order.status === "완료") {
      return "배달이 완료되었습니다. 맛있게 드세요.";
    }

    return "주문 상태를 확인 중입니다.";
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        주문 정보를 불러오는 중...
      </main>
    );
  }

  if (!order) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
        <div className="rounded-3xl border border-red-500/30 bg-zinc-950 p-8 text-center">
          <div className="text-3xl font-black text-red-400">주문을 찾을 수 없습니다.</div>
          <div className="mt-3 text-zinc-400">주문번호를 다시 확인해주세요.</div>
          <a
            href="/"
            className="mt-6 inline-block rounded-2xl bg-[#d4af37] px-6 py-3 font-black text-black"
          >
            홈으로
          </a>
        </div>
      </main>
    );
  }

  const lines = menuLines();
  const earnedStamps = Number(order.earned_stamps || 0);
  const usedStamps = Number(order.used_stamps || 0);
  const stampDiscount = Number(order.stamp_discount || 0);
  const deliveryFee = Number(order.delivery_fee || 0);
  const menuTotal = Math.max(Number(order.total || 0) + stampDiscount - deliveryFee, 0);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] px-4 py-5 text-[#fff8d9]">
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/space-bg.png')" }}
      />
      <div className="fixed inset-0 z-0 bg-[#050505]/82" />

      <div className="relative z-10 mx-auto w-full max-w-[620px]">
        <section className="rounded-[30px] border border-[#d4af3735] bg-gradient-to-b from-[#151007]/95 via-black/86 to-[#050505]/96 p-5 text-center shadow-[0_0_42px_rgba(212,175,55,.16)] backdrop-blur-xl">
          <img
            src="/images/penguin-logo.png"
            alt="황제떡볶이"
            className="mx-auto w-[130px] object-contain drop-shadow-[0_0_42px_rgba(212,175,55,.75)]"
          />

          <div className="mt-4 text-[14px] font-black text-zinc-500">오늘 주문번호</div>
          <h1 className="mt-1 text-[64px] font-black leading-none tracking-[-0.08em] text-[#f4d56d]">
            #{displayOrderNumber || order.id}
          </h1>

          <div className="mt-2 text-[12px] font-bold text-zinc-600">실제 주문 ID: {order.id}</div>

          <div className="mt-5 rounded-3xl border border-[#d4af3728] bg-[#080808] p-5">
            <div className="text-[15px] font-black text-zinc-500">현재 상태</div>
            <div
              className={`mt-2 text-[40px] font-black tracking-[-0.07em] ${
                order.status === "주문취소" ? "text-red-400" : "text-[#f4d56d]"
              }`}
            >
              {order.status}
            </div>
            <div className="mt-2 break-keep text-[17px] font-bold text-zinc-300">{getStatusMessage()}</div>
            <div className="mt-3 text-[17px] font-black text-emerald-300">
              예상시간: {order.estimated_time || "확인 중"}
            </div>
          </div>
        </section>

        {order.status === "주문취소" ? (
          <section className="mt-4 rounded-[24px] border border-red-500/30 bg-red-950/50 p-5 text-center text-[22px] font-black text-red-200">
            주문이 취소되었습니다.
          </section>
        ) : (
          <section className="mt-4 grid grid-cols-5 gap-2">
            {steps.map((step, index) => (
              <div
                key={step}
                className={`rounded-2xl border p-3 text-center text-[12px] font-black leading-tight ${getStepStyle(index)}`}
              >
                {step}
              </div>
            ))}
          </section>
        )}

        <section className="mt-4 rounded-[28px] border border-[#d4af3728] bg-[#080808]/94 p-5 shadow-2xl shadow-black/70 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[12px] font-black uppercase tracking-[0.18em] text-[#d4af37]">ORDER DETAIL</div>
              <h2 className="mt-1 text-[27px] font-black tracking-[-0.06em] text-[#fff8d9]">주문내역</h2>
            </div>
            <div className="text-right text-[13px] font-bold text-zinc-500">{formatDateTime(order.created_at)}</div>
          </div>

          <div className="mt-4 divide-y divide-[#ffffff0d] rounded-2xl border border-[#d4af3718] bg-[#050505]">
            {lines.map((item, index) => (
              <div key={`${item.name}-${index}`} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="break-keep text-[20px] font-black text-[#fff8d9]">
                      {item.name} <span className="text-[#f4d56d]">x{item.qty}</span>
                    </div>
                    {item.options && item.options.length > 0 && (
                      <div className="mt-2 space-y-1 text-[14px] font-bold text-zinc-500">
                        {item.options.map((option, optionIndex) => (
                          <div key={optionIndex}>
                            - {option.groupName}: {option.optionName}
                            {option.price > 0 && ` +${option.price.toLocaleString()}원`}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-[19px] font-black text-[#f4d56d]">
                    {Number(item.total || 0).toLocaleString()}원
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-[#d4af3718] bg-[#050505] p-4">
            <div className="flex justify-between text-[16px] font-bold text-zinc-400">
              <span>메뉴금액</span>
              <span>{menuTotal.toLocaleString()}원</span>
            </div>
            <div className="mt-2 flex justify-between text-[16px] font-bold text-zinc-400">
              <span>배달비</span>
              <span>{deliveryFee.toLocaleString()}원</span>
            </div>
            {stampDiscount > 0 && (
              <div className="mt-2 flex justify-between text-[16px] font-black text-emerald-300">
                <span>스탬프 할인</span>
                <span>-{stampDiscount.toLocaleString()}원</span>
              </div>
            )}
            <div className="mt-3 border-t border-[#ffffff12] pt-3 flex justify-between text-[22px] font-black text-[#f4d56d]">
              <span>결제금액</span>
              <span>{Number(order.total || 0).toLocaleString()}원</span>
            </div>
          </div>
        </section>

        {(earnedStamps > 0 || usedStamps > 0) && (
          <section className="mt-4 rounded-[28px] border border-[#d4af3728] bg-[#080808]/94 p-5 shadow-2xl shadow-black/70 backdrop-blur-xl">
            <div className="text-[12px] font-black uppercase tracking-[0.18em] text-[#d4af37]">STAMP BENEFIT</div>
            <h2 className="mt-1 text-[27px] font-black tracking-[-0.06em] text-[#fff8d9]">스탬프 혜택</h2>

            <div className="mt-4 grid gap-3">
              {earnedStamps > 0 && (
                <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/25 p-4">
                  <div className="text-[17px] font-black text-emerald-300">이번 주문 적립</div>
                  <div className="mt-1 text-[30px] font-black tracking-[-0.06em] text-emerald-200">
                    +{earnedStamps}개
                  </div>
                </div>
              )}

              {usedStamps > 0 && (
                <div className="rounded-2xl border border-red-500/25 bg-red-950/25 p-4">
                  <div className="text-[17px] font-black text-red-300">이번 주문 사용</div>
                  <div className="mt-1 text-[30px] font-black tracking-[-0.06em] text-red-200">
                    -{usedStamps}개
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="mt-4 rounded-[28px] border border-[#d4af3728] bg-[#080808]/94 p-5 shadow-2xl shadow-black/70 backdrop-blur-xl">
          <div className="text-[12px] font-black uppercase tracking-[0.18em] text-[#d4af37]">DELIVERY INFO</div>
          <div className="mt-3 space-y-3 text-[15px] font-bold text-zinc-400">
            <div>
              <div className="text-zinc-600">주소</div>
              <div className="mt-1 break-keep text-[16px] text-zinc-300">{order.address}</div>
            </div>
            {order.memo && (
              <div>
                <div className="text-zinc-600">요청사항/결제메모</div>
                <div className="mt-1 break-keep text-[16px] text-zinc-300">{order.memo}</div>
              </div>
            )}
            {order.payment_method && (
              <div className="flex justify-between">
                <span className="text-zinc-600">결제수단</span>
                <span className="text-zinc-300">{order.payment_method}</span>
              </div>
            )}
            {typeof order.delivery_distance_km === "number" && (
              <div className="flex justify-between">
                <span className="text-zinc-600">거리</span>
                <span className="text-zinc-300">{Number(order.delivery_distance_km || 0).toFixed(1)}km</span>
              </div>
            )}
          </div>
        </section>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <a
            href="/"
            className="rounded-2xl bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] p-4 text-center text-[17px] font-black text-black"
          >
            다시 주문
          </a>
          <a
            href="/stamp"
            className="rounded-2xl border border-[#d4af3735] bg-[#050505]/90 p-4 text-center text-[17px] font-black text-[#f4d56d]"
          >
            스탬프 조회
          </a>
        </div>
      </div>
    </main>
  );
}
