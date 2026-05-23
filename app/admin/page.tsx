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
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "waiting" | "processing" | "done" | "cancel">("all");

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
        setSelectedOrderId(newest.id);

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

  const printReceipt = async (order: Order) => {
    const text = receiptText(order);
    const electronPrinter = (window as any).hwangjePOS;

    if (!electronPrinter?.printReceipt) {
      alert("황제POS.exe에서 실행해야 COM4 빌지 자동출력이 됩니다. 현재는 브라우저/PWA라서 직접출력을 사용할 수 없습니다.");
      return false;
    }

    try {
      await electronPrinter.printReceipt(`황제떡볶이\n${text}`);
      return true;
    } catch (error) {
      alert("빌지 출력 실패: " + String(error));
      return false;
    }
  };


  const filteredOrders = orders.filter((order) => {
    if (activeFilter === "waiting") return order.status === "접수대기";
    if (activeFilter === "processing") {
      return (
        order.status === "접수완료" ||
        order.status === "조리중" ||
        order.status === "배달중"
      );
    }
    if (activeFilter === "done") return order.status === "완료";
    if (activeFilter === "cancel") return order.status === "주문취소";
    return true;
  });

  const selectedOrder =
    orders.find((order) => order.id === selectedOrderId) || filteredOrders[0] || orders[0] || null;

  const selectedOrderLines = selectedOrder ? menuLines(selectedOrder.menu) : [];
  const selectedFraud = selectedOrder ? getFraudInfo(selectedOrder) : null;
  const vipCount = orders.filter((order) => Number(order.customer_order_count || 0) >= 5).length;
  const riderStatusText = deliveryCount > 0 ? `${deliveryCount}건 배달중` : "배달 대기";

  const filterButtonClass = (filter: typeof activeFilter) =>
    `w-full rounded-2xl px-4 py-3 text-left text-sm font-black transition ${
      activeFilter === filter
        ? "border border-[#d4af37] bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] text-black shadow-[0_0_25px_rgba(212,175,55,.24)]"
        : "border border-[#d4af3724] bg-[#090909] text-[#f4d56d] hover:border-[#d4af37] hover:bg-[#17130a]"
    }`;

  const compactStatusColor = (status: string) => {
    if (status === "접수대기") return "border-red-400/50 bg-red-950/35 text-red-200";
    if (status === "접수완료") return "border-orange-400/50 bg-orange-950/35 text-orange-200";
    if (status === "조리중") return "border-blue-400/50 bg-blue-950/35 text-blue-200";
    if (status === "배달중") return "border-green-400/50 bg-green-950/35 text-green-200";
    if (status === "완료") return "border-[#d4af37]/50 bg-[#2a2108] text-[#f4d56d]";
    if (status === "주문취소") return "border-zinc-600 bg-zinc-900 text-zinc-400";
    return "border-zinc-700 bg-zinc-900 text-zinc-300";
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#050505] text-white">
      <audio ref={audioRef} preload="auto">
        <source src="/sounds/order.mp3" type="audio/mpeg" />
      </audio>

      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,#4a3809_0%,#090806_28%,#050505_60%)]" />
      <div className="fixed inset-0 z-0 bg-[linear-gradient(135deg,rgba(212,175,55,.08),transparent_36%,rgba(212,175,55,.05))]" />

      {popupOrder && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/82 p-4 backdrop-blur-md">
          <div className="w-full max-w-xl rounded-[32px] border border-[#d4af37] bg-gradient-to-b from-[#17130a] to-black p-6 shadow-[0_0_80px_rgba(212,175,55,.38)]">
            <div className="text-center text-4xl font-black text-[#f4d56d]">
              🔔 신규 주문
            </div>

            <div className="mt-2 text-center text-sm font-bold text-zinc-400">
              접수하면 COM4 빌지가 자동 출력됩니다
            </div>

            <div className="mt-5 rounded-3xl border border-[#d4af3730] bg-black/60 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-zinc-500">
                    오늘주문 #{getTodayOrderNumber(popupOrder.id)} · {formatOrderTime(popupOrder.created_at)}
                  </div>
                  <div className="mt-2 text-3xl font-black text-white">
                    {popupOrder.customer || "고객"}
                  </div>
                  <div className="mt-2 text-lg font-black text-[#f4d56d]">
                    {popupOrder.total.toLocaleString()}원
                  </div>
                </div>

                <div className={`rounded-2xl border px-4 py-2 text-sm font-black ${compactStatusColor(popupOrder.status)}`}>
                  {popupOrder.status}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-[#d4af3724] bg-[#080808] p-4">
                <div className="text-sm font-black text-[#f4d56d]">대표 메뉴</div>
                <div className="mt-1 text-base font-bold text-zinc-200">
                  {menuLines(popupOrder.menu)[0]?.name || "메뉴정보 없음"}
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-yellow-400/25 bg-black/70 p-3 text-sm font-black">
                {popupOrder.customer_type === "new" ? (
                  <span className="text-green-400">🆕 첫 주문 고객 · 1번째 주문</span>
                ) : popupOrder.customer_type === "existing" ? (
                  <span className="text-yellow-400">
                    🔥 기존 고객 · {popupOrder.customer_order_count}번째 주문
                  </span>
                ) : (
                  <span className="text-zinc-400">고객 주문횟수 정보 없음</span>
                )}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <button
                onClick={async () => {
                  await printReceipt(popupOrder);
                  await changeStatus(popupOrder, "접수완료");
                  setPopupOrder(null);
                }}
                className="rounded-2xl bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] py-4 text-lg font-black text-black shadow-[0_0_30px_rgba(212,175,55,.32)]"
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
                className="rounded-2xl bg-red-600 py-4 text-lg font-black text-white"
              >
                취소
              </button>

              <button
                onClick={() => setPopupOrder(null)}
                className="rounded-2xl bg-zinc-700 py-4 text-lg font-black"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {newOrderAlert && (
        <div className="fixed bottom-6 right-6 z-[900] w-[330px] rounded-3xl border border-[#d4af37] bg-black/92 p-4 shadow-[0_0_50px_rgba(212,175,55,.32)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] text-2xl">
              🔔
            </div>
            <div>
              <div className="text-base font-black text-[#f4d56d]">신규 주문 들어옴</div>
              <div className="text-xs font-bold text-zinc-400">확인 후 접수하면 빌지가 출력됩니다</div>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 grid h-screen grid-cols-[250px_minmax(420px,1fr)_430px] gap-4 p-4">
        <aside className="flex min-h-0 flex-col rounded-[32px] border border-[#d4af3728] bg-black/78 p-4 shadow-[0_0_55px_rgba(212,175,55,.10)] backdrop-blur-xl">
          <div className="mb-5 rounded-3xl border border-[#d4af3730] bg-gradient-to-b from-[#1b1405] to-[#070707] p-4">
            <div className="text-3xl font-black tracking-[-0.06em] text-[#f4d56d]">황제POS</div>
            <div className="mt-1 text-xs font-bold text-zinc-500">BLACK GOLD ADMIN</div>
          </div>

          <nav className="space-y-2">
            <button onClick={() => setActiveFilter("all")} className={filterButtonClass("all")}>🏠 전체 주문</button>
            <button onClick={() => setActiveFilter("waiting")} className={filterButtonClass("waiting")}>🟡 신규 주문 {waitingCount}</button>
            <button onClick={() => setActiveFilter("processing")} className={filterButtonClass("processing")}>📦 진행 주문 {activeOrderCount}</button>
            <button onClick={() => setActiveFilter("done")} className={filterButtonClass("done")}>✅ 완료 주문</button>
            <button onClick={() => setActiveFilter("cancel")} className={filterButtonClass("cancel")}>🚫 취소 주문</button>
          </nav>

          <div className="mt-5 grid gap-2">
            <a href="/admin/sales" target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-[#d4af3724] bg-[#090909] px-4 py-3 text-sm font-black text-[#f4d56d] hover:border-[#d4af37]">📊 매출관리</a>
            <a href="/admin/menu" target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-[#d4af3724] bg-[#090909] px-4 py-3 text-sm font-black text-[#f4d56d] hover:border-[#d4af37]">🍜 메뉴관리</a>
            <a href="/kitchen" target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-[#d4af3724] bg-[#090909] px-4 py-3 text-sm font-black text-[#f4d56d] hover:border-[#d4af37]">👨‍🍳 주방화면</a>
            <a href="/rider" target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-[#d4af3724] bg-[#090909] px-4 py-3 text-sm font-black text-[#f4d56d] hover:border-[#d4af37]">🛵 라이더화면</a>
          </div>

          <div className="mt-auto rounded-3xl border border-[#d4af3724] bg-[#080808] p-4">
            <div className="text-xs font-bold text-zinc-500">프린터</div>
            <div className="mt-1 text-sm font-black text-[#f4d56d]">COM4 · 9600 · CPP3000</div>
            <button onClick={testPrintReceipt} className="mt-3 w-full rounded-2xl bg-emerald-700 px-3 py-3 text-sm font-black">🧾 테스트출력</button>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col gap-4">
          <header className="rounded-[32px] border border-[#d4af3728] bg-black/78 p-4 shadow-[0_0_55px_rgba(212,175,55,.10)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] bg-clip-text text-4xl font-black tracking-[-0.06em] text-transparent">
                  주문 관리
                </h1>
                <p className="mt-1 text-sm font-bold text-zinc-500">새벽 4시 기준 오늘 영업일 주문 · 3초 자동 갱신</p>
              </div>

              <div className="flex gap-2">
                <button onClick={enableSound} className={`rounded-2xl px-4 py-3 text-sm font-black ${soundEnabled ? "bg-green-600 text-white" : "bg-[#d4af37] text-black"}`}>
                  {soundEnabled ? "🔊 알림 ON" : "🔊 알림 켜기"}
                </button>
                <button onClick={requestNotification} className="rounded-2xl bg-purple-700 px-4 py-3 text-sm font-black">🔔 푸시</button>
                <button onClick={playAlarm} className="rounded-2xl bg-zinc-800 px-4 py-3 text-sm font-black">테스트</button>
                <button onClick={stopAlarm} className="rounded-2xl bg-red-700 px-4 py-3 text-sm font-black">OFF</button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-5 gap-3">
              <div className="rounded-3xl border border-[#d4af3726] bg-[#090909] p-4">
                <div className="text-xs font-bold text-zinc-500">💰 오늘매출</div>
                <div className="mt-1 text-2xl font-black text-[#f4d56d]">{todaySales.toLocaleString()}원</div>
              </div>
              <div className="rounded-3xl border border-[#d4af3726] bg-[#090909] p-4">
                <div className="text-xs font-bold text-zinc-500">📦 진행주문</div>
                <div className="mt-1 text-2xl font-black text-white">{activeOrderCount}건</div>
              </div>
              <div className="rounded-3xl border border-[#d4af3726] bg-[#090909] p-4">
                <div className="text-xs font-bold text-zinc-500">🛵 라이더 상태</div>
                <div className="mt-1 text-xl font-black text-green-400">{riderStatusText}</div>
              </div>
              <div className="rounded-3xl border border-[#d4af3726] bg-[#090909] p-4">
                <div className="text-xs font-bold text-zinc-500">🔥 VIP</div>
                <div className="mt-1 text-2xl font-black text-[#f4d56d]">{vipCount}명</div>
              </div>
              <div className="rounded-3xl border border-[#d4af3726] bg-[#090909] p-4">
                <div className="text-xs font-bold text-zinc-500">⏱ 자동예상</div>
                <div className="mt-1 text-2xl font-black text-[#f4d56d]">{autoEstimatedTime}</div>
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:#d4af37_#111]">
            <div className="grid gap-3">
              {filteredOrders.map((order) => {
                const isSelected = selectedOrder?.id === order.id;
                const isNew = order.status === "접수대기";
                const isVip = Number(order.customer_order_count || 0) >= 5;
                const fraud = getFraudInfo(order);
                const firstMenu = menuLines(order.menu)[0];

                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`rounded-[28px] border bg-gradient-to-b from-[#111111] to-[#060606] p-4 text-left shadow-[0_0_18px_rgba(212,175,55,.08)] transition hover:border-[#d4af37] ${
                      isSelected ? "border-[#d4af37] shadow-[0_0_35px_rgba(212,175,55,.22)]" : "border-[#d4af3724]"
                    } ${isNew ? "animate-pulse" : ""} ${isVip ? "ring-2 ring-[#d4af37]/60" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-zinc-500">
                          오늘주문 #{getTodayOrderNumber(order.id)} · {formatOrderTime(order.created_at)}
                        </div>
                        <div className="mt-1 truncate text-2xl font-black text-white">{order.customer || "고객"}</div>
                        <div className="mt-2 truncate text-sm font-bold text-zinc-400">{firstMenu?.name || "메뉴정보 없음"}</div>
                      </div>

                      <div className="text-right">
                        <div className={`inline-flex rounded-2xl border px-3 py-1.5 text-xs font-black ${compactStatusColor(order.status)}`}>
                          {order.status}
                        </div>
                        <div className="mt-2 text-xl font-black text-[#f4d56d]">{order.total.toLocaleString()}원</div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {order.customer_type === "new" && <span className="rounded-full bg-green-700 px-3 py-1 text-xs font-black">🆕 첫주문</span>}
                      {order.customer_type === "existing" && <span className="rounded-full bg-[#2a2108] px-3 py-1 text-xs font-black text-[#f4d56d]">🔥 {order.customer_order_count}번째</span>}
                      {isVip && <span className="rounded-full bg-gradient-to-r from-[#fff1a8] to-[#d4af37] px-3 py-1 text-xs font-black text-black">VIP</span>}
                      {order.payment_method === "계좌이체" && <span className="rounded-full bg-red-700 px-3 py-1 text-xs font-black">입금확인</span>}
                      {fraud.suspicious && <span className="rounded-full bg-red-800 px-3 py-1 text-xs font-black">🚨 의심</span>}
                    </div>
                  </button>
                );
              })}

              {filteredOrders.length === 0 && (
                <div className="rounded-[28px] border border-[#d4af3724] bg-black/70 p-10 text-center text-zinc-500">
                  표시할 주문이 없습니다.
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col rounded-[32px] border border-[#d4af3728] bg-black/82 shadow-[0_0_55px_rgba(212,175,55,.10)] backdrop-blur-xl">
          {selectedOrder ? (
            <>
              <div className="border-b border-[#d4af3724] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-zinc-500">선택 주문</div>
                    <div className="mt-1 text-3xl font-black text-[#f4d56d]">
                      #{getTodayOrderNumber(selectedOrder.id)}
                    </div>
                  </div>

                  <div className={`rounded-2xl border px-3 py-2 text-sm font-black ${compactStatusColor(selectedOrder.status)}`}>
                    {selectedOrder.status}
                  </div>
                </div>

                <div className="mt-4 rounded-3xl border border-[#d4af3724] bg-[#090909] p-4">
                  <div className="text-2xl font-black text-white">{selectedOrder.customer || "고객"}</div>
                  <div className="mt-2 break-words text-sm font-bold text-zinc-400">📞 {selectedOrder.phone}</div>
                  <div className="mt-1 break-words text-sm font-bold text-zinc-400">📍 {selectedOrder.address}</div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedOrder.customer_type === "new" ? (
                    <span className="rounded-full bg-green-700 px-3 py-1 text-xs font-black">🆕 첫 주문 고객</span>
                  ) : selectedOrder.customer_type === "existing" ? (
                    <span className="rounded-full bg-[#2a2108] px-3 py-1 text-xs font-black text-[#f4d56d]">🔥 {selectedOrder.customer_order_count}번째 주문</span>
                  ) : (
                    <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-black text-zinc-400">고객정보 없음</span>
                  )}

                  {Number(selectedOrder.customer_order_count || 0) >= 5 && (
                    <span className="rounded-full bg-gradient-to-r from-[#fff1a8] to-[#d4af37] px-3 py-1 text-xs font-black text-black">VIP GOLD</span>
                  )}

                  {selectedFraud?.sameDevice && <span className="rounded-full bg-orange-700 px-3 py-1 text-xs font-black">같은 기기 반복</span>}
                  {selectedFraud?.phoneChanged && <span className="rounded-full bg-red-700 px-3 py-1 text-xs font-black">번호 변경</span>}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5 [scrollbar-width:thin] [scrollbar-color:#d4af37_#111]">
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-lg font-black text-[#f4d56d]">메뉴 상세</div>
                  <div className="text-sm font-black text-zinc-500">{formatOrderTime(selectedOrder.created_at)}</div>
                </div>

                <div className="space-y-3">
                  {selectedOrderLines.map((item, index) => (
                    <div key={index} className="rounded-3xl border border-[#d4af3722] bg-[#080808] p-4">
                      <div className="flex justify-between gap-3">
                        <div className="text-base font-black text-white">{item.name}</div>
                        <div className="rounded-xl bg-[#d4af37] px-3 py-1 text-xs font-black text-black">x{item.qty}</div>
                      </div>

                      {item.options.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {item.options.map((option, optionIndex) => (
                            <div key={optionIndex} className="rounded-2xl bg-black px-3 py-2 text-xs font-bold text-zinc-300">
                              <span className="text-zinc-500">{option.groupName}: </span>
                              {option.optionName}
                              {option.price > 0 && <span className="text-[#f4d56d]"> +{option.price.toLocaleString()}원</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 text-right text-lg font-black text-[#f4d56d]">{item.price}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-3xl border border-[#d4af3722] bg-[#080808] p-4">
                  <div className="mb-2 text-sm font-black text-zinc-500">요청사항</div>
                  <div className="break-words text-sm font-bold leading-relaxed text-zinc-200">
                    {selectedOrder.memo?.trim() ? selectedOrder.memo : "요청사항 없음"}
                  </div>
                </div>

                <div className="mt-4 rounded-3xl border border-[#d4af3722] bg-[#080808] p-4">
                  <div className="flex justify-between text-sm font-bold text-zinc-400">
                    <span>배달비</span>
                    <span>{Number(selectedOrder.delivery_fee || 0).toLocaleString()}원</span>
                  </div>
                  <div className="mt-2 flex justify-between text-sm font-bold text-zinc-400">
                    <span>거리</span>
                    <span>{selectedOrder.delivery_distance_km !== null && selectedOrder.delivery_distance_km !== undefined ? Number(selectedOrder.delivery_distance_km).toFixed(1) : "0.0"}km</span>
                  </div>
                  {selectedOrder.stamp_discount && selectedOrder.stamp_discount > 0 && (
                    <div className="mt-2 flex justify-between text-sm font-bold text-green-400">
                      <span>스탬프 할인</span>
                      <span>-{selectedOrder.stamp_discount.toLocaleString()}원</span>
                    </div>
                  )}
                  <div className="mt-4 border-t border-[#d4af3724] pt-4">
                    <div className="text-sm font-bold text-zinc-500">총 결제금액</div>
                    <div className="text-4xl font-black text-[#f4d56d]">{selectedOrder.total.toLocaleString()}원</div>
                    <div className="mt-1 text-sm font-black text-zinc-400">수단: {selectedOrder.payment_method || "미설정"}</div>
                  </div>
                </div>

                <div className="mt-4 rounded-3xl border border-[#d4af3722] bg-[#080808] p-4">
                  <div className="mb-3 text-sm font-black text-zinc-500">예상시간</div>
                  <div className="grid grid-cols-3 gap-2">
                    {estimatedTimes.map((time) => (
                      <button
                        key={time}
                        onClick={() => changeEstimatedTime(selectedOrder.id, time)}
                        className={`rounded-2xl py-3 text-sm font-black ${selectedOrder.estimated_time === time ? "bg-green-600" : "bg-zinc-800"}`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-[#d4af3724] p-4">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={!canChangeStatus(selectedOrder, "접수완료")}
                    onClick={async () => {
                      await printReceipt(selectedOrder);
                      await changeStatus(selectedOrder, "접수완료");
                    }}
                    className={statusButtonClass(selectedOrder, "접수완료", "rounded-2xl bg-orange-500 py-3 font-black")}
                  >
                    접수+출력
                  </button>

                  <button
                    onClick={async () => {
                      await printReceipt(selectedOrder);
                    }}
                    className="rounded-2xl border border-[#d4af37] bg-gradient-to-b from-[#302300] to-[#0d0d0d] py-3 font-black text-[#f4d56d]"
                  >
                    빌지출력
                  </button>

                  <button disabled={!canChangeStatus(selectedOrder, "조리중")} onClick={() => changeStatus(selectedOrder, "조리중")} className={statusButtonClass(selectedOrder, "조리중", "rounded-2xl bg-blue-600 py-3 font-black")}>조리중</button>
                  <button disabled={!canChangeStatus(selectedOrder, "배달중")} onClick={() => changeStatus(selectedOrder, "배달중")} className={statusButtonClass(selectedOrder, "배달중", "rounded-2xl bg-green-600 py-3 font-black")}>배달중</button>
                  <button disabled={!canChangeStatus(selectedOrder, "완료")} onClick={() => changeStatus(selectedOrder, "완료")} className={statusButtonClass(selectedOrder, "완료", "rounded-2xl bg-[#d4af37] py-3 font-black text-black")}>완료</button>
                  <button
                    disabled={!canChangeStatus(selectedOrder, "주문취소")}
                    onClick={() => {
                      const ok = confirm("주문 취소하시겠습니까?");
                      if (ok) changeStatus(selectedOrder, "주문취소");
                    }}
                    className={statusButtonClass(selectedOrder, "주문취소", "rounded-2xl bg-zinc-700 py-3 font-black")}
                  >
                    취소
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center text-zinc-500">
              <div>
                <div className="text-5xl">🐧</div>
                <div className="mt-3 text-xl font-black text-[#f4d56d]">선택된 주문이 없습니다</div>
                <div className="mt-1 text-sm">주문이 들어오면 이곳에 상세정보가 표시됩니다.</div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
