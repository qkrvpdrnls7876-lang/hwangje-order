"use client";

// OrderStatusPage 바로 아래에 추


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
};

type MenuItem = {
  name: string;
  qty: number;
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
  const [displayOrderNumber, setDisplayOrderNumber] =
    useState<number | null>(null);

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

    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      4,
      0,
      0
    );
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
      const index = (todayOrders || []).findIndex(
        (item) => item.id === data.id
      );

      setDisplayOrderNumber(index >= 0 ? index + 1 : data.id);
    }

    setOrder(data);
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
      return "bg-zinc-800 text-zinc-500";
    }

    if (index <= currentIndex) {
      return "bg-yellow-400 text-black";
    }

    return "bg-zinc-800 text-zinc-500";
  };

  const menuLines = (): MenuItem[] => {
    if (!order) return [];

    try {
      return JSON.parse(order.menu) as MenuItem[];
    } catch {
      return [];
    }
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
        <div className="rounded-3xl bg-zinc-900 p-8 text-center">
          <div className="text-3xl font-black text-red-500">
            주문을 찾을 수 없습니다.
          </div>

          <div className="mt-3 text-zinc-400">
            주문번호를 다시 확인해주세요.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black p-4 text-white md:p-6">
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/images/space-bg.png')",
        }}
      />

      <div className="fixed inset-0 z-0 bg-black/60" />

      <div className="relative z-10 mx-auto max-w-2xl">
        <div className="mb-6 rounded-3xl border border-yellow-400/20 bg-black/80 p-6 text-center shadow-2xl backdrop-blur">
          <img
            src="/images/penguin-logo.png"
            alt="황제떡볶이"
            className="mx-auto mb-4 w-32 object-contain drop-shadow-[0_0_50px_rgba(250,204,21,.8)]"
          />

          <div className="text-sm text-zinc-400">오늘 주문번호</div>

          <h1 className="mt-2 text-5xl font-black text-yellow-400">
            #{displayOrderNumber || order.id}
          </h1>

          <div className="mt-2 text-xs text-zinc-500">
            실제 주문 ID: {order.id}
          </div>

          <div className="mt-4 text-2xl font-black">  
            {order.customer || "고객"}님 주문상태
          </div>

          <div className="mt-4 rounded-2xl bg-zinc-950 p-5">
            <div className="text-sm text-zinc-400">현재 상태</div>

            <div
              className={`mt-2 text-4xl font-black ${
                order.status === "주문취소"
                  ? "text-red-500"
                  : "text-yellow-400"
              }`}
            >
              {order.status}
            </div>

            <div className="mt-3 text-lg font-bold text-green-400">
              예상시간: {order.estimated_time || "확인 중"}
            </div>
          </div>
        </div>

        {order.status === "주문취소" ? (
          <div className="mb-6 rounded-3xl bg-red-600 p-5 text-center text-xl font-black">
            주문이 취소되었습니다.
          </div>
        ) : (
          <div className="mb-6 grid grid-cols-5 gap-2">
            {steps.map((step, index) => (
              <div
                key={step}
                className={`rounded-2xl p-3 text-center text-xs font-black md:text-sm ${getStepStyle(
                  index
                )}`}
              >
                {step}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}