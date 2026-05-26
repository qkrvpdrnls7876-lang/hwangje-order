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

type RiderFilter = "all" | "ready" | "delivering";

type ToastMessage = {
  id: number;
  title: string;
  message: string;
  tone: "success" | "error" | "warning" | "info";
};

type ConfirmDialog = {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  tone: "gold" | "green" | "danger";
  onConfirm: () => void | Promise<void>;
} | null;

const STORE_NAME = "황제떡볶이 효자점";
const STORE_ADDRESS = "전북 전주시 완산구 효자천변2길 12-6";

export default function RiderPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [openAddressIds, setOpenAddressIds] = useState<number[]>([]);
  const [openMenuIds, setOpenMenuIds] = useState<number[]>([]);
  const [selectedMapOrder, setSelectedMapOrder] = useState<Order | null>(null);
  const [activeFilter, setActiveFilter] = useState<RiderFilter>("all");
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>(null);

  const showToast = (
    message: string,
    title = "황제라이더",
    tone: ToastMessage["tone"] = "info",
  ) => {
    const nextToast = {
      id: Date.now(),
      title,
      message,
      tone,
    };

    setToast(nextToast);

    window.setTimeout(() => {
      setToast((current) => (current?.id === nextToast.id ? null : current));
    }, 3600);
  };

  const runConfirm = async () => {
    if (!confirmDialog) return;

    const action = confirmDialog.onConfirm;
    setConfirmDialog(null);
    await action();
  };

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

    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 4, 0, 0);
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
      showToast("오늘 주문 불러오기 실패: " + todayError.message, "조회 실패", "error");
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

  const normalizePhone = (phone: string) => phone.replace(/[^0-9]/g, "");

  const shortAddress = (address: string) => {
    if (!address) return "주소 없음";
    if (address.length <= 30) return address;
    return `${address.slice(0, 30)}...`;
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
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
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

  // 황제수정: 직접배달용 출발지 고정 경로 검색
  const openKakaoRoute = (address: string) => {
    const query = `${STORE_ADDRESS} 에서 ${address}`;
    const url = `https://map.kakao.com/link/search/${encodeURIComponent(query)}`;
    window.open(url, "_blank");
  };

  const openNaverRoute = (address: string) => {
    const query = `${STORE_ADDRESS} ${address}`;
    const url = `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
    window.open(url, "_blank");
  };

  const copyText = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(message, "복사 완료", "success");
    } catch {
      showToast("복사 실패. 직접 복사해주세요.", "복사 실패", "error");
    }
  };

  const callCustomer = (phone: string) => {
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) {
      showToast("전화번호가 없습니다.", "전화 실패", "warning");
      return;
    }

    window.location.href = `tel:${cleanPhone}`;
  };

  // 황제수정: 스탬프 적립/차감은 손님 주문 생성 시점에서 1회 처리한다.
  // 라이더 완료 처리에서 다시 적립하면 중복 적립이 발생하므로 주문 표시값만 정리한다.
  const processStamp = async (order: Order) => {
    if (order.stamp_processed) return true;

    const { error } = await supabase
      .from("orders")
      .update({ stamp_processed: true })
      .eq("id", order.id);

    if (error) {
      showToast("스탬프 처리 표시 실패: " + error.message, "스탬프 표시 실패", "error");
      return false;
    }

    return true;
  };

  // 황제수정: window.confirm 제거 → 앱 내부 확인 모달 사용
  const requestStartDelivery = (order: Order) => {
    setConfirmDialog({
      title: "배달 시작",
      message: `오늘주문 #${getTodayOrderNumber(order.id)}\n${order.customer || "고객"}님 주문을 배달중으로 변경할까요?`,
      confirmText: order.status === "조리중" ? "픽업완료" : "배차받기",
      cancelText: "취소",
      tone: "gold",
      onConfirm: async () => {
        const { error } = await supabase
          .from("orders")
          .update({ status: "배달중" })
          .eq("id", order.id);

        if (error) {
          showToast("배달중 변경 실패: " + error.message, "상태 변경 실패", "error");
          return;
        }

        showToast("배달중으로 변경했습니다.", "상태 변경 완료", "success");
        fetchOrders();
      },
    });
  };

  // 황제수정: window.confirm/alert 제거 → 앱 내부 확인 모달 + 토스트 사용
  const requestCompleteDelivery = (order: Order) => {
    setConfirmDialog({
      title: "배달완료 처리",
      message: `오늘주문 #${getTodayOrderNumber(order.id)}\n${order.customer || "고객"}님 주문을 완료 처리할까요?\n\n스탬프는 주문 접수 시 이미 반영됩니다.`,
      confirmText: "배달완료",
      cancelText: "취소",
      tone: "green",
      onConfirm: async () => {
        const { error } = await supabase
          .from("orders")
          .update({ status: "완료" })
          .eq("id", order.id);

        if (error) {
          showToast("완료 처리 실패: " + error.message, "완료 실패", "error");
          return;
        }

        const stampOk = await processStamp(order);

        if (!stampOk) {
          showToast("주문은 완료됐지만 스탬프 처리 확인이 필요합니다.", "부분 완료", "warning");
        } else {
          showToast("배달완료 처리됐습니다.", "배달완료", "success");
        }

        fetchOrders();
      },
    });
  };

  const formatTime = (dateText: string) => {
    const date = new Date(dateText);

    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusClass = (status: string) => {
    if (status === "접수완료") return "border-amber-500/45 bg-amber-500/10 text-amber-300";
    if (status === "조리중") return "border-sky-500/40 bg-sky-500/10 text-sky-300";
    if (status === "배달중") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    return "border-zinc-700 bg-zinc-900 text-zinc-300";
  };

  const getActionLabel = (status: string) => {
    if (status === "배달중") return "배달완료";
    if (status === "조리중") return "픽업완료";
    return "배차받기";
  };

  const runMainAction = (order: Order) => {
    if (order.status === "배달중") {
      requestCompleteDelivery(order);
      return;
    }

    requestStartDelivery(order);
  };

  const acceptedCount = orders.filter((order) => order.status === "접수완료").length;
  const cookingCount = orders.filter((order) => order.status === "조리중").length;
  const deliveringCount = orders.filter((order) => order.status === "배달중").length;
  const transferCount = orders.filter((order) => order.payment_method === "계좌이체").length;
  const totalDeliveryFee = orders.reduce((sum, order) => sum + Number(order.delivery_fee || 0), 0);
  const readyCount = acceptedCount + cookingCount;

  const filteredOrders = useMemo(() => {
    if (activeFilter === "ready") {
      return orders.filter((order) => order.status === "접수완료" || order.status === "조리중");
    }

    if (activeFilter === "delivering") {
      return orders.filter((order) => order.status === "배달중");
    }

    return orders;
  }, [activeFilter, orders]);

  const filterButtonClass = (filter: RiderFilter) =>
    `rounded-2xl px-4 py-3 text-sm font-black transition ${
      activeFilter === filter
        ? "bg-[#d4af37] text-black shadow-[0_12px_40px_rgba(212,175,55,.22)]"
        : "border border-zinc-800 bg-[#101010] text-zinc-400 hover:border-[#d4af37]/40 hover:text-[#f0d98a]"
    }`;

  const confirmToneClass = confirmDialog?.tone === "green"
    ? "border-emerald-500/60 bg-emerald-500 text-black hover:bg-emerald-400"
    : confirmDialog?.tone === "danger"
      ? "border-red-500/60 bg-red-600 text-white hover:bg-red-500"
      : "border-[#d4af37]/60 bg-[#d4af37] text-black hover:bg-[#f0c75a]";

  return (
    <main className="min-h-screen overflow-hidden bg-[#070707] pt-9 text-zinc-100">
      <div className="fixed left-0 right-0 top-0 z-[1000] flex h-9 items-center justify-between border-b border-[#d4af3720] bg-[#080808]/95 px-3 text-xs text-zinc-400 backdrop-blur-xl [-webkit-app-region:drag]">
        <button
          type="button"
          onClick={goBack}
          className="flex items-center gap-2 rounded-md px-2 py-1 font-black tracking-[-0.03em] text-[#d4af37] hover:bg-white/[0.04] [-webkit-app-region:no-drag]"
        >
          <span className="h-2 w-2 rounded-full bg-[#d4af37]" />← 황제POS / 라이더관리
        </button>

        <div className="flex items-center gap-1 [-webkit-app-region:no-drag]">
          <button type="button" onClick={() => (window as any).hwangjePOS?.minimizeWindow?.()} className="flex h-7 w-9 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-white">—</button>
          <button type="button" onClick={() => (window as any).hwangjePOS?.toggleMaximizeWindow?.()} className="flex h-7 w-9 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-white">□</button>
          <button type="button" onClick={() => (window as any).hwangjePOS?.closeWindow?.()} className="flex h-7 w-9 items-center justify-center rounded-md text-zinc-400 hover:bg-red-600 hover:text-white">×</button>
        </div>
      </div>

      <div className="grid min-h-[calc(100vh-36px)] grid-cols-1 lg:grid-cols-[228px_1fr]">
        <aside className="hidden border-r border-[#d4af37]/15 bg-[linear-gradient(180deg,#111111_0%,#070707_100%)] lg:flex lg:flex-col">
          <div className="border-b border-[#d4af37]/10 px-6 py-7">
            <div className="text-[11px] font-black tracking-[0.28em] text-[#d4af37]">HWANGJEE</div>
            <div className="mt-1 text-4xl font-black tracking-[-0.08em] text-[#f0d98a]">POS</div>
            <div className="mt-1 text-xs font-bold text-[#d4af37]/80">황제떡볶이 효자점</div>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-5">
            <a href="/admin" className="block rounded-[10px] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white">주문 관리</a>
            <a href="/admin/sales" className="block rounded-[10px] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white">매출 관리</a>
            <a href="/admin/menu" className="block rounded-[10px] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white">메뉴 관리</a>
            <div className="flex w-full items-center justify-between rounded-[10px] border border-[#d4af37]/20 bg-[#d4af37]/10 px-4 py-3 text-sm font-bold text-[#f0d98a]">
              <span>라이더 관리</span>
              <span className="rounded-full bg-[#d4af37] px-2 py-0.5 text-xs text-black">ON</span>
            </div>
            <a href="/kitchen" className="block rounded-[10px] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white">주방 모니터</a>
          </nav>

          <div className="mx-4 mb-4 rounded-[12px] border border-[#d4af37]/20 bg-black/40 p-4">
            <div className="text-xs font-bold text-zinc-500">라이더 현황</div>
            <div className="mt-1 text-2xl font-black tracking-[-0.05em] text-[#f0d98a]">
              {deliveringCount > 0 ? `배달중 ${deliveringCount}` : "대기중"}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-zinc-500">대기콜</div>
                <div className="font-black text-zinc-100">{readyCount}건</div>
              </div>
              <div>
                <div className="text-zinc-500">배달비</div>
                <div className="font-black text-[#d4af37]">{totalDeliveryFee.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </aside>

        <section className="min-h-[calc(100vh-36px)] overflow-y-auto bg-[#090909]">
          <header className="sticky top-9 z-40 border-b border-zinc-800 bg-[#0b0b0b]/96 px-4 py-5 backdrop-blur-xl lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <button type="button" onClick={goBack} className="mb-3 inline-flex items-center rounded-[9px] border border-zinc-700 bg-[#111111] px-3 py-2 text-xs font-black text-zinc-300 transition hover:border-[#d4af37]/50 hover:text-[#f0d98a]">← 뒤로가기</button>
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#d4af37]">RIDER DISPATCH APP</div>
                <h1 className="mt-1 text-4xl font-black tracking-[-0.07em] text-zinc-100">직접배달</h1>
                <p className="mt-2 text-sm text-zinc-500">출발지는 {STORE_ADDRESS} 고정. 주문은 3초마다 자동갱신됩니다.</p>
              </div>

              <button onClick={fetchOrders} className="rounded-[14px] border border-[#d4af37]/60 bg-[#d4af37] px-5 py-4 text-sm font-black text-black transition hover:bg-[#f0c75a]">새로고침</button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
              <div className="rounded-[14px] border border-zinc-800 bg-[#111111] px-3 py-3"><span className="text-zinc-500">배달대상</span><div className="mt-1 text-lg font-black text-[#f0d98a]">{orders.length}건</div></div>
              <div className="rounded-[14px] border border-zinc-800 bg-[#111111] px-3 py-3"><span className="text-zinc-500">대기콜</span><div className="mt-1 text-lg font-black text-amber-300">{readyCount}건</div></div>
              <div className="rounded-[14px] border border-zinc-800 bg-[#111111] px-3 py-3"><span className="text-zinc-500">조리중</span><div className="mt-1 text-lg font-black text-sky-300">{cookingCount}건</div></div>
              <div className="rounded-[14px] border border-zinc-800 bg-[#111111] px-3 py-3"><span className="text-zinc-500">배달중</span><div className="mt-1 text-lg font-black text-emerald-300">{deliveringCount}건</div></div>
              <div className="rounded-[14px] border border-zinc-800 bg-[#111111] px-3 py-3"><span className="text-zinc-500">입금확인</span><div className="mt-1 text-lg font-black text-red-300">{transferCount}건</div></div>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              <button type="button" onClick={() => setActiveFilter("all")} className={filterButtonClass("all")}>전체 {orders.length}</button>
              <button type="button" onClick={() => setActiveFilter("ready")} className={filterButtonClass("ready")}>대기콜 {readyCount}</button>
              <button type="button" onClick={() => setActiveFilter("delivering")} className={filterButtonClass("delivering")}>배달중 {deliveringCount}</button>
            </div>
          </header>

          <div className="px-4 py-5 lg:px-8">
            {loading && (
              <div className="rounded-[18px] border border-zinc-800 bg-[#101010] p-8 text-center text-sm font-bold text-zinc-500">불러오는 중...</div>
            )}

            {!loading && filteredOrders.length === 0 && (
              <div className="rounded-[18px] border border-zinc-800 bg-[#101010] p-12 text-center">
                <div className="text-2xl font-black text-zinc-300">표시할 배달 주문이 없습니다.</div>
                <div className="mt-2 text-sm text-zinc-500">접수완료/조리중/배달중 주문이 생기면 자동으로 표시됩니다.</div>
              </div>
            )}

            <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {filteredOrders.map((order) => {
                const lines = menuLines(order.menu);
                const addressOpen = openAddressIds.includes(order.id);
                const menuOpen = openMenuIds.includes(order.id);
                const isDelivering = order.status === "배달중";

                return (
                  <div key={order.id} className="overflow-hidden rounded-[24px] border border-zinc-800 bg-[#101010] shadow-[0_18px_60px_rgba(0,0,0,.28)]">
                    <div className="border-b border-zinc-800 bg-[radial-gradient(circle_at_top_left,#2b2410_0%,#0b0b0b_42%,#090909_100%)] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-zinc-500">오늘주문 #{getTodayOrderNumber(order.id)} · {formatTime(order.created_at)}</div>
                          <div className="mt-1 truncate text-2xl font-black tracking-[-0.05em] text-[#f0d98a]">{order.customer || "고객"}</div>
                          <div className="mt-1 truncate text-sm font-bold text-zinc-400">{getMenuSummary(order.menu)}</div>
                        </div>
                        <div className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-black ${statusClass(order.status)}`}>{order.status}</div>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <div className="rounded-[14px] border border-zinc-800 bg-black/40 p-3">
                          <div className="text-[11px] font-bold text-zinc-500">결제금액</div>
                          <div className="mt-1 text-lg font-black text-[#f0d98a]">{order.total.toLocaleString()}원</div>
                        </div>
                        <div className="rounded-[14px] border border-zinc-800 bg-black/40 p-3">
                          <div className="text-[11px] font-bold text-zinc-500">거리</div>
                          <div className="mt-1 text-lg font-black text-[#f0d98a]">{Number(order.delivery_distance_km || 0).toFixed(1)}km</div>
                        </div>
                        <div className="rounded-[14px] border border-zinc-800 bg-black/40 p-3">
                          <div className="text-[11px] font-bold text-zinc-500">배달비</div>
                          <div className="mt-1 text-lg font-black text-[#f0d98a]">{(order.delivery_fee || 0).toLocaleString()}</div>
                        </div>
                      </div>

                      {order.payment_method === "계좌이체" && (
                        <div className="mt-3 rounded-[12px] border border-red-500/35 bg-red-950/30 px-3 py-2 text-center text-sm font-black text-red-300">입금확인 필요</div>
                      )}
                    </div>

                    <div className="p-4">
                      <div className="rounded-[18px] border border-zinc-800 bg-[#070707] p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex flex-col items-center">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d4af37] text-sm font-black text-black">출</div>
                            <div className="h-9 border-l border-dashed border-[#d4af37]/50" />
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400 text-sm font-black text-black">도</div>
                          </div>
                          <div className="min-w-0 flex-1 space-y-3">
                            <div>
                              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">출발지</div>
                              <div className="mt-1 text-sm font-black text-[#f0d98a]">{STORE_NAME}</div>
                              <div className="mt-0.5 text-xs font-bold text-zinc-500">{STORE_ADDRESS}</div>
                            </div>
                            <button type="button" onClick={() => toggleAddress(order.id)} className="w-full text-left">
                              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">도착지</div>
                              <div className="mt-1 text-base font-black leading-relaxed text-zinc-100">{addressOpen ? order.address : shortAddress(order.address)}</div>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button onClick={() => setSelectedMapOrder(order)} className="rounded-[16px] border border-[#d4af37]/60 bg-[#d4af37] p-4 text-base font-black text-black transition hover:bg-[#f0c75a]">지도보기</button>
                        <button onClick={() => callCustomer(order.phone)} className="rounded-[16px] border border-zinc-700 bg-[#111111] p-4 text-base font-black text-zinc-300 transition hover:border-[#d4af37]/40 hover:text-[#d4af37]">전화걸기</button>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button onClick={() => openKakaoRoute(order.address)} className="rounded-[14px] border border-[#d4af37]/35 bg-[#111111] p-3 text-sm font-black text-[#d4af37] transition hover:bg-[#17130a]">카카오 경로</button>
                        <button onClick={() => openNaverRoute(order.address)} className="rounded-[14px] border border-emerald-500/35 bg-emerald-500/10 p-3 text-sm font-black text-emerald-300 transition hover:bg-emerald-500/15">네이버 경로</button>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button onClick={() => openKakaoMap(order.address)} className="rounded-[14px] border border-zinc-800 bg-[#070707] p-3 text-sm font-black text-zinc-300 transition hover:border-[#d4af37]/40">카카오 검색</button>
                        <button onClick={() => copyText(order.address, "도착지 주소가 복사되었습니다.")} className="rounded-[14px] border border-zinc-800 bg-[#070707] p-3 text-sm font-black text-zinc-300 transition hover:border-[#d4af37]/40">주소복사</button>
                      </div>

                      <button type="button" onClick={() => toggleMenu(order.id)} className="mt-3 w-full rounded-[16px] border border-zinc-800 bg-[#070707] p-3 text-left transition hover:border-[#d4af37]/40">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">주문메뉴</div>
                            <div className="mt-1 truncate text-sm font-black text-zinc-100">{getMenuSummary(order.menu)}</div>
                          </div>
                          <div className="shrink-0 rounded-md border border-[#d4af37]/30 bg-[#d4af37]/10 px-2 py-1 text-[11px] font-black text-[#d4af37]">{menuOpen ? "접기 ▲" : "상세 ▼"}</div>
                        </div>
                      </button>

                      {menuOpen && (
                        <div className="mt-2 space-y-2">
                          {lines.map((item, index) => (
                            <div key={index} className="rounded-[14px] border border-zinc-800 bg-[#0b0b0b] p-3">
                              <div className="flex justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-black leading-tight text-zinc-100">{item.name}</div>
                                  <div className="mt-1 text-xs font-bold text-zinc-500">수량 {item.qty}개</div>
                                  {item.options && item.options.length > 0 && (
                                    <div className="mt-2 space-y-0.5 text-[11px] leading-relaxed text-zinc-500">
                                      {item.options.map((option, optionIndex) => (
                                        <div key={optionIndex}>- {option.groupName}: {option.optionName}{option.price > 0 && ` +${option.price.toLocaleString()}원`}</div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="shrink-0 text-sm font-black text-[#d4af37]">{Number(item.total || 0).toLocaleString()}원</div>
                              </div>
                            </div>
                          ))}

                          <div className="rounded-[14px] border border-zinc-800 bg-[#0b0b0b] p-3">
                            <div className="mb-1 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">요청사항</div>
                            <div className="text-xs leading-relaxed text-zinc-300">{order.memo?.trim() ? order.memo : "요청사항 없음"}</div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-zinc-800 p-4">
                      <button
                        onClick={() => runMainAction(order)}
                        className={`w-full rounded-[18px] border p-5 text-lg font-black transition ${
                          isDelivering
                            ? "border-emerald-500/60 bg-emerald-500 text-black hover:bg-emerald-400"
                            : "border-[#d4af37]/60 bg-[#d4af37] text-black hover:bg-[#f0c75a]"
                        }`}
                      >
                        {getActionLabel(order.status)}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {selectedMapOrder && (
        <div className="fixed inset-0 z-[1600] flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm md:items-center">
          <div className="w-full max-w-xl overflow-hidden rounded-[24px] border border-[#d4af37]/35 bg-[#0b0b0b] shadow-[0_32px_120px_rgba(0,0,0,.85)]">
            <div className="border-b border-zinc-800 bg-[#111111] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#d4af37]">ROUTE MAP</div>
                  <div className="mt-1 text-2xl font-black tracking-[-0.05em] text-zinc-100">지도보기 · 오늘주문 #{getTodayOrderNumber(selectedMapOrder.id)}</div>
                </div>
                <button type="button" onClick={() => setSelectedMapOrder(null)} className="rounded-xl border border-zinc-700 bg-[#070707] px-3 py-2 text-sm font-black text-zinc-300">닫기</button>
              </div>
            </div>

            <div className="p-4">
              <div className="relative overflow-hidden rounded-[22px] border border-zinc-800 bg-[radial-gradient(circle_at_top,#2b2410_0%,#090909_46%,#050505_100%)] p-5">
                <div className="absolute inset-x-10 top-1/2 h-px border-t border-dashed border-[#d4af37]/45" />
                <div className="relative grid gap-4 md:grid-cols-2">
                  <div className="rounded-[18px] border border-[#d4af37]/30 bg-black/65 p-4">
                    <div className="mb-3 inline-flex rounded-full bg-[#d4af37] px-3 py-1 text-xs font-black text-black">출발지</div>
                    <div className="text-lg font-black text-[#f0d98a]">{STORE_NAME}</div>
                    <div className="mt-2 text-sm font-bold leading-relaxed text-zinc-300">{STORE_ADDRESS}</div>
                  </div>

                  <div className="rounded-[18px] border border-emerald-500/35 bg-black/65 p-4">
                    <div className="mb-3 inline-flex rounded-full bg-emerald-400 px-3 py-1 text-xs font-black text-black">도착지</div>
                    <div className="text-lg font-black text-emerald-200">{selectedMapOrder.customer || "고객"}</div>
                    <div className="mt-2 text-sm font-bold leading-relaxed text-zinc-300">{selectedMapOrder.address}</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-[14px] border border-zinc-800 bg-[#070707] p-3">
                  <div className="text-xs text-zinc-500">거리</div>
                  <div className="mt-1 text-xl font-black text-[#d4af37]">{Number(selectedMapOrder.delivery_distance_km || 0).toFixed(1)}km</div>
                </div>
                <div className="rounded-[14px] border border-zinc-800 bg-[#070707] p-3">
                  <div className="text-xs text-zinc-500">배달비</div>
                  <div className="mt-1 text-xl font-black text-[#d4af37]">{(selectedMapOrder.delivery_fee || 0).toLocaleString()}원</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => openKakaoRoute(selectedMapOrder.address)} className="rounded-[14px] border border-[#d4af37]/60 bg-[#d4af37] p-4 text-base font-black text-black">카카오 경로</button>
                <button type="button" onClick={() => openNaverRoute(selectedMapOrder.address)} className="rounded-[14px] border border-emerald-500/40 bg-emerald-500/15 p-4 text-base font-black text-emerald-300">네이버 경로</button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => copyText(STORE_ADDRESS, "출발지 주소가 복사되었습니다.")} className="rounded-[12px] border border-zinc-700 bg-[#111111] p-3 text-sm font-black text-zinc-300">출발지 복사</button>
                <button type="button" onClick={() => copyText(selectedMapOrder.address, "도착지 주소가 복사되었습니다.")} className="rounded-[12px] border border-zinc-700 bg-[#111111] p-3 text-sm font-black text-zinc-300">도착지 복사</button>
              </div>

              <div className="mt-3 rounded-[12px] border border-zinc-800 bg-[#070707] p-3 text-xs font-bold leading-relaxed text-zinc-500">앱 내부에서는 출발지/도착지 확인용 UI를 보여주고, 실제 길안내는 카카오/네이버 버튼으로 바로 엽니다.</div>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-[1700] flex items-center justify-center bg-black/78 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[24px] border border-[#d4af37]/35 bg-[#0b0b0b] shadow-[0_32px_120px_rgba(0,0,0,.9)]">
            <div className="border-b border-zinc-800 bg-[radial-gradient(circle_at_top,#2b2410_0%,#101010_46%,#080808_100%)] p-5">
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#d4af37]">HWANGJE RIDER</div>
              <div className="mt-2 text-2xl font-black tracking-[-0.05em] text-zinc-100">{confirmDialog.title}</div>
              <div className="mt-3 whitespace-pre-line text-sm font-bold leading-relaxed text-zinc-400">{confirmDialog.message}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 p-4">
              <button type="button" onClick={() => setConfirmDialog(null)} className="rounded-[16px] border border-zinc-700 bg-[#111111] px-4 py-4 text-base font-black text-zinc-300 transition hover:border-zinc-500 hover:text-white">{confirmDialog.cancelText}</button>
              <button type="button" onClick={runConfirm} className={`rounded-[16px] border px-4 py-4 text-base font-black transition ${confirmToneClass}`}>{confirmDialog.confirmText}</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-[1800] w-[380px] max-w-[calc(100vw-32px)] rounded-[18px] border border-[#d4af37]/35 bg-[#0b0b0b]/96 p-4 text-sm shadow-[0_22px_80px_rgba(0,0,0,.75)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className={`font-black ${toast.tone === "error" ? "text-red-300" : toast.tone === "success" ? "text-emerald-300" : toast.tone === "warning" ? "text-amber-300" : "text-[#f0d98a]"}`}>{toast.title}</div>
              <div className="mt-2 whitespace-pre-line leading-relaxed text-zinc-300">{toast.message}</div>
            </div>
            <button type="button" onClick={() => setToast(null)} className="shrink-0 text-xl leading-none text-zinc-500 transition hover:text-white">×</button>
          </div>
        </div>
      )}
    </main>
  );
}
