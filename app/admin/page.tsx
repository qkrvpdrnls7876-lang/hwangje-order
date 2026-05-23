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
  const [activeTab, setActiveTab] = useState<"active" | "waiting" | "done">("active");
  const [toastOrder, setToastOrder] = useState<Order | null>(null);

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
        setToastOrder(newest);
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
    if (activeTab === "waiting") return order.status === "접수대기";
    if (activeTab === "done") return order.status === "완료";
    return order.status !== "완료" && order.status !== "주문취소";
  });

  const selectedOrder =
    orders.find((order) => order.id === selectedOrderId) || filteredOrders[0] || orders[0] || null;

  const selectedLines = selectedOrder ? menuLines(selectedOrder.menu) : [];
  const selectedMenuTotal = selectedLines.reduce((sum, line) => {
    const price = Number(line.price.replace(/[^0-9]/g, "")) || 0;
    return sum + price;
  }, 0);

  const vipCount = orders.filter((order) => Number(order.customer_order_count || 0) >= 5).length;
  const doneCount = orders.filter((order) => order.status === "완료").length;
  const riderStatus = deliveryCount > 0 ? `배달중 ${deliveryCount}건` : "대기중";

  const statusStepIndex = (status: string) => {
    if (status === "접수대기") return 0;
    if (status === "접수완료") return 1;
    if (status === "조리중") return 2;
    if (status === "배달중") return 3;
    if (status === "완료") return 4;
    return 0;
  };

  const premiumStatusClass = (status: string) => {
    if (status === "접수대기") return "border-amber-500/50 bg-amber-500/10 text-amber-300";
    if (status === "접수완료") return "border-orange-500/40 bg-orange-500/10 text-orange-300";
    if (status === "조리중") return "border-sky-500/40 bg-sky-500/10 text-sky-300";
    if (status === "배달중") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    if (status === "완료") return "border-lime-500/40 bg-lime-500/10 text-lime-300";
    if (status === "주문취소") return "border-zinc-600 bg-zinc-900 text-zinc-500";
    return "border-zinc-700 bg-zinc-900 text-zinc-300";
  };

  const acceptWithPrint = async (order: Order) => {
    await printReceipt(order);
    await changeStatus(order, "접수완료");
  };

  const actionButtonClass = (order: Order, nextStatus: string, tone: string) => {
    if (!canChangeStatus(order, nextStatus)) {
      return "rounded-[10px] border border-zinc-800 bg-zinc-900/80 px-4 py-3 text-sm font-bold text-zinc-600 cursor-not-allowed";
    }

    if (tone === "gold") {
      return "rounded-[10px] border border-[#d4af37]/60 bg-[#d4af37] px-4 py-3 text-sm font-black text-black transition hover:bg-[#f0c75a]";
    }

    if (tone === "line") {
      return "rounded-[10px] border border-[#d4af37]/35 bg-[#111111] px-4 py-3 text-sm font-bold text-[#d4af37] transition hover:border-[#d4af37] hover:bg-[#191307]";
    }

    if (tone === "danger") {
      return "rounded-[10px] border border-red-500/35 bg-red-950/40 px-4 py-3 text-sm font-bold text-red-300 transition hover:bg-red-900/50";
    }

    return "rounded-[10px] border border-zinc-700 bg-[#151515] px-4 py-3 text-sm font-bold text-zinc-200 transition hover:border-zinc-500";
  };

  useEffect(() => {
    if (!toastOrder) return;

    const timer = setTimeout(() => {
      setToastOrder(null);
    }, 6500);

    return () => clearTimeout(timer);
  }, [toastOrder]);

  useEffect(() => {
    if (!selectedOrderId && orders.length > 0) {
      setSelectedOrderId(orders[0].id);
    }
  }, [orders, selectedOrderId]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#070707] pt-9 text-zinc-100">
      <div className="fixed left-0 right-0 top-0 z-[1200] flex h-9 items-center justify-between border-b border-[#d4af3720] bg-[#080808]/98 px-3 text-xs text-zinc-400 backdrop-blur-xl [-webkit-app-region:drag]">
        <div className="flex items-center gap-2 font-black tracking-[-0.03em] text-[#d4af37]">
          <span className="h-2 w-2 rounded-full bg-[#d4af37] shadow-[0_0_12px_rgba(212,175,55,.85)]" />
          <span>황제POS</span>
          <span className="hidden text-[10px] font-bold text-zinc-600 sm:inline">관리자</span>
        </div>

        <div className="flex items-center gap-1 [-webkit-app-region:no-drag]">
          <button
            type="button"
            onClick={() => (window as any).hwangjePOS?.minimizeWindow?.()}
            className="flex h-7 w-9 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
            aria-label="최소화"
          >
            —
          </button>

          <button
            type="button"
            onClick={() => (window as any).hwangjePOS?.toggleMaximizeWindow?.()}
            className="flex h-7 w-9 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
            aria-label="최대화"
          >
            □
          </button>

          <button
            type="button"
            onClick={() => (window as any).hwangjePOS?.closeWindow?.()}
            className="flex h-7 w-9 items-center justify-center rounded-md text-zinc-400 transition hover:bg-red-600 hover:text-white"
            aria-label="닫기"
          >
            ×
          </button>
        </div>
      </div>

      <audio ref={audioRef} preload="auto">
        <source src="/sounds/order.mp3" type="audio/mpeg" />
      </audio>

      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[228px_minmax(380px,480px)_1fr]">
        <aside className="hidden border-r border-[#d4af37]/15 bg-[linear-gradient(180deg,#111111_0%,#070707_100%)] lg:flex lg:flex-col">
          <div className="border-b border-[#d4af37]/10 px-6 py-7">
            <div className="text-[11px] font-black tracking-[0.28em] text-[#d4af37]">HWANGJEE</div>
            <div className="mt-1 text-4xl font-black tracking-[-0.08em] text-[#f0d98a]">POS</div>
            <div className="mt-1 text-xs font-bold text-[#d4af37]/80">황제떡볶이 효자점</div>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-5">
            <button className="flex w-full items-center justify-between rounded-[10px] border border-[#d4af37]/20 bg-[#d4af37]/10 px-4 py-3 text-sm font-bold text-[#f0d98a]">
              <span>처리 중</span>
              <span className="rounded-full bg-[#d4af37] px-2 py-0.5 text-xs text-black">{activeOrderCount}</span>
            </button>

            <button onClick={() => setActiveTab("waiting")} className="flex w-full items-center justify-between rounded-[10px] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white">
              <span>신규 주문</span>
              <span className="text-[#d4af37]">{waitingCount}</span>
            </button>

            <button onClick={() => setActiveTab("active")} className="flex w-full items-center justify-between rounded-[10px] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white">
              <span>진행 주문</span>
              <span className="text-[#d4af37]">{activeOrderCount}</span>
            </button>

            <button onClick={() => setActiveTab("done")} className="flex w-full items-center justify-between rounded-[10px] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white">
              <span>완료 주문</span>
              <span className="text-[#d4af37]">{doneCount}</span>
            </button>

            <div className="my-4 border-t border-zinc-800" />

            <a href="/admin/sales" className="block rounded-[10px] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white">매출 관리</a>
            <a href="/admin/menu" className="block rounded-[10px] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white">메뉴 관리</a>
            <a href="/rider" className="block rounded-[10px] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white">라이더 관리</a>
            <a href="/kitchen" className="block rounded-[10px] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white">주방 모니터</a>
          </nav>

          <div className="mx-4 mb-4 rounded-[12px] border border-[#d4af37]/20 bg-black/40 p-4">
            <div className="text-xs font-bold text-zinc-500">오늘 매출</div>
            <div className="mt-1 text-2xl font-black tracking-[-0.05em] text-[#f0d98a]">{todaySales.toLocaleString()}원</div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-zinc-500">주문</div>
                <div className="font-black text-zinc-100">{payableOrders.length}건</div>
              </div>
              <div>
                <div className="text-zinc-500">VIP</div>
                <div className="font-black text-[#d4af37]">{vipCount}명</div>
              </div>
            </div>
          </div>
        </aside>

        <section className="flex min-h-screen flex-col border-r border-zinc-800/80 bg-[#0b0b0b]">
          <header className="border-b border-zinc-800 bg-[#0c0c0c] px-4 py-4 lg:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-zinc-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_14px_rgba(16,185,129,.8)]" />
                  <span>{activeOrderCount}1개 영업 중</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500">새벽 3시 기준 오늘 영업일 주문</div>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={enableSound} className={`rounded-[9px] border px-3 py-2 text-xs font-black ${soundEnabled ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-[#d4af37]/35 bg-[#15120a] text-[#d4af37]"}`}>
                  {soundEnabled ? "음량 ON" : "음량"}
                </button>
                <button onClick={requestNotification} className="rounded-[9px] border border-zinc-700 bg-[#111111] px-3 py-2 text-xs font-black text-zinc-300">푸시</button>
                <button onClick={testPrintReceipt} className="rounded-[9px] border border-[#d4af37]/35 bg-[#111111] px-3 py-2 text-xs font-black text-[#d4af37]">테스트출력</button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-4 gap-1 border-b border-zinc-800 text-sm font-bold">
              <button onClick={() => setActiveTab("waiting")} className={`border-b-2 px-2 pb-3 ${activeTab === "waiting" ? "border-[#d4af37] text-[#f0d98a]" : "border-transparent text-zinc-500"}`}>신규 {waitingCount}</button>
              <button onClick={() => setActiveTab("active")} className={`border-b-2 px-2 pb-3 ${activeTab === "active" ? "border-[#d4af37] text-[#f0d98a]" : "border-transparent text-zinc-500"}`}>진행 {activeOrderCount}</button>
              <button onClick={() => setActiveTab("done")} className={`border-b-2 px-2 pb-3 ${activeTab === "done" ? "border-[#d4af37] text-[#f0d98a]" : "border-transparent text-zinc-500"}`}>완료 {doneCount}</button>
              <div className="border-b-2 border-transparent px-2 pb-3 text-center text-zinc-500">입금 {transferCount}</div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-5">
            <div className="mb-3 flex items-center justify-between text-sm">
              <div className="font-bold text-zinc-400">최신순</div>
              <div className="rounded-full border border-zinc-800 px-3 py-1 text-xs font-bold text-zinc-500">자동 예상 {autoEstimatedTime}</div>
            </div>

            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const fraud = getFraudInfo(order);
                const isSelected = selectedOrder?.id === order.id;
                const isVip = Number(order.customer_order_count || 0) >= 5;
                const isNewWaiting = order.status === "접수대기";

                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`w-full rounded-[12px] border bg-[#101010] p-4 text-left transition ${
                      isSelected
                        ? "border-[#d4af37]/80 bg-[#12100a]"
                        : isVip
                          ? "border-[#d4af37]/40 hover:border-[#d4af37]/70"
                          : "border-zinc-800 hover:border-zinc-600"
                    } ${isNewWaiting ? "animate-pulse" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-md border px-2 py-1 text-[11px] font-black ${premiumStatusClass(order.status)}`}>{order.status}</span>
                          {isVip && <span className="rounded-md border border-[#d4af37]/40 bg-[#d4af37]/10 px-2 py-1 text-[11px] font-black text-[#d4af37]">VIP</span>}
                          {fraud.suspicious && <span className="rounded-md border border-red-500/40 bg-red-950/40 px-2 py-1 text-[11px] font-black text-red-300">주의</span>}
                        </div>

                        <div className="mt-3 text-2xl font-black tracking-[-0.05em] text-zinc-100">#{getTodayOrderNumber(order.id)} · {order.customer || "고객"}</div>
                        <div className="mt-1 truncate text-sm text-zinc-400">{order.phone}</div>
                        <div className="mt-2 text-sm font-bold text-zinc-300">{menuLines(order.menu)[0]?.name || "메뉴정보"}</div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-xs text-zinc-500">{formatOrderTime(order.created_at)}</div>
                        <div className="mt-5 rounded-[10px] border border-zinc-700 bg-black/40 px-3 py-2">
                          <div className="text-[11px] text-zinc-500">픽업까지</div>
                          <div className="text-xl font-black text-[#f0d98a]">{order.estimated_time || autoEstimatedTime}</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-3 text-sm">
                      <span className="text-zinc-500">총 {menuLines(order.menu).length}개 · {order.payment_method || "결제미정"}</span>
                      <span className="font-black text-[#f0d98a]">{order.total.toLocaleString()}원</span>
                    </div>
                  </button>
                );
              })}

              {filteredOrders.length === 0 && (
                <div className="rounded-[12px] border border-zinc-800 bg-[#101010] p-10 text-center text-sm font-bold text-zinc-500">
                  표시할 주문이 없습니다.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="min-h-screen overflow-y-auto bg-[#090909]">
          <header className="border-b border-zinc-800 bg-[#0b0b0b] px-5 py-4 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                <div className="rounded-[10px] border border-zinc-800 bg-[#111111] px-3 py-2"><span className="text-zinc-500">매출</span><div className="mt-1 font-black text-[#f0d98a]">{todaySales.toLocaleString()}원</div></div>
                <div className="rounded-[10px] border border-zinc-800 bg-[#111111] px-3 py-2"><span className="text-zinc-500">진행</span><div className="mt-1 font-black text-zinc-100">{activeOrderCount}건</div></div>
                <div className="rounded-[10px] border border-zinc-800 bg-[#111111] px-3 py-2"><span className="text-zinc-500">라이더</span><div className="mt-1 font-black text-[#f0d98a]">{riderStatus}</div></div>
                <div className="rounded-[10px] border border-zinc-800 bg-[#111111] px-3 py-2"><span className="text-zinc-500">자동예상</span><div className="mt-1 font-black text-zinc-100">{autoEstimatedTime}</div></div>
              </div>

              <div className="hidden items-center gap-2 lg:flex">
                <a href="/admin/sales" className="rounded-[9px] border border-zinc-700 px-3 py-2 text-xs font-black text-zinc-300 hover:border-[#d4af37]/50">매출</a>
                <a href="/admin/menu" className="rounded-[9px] border border-zinc-700 px-3 py-2 text-xs font-black text-zinc-300 hover:border-[#d4af37]/50">메뉴</a>
                <a href="/rider" className="rounded-[9px] border border-zinc-700 px-3 py-2 text-xs font-black text-zinc-300 hover:border-[#d4af37]/50">라이더</a>
              </div>
            </div>
          </header>

          {selectedOrder ? (
            <div className="px-5 py-5 lg:px-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-black text-[#d4af37]">주문번호</div>
                  <div className="mt-2 text-5xl font-black tracking-[-0.08em] text-zinc-100">#{getTodayOrderNumber(selectedOrder.id)}</div>
                  <div className="mt-2 text-sm text-zinc-500">주문 시간 {formatOrderTime(selectedOrder.created_at)}</div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => printReceipt(selectedOrder)} className="rounded-[10px] border border-[#d4af37]/40 bg-[#111111] px-4 py-3 text-sm font-black text-[#d4af37] transition hover:bg-[#17130a]">영수증 출력</button>
                  <button onClick={() => window.open(`tel:${selectedOrder.phone}`)} className="rounded-[10px] border border-zinc-700 bg-[#111111] px-4 py-3 text-sm font-black text-zinc-200 transition hover:border-zinc-500">고객 전화</button>
                </div>
              </div>

              <div className="mt-6 grid gap-3 xl:grid-cols-[1.2fr_.9fr_.7fr]">
                <div className="rounded-[12px] border border-zinc-800 bg-[#101010] p-4">
                  <div className="text-xs font-black text-zinc-500">고객</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="text-2xl font-black text-[#f0d98a]">{selectedOrder.customer || "고객"}</div>
                    {Number(selectedOrder.customer_order_count || 0) >= 5 && <span className="rounded-md border border-[#d4af37]/40 bg-[#d4af37]/10 px-2 py-1 text-xs font-black text-[#d4af37]">VIP</span>}
                    <span className="rounded-md border border-zinc-700 px-2 py-1 text-xs font-bold text-zinc-400">{selectedOrder.customer_order_count || 0}번째 주문</span>
                  </div>
                  <div className="mt-3 text-sm text-zinc-300">{selectedOrder.phone}</div>
                  <div className="mt-3 rounded-[10px] border border-zinc-800 bg-black/35 p-3 text-sm leading-relaxed text-zinc-300">{selectedOrder.address}</div>
                </div>

                <div className="rounded-[12px] border border-zinc-800 bg-[#101010] p-4">
                  <div className="text-xs font-black text-zinc-500">주문 유형</div>
                  <div className="mt-2 text-lg font-black text-zinc-100">배달 / {selectedOrder.payment_method || "결제미정"}</div>
                  <div className="mt-3 text-sm text-zinc-400">배달비 {Number(selectedOrder.delivery_fee || 0).toLocaleString()}원</div>
                  <div className="mt-1 text-sm text-zinc-400">거리 {Number(selectedOrder.delivery_distance_km || 0).toFixed(1)}km</div>
                  {selectedOrder.payment_method === "계좌이체" && <div className="mt-3 rounded-[9px] border border-red-500/35 bg-red-950/30 px-3 py-2 text-sm font-black text-red-300">입금 확인 필요</div>}
                </div>

                <div className="rounded-[12px] border border-zinc-800 bg-[#101010] p-4">
                  <div className="text-xs font-black text-zinc-500">주문 상태</div>
                  <div className={`mt-2 inline-flex rounded-md border px-2 py-1 text-xs font-black ${premiumStatusClass(selectedOrder.status)}`}>{selectedOrder.status}</div>
                  <div className="mt-4 space-y-3">
                    {["접수", "조리", "배달", "완료"].map((label, index) => (
                      <div key={label} className="flex items-center gap-3 text-sm">
                        <span className={`h-3 w-3 rounded-full border ${statusStepIndex(selectedOrder.status) > index ? "border-[#d4af37] bg-[#d4af37]" : "border-zinc-600 bg-[#0a0a0a]"}`} />
                        <span className={statusStepIndex(selectedOrder.status) > index ? "text-[#d4af37]" : "text-zinc-500"}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-[12px] border border-zinc-800 bg-[#101010]">
                <div className="border-b border-zinc-800 px-5 py-4 text-lg font-black text-[#f0d98a]">주문 내역</div>
                <div className="divide-y divide-zinc-800">
                  {selectedLines.map((item, index) => (
                    <div key={index} className="grid grid-cols-[1fr_80px_120px] gap-3 px-5 py-4 text-sm">
                      <div>
                        <div className="font-black text-zinc-100">{item.name}</div>
                        {item.options.length > 0 && (
                          <div className="mt-2 space-y-1 text-xs text-zinc-500">
                            {item.options.map((option, optionIndex) => (
                              <div key={optionIndex}>- {option.groupName}: {option.optionName}{option.price > 0 ? ` +${option.price.toLocaleString()}원` : ""}</div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-center font-black text-[#d4af37]">{item.qty}</div>
                      <div className="text-right font-black text-zinc-100">{item.price}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 border-t border-zinc-800 px-5 py-4 text-sm">
                  <div className="flex justify-between text-zinc-400"><span>상품 금액</span><span>{selectedMenuTotal.toLocaleString()}원</span></div>
                  <div className="flex justify-between text-zinc-400"><span>배달비</span><span>{Number(selectedOrder.delivery_fee || 0).toLocaleString()}원</span></div>
                  {Number(selectedOrder.stamp_discount || 0) > 0 && <div className="flex justify-between text-emerald-300"><span>스탬프 할인</span><span>-{Number(selectedOrder.stamp_discount || 0).toLocaleString()}원</span></div>}
                  <div className="flex justify-between border-t border-zinc-800 pt-3 text-2xl font-black text-[#f0d98a]"><span>총 결제 금액</span><span>{selectedOrder.total.toLocaleString()}원</span></div>
                </div>
              </div>

              <div className="mt-5 rounded-[12px] border border-zinc-800 bg-[#101010] p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-black text-zinc-400">예상시간 설정</div>
                  <div className="text-sm font-bold text-[#d4af37]">현재 {selectedOrder.estimated_time || "미설정"}</div>
                </div>
                <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
                  {estimatedTimes.map((time) => (
                    <button key={time} onClick={() => changeEstimatedTime(selectedOrder.id, time)} className={`rounded-[9px] border px-3 py-2 text-sm font-black ${selectedOrder.estimated_time === time ? "border-[#d4af37] bg-[#d4af37] text-black" : "border-zinc-700 bg-[#0a0a0a] text-zinc-300 hover:border-[#d4af37]/50"}`}>{time}</button>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-6">
                <button disabled={!canChangeStatus(selectedOrder, "접수완료")} onClick={() => acceptWithPrint(selectedOrder)} className={actionButtonClass(selectedOrder, "접수완료", "gold")}>접수</button>
                <button disabled={!canChangeStatus(selectedOrder, "조리중")} onClick={() => changeStatus(selectedOrder, "조리중")} className={actionButtonClass(selectedOrder, "조리중", "line")}>조리 시작</button>
                <button disabled={!canChangeStatus(selectedOrder, "배달중")} onClick={() => changeStatus(selectedOrder, "배달중")} className={actionButtonClass(selectedOrder, "배달중", "line")}>배달중</button>
                <button disabled={!canChangeStatus(selectedOrder, "완료")} onClick={() => changeStatus(selectedOrder, "완료")} className={actionButtonClass(selectedOrder, "완료", "line")}>완료</button>
                <button onClick={() => printReceipt(selectedOrder)} className="rounded-[10px] border border-[#d4af37]/40 bg-[#111111] px-4 py-3 text-sm font-black text-[#d4af37] transition hover:bg-[#17130a]">빌지출력</button>
                <button disabled={!canChangeStatus(selectedOrder, "주문취소")} onClick={() => { const ok = confirm("주문 취소하시겠습니까?"); if (ok) changeStatus(selectedOrder, "주문취소"); }} className={actionButtonClass(selectedOrder, "주문취소", "danger")}>취소</button>
              </div>

              <div className="mt-5 rounded-[12px] border border-zinc-800 bg-[#101010] p-4">
                <div className="text-sm font-black text-zinc-500">요청사항</div>
                <div className="mt-2 text-sm leading-relaxed text-zinc-300">{selectedOrder.memo?.trim() ? selectedOrder.memo : "요청사항 없음"}</div>
              </div>
            </div>
          ) : (
            <div className="flex h-[70vh] items-center justify-center text-sm font-bold text-zinc-500">선택된 주문이 없습니다.</div>
          )}
        </section>
      </div>

      {newOrderAlert && (
        <div className="fixed left-1/2 top-5 z-[999] -translate-x-1/2 rounded-full border border-red-500/40 bg-red-950/70 px-5 py-2 text-sm font-black text-red-200 shadow-2xl backdrop-blur">
          신규 주문이 들어왔습니다
        </div>
      )}

      {toastOrder && (
        <div className="fixed bottom-5 right-5 z-[999] w-[420px] max-w-[calc(100vw-40px)] rounded-[12px] border border-[#d4af37]/40 bg-[#0b0b0b]/95 p-4 shadow-[0_20px_80px_rgba(0,0,0,.65)] backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-black text-[#f0d98a]">신규 주문 알림</div>
              <div className="mt-2 text-sm text-zinc-300">#{getTodayOrderNumber(toastOrder.id)} {toastOrder.customer}님 주문이 접수되었습니다.</div>
            </div>
            <button onClick={() => setToastOrder(null)} className="text-xl leading-none text-zinc-500 hover:text-white">×</button>
          </div>
        </div>
      )}

      {popupOrder && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[14px] border border-[#d4af37]/45 bg-[#0d0d0d] p-5 shadow-[0_24px_90px_rgba(0,0,0,.7)]">
            <div className="text-center text-2xl font-black text-[#f0d98a]">신규 주문</div>
            <div className="mt-1 text-center text-sm text-zinc-500">접수와 동시에 빌지를 출력할 수 있습니다.</div>

            <div className="mt-5 rounded-[12px] border border-zinc-800 bg-[#111111] p-4">
              <div className="text-sm text-zinc-500">오늘주문 #{getTodayOrderNumber(popupOrder.id)}</div>
              <div className="mt-2 text-2xl font-black text-zinc-100">{popupOrder.customer}</div>
              <div className="mt-2 text-xl font-black text-[#f0d98a]">{popupOrder.total.toLocaleString()}원</div>
              <div className="mt-2 text-sm text-zinc-400">{menuLines(popupOrder.menu)[0]?.name || ""}</div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <button onClick={async () => { await acceptWithPrint(popupOrder); setPopupOrder(null); }} className="rounded-[10px] bg-[#d4af37] py-3 text-sm font-black text-black">접수+빌지</button>
              <button onClick={() => { const ok = confirm("주문 취소하시겠습니까?"); if (!ok) return; changeStatus(popupOrder, "주문취소"); setPopupOrder(null); }} className="rounded-[10px] border border-red-500/40 bg-red-950/50 py-3 text-sm font-black text-red-200">취소</button>
              <button onClick={() => setPopupOrder(null)} className="rounded-[10px] border border-zinc-700 bg-[#151515] py-3 text-sm font-black text-zinc-300">닫기</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
