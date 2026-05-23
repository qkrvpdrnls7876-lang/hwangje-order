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
  stamp_discount: number | null;
  used_stamp_reward: boolean | null;
  stamp_processed: boolean | null;
  payment_method: string | null;
  delivery_fee: number | null;
  delivery_distance_km: number | null;

  customer_order_count?: number;
  customer_type?: "new" | "existing" | "unknown";
  device_id?: string;
  device_info?: string;
};

type MenuOptionLine = {
  groupName: string;
  optionName: string;
  price: number;
};

type MenuLine = {
  name: string;
  qty: string;
  price: string;
  options: MenuOptionLine[];
};

type StampCustomer = {
  phone: string;
  stamp_count: number;
  total_orders: number;
};

type Customer = {
  phone: string;
  name: string | null;
  order_count: number | null;
};

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const [openOrderIds, setOpenOrderIds] = useState<number[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [popupOrder, setPopupOrder] = useState<Order | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const soundEnabledRef = useRef(false);
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firstLoadRef = useRef(true);
  const lastCountRef = useRef(0);

  const estimatedTimes = ["20분", "30분", "40분", "50분", "60분", "80분"];

  const cleanPhone = (phone: string) => phone.replace(/[^0-9]/g, "");

  const payableOrders = orders.filter((order) => order.status !== "주문취소");
  const todaySales = payableOrders.reduce((sum, order) => sum + order.total, 0);
  const waitingCount = orders.filter((order) => order.status === "접수대기").length;
  const acceptedCount = orders.filter((order) => order.status === "접수완료").length;
  const cookingCount = orders.filter((order) => order.status === "조리중").length;
  const deliveryCount = orders.filter((order) => order.status === "배달중").length;
  const transferCount = orders.filter(
    (order) =>
      order.payment_method === "계좌이체" &&
      order.status !== "완료" &&
      order.status !== "주문취소"
  ).length;

  const activeOrderCount = orders.filter(
    (order) =>
      order.status === "접수대기" ||
      order.status === "접수완료" ||
      order.status === "조리중"
  ).length;

  const getAutoEstimatedTime = (count: number) => {
    if (count <= 0) return "20분";
    if (count <= 3) return "25분";
    if (count <= 7) return "40분";
    if (count <= 12) return "60분";
    return "80분";
  };

  const autoEstimatedTime = getAutoEstimatedTime(activeOrderCount);

  const getTodayOrderNumber = (orderId: number) => {
    const sortedOrders = [...orders].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const index = sortedOrders.findIndex((order) => order.id === orderId);
    return index >= 0 ? index + 1 : orderId;
  };

  const isOrderLocked = (order: Order) => {
    return order.status === "완료" || order.status === "주문취소";
  };

  const canChangeStatus = (order: Order, nextStatus: string) => {
    if (isOrderLocked(order)) return false;

    if (nextStatus === "접수완료") return order.status === "접수대기";
    if (nextStatus === "주문취소") return order.status === "접수대기";

    if (nextStatus === "조리중") {
      return order.status === "접수대기" || order.status === "접수완료";
    }

    if (nextStatus === "배달중") {
      return (
        order.status === "접수대기" ||
        order.status === "접수완료" ||
        order.status === "조리중"
      );
    }

    if (nextStatus === "완료") {
      return order.status !== "완료" && order.status !== "주문취소";
    }

    return true;
  };

  const statusButtonClass = (order: Order, nextStatus: string, activeClass: string) => {
    if (!canChangeStatus(order, nextStatus)) {
      return "rounded-xl bg-zinc-800 py-3 font-bold text-zinc-500 cursor-not-allowed";
    }

    return activeClass;
  };

  const enableSound = async () => {
    try {
      if (!audioRef.current) return;

      await audioRef.current.play();
      audioRef.current.pause();
      audioRef.current.currentTime = 0;

      soundEnabledRef.current = true;
      setSoundEnabled(true);

      alert("알림음 켜짐");
    } catch {
      alert("브라우저가 소리를 막고 있음. 화면을 한 번 클릭 후 다시 눌러봐.");
    }
  };

  const requestNotification = async () => {
    if (!("Notification" in window)) {
      alert("이 브라우저는 알림을 지원하지 않습니다.");
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      alert("브라우저 알림 켜짐");
    } else {
      alert("알림 권한이 허용되지 않았습니다.");
    }
  };

  const speakOrder = (order: Order) => {
    if (!("speechSynthesis" in window)) return;

    const msg = new SpeechSynthesisUtterance(
      `신규 주문이 들어왔습니다. ${order.customer || "고객"}님 ${order.total.toLocaleString()}원 주문`
    );

    msg.lang = "ko-KR";
    msg.rate = 1;

    speechSynthesis.cancel();
    speechSynthesis.speak(msg);
  };

  const showBrowserNotification = (order: Order) => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    new Notification("🐧 황제떡볶이 신규 주문!", {
      body: `주문번호 #${order.id} / ${order.total.toLocaleString()}원`,
      icon: "/images/penguin-logo.png",
    });
  };

  const playAlarm = () => {
    if (!audioRef.current) return;

    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  };

  const startAlarm = () => {
    setNewOrderAlert(true);

    if (!soundEnabledRef.current) return;
    if (alarmIntervalRef.current) return;

    playAlarm();

    alarmIntervalRef.current = setInterval(() => {
      playAlarm();
    }, 3000);
  };

  const stopAlarm = () => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setNewOrderAlert(false);
  };

  const fetchOrders = async () => {
    const now = new Date();

    if (now.getHours() < 4) {
      now.setDate(now.getDate() - 1);
    }

    const startDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      4,
      0,
      0
    );

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      console.log(error);
      return;
    }

    const rawOrders = (data || []) as Order[];

    const phoneList = Array.from(
      new Set(rawOrders.map((order) => cleanPhone(order.phone)).filter(Boolean))
    );

    let customerMap = new Map<string, Customer>();

    if (phoneList.length > 0) {
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("phone,name,order_count")
        .in("phone", phoneList);

      if (!customersError && customersData) {
        customerMap = new Map(
          (customersData as Customer[]).map((customer) => [
            cleanPhone(customer.phone),
            customer,
          ])
        );
      }
    }

    const newData: Order[] = rawOrders.map((order) => {
      const phone = cleanPhone(order.phone);
      const customer = customerMap.get(phone);
      const orderCount = Number(customer?.order_count || 0);

      return {
        ...order,
        customer_order_count: orderCount,
        customer_type:
          orderCount <= 0 ? "unknown" : orderCount === 1 ? "new" : "existing",
      };
    });

    const activeCount = newData.filter(
      (order) =>
        order.status === "접수대기" ||
        order.status === "접수완료" ||
        order.status === "조리중"
    ).length;

    const nextAutoEstimatedTime = getAutoEstimatedTime(activeCount);

    const ordersNeedEstimatedTime = newData.filter(
      (order) => order.status === "접수대기" && !order.estimated_time
    );

    if (ordersNeedEstimatedTime.length > 0) {
      await Promise.all(
        ordersNeedEstimatedTime.map((order) =>
          supabase
            .from("orders")
            .update({ estimated_time: nextAutoEstimatedTime })
            .eq("id", order.id)
        )
      );

      for (const order of newData) {
        if (order.status === "접수대기" && !order.estimated_time) {
          order.estimated_time = nextAutoEstimatedTime;
        }
      }
    }

    if (!firstLoadRef.current && newData.length > lastCountRef.current) {
      const newest = newData[0];

      if (newest) {
        startAlarm();
        showBrowserNotification(newest);
        speakOrder(newest);
        setPopupOrder(newest);

        setOpenOrderIds((prev) =>
          prev.includes(newest.id) ? prev : [newest.id, ...prev]
        );
      }
    }

    firstLoadRef.current = false;
    lastCountRef.current = newData.length;
    setOrders(newData);
  };

  useEffect(() => {
    fetchOrders();

    const interval = setInterval(() => {
      fetchOrders();
    }, 3000);

    return () => {
      clearInterval(interval);
      stopAlarm();
    };
  }, []);

  const processStamp = async (order: Order) => {
    if (order.stamp_processed) return;

    const phone = cleanPhone(order.phone);

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

    const { error: orderError } = await supabase
      .from("orders")
      .update({
        stamp_processed: true,
      })
      .eq("id", order.id);

    if (orderError) {
      alert("스탬프 처리표시 실패: " + orderError.message);
    }
  };

  const changeStatus = async (order: Order, status: string) => {
    if (!canChangeStatus(order, status)) {
      alert("이미 처리된 주문이라 해당 상태로 변경할 수 없습니다.");
      return;
    }

    const { error } = await supabase.from("orders").update({ status }).eq("id", order.id);

    if (error) {
      alert(error.message);
      return;
    }

    if (status === "접수완료" || status === "주문취소") {
      stopAlarm();
    }

    if (status === "완료") {
      await processStamp(order);
    }

    fetchOrders();
  };

  const changeEstimatedTime = async (id: number, estimatedTime: string) => {
    const { error } = await supabase
      .from("orders")
      .update({
        estimated_time: estimatedTime,
      })
      .eq("id", id);

    if (error) {
      alert("예상시간 저장 실패: " + error.message);
      return;
    }

    fetchOrders();
  };

  const testPrintReceipt = async () => {
    const text = [
      "황제떡볶이",
      "------------------------------",
      "테스트 출력",
      "COM4 / 9600 / 58mm",
      "------------------------------",
      "오늘주문 #999",
      "시간 오후 08:18",
      "------------------------------",
      "국물떡볶이 x1",
      "  7,500원",
      "순대+내장 x1",
      "  8,000원",
      "------------------------------",
      "배달비 3,000",
      "결제 18,500원",
      "수단 테스트",
      "------------------------------",
      "전화 010-0000-0000",
      "주소",
      "전주시 테스트 주소",
      "요청",
      "CPP3000 테스트 출력입니다.",
      "------------------------------",
    ].join("\n");

    const electronPrinter = (window as any).hwangjePOS;

    if (electronPrinter?.printReceipt) {
      try {
        await electronPrinter.printReceipt(text);
        alert("테스트 출력 전송 완료");
        return;
      } catch (error) {
        alert(String(error));
        return;
      }
    }

    const printWindow = window.open("", "_blank", "width=300,height=720");

    if (!printWindow) {
      alert("팝업이 차단되었습니다. 팝업 허용 후 다시 눌러주세요.");
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>황제떡볶이 테스트 빌지</title>
          <style>
            @page {
              size: 58mm auto;
              margin: 2mm;
            }

            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 0;
              background: #fff;
              color: #000;
              font-family: "Courier New", "D2Coding", monospace;
              font-size: 11px;
              line-height: 1.15;
              font-weight: 700;
            }

            .receipt {
              width: 54mm;
              padding: 0;
              margin: 0 auto;
              white-space: pre-wrap;
              word-break: break-all;
            }

            .title {
              text-align: center;
              font-size: 16px;
              font-weight: 900;
              line-height: 1.05;
              margin: 0 0 2px;
            }

            .text {
              margin: 0;
              padding: 0;
              white-space: pre-wrap;
              word-break: break-all;
            }

            @media print {
              html,
              body {
                width: 58mm;
                margin: 0;
                padding: 0;
              }

              .receipt {
                width: 54mm;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="title">황제떡볶이</div>
            <pre class="text">${text.replace("황제떡볶이\n", "")}</pre>
          </div>
          <script>
            window.onload = function () {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  const toggleOpen = (id: number) => {
    setOpenOrderIds((prev) =>
      prev.includes(id) ? prev.filter((orderId) => orderId !== id) : [...prev, id]
    );
  };

  const getFraudInfo = (order: Order) => {
    const sameDeviceOrders = orders.filter(
      (o) => o.device_id && o.device_id === order.device_id
    );

    const differentPhones = new Set(sameDeviceOrders.map((o) => cleanPhone(o.phone)));

    return {
      sameDevice: sameDeviceOrders.length >= 3,
      phoneChanged: differentPhones.size >= 2,
      suspicious: sameDeviceOrders.length >= 3 && differentPhones.size >= 2,
    };
  };

  const getStatusColor = (status: string) => {
    if (status === "접수대기") return "bg-red-600 text-white";
    if (status === "접수완료") return "bg-orange-500 text-white";
    if (status === "조리중") return "bg-blue-600 text-white";
    if (status === "배달중") return "bg-green-600 text-white";
    if (status === "완료") return "bg-yellow-400 text-black";
    if (status === "주문취소") return "bg-zinc-700 text-white";
    return "bg-zinc-700 text-white";
  };

  const formatOrderTime = (dateText: string) => {
    const date = new Date(dateText);

    return date.toLocaleString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const menuLines = (menuText: string): MenuLine[] => {
    try {
      const parsed = JSON.parse(menuText) as {
        name: string;
        qty: number;
        total: number;
        options?: MenuOptionLine[];
      }[];

      return parsed.map((item) => ({
        name: item.name,
        qty: String(item.qty),
        price: item.total.toLocaleString() + "원",
        options: item.options || [],
      }));
    } catch {
      return [];
    }
  };

  const receiptText = (order: Order) => {
    const lines = menuLines(order.menu);
    const todayNo = getTodayOrderNumber(order.id);
    const time = formatOrderTime(order.created_at);
    const divider = "------------------------------";

    const menuText = lines
      .map((item) => {
        const options =
          item.options.length > 0
            ? item.options
                .map(
                  (option) =>
                    `  - ${option.groupName}:${option.optionName}${
                      option.price > 0 ? ` +${option.price.toLocaleString()}` : ""
                    }`
                )
                .join("\n")
            : "";

        return [`${item.name} x${item.qty}`, options, `  ${item.price}`]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n");

    const deliveryFee =
      order.delivery_fee !== null && order.delivery_fee !== undefined
        ? order.delivery_fee
        : 0;

    const stampDiscount =
      order.stamp_discount !== null && order.stamp_discount !== undefined
        ? order.stamp_discount
        : 0;

    const memo = order.memo?.trim() ? order.memo.trim() : "없음";

    return [
      `오늘주문 #${todayNo}`,
      `시간 ${time}`,
      divider,
      menuText,
      divider,
      `배달비 ${deliveryFee.toLocaleString()}`,
      stampDiscount > 0 ? `할인 -${stampDiscount.toLocaleString()}` : "",
      `결제 ${order.total.toLocaleString()}원`,
      `수단 ${order.payment_method || "미설정"}`,
      divider,
      `전화 ${order.phone}`,
      "주소",
      order.address,
      "요청",
      memo,
      divider,
    ]
      .filter(Boolean)
      .join("\n");
  };

  const printReceipt = (order: Order) => {
    const text = receiptText(order);
    const printWindow = window.open("", "_blank", "width=380,height=720");

    if (!printWindow) {
      alert("팝업이 차단되었습니다. 팝업 허용 후 다시 눌러주세요.");
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>황제떡볶이 빌지</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 2mm;
            }

            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 0;
              background: #fff;
              color: #000;
              font-family: "Courier New", "D2Coding", monospace;
              font-size: 12px;
              line-height: 1.15;
              font-weight: 700;
            }

            .receipt {
              width: 76mm;
              padding: 0;
              margin: 0 auto;
              white-space: pre-wrap;
              word-break: break-all;
            }

            .title {
              text-align: center;
              font-size: 18px;
              font-weight: 900;
              line-height: 1.05;
              margin: 0 0 2px;
            }

            .text {
              margin: 0;
              padding: 0;
              white-space: pre-wrap;
              word-break: break-all;
            }

            @media print {
              html,
              body {
                width: 80mm;
                margin: 0;
                padding: 0;
              }

              .receipt {
                width: 76mm;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="title">황제떡볶이</div>
            <pre class="text">${text.replace("황제떡볶이\n", "")}</pre>
          </div>
          <script>
            window.onload = function () {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#050505] bg-[radial-gradient(circle_at_top,#3b2f0b_0%,#050505_35%)] px-3 py-4 text-white sm:px-4 md:p-6">
      <div className="fixed right-4 top-4 z-50 hidden w-[210px] rounded-3xl border border-[#d4af3735] bg-black/85 p-3 shadow-[0_0_35px_rgba(212,175,55,.18)] backdrop-blur-xl xl:block">
        <div className="mb-2 rounded-2xl bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] px-3 py-2 text-center text-sm font-black text-black">
          황제 바로가기
        </div>

        <div className="grid gap-2">
          <a href="/admin/sales" target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-[#d4af3728] bg-[#080808] px-3 py-3 text-sm font-black text-[#f4d56d] shadow-[0_0_14px_rgba(212,175,55,.08)] transition hover:border-[#d4af37] hover:bg-[#17130a]">
            📊 매출관리
          </a>
          <a href="/admin/menu" target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-[#d4af3728] bg-[#080808] px-3 py-3 text-sm font-black text-[#f4d56d] shadow-[0_0_14px_rgba(212,175,55,.08)] transition hover:border-[#d4af37] hover:bg-[#17130a]">
            🍜 메뉴수정
          </a>
          <a href="/kitchen" target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-[#d4af3728] bg-[#080808] px-3 py-3 text-sm font-black text-[#f4d56d] shadow-[0_0_14px_rgba(212,175,55,.08)] transition hover:border-[#d4af37] hover:bg-[#17130a]">
            👨‍🍳 주방화면
          </a>
          <a href="/rider" target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-[#d4af3728] bg-[#080808] px-3 py-3 text-sm font-black text-[#f4d56d] shadow-[0_0_14px_rgba(212,175,55,.08)] transition hover:border-[#d4af37] hover:bg-[#17130a]">
            🛵 라이더화면
          </a>
        </div>
      </div>

      <audio ref={audioRef} preload="auto">
        <source src="/sounds/order.mp3" type="audio/mpeg" />
      </audio>

      {popupOrder && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 p-3 backdrop-blur">
          <div className="w-full max-w-lg rounded-3xl border border-[#d4af37] bg-gradient-to-b from-[#17130a] to-black p-5 shadow-[0_0_50px_rgba(212,175,55,.35)] sm:p-6">
            <div className="mb-3 text-center text-3xl font-black text-[#f4d56d] sm:text-4xl">
              🔔 신규 주문
            </div>

            <div className="mb-4 text-center text-sm font-bold text-zinc-400">
              포스 원격용 · 접수와 동시에 빌지를 출력할 수 있습니다
            </div>

            <div className="rounded-2xl bg-black/50 p-4">
              <div className="text-zinc-400">
                오늘주문 #{getTodayOrderNumber(popupOrder.id)}
              </div>
              <div className="mt-2 text-2xl font-black sm:text-3xl">{popupOrder.customer}</div>
              <div className="mt-2 text-xl text-[#f4d56d]">
                {popupOrder.total.toLocaleString()}원
              </div>
              <div className="mt-2 text-sm text-zinc-300">
                {menuLines(popupOrder.menu)[0]?.name || ""}
              </div>

              <div className="mt-3 rounded-xl border border-yellow-400/30 bg-black/70 p-3 text-sm font-black">
                {popupOrder.customer_type === "new" ? (
                  <span className="text-green-400">🆕 첫 주문 고객 · 1번째 주문</span>
                ) : popupOrder.customer_type === "existing" ? (
                  <span className="text-yellow-400">
                    ⭐ 기존 고객 · 🔥 {popupOrder.customer_order_count}번째 주문
                  </span>
                ) : (
                  <span className="text-zinc-400">고객 주문횟수 정보 없음</span>
                )}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
              <button
                onClick={() => {
                  printReceipt(popupOrder);
                  changeStatus(popupOrder, "접수완료");
                  setPopupOrder(null);
                }}
                className="rounded-2xl bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] py-4 text-sm font-black text-black shadow-[0_0_25px_rgba(212,175,55,.35)] sm:text-lg"
              >
                접수+빌지
              </button>

              <button
                onClick={() => {
                  const ok = confirm("주문 취소하시겠습니까?");
                  if (!ok) return;
                  changeStatus(popupOrder, "주문취소");
                  setPopupOrder(null);
                }}
                className="rounded-2xl bg-red-600 py-4 text-sm font-black text-white sm:text-lg"
              >
                취소
              </button>

              <button
                onClick={() => setPopupOrder(null)}
                className="rounded-2xl bg-zinc-700 py-4 text-sm font-black sm:text-lg"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-[1600px]">
        <div className="mb-4 rounded-3xl bg-zinc-900 p-4 sm:mb-6 sm:p-6">
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] bg-clip-text text-3xl font-black text-transparent sm:text-4xl">
                황제 관리자
              </h1>

              <p className="mt-2 text-sm text-zinc-400 sm:text-lg">
                새벽 3시 기준 오늘 영업일 주문만 표시
              </p>

              <div className="mt-3 inline-flex rounded-2xl border border-yellow-400/20 bg-black/60 px-4 py-2 text-sm font-black text-yellow-400 sm:text-lg">
                진행주문 {activeOrderCount}건 · 자동 예상 {autoEstimatedTime}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:hidden">
                <a href="/admin/sales" target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-[#d4af3735] bg-black/70 px-3 py-3 text-center text-sm font-black text-[#f4d56d]">
                  📊 매출
                </a>
                <a href="/admin/menu" target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-[#d4af3735] bg-black/70 px-3 py-3 text-center text-sm font-black text-[#f4d56d]">
                  🍜 메뉴
                </a>
                <a href="/kitchen" target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-[#d4af3735] bg-black/70 px-3 py-3 text-center text-sm font-black text-[#f4d56d]">
                  👨‍🍳 주방
                </a>
                <a href="/rider" target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-[#d4af3735] bg-black/70 px-3 py-3 text-center text-sm font-black text-[#f4d56d]">
                  🛵 라이더
                </a>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button onClick={enableSound} className={`rounded-xl px-3 py-2 text-sm font-black transition ${soundEnabled ? "bg-green-600 text-white" : "bg-yellow-400 text-black"}`}>
              {soundEnabled ? "🔊 ON" : "🔊 알림"}
            </button>

            <button onClick={requestNotification} className="rounded-xl bg-purple-600 px-3 py-2 text-sm font-black">
              🔔 푸시
            </button>

            <button onClick={playAlarm} className="rounded-xl bg-zinc-700 px-3 py-2 text-sm font-black">
              테스트
            </button>

            <button onClick={stopAlarm} className="rounded-xl bg-red-600 px-3 py-2 text-sm font-black">
              OFF
            </button>

            <button onClick={testPrintReceipt} className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-black">
              🧾 테스트출력
            </button>
          </div>
        </div>

        {/* 모바일 깨짐 수정 핵심: ml-8/mr-[260px] 제거, xl 이상에서만 우측 고정메뉴 여백 적용 */}
        <div className="mb-4 grid w-full grid-cols-2 gap-2 sm:mb-6 md:grid-cols-3 xl:mr-[240px] xl:grid-cols-6">
          <div className="min-w-0 rounded-xl border border-[#d4af3720] bg-[#0d0d0d]/95 p-3 shadow-[0_0_10px_rgba(212,175,55,.08)]">
            <div className="text-xs text-zinc-400">오늘 매출</div>
            <div className="mt-1 break-words text-lg font-black text-yellow-400">
              {todaySales.toLocaleString()}원
            </div>
          </div>

          <div className="min-w-0 rounded-xl border border-zinc-700 bg-zinc-900 p-3">
            <div className="text-xs text-zinc-400">주문</div>
            <div className="mt-1 text-lg font-black">{payableOrders.length}건</div>
          </div>

          <div className="min-w-0 rounded-xl border border-red-500/30 bg-zinc-900 p-3">
            <div className="text-xs text-zinc-400">대기/접수</div>
            <div className="mt-1 text-lg font-black text-red-400">
              {waitingCount + acceptedCount}건
            </div>
          </div>

          <div className="min-w-0 rounded-xl border border-blue-500/30 bg-zinc-900 p-3">
            <div className="text-xs text-zinc-400">조리중</div>
            <div className="mt-1 text-lg font-black text-blue-400">{cookingCount}건</div>
          </div>

          <div className="min-w-0 rounded-xl border border-green-500/30 bg-zinc-900 p-3">
            <div className="text-xs text-zinc-400">배달/입금</div>
            <div className="mt-1 text-lg font-black text-green-400">
              {deliveryCount}/{transferCount}
            </div>
          </div>

          <div className="min-w-0 rounded-xl border border-yellow-400/30 bg-zinc-900 p-3">
            <div className="text-xs text-zinc-400">자동 예상</div>
            <div className="mt-1 text-lg font-black text-yellow-400">
              {autoEstimatedTime}
            </div>
          </div>
        </div>

        {newOrderAlert && (
          <div className="mb-5 rounded-xl bg-red-600 p-4 text-center font-black">
            🔔 신규 주문 들어옴
          </div>
        )}

        <div className="space-y-4 xl:mr-[240px]">
          {orders.map((order) => {
            const isOpen = openOrderIds.includes(order.id);

            return (
              <div
                key={order.id}
                className="overflow-hidden rounded-3xl border border-[#d4af3735] bg-gradient-to-b from-[#111111] to-[#050505] shadow-[0_0_20px_rgba(212,175,55,0.12)] transition-all duration-300 hover:border-[#d4af37] hover:shadow-[0_0_35px_rgba(212,175,55,0.28)]"
              >
                <div className="bg-zinc-900 p-4 sm:p-5">
                  <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-zinc-500">
                        오늘주문 #{getTodayOrderNumber(order.id)} · 🕒{" "}
                        {formatOrderTime(order.created_at)}
                      </div>

                      <div className="break-words text-2xl font-black">
                        {order.customer}
                      </div>

                      <div className="mt-2 inline-flex rounded-xl border border-yellow-400/30 bg-black/70 px-3 py-2 text-sm font-black">
                        {order.customer_type === "new" ? (
                          <span className="text-green-400">🆕 첫 주문 고객 · 1번째 주문</span>
                        ) : order.customer_type === "existing" ? (
                          <span className="text-yellow-400">
                            ⭐ 기존 고객 · 🔥 {order.customer_order_count}번째 주문
                          </span>
                        ) : (
                          <span className="text-zinc-400">고객 주문횟수 정보 없음</span>
                        )}
                      </div>
                    </div>

                    <div className={`h-fit w-fit rounded-xl px-4 py-2 text-sm font-black ${getStatusColor(order.status)}`}>
                      {order.status}
                    </div>
                  </div>

                  <div className="break-words text-zinc-300">📞 {order.phone}</div>
                  <div className="break-words text-zinc-300">📍 {order.address}</div>

                  {(() => {
                    const fraud = getFraudInfo(order);
                    return (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {fraud.sameDevice && (
                          <div className="rounded-xl bg-orange-600 px-3 py-2 text-sm font-black">
                            ⚠ 같은 기기 반복
                          </div>
                        )}

                        {fraud.phoneChanged && (
                          <div className="rounded-xl bg-red-500 px-3 py-2 text-sm font-black">
                            ⚠ 번호만 변경
                          </div>
                        )}

                        {fraud.suspicious && (
                          <div className="animate-pulse rounded-xl bg-red-700 px-3 py-2 text-sm font-black">
                            🚨 의심 주문
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <div
                      className={`rounded-xl px-3 py-2 text-sm font-black ${
                        order.payment_method === "계좌이체"
                          ? "bg-green-600 text-white"
                          : order.payment_method === "만나서 카드결제"
                            ? "bg-blue-600 text-white"
                            : order.payment_method === "만나서 현금결제"
                              ? "bg-yellow-400 text-black"
                              : "bg-zinc-700 text-white"
                      }`}
                    >
                      💳 결제: {order.payment_method || "미설정"}
                    </div>

                    {order.payment_method === "계좌이체" && (
                      <div className="rounded-xl bg-red-600 px-3 py-2 text-sm font-black text-white">
                        ⚠️ 입금확인 필요
                      </div>
                    )}
                  </div>

                  <div className="mt-3 rounded-xl border border-zinc-800 bg-black/60 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="text-sm font-black text-yellow-400">메뉴상세</div>
                      <button onClick={() => toggleOpen(order.id)} className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-black">
                        {isOpen ? "요청접기" : "요청보기"}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                      {menuLines(order.menu).map((item, index) => (
                        <div key={index} className="rounded-lg bg-zinc-900 p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1 text-sm font-black leading-tight text-white">
                              {item.name}
                            </div>

                            <div className="shrink-0 rounded-md bg-yellow-400 px-2 py-0.5 text-xs font-black text-black">
                              x{item.qty}
                            </div>
                          </div>

                          {item.options.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {item.options.map((option, optionIndex) => (
                                <div key={optionIndex} className="rounded-md bg-black/80 px-2 py-1 text-[12px] font-bold leading-tight text-zinc-300">
                                  <span className="text-zinc-500">{option.groupName}: </span>
                                  <span>{option.optionName}</span>
                                  {option.price > 0 && (
                                    <span className="text-yellow-400">
                                      {" "}
                                      +{option.price.toLocaleString()}원
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="mt-2 text-right text-sm font-black text-yellow-400">
                            {item.price}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row">
                    <div>
                      <div className="text-zinc-400">총 결제금액</div>

                      <div className="text-3xl font-black text-yellow-400">
                        {order.total.toLocaleString()}원
                      </div>

                      {order.delivery_fee !== null && order.delivery_fee !== undefined && (
                        <div className="mt-1 text-sm font-bold text-zinc-400">
                          배달비 {order.delivery_fee.toLocaleString()}원
                          {order.delivery_distance_km !== null &&
                            order.delivery_distance_km !== undefined &&
                            ` (${Number(order.delivery_distance_km).toFixed(1)}km)`}
                        </div>
                      )}

                      {order.stamp_discount && order.stamp_discount > 0 && (
                        <div className="mt-1 text-sm font-bold text-green-400">
                          스탬프 할인 {order.stamp_discount.toLocaleString()}원 사용
                        </div>
                      )}

                      <div className="mt-2 text-sm font-bold text-green-400">
                        예상시간: {order.estimated_time || "미설정"}
                      </div>

                      <div className="mt-1 text-xs text-zinc-500">
                        스탬프 처리: {order.stamp_processed ? "완료" : "미처리"}
                      </div>
                    </div>

                    <button onClick={() => toggleOpen(order.id)} className="h-fit w-full rounded-xl bg-zinc-800 px-4 py-3 font-bold sm:w-auto">
                      {isOpen ? "요청접기" : "요청보기"}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-zinc-800 p-3">
                    <div className="rounded-lg bg-zinc-900 p-3">
                      <div className="mb-1 text-sm text-zinc-400">요청사항</div>
                      <div className="text-sm leading-relaxed">
                        {order.memo?.trim() ? order.memo : "요청사항 없음"}
                      </div>
                    </div>
                  </div>
                )}

                <div className="border-t border-zinc-800 p-4">
                  <div className="mb-3 text-sm font-bold text-zinc-400">예상시간 설정</div>

                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {estimatedTimes.map((time) => (
                      <button
                        key={time}
                        onClick={() => changeEstimatedTime(order.id, time)}
                        className={`rounded-xl py-3 font-bold ${
                          order.estimated_time === time ? "bg-green-600" : "bg-zinc-700"
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 p-4 md:grid-cols-3 2xl:grid-cols-6">
                  <button disabled={!canChangeStatus(order, "접수완료")} onClick={() => changeStatus(order, "접수완료")} className={statusButtonClass(order, "접수완료", "rounded-xl bg-orange-500 py-3 font-bold")}>
                    접수
                  </button>

                  <button disabled={!canChangeStatus(order, "조리중")} onClick={() => changeStatus(order, "조리중")} className={statusButtonClass(order, "조리중", "rounded-xl bg-blue-600 py-3 font-bold")}>
                    조리중
                  </button>

                  <button disabled={!canChangeStatus(order, "배달중")} onClick={() => changeStatus(order, "배달중")} className={statusButtonClass(order, "배달중", "rounded-xl bg-green-600 py-3 font-bold")}>
                    배달중
                  </button>

                  <button disabled={!canChangeStatus(order, "완료")} onClick={() => changeStatus(order, "완료")} className={statusButtonClass(order, "완료", "rounded-xl bg-yellow-400 py-3 font-bold text-black")}>
                    완료
                  </button>

                  <button onClick={() => printReceipt(order)} className="rounded-xl border border-[#d4af37] bg-gradient-to-b from-[#302300] to-[#0d0d0d] py-3 font-black text-[#f4d56d] shadow-[0_0_15px_rgba(212,175,55,.3)] hover:shadow-[0_0_25px_rgba(212,175,55,.6)]">
                    빌지출력
                  </button>

                  <button
                    disabled={!canChangeStatus(order, "주문취소")}
                    onClick={() => {
                      const ok = confirm("주문 취소하시겠습니까?");
                      if (ok) {
                        changeStatus(order, "주문취소");
                      }
                    }}
                    className={statusButtonClass(order, "주문취소", "rounded-xl bg-zinc-700 py-3 font-bold")}
                  >
                    취소
                  </button>
                </div>
              </div>
            );
          })}

          {orders.length === 0 && (
            <div className="rounded-3xl bg-zinc-900 p-8 text-center text-zinc-400">
              오늘 영업일 주문이 없습니다.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}