"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

declare global {
  interface Window {
    kakao: any;
  }
}

type Menu = {
  id: number;
  name: string;
  price: number;
  description: string | null;
  category: string | null;
  is_soldout: boolean;
};

type OptionGroup = {
  id: number;
  menu_id: number;
  name: string;
  type: string;
  required: boolean;
};

type OptionItem = {
  id: number;
  group_id: number;
  name: string;
  price: number;
  is_soldout: boolean;
};

type GroupMenuLink = {
  id:number;
  menu_id:number;
  group_id:number;
};

type SelectedOption = {
  groupName: string;
  optionName: string;
  price: number;
};

type CartItem = {
  cartId: string;
  menuId: number;
  name: string;
  basePrice: number;
  qty: number;
  options: SelectedOption[];
  total: number;
};

type StampCustomer = {
  phone: string;
  stamp_count: number;
  total_orders: number;
};

type RecentOrder = {
  id: number;
  created_at: string;
  address: string;
  menu: string;
  total: number;
  memo: string | null;
  payment_method: string | null;
  delivery_fee: number | null;
  delivery_distance_km: number | null;
  status: string;
};

type SavedCustomerInfo = {
  name: string;
  phone: string;
  address: string;
  detailAddress: string;
};

export default function Home() {
  const router = useRouter();

  const cartRef = useRef<HTMLDivElement | null>(null);
  const orderFormRef = useRef<HTMLDivElement | null>(null);
  const categoryRefs = useRef<Record<string, HTMLElement | null>>({});

  const bankInfo = "전북은행 1021-02-6973516 박여진";
  const STORE_ADDRESS = "전북 전주시 완산구 효자천변2길 12-6 105호";
  const MAX_DELIVERY_DISTANCE_KM = 8;
  const SAVED_CUSTOMER_KEY = "hwangje_saved_customer";

  const [menus, setMenus] = useState<Menu[]>([]);
  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [items, setItems] = useState<OptionItem[]>([]);
const [links, setLinks] = useState<GroupMenuLink[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<
    Record<number, OptionItem[]>
  >({});
  const [optionModalQty, setOptionModalQty] = useState(1);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState("");
  const [showDeliveryRequests, setShowDeliveryRequests] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);
  const [stampCustomer, setStampCustomer] = useState<StampCustomer | null>(
    null,
  );
  const [useStampReward, setUseStampReward] = useState(false);
  const [showOrderLookup, setShowOrderLookup] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [orderLookupPhone, setOrderLookupPhone] = useState("");
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [recentOrdersLoading, setRecentOrdersLoading] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [deliveryDistance, setDeliveryDistance] = useState(0);
  const [kakaoReady, setKakaoReady] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState(
    "주소를 입력하면 배달비가 자동 계산됩니다.",
  );
  const [gettingLocation, setGettingLocation] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const getDeviceId=()=>{
    let id=localStorage.getItem("hwangje_device_id");
    if(!id){
      id="device-"+Date.now()+"-"+Math.random().toString(36).slice(2,10);
      localStorage.setItem("hwangje_device_id",id);
    }
    return id;
  };

  const getDeviceInfo=()=>{
    return navigator.userAgent;
  };
  const [showAddressSearch, setShowAddressSearch] = useState(false);
  const [addressKeyword, setAddressKeyword] = useState("");
  const [addressResults, setAddressResults] = useState<any[]>([]);
  const [selectedBaseAddress, setSelectedBaseAddress] = useState("");
  const [detailAddress, setDetailAddress] = useState("");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    memo: "",
  });

  const deliveryRequests = [
    "문 앞에 두고 문자 주세요",
    "문 앞에 두고 벨 눌러주세요",
    "문 앞에 두고 노크해주세요",
    "문 앞에만 두고 가주세요",
    "직접 받을게요",
  ];

  const paymentMethods = ["만나서 현금결제", "만나서 카드결제", "계좌이체"];

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  const getBusinessDay = (date: Date) => {
    const businessDay = new Date(date);

    // 새벽 3시 전까지는 전날 영업일로 봄
    // 화요일 영업은 수요일 새벽 2시까지만 운영하지만,
    // 수요일 0~2시는 화요일 영업일로 계산해야 해서 3시 기준은 유지
    if (businessDay.getHours() < 3) {
      businessDay.setDate(businessDay.getDate() - 1);
    }

    businessDay.setHours(0, 0, 0, 0);
    return businessDay;
  };

  const isWeekendBusinessDay = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const getNextOpenText = (date: Date) => {
    const next = new Date(date);

    for (let i = 0; i < 8; i += 1) {
      const candidate = new Date(next);
      candidate.setDate(next.getDate() + i);
      candidate.setHours(candidate.getHours() < 3 && i === 0 ? 3 : 0, 0, 0, 0);

      const businessDay = getBusinessDay(candidate);
      const day = businessDay.getDay();

      if (day === 3) continue;

      const openHour = isWeekendBusinessDay(businessDay) ? 15 : 16;
      const openAt = new Date(businessDay);
      openAt.setHours(openHour, 0, 0, 0);

      if (openAt.getTime() > date.getTime()) {
        const label =
          i === 0
            ? "오늘"
            : i === 1
              ? "내일"
              : `${businessDay.getMonth() + 1}/${businessDay.getDate()}(${dayNames[day]})`;

        return `${label} 오후 ${openHour === 15 ? "3" : "4"}시 오픈`;
      }
    }

    return "다음 영업일에 오픈";
  };

  const getStoreStatus = (date: Date) => {
    const businessDay = getBusinessDay(date);
    const businessDayNumber = businessDay.getDay();
    const isClosedDay = businessDayNumber === 3;
    const openHour = isWeekendBusinessDay(businessDay) ? 15 : 16;
    const closeHour = businessDayNumber === 2 ? 2 : 3;

    const openAt = new Date(businessDay);
    openAt.setHours(openHour, 0, 0, 0);

    const closeAt = new Date(businessDay);
    closeAt.setDate(closeAt.getDate() + 1);
    closeAt.setHours(closeHour, 0, 0, 0);

    const isOpen =
      !isClosedDay &&
      date.getTime() >= openAt.getTime() &&
      date.getTime() < closeAt.getTime();

    const scheduleText =
      "월/목/금 오후 4시~새벽 3시 · 화 오후 4시~새벽 2시 · 토/일 오후 3시~새벽 3시 · 수요일 휴무";

    if (isOpen) {
      return {
        isOpen,
        title: "영업중",
        message: `오늘은 ${dayNames[businessDayNumber]}요일 영업일입니다. 새벽 ${closeHour}시까지 주문 가능`,
        scheduleText,
        nextOpenText: "",
      };
    }

    return {
      isOpen,
      title: isClosedDay ? "수요일 정기휴무" : "영업시간 종료",
      message: isClosedDay
        ? "매주 수요일은 쉬어갑니다. 영업시간에는 다시 주문할 수 있어요."
        : `지금은 주문 접수 시간이 아닙니다. ${getNextOpenText(date)}`,
      scheduleText,
      nextOpenText: getNextOpenText(date),
    };
  };


  const fetchAll = async () => {
    const menusResult = await supabase
      .from("menus")
      .select("*")
      .order("id", { ascending: true });
    const groupsResult = await supabase
      .from("menu_option_groups")
      .select("*")
      .order("id", { ascending: true });
    const itemsResult = await supabase
      .from("menu_option_items")
      .select("*")
      .order("id", { ascending: true });

    const linksResult = await supabase
      .from("menu_option_group_menus")
      .select("*")
      .order("id",{ascending:true});

    if (menusResult.error)
      return alert("메뉴 불러오기 실패: " + menusResult.error.message);
    if (groupsResult.error)
      return alert("옵션그룹 불러오기 실패: " + groupsResult.error.message);
    if (itemsResult.error)
      return alert("옵션항목 불러오기 실패: " + itemsResult.error.message);

if (linksResult.error)
      return alert("연결 불러오기 실패: " + linksResult.error.message);

    setMenus(menusResult.data || []);
    setGroups(groupsResult.data || []);
    setItems(itemsResult.data || []);
    setLinks(linksResult.data || []);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = localStorage.getItem(SAVED_CUSTOMER_KEY);
      if (!saved) return;

      const parsed = JSON.parse(saved) as {
        name?: string;
        phone?: string;
        address?: string;
        detailAddress?: string;
      };

      setForm((prev) => ({
        ...prev,
        name: parsed.name || "",
        phone: parsed.phone ? formatPhone(parsed.phone) : "",
        address: parsed.address || "",
      }));

      setDetailAddress(parsed.detailAddress || "");

      if (parsed.address) {
        calculateDeliveryFee(parsed.address);
      }
    } catch {
      localStorage.removeItem(SAVED_CUSTOMER_KEY);
    }
  }, []);

  useEffect(() => {
    loadKakaoMap();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60 * 1000);

    return () => clearInterval(timer);
  }, []);

  const normalizePhone = (phone: string) => phone.replace(/[^0-9]/g, "");

  const formatPhone = (value: string) => {
    const numbers = normalizePhone(value).slice(0, 11);

    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;

    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
  };

  const isValidKoreanPhone = (value: string) => {
    const phone = normalizePhone(value);
    return /^010\d{8}$/.test(phone);
  };

  const saveCustomerInfo = (next?: Partial<SavedCustomerInfo>) => {
    if (typeof window === "undefined") return;

    const merged: SavedCustomerInfo = {
      name: next?.name ?? form.name,
      phone: formatPhone(next?.phone ?? form.phone),
      address: next?.address ?? form.address,
      detailAddress: next?.detailAddress ?? detailAddress,
    };

    localStorage.setItem(SAVED_CUSTOMER_KEY, JSON.stringify(merged));
  };
  const loadKakaoMap = () => {
    return new Promise<boolean>((resolve) => {
      if (typeof window === "undefined") {
        resolve(false);
        return;
      }

      if (window.kakao?.maps?.services) {
        setKakaoReady(true);
        resolve(true);
        return;
      }

      const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

      if (!kakaoKey) {
        setDeliveryStatus("카카오 JavaScript 키가 .env.local에 없습니다.");
        resolve(false);
        return;
      }

      const existingScript = document.getElementById(
        "kakao-map-script",
      ) as HTMLScriptElement | null;

      const onLoaded = () => {
        if (!window.kakao?.maps) {
          setDeliveryStatus("카카오 지도 스크립트 로드 실패");
          resolve(false);
          return;
        }

        window.kakao.maps.load(() => {
          setKakaoReady(true);
          resolve(true);
        });
      };

      if (existingScript) {
        existingScript.addEventListener("load", onLoaded, { once: true });

        if (window.kakao?.maps) {
          onLoaded();
        }

        return;
      }

      const script = document.createElement("script");
      script.id = "kakao-map-script";
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoKey}&libraries=services&autoload=false`;
      script.async = true;
      script.onload = onLoaded;
      script.onerror = () => {
        setDeliveryStatus(
          "카카오 지도 스크립트 로드 실패. 플랫폼 Web 도메인 등록을 확인해주세요.",
        );
        resolve(false);
      };

      document.head.appendChild(script);
    });
  };

  const getStampDiscount = (stampCount: number) => {
    if (stampCount < 5) return 0;
    return stampCount * 500;
  };

  const copyBankInfo = async () => {
    try {
      await navigator.clipboard.writeText(bankInfo);
      alert("계좌번호가 복사되었습니다.");
    } catch {
      alert("복사 실패. 직접 복사해주세요.");
    }
  };

  const fetchRecentOrders = async () => {
    const phone = normalizePhone(orderLookupPhone);

    if (!phone) {
      alert("휴대폰번호를 입력해주세요.");
      return;
    }

    setRecentOrdersLoading(true);

    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, created_at, address, menu, total, memo, payment_method, delivery_fee, delivery_distance_km, status",
      )
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(5);

    setRecentOrdersLoading(false);

    if (error) {
      alert("최근 주문 조회 실패: " + error.message);
      return;
    }

    if (!data || data.length === 0) {
      setRecentOrders([]);
      alert("해당 휴대폰번호의 주문내역이 없습니다.");
      return;
    }

    setRecentOrders(data as RecentOrder[]);
  };

  const goOrderLookup = async () => {
    const phone = normalizePhone(orderLookupPhone);

    if (!phone) {
      alert("휴대폰번호를 입력해주세요.");
      return;
    }

    const { data, error } = await supabase
      .from("orders")
      .select("id")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      alert("해당 휴대폰번호의 주문내역이 없습니다.");
      return;
    }

    router.push(`/order/${data.id}`);
  };

  const checkStamp = async () => {
    const phone = normalizePhone(form.phone);

    if (!phone) {
      alert("전화번호를 먼저 입력해주세요.");
      return;
    }

    const { data, error } = await supabase
      .from("stamp_customers")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();

    if (error) {
      alert("스탬프 조회 실패: " + error.message);
      return;
    }

    if (!data) {
      setStampCustomer({
        phone,
        stamp_count: 0,
        total_orders: 0,
      });

      setUseStampReward(false);
      alert("첫 주문 고객입니다. 현재 스탬프 0개");
      return;
    }

    setStampCustomer(data);
    setUseStampReward(false);
    alert(`현재 스탬프 ${data.stamp_count}개`);
  };

  const parseOrderMenuToCart = (menuText: string) => {
    try {
      const parsed = JSON.parse(menuText) as {
        name: string;
        qty: number;
        basePrice?: number;
        options?: SelectedOption[];
        total: number;
      }[];

      return parsed.map((item, index) => {
        const qty = Number(item.qty || 1);
        const options = item.options || [];
        const optionSum = options.reduce(
          (sum, option) => sum + Number(option.price || 0),
          0,
        );
        const unitTotal = Math.round(Number(item.total || 0) / Math.max(qty, 1));
        const basePrice = Number(item.basePrice || Math.max(unitTotal - optionSum, 0));

        return {
          cartId: `reorder-${Date.now()}-${index}`,
          menuId: 0,
          name: item.name,
          basePrice,
          qty,
          options,
          total: Number(item.total || unitTotal * qty),
        };
      });
    } catch {
      return [];
    }
  };

  const formatOrderDate = (dateText: string) => {
    const date = new Date(dateText);

    return date.toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getOrderMenuSummary = (menuText: string) => {
    const lines = parseOrderMenuToCart(menuText);

    if (lines.length === 0) return "메뉴정보 없음";

    const first = lines[0];
    const totalQty = lines.reduce((sum, item) => sum + Number(item.qty || 0), 0);

    if (lines.length === 1) {
      return `${first.name} x${first.qty}`;
    }

    return `${first.name} x${first.qty} 외 ${lines.length - 1}개 / 총 ${totalQty}개`;
  };

  const reorderSame = (order: RecentOrder) => {
    const nextCart = parseOrderMenuToCart(order.menu);

    if (nextCart.length === 0) {
      alert("이전 주문 메뉴를 불러오지 못했습니다.");
      return;
    }

    const phone = normalizePhone(orderLookupPhone);

    setCart(nextCart);
    setForm((prev) => ({
      ...prev,
      phone: phone || prev.phone,
      address: order.address || prev.address,
    }));

    setSelectedBaseAddress("");
    setDetailAddress("");
    setShowOrderForm(true);
    setShowOrderLookup(false);

    if (order.payment_method) {
      setPaymentMethod(order.payment_method);
    }

    if (order.address) {
      calculateDeliveryFee(order.address);
    }

    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: "smooth",
    });

    alert("이전 주문을 장바구니에 담았습니다.");
  };

  const autoFillAddress = async (phoneRaw: string) => {
    const phone = normalizePhone(phoneRaw);

    if (phone.length < 10) return;

    const { data } = await supabase
      .from("orders")
      .select("address")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.address) {
      setForm((prev) => ({
        ...prev,
        address: data.address,
      }));

      saveCustomerInfo({
        address: data.address,
      });

      calculateDeliveryFee(data.address);
    }
  };

  const calculateDeliveryFee = async (customerAddress: string) => {
    const cleanAddress = customerAddress.trim();

    if (!cleanAddress) {
      setDeliveryDistance(0);
      setDeliveryFee(0);
      setDeliveryStatus("주소를 입력하면 배달비가 자동 계산됩니다.");
      return;
    }

    setDeliveryStatus("배달비 계산 중...");

    const loaded = await loadKakaoMap();

    if (!loaded || !window.kakao?.maps?.services) {
      setDeliveryStatus(
        "카카오 지도 연결이 안 됐습니다. .env.local 키와 Web 플랫폼 등록을 확인해주세요.",
      );
      return;
    }

    const applyDistance = (lat: number, lng: number) => {
      // 가게 주소: 전주시 완산구 효자천변2길 12-6
      // 카카오가 가게 주소를 못 찾는 경우를 막으려고 가게 좌표는 고정값으로 사용
      const storeLat = 35.8083;
      const storeLng = 127.1153;

      const distance = getDistanceFromLatLonInKm(
        storeLat,
        storeLng,
        lat,
        lng,
      );

      setDeliveryDistance(distance);

      if (distance > MAX_DELIVERY_DISTANCE_KM) {
        setDeliveryFee(0);
        setDeliveryStatus(
          `${distance.toFixed(1)}km / 배달 가능 거리 8km를 초과했습니다.`,
        );
        return;
      }

      if (distance <= 2) {
        setDeliveryFee(1000);
        setDeliveryStatus("2km 이내 배달비 1,000원");
        return;
      }

      const extraDistance = distance - 2;
      const fee = 1000 + Math.ceil(extraDistance * 10) * 100;

      setDeliveryFee(fee);
      setDeliveryStatus(
        `${distance.toFixed(1)}km / 배달비 ${fee.toLocaleString()}원`,
      );
    };

    const geocoder = new window.kakao.maps.services.Geocoder();

    geocoder.addressSearch(
      cleanAddress,
      (customerResult: any, customerStatus: any) => {
        if (
          customerStatus === window.kakao.maps.services.Status.OK &&
          customerResult?.[0]
        ) {
          const customerLat = parseFloat(customerResult[0].y);
          const customerLng = parseFloat(customerResult[0].x);
          applyDistance(customerLat, customerLng);
          return;
        }

        // 도로명주소로 못 찾으면 아파트명/건물명 키워드 검색으로 한 번 더 찾기
        const places = new window.kakao.maps.services.Places();
        const keyword = cleanAddress.includes("전주")
          ? cleanAddress
          : `전주 ${cleanAddress}`;

        places.keywordSearch(keyword, (data: any, status: any) => {
          if (status !== window.kakao.maps.services.Status.OK || !data?.[0]) {
            setDeliveryDistance(0);
            setDeliveryFee(0);
            setDeliveryStatus(
              "주소를 찾지 못했습니다. 주소검색 버튼으로 아파트/건물명을 선택해주세요.",
            );
            return;
          }

          const customerLat = parseFloat(data[0].y);
          const customerLng = parseFloat(data[0].x);
          applyDistance(customerLat, customerLng);
        });
      },
    );
  };

  const searchAddressKeyword = async () => {
    const keyword = addressKeyword.trim();

    if (!keyword) {
      alert("아파트명이나 건물명을 입력해주세요.");
      return;
    }

    const loaded = await loadKakaoMap();

    if (!loaded || !window.kakao?.maps?.services) {
      alert("카카오 지도가 준비되지 않았습니다.");
      return;
    }

    setDeliveryStatus("주소 검색 중...");

    const places = new window.kakao.maps.services.Places();
    const query = keyword.includes("전주") ? keyword : `전주 ${keyword}`;

    places.keywordSearch(query, (data: any, status: any) => {
      if (status !== window.kakao.maps.services.Status.OK || !data?.length) {
        setAddressResults([]);
        setDeliveryStatus("검색 결과가 없습니다. 동 이름을 같이 입력해보세요.");
        return;
      }

      setAddressResults(data.slice(0, 8));
      setDeliveryStatus("검색 결과에서 주소를 선택해주세요.");
    });
  };

  const selectAddressResult = (place: any) => {
    const baseAddress =
      place.road_address_name || place.address_name || place.place_name || "";

    if (!baseAddress) {
      alert("주소 정보를 찾을 수 없습니다.");
      return;
    }

    const fullAddress = `${baseAddress} ${detailAddress}`.trim();

    setSelectedBaseAddress(baseAddress);
    setForm((prev) => ({
      ...prev,
      address: fullAddress,
    }));

    saveCustomerInfo({
      address: fullAddress,
      detailAddress,
    });

    setShowAddressSearch(false);
    calculateDeliveryFee(baseAddress);
  };

  const updateDetailAddress = (value: string) => {
    setDetailAddress(value);

    if (selectedBaseAddress) {
      const nextAddress = `${selectedBaseAddress} ${value}`.trim();

      setForm((prev) => ({
        ...prev,
        address: nextAddress,
      }));

      saveCustomerInfo({
        address: nextAddress,
        detailAddress: value,
      });

      return;
    }

    saveCustomerInfo({
      detailAddress: value,
    });
  };

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      alert("현재 위치를 지원하지 않는 브라우저입니다.");
      return;
    }

    const loaded = await loadKakaoMap();

    if (!loaded || !window.kakao?.maps?.services) {
      alert("카카오 지도가 준비되지 않았습니다.");
      return;
    }

    setGettingLocation(true);
    setDeliveryStatus("현재 위치 가져오는 중...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        const geocoder = new window.kakao.maps.services.Geocoder();
        const coord = new window.kakao.maps.LatLng(lat, lng);

        geocoder.coord2Address(
          coord.getLng(),
          coord.getLat(),
          (result: any, status: any) => {
            setGettingLocation(false);

            if (status !== window.kakao.maps.services.Status.OK || !result?.[0]) {
              setDeliveryStatus("현재 위치 주소 변환 실패");
              return;
            }

            const address =
              result[0].road_address?.address_name ||
              result[0].address?.address_name;

            if (!address) {
              setDeliveryStatus("주소를 찾지 못했습니다.");
              return;
            }

            const fullAddress = `${address} ${detailAddress}`.trim();

            setSelectedBaseAddress(address);
            setForm((prev) => ({
              ...prev,
              address: fullAddress,
            }));

            saveCustomerInfo({
              address: fullAddress,
              detailAddress,
            });

            calculateDeliveryFee(address);
          },
        );
      },
      (error) => {
        setGettingLocation(false);
        setDeliveryStatus("위치 권한이 거부되었습니다.");
        alert("위치 권한 허용이 필요합니다. 브라우저 위치 권한을 허용해주세요.");
        console.log(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

  const getDistanceFromLatLonInKm = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) *
        Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const deg2rad = (deg: number) => {
    return deg * (Math.PI / 180);
  };

  const groupedMenu = menus.reduce((result: Record<string, Menu[]>, menu) => {
    const category =
      menu.category && menu.category.trim() !== "" ? menu.category : "기타";

    if (!result[category]) result[category] = [];
    result[category].push(menu);

    return result;
  }, {});

  const getGroupsByMenuId = (menuId:number)=>{

const groupIds = links
.filter(
(link)=>link.menu_id===menuId
)
.map(
(link)=>link.group_id
);

return groups.filter(
(group)=>groupIds.includes(group.id)
);

};

  const getItemsByGroupId = (groupId: number) =>
    items.filter((item) => item.group_id === groupId);

  const openOptionModal = (menu: Menu) => {
    if (menu.is_soldout) return alert("품절된 메뉴입니다.");

    // 수정: 메뉴 상세창을 열 때 필수 옵션은 첫 번째 판매중 옵션으로 기본 선택
    // 선택 누락으로 주문 진행이 막히는 것을 줄이고, 배민처럼 바로 담기 가능한 흐름으로 개선
    const defaultSelectedOptions = getGroupsByMenuId(menu.id).reduce<
      Record<number, OptionItem[]>
    >((result, group) => {
      const availableOptions = getItemsByGroupId(group.id).filter(
        (option) => !option.is_soldout,
      );

      if (group.required && availableOptions.length > 0) {
        result[group.id] = [availableOptions[0]];
      }

      return result;
    }, {});

    setSelectedMenu(menu);
    setSelectedOptions(defaultSelectedOptions);
    setOptionModalQty(1);
  };

  const closeOptionModal = () => {
    setSelectedMenu(null);
    setSelectedOptions({});
    setOptionModalQty(1);
  };

  const toggleOption = (group: OptionGroup, option: OptionItem) => {
    if (option.is_soldout) return alert("품절된 옵션입니다.");

    setSelectedOptions((prev) => {
      const current = prev[group.id] || [];

      const exists = current.some((item) => item.id === option.id);

      // 수정: 단일 선택 옵션도 같은 항목을 다시 누르면 선택 해제되게 처리
      // 실수로 선택했을 때 바로 뺄 수 있고, 필수 옵션은 장바구니 담기 시 다시 검증됨
      if (group.type === "single") {
        return { ...prev, [group.id]: exists ? [] : [option] };
      }


      return {
        ...prev,
        [group.id]: exists
          ? current.filter((item) => item.id !== option.id)
          : [...current, option],
      };
    });
  };

  const optionTotal = Object.values(selectedOptions)
    .flat()
    .reduce((sum, option) => sum + option.price, 0);

  const selectedMenuTotal = selectedMenu ? selectedMenu.price + optionTotal : 0;

  const addCartWithOptions = () => {
    if (!selectedMenu) return;

    const optionGroups = getGroupsByMenuId(selectedMenu.id);

    for (const group of optionGroups) {
      if (group.required) {
        const selected = selectedOptions[group.id] || [];

        if (selected.length === 0) {
          return alert(`${group.name} 옵션을 선택해주세요.`);
        }
      }
    }

    const options: SelectedOption[] = Object.entries(selectedOptions).flatMap(
      ([groupId, optionList]) => {
        const group = groups.find((item) => item.id === Number(groupId));

        return optionList.map((option) => ({
          groupName: group?.name || "옵션",
          optionName: option.name,
          price: option.price,
        }));
      },
    );

    const cartId = `${selectedMenu.id}-${JSON.stringify(options)}-${Date.now()}`;

    setCart((prev) => [
      ...prev,
      {
        cartId,
        menuId: selectedMenu.id,
        name: selectedMenu.name,
        basePrice: selectedMenu.price,
        qty: optionModalQty,
        options,
        total: selectedMenuTotal * optionModalQty,
      },
    ]);

    closeOptionModal();
  };

  const getUnitPrice = (item: CartItem) => {
    return (
      item.basePrice +
      item.options.reduce((sum, option) => sum + option.price, 0)
    );
  };

  const increaseCart = (cartId: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.cartId === cartId
          ? {
              ...item,
              qty: item.qty + 1,
              total: getUnitPrice(item) * (item.qty + 1),
            }
          : item,
      ),
    );
  };

  const decreaseCart = (cartId: string) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.cartId === cartId
            ? {
                ...item,
                qty: item.qty - 1,
                total: getUnitPrice(item) * (item.qty - 1),
              }
            : item,
        )
        .filter((item) => item.qty > 0),
    );
  };

  const removeCart = (cartId: string) => {
    setCart((prev) => prev.filter((item) => item.cartId !== cartId));
  };

  const menuTotal = cart.reduce((sum, item) => sum + item.total, 0);
  const total = menuTotal + deliveryFee;

  const stampCount = stampCustomer?.stamp_count || 0;
  const availableStampDiscount = getStampDiscount(stampCount);
  const finalStampDiscount = useStampReward
    ? Math.min(availableStampDiscount, total)
    : 0;
  const finalTotal = Math.max(total - finalStampDiscount, 0);

  const scrollToCategory = (category: string) => {
    const target = categoryRefs.current[category];

    target?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const scrollToCart = () => {
    setShowOrderForm(true);

    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setMobileCartOpen(true);
      return;
    }

    setTimeout(() => {
      const target = orderFormRef.current || cartRef.current;

      target?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  };

  const submitOrder = async () => {
    if (submittingOrder) return;

    setSubmittingOrder(true);

    try {
      const liveStoreStatus = getStoreStatus(new Date());

      if (!liveStoreStatus.isOpen) {
        alert(`${liveStoreStatus.title}\n${liveStoreStatus.message}`);
        return;
      }

      if (cart.length === 0) {
        alert("메뉴를 담아주세요");
        return;
      }

      if (menuTotal < 10000) {
        alert(
          `최소 주문금액은 10,000원입니다.\n현재 메뉴금액 ${menuTotal.toLocaleString()}원`,
        );
        return;
      }

      const finalAddress = selectedBaseAddress
        ? `${selectedBaseAddress} ${detailAddress}`.trim()
        : `${form.address} ${detailAddress}`.trim();

      if (!form.phone || !finalAddress) {
        alert("전화번호와 주소를 입력해주세요");
        return;
      }

      if (!isValidKoreanPhone(form.phone)) {
        alert("휴대폰번호는 010으로 시작하는 11자리 번호로 입력해주세요.");
        return;
      }

      if (deliveryDistance > MAX_DELIVERY_DISTANCE_KM) {
        alert(
          `배달 가능 거리는 최대 8km입니다.\n현재 거리: ${deliveryDistance.toFixed(1)}km`,
        );
        return;
      }

      if (
        deliveryStatus.includes("주소를 찾지 못했습니다") ||
        deliveryStatus.includes("초과")
      ) {
        alert("배달 가능한 주소인지 다시 확인해주세요.");
        return;
      }

      if (!paymentMethod) {
        alert("결제수단을 선택해주세요.");
        return;
      }

      const phone = normalizePhone(form.phone);

      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .eq("phone", phone)
        .maybeSingle();

      if (customerError) {
        alert("고객 정보 확인 실패: " + customerError.message);
        return;
      }

      if (!customerData) {
        const { error: insertCustomerError } = await supabase
          .from("customers")
          .insert({
            phone,
            name: form.name || "고객",
            order_count: 1,
          });

        if (insertCustomerError) {
          alert("신규 고객 등록 실패: " + insertCustomerError.message);
          return;
        }
      } else {
        const { error: updateCustomerError } = await supabase
          .from("customers")
          .update({
            name: form.name || customerData.name || "고객",
            order_count: Number(customerData.order_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("phone", phone);

        if (updateCustomerError) {
          alert("기존 고객 주문횟수 업데이트 실패: " + updateCustomerError.message);
          return;
        }
      }

      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

      const { data: duplicateOrder, error: duplicateError } = await supabase
        .from("orders")
        .select("id")
        .eq("phone", phone)
        .gte("created_at", oneMinuteAgo)
        .in("status", ["접수대기", "접수완료"])
        .limit(1);

      if (duplicateError) {
        alert("중복 주문 확인 실패: " + duplicateError.message);
        return;
      }

      if (duplicateOrder && duplicateOrder.length > 0) {
        alert(
          "같은 번호로 최근 주문이 접수되었습니다.\n잠시 후 다시 시도해주세요.",
        );
        return;
      }

      const menuText = JSON.stringify(
        cart.map((item) => ({
          name: item.name,
          qty: item.qty,
          basePrice: item.basePrice,
          options: item.options,
          total: item.total,
        })),
      );

      const paymentMemo =
        paymentMethod === "계좌이체"
          ? `${paymentMethod} / ${bankInfo}`
          : paymentMethod;

      const finalMemo = [selectedRequest, form.memo, paymentMemo]
        .filter(Boolean)
        .join(" / ");

      const { data, error } = await supabase
        .from("orders")
        .insert({
          customer: form.name || "고객",
          phone,
          address: finalAddress,
          menu: menuText,
          total: finalTotal,
          status: "접수대기",
          memo: finalMemo,
          payment_method: paymentMethod,
          delivery_fee: deliveryFee,
          delivery_distance_km: Number(deliveryDistance.toFixed(2)),
          stamp_discount: finalStampDiscount,
          used_stamp_reward: useStampReward,
          stamp_processed: false,
          device_id:getDeviceId(),
          device_info:getDeviceInfo(),
        })
        .select("id")
        .single();

      if (error) {
        alert("주문 저장 실패: " + error.message);
        return;
      }

      if (!data?.id) {
        alert("주문번호 생성 실패");
        return;
      }

      const { data: stampData } = await supabase
        .from("stamp_customers")
        .select("*")
        .eq("phone", phone)
        .maybeSingle();

      if (!stampData) {
        await supabase
          .from("stamp_customers")
          .insert({
            phone,
            stamp_count: 1,
            total_orders: 1,
          });
      } else {
        let nextStamp =
          Number(stampData.stamp_count || 0) + 1;

        if (useStampReward) {
          nextStamp = Math.max(
            nextStamp - Math.floor(finalStampDiscount / 500),
            0
          );
        }

        await supabase
          .from("stamp_customers")
          .update({
            stamp_count: nextStamp,
            total_orders:
              Number(stampData.total_orders || 0) + 1,
          })
          .eq("phone", phone);
      }

      saveCustomerInfo({
        phone: formatPhone(form.phone),
        address: finalAddress,
        detailAddress,
      });

      router.push(`/order/${data.id}`);
    } finally {
      setSubmittingOrder(false);
    }
  };

  const storeStatus = getStoreStatus(currentTime);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] bg-[radial-gradient(circle_at_top,#3b2f0b_0%,#050505_34%)] pb-24 text-[#f7e7b0] md:pb-0">
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/space-bg.png')" }}
      />

      <div className="fixed inset-0 z-0 bg-[#050505]/82" />

      <div className="relative z-10 mx-auto w-full max-w-[520px] px-4 py-4 md:max-w-6xl md:p-6 /* 황제수정: 모바일 화면 폭/여백 확대 */">
        <section className="mb-4 flex min-h-[30vh] flex-col items-center justify-center rounded-[28px] /* 황제수정: 첫 화면을 더 크게 */ border border-[#d4af3735] bg-gradient-to-b from-[#151007]/95 via-black/78 to-[#050505]/95 px-4 py-5 text-center shadow-[0_0_42px_rgba(212,175,55,.16)] backdrop-blur-xl md:mb-8 md:min-h-[54vh] md:rounded-3xl md:py-6">
          <img
            src="/images/penguin-logo.png"
            alt="황제떡볶이"
            className="w-[170px] object-contain /* 황제수정: 로고 확대 */ drop-shadow-[0_0_42px_rgba(212,175,55,.75)] md:w-[700px]"
          />

          <div className="mt-3 rounded-full border border-[#d4af3748] bg-[#120e05]/85 px-4 py-1.5 text-xs font-black tracking-[-0.03em] text-[#f4d56d] md:text-xs">
            효자동 순대 · 내장 맛집
          </div>

          <div className="mt-3 rounded-2xl border border-[#d4af3728] bg-[#050505]/90 px-4 py-3 text-sm font-black text-zinc-200 md:text-sm">
            최소 주문금액
            <span className="ml-2 text-[#f4d56d]">10,000원</span>
          </div>

          <div
            className={`mt-3 w-full max-w-md rounded-3xl border px-4 py-4 text-left shadow-lg md:max-w-sm ${
              storeStatus.isOpen
                ? "border-green-400/35 bg-green-950/35 shadow-green-500/10"
                : "border-red-400/35 bg-red-950/35 shadow-red-500/10"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-black text-zinc-300 md:text-base">
                영업시간
              </div>
              <div
                className={`rounded-full px-3 py-1.5 text-xs font-black ${
                  storeStatus.isOpen
                    ? "bg-green-500 text-black"
                    : "bg-red-500 text-white"
                }`}
              >
                {storeStatus.title}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">

<div className="rounded-xl border border-[#d4af3720] bg-[#111111]/80 p-2">
<div className="text-xs font-black text-[#f4d56d]">월 · 목 · 금</div>
<div className="mt-1 text-xs text-zinc-300">오후 4시 ~ 새벽 3시</div>
</div>

<div className="rounded-xl border border-[#d4af3720] bg-[#111111]/80 p-2">
<div className="text-xs font-black text-[#f4d56d]">화요일</div>
<div className="mt-1 text-xs text-zinc-300">오후 4시 ~ 새벽 2시</div>
</div>

<div className="rounded-xl border border-[#d4af3720] bg-[#111111]/80 p-2">
<div className="text-xs font-black text-[#f4d56d]">주말</div>
<div className="mt-1 text-xs text-zinc-300">오후 3시 ~ 새벽 3시</div>
</div>

<div className="rounded-xl border border-red-500/20 bg-red-950/30 p-2">
<div className="text-xs font-black text-red-300">수요일</div>
<div className="mt-1 text-xs text-zinc-300">정기휴무</div>
</div>

</div>

<div className={`mt-2 text-xs font-black md:text-xs ${
storeStatus.isOpen ? "text-green-300" : "text-red-300"
}`}>
{storeStatus.message}
</div>
          </div>

          <div className="mt-4 grid w-full max-w-md grid-cols-2 gap-3 md:max-w-lg">
            <a
              href="/stamp"
              className="rounded-xl border border-[#d4af3748] bg-[#050505]/90 px-4 py-3 text-sm font-black text-[#f4d56d] shadow-lg shadow-[#d4af37]/10 md:text-sm"
            >
              내 스탬프
            </a>

            <button
              type="button"
              onClick={() => setShowOrderLookup(!showOrderLookup)}
              className="rounded-xl bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] px-4 py-3 text-sm font-black text-black shadow-lg shadow-[#d4af37]/20 md:text-sm"
            >
              📦 주문내역
            </button>
          </div>

          {showOrderLookup && (
            <div className="mt-3 w-full max-w-xs rounded-xl border border-[#d4af3735] bg-[#050505]/92 p-2.5 md:max-w-sm">
              <input
                placeholder="휴대폰번호 입력"
                value={orderLookupPhone}
                onChange={(e) => {
                  setOrderLookupPhone(formatPhone(e.target.value));
                  setRecentOrders([]);
                }}
                className="w-full rounded-lg border border-[#d4af3728] bg-[#060606] p-2 text-center text-xs font-bold text-[#fff2b8] outline-none placeholder:text-zinc-500 focus:border-yellow-500 md:text-sm"
              />

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={fetchRecentOrders}
                  disabled={recentOrdersLoading}
                  className="rounded-2xl border border-[#d4af3735] bg-[#050505] p-4 text-sm font-black text-[#f4d56d]"
                >
                  {recentOrdersLoading ? "불러오는 중" : "최근주문"}
                </button>

                <button
                  type="button"
                  onClick={goOrderLookup}
                  className="rounded-2xl bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] p-4 text-sm font-black text-black"
                >
                  상태보기
                </button>
              </div>

              {recentOrders.length > 0 && (
                <div className="mt-3 space-y-2">
                  {recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="rounded-xl border border-[#d4af3724] bg-[#070707] p-2.5 text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-zinc-500">
                            #{order.id} · {formatOrderDate(order.created_at)} · {order.status}
                          </div>
                          <div className="mt-1 truncate text-xs font-black text-[#fff2b8]">
                            {getOrderMenuSummary(order.menu)}
                          </div>
                          <div className="mt-1 truncate text-xs text-zinc-500">
                            {order.address}
                          </div>
                        </div>

                        <div className="shrink-0 text-xs font-black text-[#f4d56d]">
                          {Number(order.total || 0).toLocaleString()}원
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => reorderSame(order)}
                        className="mt-2 w-full rounded-lg bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] p-2 text-xs font-black text-black"
                      >
                        그대로 재주문
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>


        <div className="sticky top-0 z-30 mb-4 -mx-4 border-y border-[#d4af3724] bg-[#050505]/95 px-4 py-3 shadow-xl shadow-black/60 backdrop-blur md:top-0 md:mx-0 md:rounded-xl md:border md:px-3">
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {Object.keys(groupedMenu).map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => scrollToCategory(category)}
                className="shrink-0 rounded-full border border-[#d4af3735] bg-gradient-to-b from-[#17130a] to-[#050505] px-4 py-3 text-sm font-black text-[#f4d56d] shadow-[0_0_14px_rgba(212,175,55,.12)] active:bg-gradient-to-r active:from-[#fff1a8] active:via-[#d4af37] active:to-[#8a6a14] active:text-black md:text-sm"
              >
                {category}
              </button>
            ))}

            {cart.length > 0 && (
              <button
                type="button"
                onClick={scrollToCart}
                className="shrink-0 rounded-full bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] px-4 py-3 text-sm font-black text-black shadow-lg shadow-[#d4af37]/20 md:hidden"
              >
                🛒 장바구니
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="space-y-5">
              {Object.entries(groupedMenu).map(([category, menuItems]) => (
                <section
                  key={category}
                  ref={(element) => {
                    categoryRefs.current[category] = element;
                  }}
                  className="scroll-mt-20 md:scroll-mt-24"
                >
                  <h2 className="mb-3 border-b border-[#d4af3735] bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] bg-clip-text pb-1.5 text-xl font-black tracking-[-0.04em] /* 황제수정: 카테고리 제목 확대 */ text-transparent drop-shadow-[0_0_18px_rgba(212,175,55,.25)] md:text-xl">
                    {category}
                  </h2>

                  <div className="grid gap-3">
                    {menuItems.map((menu) => (
                      <div
                        key={menu.id}
                        className={`rounded-[24px] border border-[#d4af3728] bg-gradient-to-b from-[#111111]/95 to-[#050505]/95 p-4 /* 황제수정: 메뉴 카드 확대 */ shadow-[0_0_16px_rgba(212,175,55,.07)] backdrop-blur-xl transition-all duration-300 hover:border-[#d4af37] hover:shadow-[0_0_30px_rgba(212,175,55,.22)] ${
                          menu.is_soldout ? "opacity-50" : ""
                        }`}
                      >
                        <div className="flex justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-black tracking-[-0.04em] text-[#fff8d9] md:text-xl">
                              {menu.name}
                            </h3>

                            <div className="mt-1 text-sm leading-relaxed text-zinc-400 md:text-base">
                              {menu.description || ""}
                            </div>

                            <div className="mt-2 text-xl font-black text-[#f4d56d] md:text-2xl">
                              {menu.price.toLocaleString()}원
                            </div>
                          </div>

                          {menu.is_soldout && (
                            <div className="h-fit rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-black">
                              품절
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => openOptionModal(menu)}
                          disabled={menu.is_soldout}
                          className={`mt-3 w-full rounded-2xl p-3.5 text-sm font-black md:text-base ${
                            menu.is_soldout
                              ? "bg-zinc-800 text-zinc-500"
                              : "bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] text-black shadow-[0_0_22px_rgba(212,175,55,.28)]"
                          }`}
                        >
                          {menu.is_soldout ? "품절" : "선택하기"}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <aside className={`${showOrderForm ? "block" : "hidden"} md:block`}>
            <div ref={cartRef} className="md:sticky md:top-3 rounded-2xl border border-[#d4af3735] bg-gradient-to-b from-[#111111]/95 to-[#050505]/95 p-4 shadow-2xl shadow-black/70 backdrop-blur">
              <h2 className="mb-3 text-xl font-black text-[#f4d56d] md:text-2xl">
                장바구니
              </h2>

              {cart.length === 0 && (
                <div className="rounded-xl bg-zinc-900/80 p-4 text-sm text-zinc-500">
                  메뉴를 담아주세요
                </div>
              )}

              {cart.map((item) => (
                <div
                  key={item.cartId}
                  className="border-b border-zinc-900 py-2"
                >
                  <div className="text-base font-black text-[#fff8d9] md:text-lg">{item.name}</div>

                  {item.options.length > 0 && (
                    <div className="mt-2 space-y-1 text-xs text-zinc-400">
                      {item.options.map((option, index) => (
                        <div key={index}>
                          - {option.groupName}: {option.optionName}
                          {option.price > 0 &&
                            ` +${option.price.toLocaleString()}원`}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="text-base font-black text-[#f4d56d] md:text-lg">
                      {item.total.toLocaleString()}원
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => decreaseCart(item.cartId)}
                        className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-black"
                      >
                        -
                      </button>

                      <div className="px-1 text-sm font-black">{item.qty}</div>

                      <button
                        onClick={() => increaseCart(item.cartId)}
                        className="rounded-md bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] px-2 py-0.5 text-xs font-black text-black"
                      >
                        +
                      </button>

                      <button
                        onClick={() => removeCart(item.cartId)}
                        className="rounded-md bg-red-700 px-2 py-0.5 text-xs font-black"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <div className="mt-3">
                <div className="rounded-lg border border-[#d4af3718] bg-[#050505]/82 p-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">메뉴금액</span>
                    <span className="font-bold">
                      {menuTotal.toLocaleString()}원
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-zinc-400">
                      배달비 ({deliveryDistance.toFixed(1)}km)
                    </span>

                    <span className="text-base font-black text-[#f4d56d] md:text-lg">
                      {deliveryFee.toLocaleString()}원
                    </span>
                  </div>
                </div>

                <div className="mt-2 text-xs text-zinc-500">총금액</div>

                <div className="text-xl font-black text-[#f4d56d] md:text-2xl">
                  {total.toLocaleString()}원
                </div>

                {useStampReward && (
                  <div className="mt-2 text-base font-black text-green-400">
                    스탬프 할인 -{finalStampDiscount.toLocaleString()}원
                  </div>
                )}

                <div className="mt-1 text-base font-black text-red-400 md:text-lg">
                  결제금액 {finalTotal.toLocaleString()}원
                </div>

                {cart.length > 0 && menuTotal < 10000 && (
                  <div className="mt-2 text-sm text-red-400">
                    최소 주문금액까지 {(10000 - menuTotal).toLocaleString()}원
                    부족
                  </div>
                )}

                {deliveryDistance > MAX_DELIVERY_DISTANCE_KM && (
                  <div className="mt-2 rounded-lg border border-red-500/30 bg-red-950/40 p-2 text-sm font-black text-red-300">
                    배달 가능 거리 8km 초과로 주문할 수 없습니다.
                  </div>
                )}

                {!storeStatus.isOpen && (
                  <div className="mt-2 rounded-lg border border-red-500/30 bg-red-950/40 p-2 text-xs font-black leading-relaxed text-red-300 md:text-sm">
                    {storeStatus.title} · {storeStatus.message}
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowOrderForm(true)}
                disabled={
                  !storeStatus.isOpen ||
                  cart.length === 0 ||
                  menuTotal < 10000 ||
                  deliveryDistance > MAX_DELIVERY_DISTANCE_KM
                }
                className={`mt-4 w-full rounded-2xl p-4 text-base font-black ${
                  !storeStatus.isOpen ||
                  cart.length === 0 ||
                  menuTotal < 10000 ||
                  deliveryDistance > MAX_DELIVERY_DISTANCE_KM
                    ? "bg-zinc-800 text-zinc-500"
                    : "bg-red-500"
                }`}
              >
                {storeStatus.isOpen ? "주문하기" : "영업시간 외 주문불가"}
              </button>

              {showOrderForm && (
                <div ref={orderFormRef} className="mt-3 scroll-mt-24 space-y-2">
                  <input
                    placeholder="닉네임"
                    value={form.name}
                    onChange={(e) => {
                      const next = { ...form, name: e.target.value };
                      setForm(next);
                      saveCustomerInfo({
                        name: next.name,
                        phone: next.phone,
                        address: next.address,
                      });
                    }}
                    className="w-full rounded-2xl border border-[#d4af3724] bg-[#050505] p-4 text-base text-[#fff8d9] outline-none placeholder:text-zinc-600 focus:border-yellow-500"
                  />

                  <input
                    placeholder="전화번호 *"
                    value={form.phone}
                    onChange={(e) => {
                      const value = formatPhone(e.target.value);
                      const next = { ...form, phone: value };

                      setForm(next);
                      saveCustomerInfo({
                        name: next.name,
                        phone: next.phone,
                        address: next.address,
                      });
                      setStampCustomer(null);
                      setUseStampReward(false);

                      if (normalizePhone(value).length === 11) {
                        autoFillAddress(value);
                      }
                    }}
                    className="w-full rounded-2xl border border-[#d4af3724] bg-[#050505] p-4 text-base text-[#fff8d9] outline-none placeholder:text-zinc-600 focus:border-yellow-500"
                  />

                  {form.phone && !isValidKoreanPhone(form.phone) && (
                    <div className="rounded-lg border border-red-500/30 bg-red-950/40 p-2 text-xs font-bold text-red-300">
                      010으로 시작하는 11자리 휴대폰번호를 입력해주세요.
                    </div>
                  )}

                  <button
                    onClick={checkStamp}
                    className="w-full rounded-2xl border border-yellow-500/30 bg-[#050505] p-4 text-base font-black text-[#f4d56d] shadow-lg shadow-[#d4af37]/10"
                  >
                    스탬프 조회
                  </button>

                  {stampCustomer && (
                    <div className="rounded-xl border border-[#d4af3728] bg-[#080808] p-3">
                      <div className="text-sm font-black text-[#f4d56d]">
                        황제 단골 고객님 환영합니다
                      </div>

                      <div className="mt-2 text-sm font-black text-white">
                        🔥 현재 {stampCustomer.total_orders}번째 주문
                      </div>

                      <div className="mt-2 text-sm font-black text-green-400">
                        🎟 보유 스탬프 : {stampCustomer.stamp_count}개
                      </div>

                      <div className="mt-2 text-xs text-zinc-400">
                        💰 스탬프 1개 = 500원 할인
                      </div>

                      <div className="mt-1 text-xs text-zinc-400">
                        🎁 5개부터 사용 가능
                      </div>

                      <div className="mt-2 text-sm font-black text-yellow-400">
                        💵 사용 가능 할인 :
                        {availableStampDiscount.toLocaleString()}원
                      </div>

                      {availableStampDiscount > 0 ? (
                        <button
                          onClick={() => setUseStampReward(!useStampReward)}
                          className={`mt-2.5 w-full rounded-lg p-2.5 text-sm font-black ${
                            useStampReward
                              ? "bg-green-600"
                              : "bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] text-black"
                          }`}
                        >
                          {useStampReward
                            ? `${finalStampDiscount.toLocaleString()}원 할인 적용됨`
                            : `${availableStampDiscount.toLocaleString()}원 할인 사용하기`}
                        </button>
                      ) : (
                        <div className="mt-2 text-sm text-zinc-400">
                          스탬프 5개 이상부터 사용 가능
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddressSearch(true)}
                      className="rounded-2xl border border-[#d4af3735] bg-[#050505] p-4 text-sm font-black text-[#f4d56d] md:text-sm"
                    >
                      🔎 주소검색
                    </button>

                    <button
                      type="button"
                      onClick={getCurrentLocation}
                      disabled={gettingLocation}
                      className="rounded-2xl bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] p-4 text-sm font-black text-black md:text-sm"
                    >
                      {gettingLocation ? "📍 위치 찾는 중" : "현재위치"}
                    </button>
                  </div>

                  <input
                    placeholder="주소 * 예: 효자동 우미린, 서신동 아이파크"
                    value={form.address}
                    onChange={(e) => {
                      const value = e.target.value;
                      const next = { ...form, address: value };

                      setSelectedBaseAddress("");
                      setDetailAddress("");
                      setForm(next);
                      saveCustomerInfo({ ...next, detailAddress: "" });
                      calculateDeliveryFee(value);
                    }}
                    className="w-full rounded-2xl border border-[#d4af3724] bg-[#050505] p-4 text-base text-[#fff8d9] outline-none placeholder:text-zinc-600 focus:border-yellow-500"
                  />

                  <input
                    placeholder="상세주소 예: 101동 1001호 / 현관 비번"
                    value={detailAddress}
                    onChange={(e) => updateDetailAddress(e.target.value)}
                    className="w-full rounded-2xl border border-[#d4af3724] bg-[#050505] p-4 text-base text-[#fff8d9] outline-none placeholder:text-zinc-600 focus:border-yellow-500"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      calculateDeliveryFee(selectedBaseAddress || form.address)
                    }
                    className="w-full rounded-lg bg-zinc-900 p-2.5 text-xs font-black text-[#f4d56d] md:text-sm"
                  >
                    배달비 다시 계산
                  </button>

                  <div className="rounded-lg border border-[#d4af3718] bg-[#070707] p-2.5 text-xs md:text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">가게 기준 거리</span>
                      <span className="font-bold text-[#f4d56d]">
                        {deliveryDistance.toFixed(1)}km
                      </span>
                    </div>

                    <div className="mt-2 flex justify-between">
                      <span className="text-zinc-400">배달비</span>
                      <span className="text-base font-black text-[#f4d56d] md:text-lg">
                        {deliveryFee.toLocaleString()}원
                      </span>
                    </div>

                    <div className="mt-2 text-xs text-zinc-500">
                      2km까지 1,000원 / 이후 100m당 100원 추가
                    </div>

                    <div
                      className={`mt-2 text-xs font-bold ${
                        deliveryDistance > MAX_DELIVERY_DISTANCE_KM
                          ? "text-red-400"
                          : "text-green-400"
                      }`}
                    >
                      {deliveryStatus}
                    </div>

                    {!kakaoReady && (
                      <div className="mt-1 text-xs text-red-400">
                        카카오 지도 준비 중이거나 키 설정 확인 필요
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-[#d4af3724] bg-[#050505]/94">
                    <button
                      type="button"
                      onClick={() =>
                        setShowDeliveryRequests(!showDeliveryRequests)
                      }
                      className="flex w-full items-center justify-between p-2.5 text-sm font-black text-[#fff2b8]"
                    >
                      <span>배달 요청사항</span>
                      <span>{showDeliveryRequests ? "접기 ▲" : "열기 ▼"}</span>
                    </button>

                    {showDeliveryRequests && (
                      <div className="border-t border-[#d4af3718] p-2.5">
                        <div className="grid gap-3">
                          {deliveryRequests.map((request) => (
                            <button
                              key={request}
                              type="button"
                              onClick={() => {
                                setSelectedRequest(request);
                                setShowDeliveryRequests(false);
                              }}
                              className={`rounded-lg p-2.5 text-left text-sm font-black ${
                                selectedRequest === request
                                  ? "bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] text-black shadow-[0_0_22px_rgba(212,175,55,.28)]"
                                  : "bg-zinc-900 text-[#fff2b8]"
                              }`}
                            >
                              {request}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedRequest && (
                      <div className="px-3 pb-3 text-xs font-bold text-[#f4d56d] md:text-sm">
                        선택됨: {selectedRequest}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-[#d4af3724] bg-[#050505]/94">
                    <button
                      type="button"
                      onClick={() => setShowPaymentMethods(!showPaymentMethods)}
                      className="flex w-full items-center justify-between p-2.5 text-sm font-black text-[#fff2b8]"
                    >
                      <span>결제수단</span>
                      <span>{showPaymentMethods ? "접기 ▲" : "열기 ▼"}</span>
                    </button>

                    {showPaymentMethods && (
                      <div className="border-t border-[#d4af3718] p-2.5">
                        <div className="grid gap-3">
                          {paymentMethods.map((method) => (
                            <button
                              key={method}
                              type="button"
                              onClick={() => {
                                setPaymentMethod(method);
                                setShowPaymentMethods(false);
                              }}
                              className={`rounded-lg p-2.5 text-left text-sm font-black ${
                                paymentMethod === method
                                  ? "bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] text-black shadow-[0_0_22px_rgba(212,175,55,.28)]"
                                  : "bg-zinc-900 text-[#fff2b8]"
                              }`}
                            >
                              {method}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {paymentMethod && (
                      <div className="px-3 pb-3 text-xs font-bold text-[#f4d56d] md:text-sm">
                        선택됨: {paymentMethod}
                      </div>
                    )}
                  </div>

                  {paymentMethod === "계좌이체" && (
                    <div className="rounded-xl border border-[#d4af3735] bg-[#070707] p-3">
                      <div className="mb-2 text-sm text-zinc-400">
                        입금 계좌
                      </div>

                      <div className="text-sm font-black text-[#f4d56d] md:text-base">
                        {bankInfo}
                      </div>

                      <button
                        type="button"
                        onClick={copyBankInfo}
                        className="mt-2 w-full rounded-lg bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] p-2.5 text-sm font-black text-black"
                      >
                        계좌번호 복사
                      </button>

                      <div className="mt-2 text-xs text-zinc-400">
                        입금 확인 후 주문이 접수됩니다.
                      </div>
                    </div>
                  )}

                  <textarea
                    placeholder="추가 요청사항 예: 덜 맵게, 단무지 많이 주세요"
                    value={form.memo}
                    onChange={(e) => setForm({ ...form, memo: e.target.value })}
                    className="w-full rounded-2xl border border-[#d4af3724] bg-[#050505] p-4 text-base text-[#fff8d9] outline-none placeholder:text-zinc-600 focus:border-yellow-500"
                  />

                  <button
                    onClick={submitOrder}
                    disabled={
                      !storeStatus.isOpen ||
                      deliveryDistance > MAX_DELIVERY_DISTANCE_KM ||
                      submittingOrder
                    }
                    className={`w-full rounded-lg p-3 text-sm font-black shadow-lg ${
                      !storeStatus.isOpen ||
                      deliveryDistance > MAX_DELIVERY_DISTANCE_KM ||
                      submittingOrder
                        ? "bg-zinc-800 text-zinc-500 shadow-none"
                        : "bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] text-black shadow-[#d4af37]/20"
                    }`}
                  >
                    {submittingOrder
                      ? "주문 처리중..."
                      : !storeStatus.isOpen
                        ? "영업시간 외 주문불가"
                        : deliveryDistance > MAX_DELIVERY_DISTANCE_KM
                          ? "배달 가능 거리 초과"
                          : "주문 접수하기"}
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>


        {cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#d4af3748] bg-[#050505]/97 p-2.5 shadow-[0_-12px_40px_rgba(212,175,55,.16)] backdrop-blur-xl md:hidden">
            <button
              type="button"
              onClick={scrollToCart}
              className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] px-4 py-3 text-black shadow-lg shadow-[#d4af37]/30"
            >
              <div className="text-left">
                <div className="text-xs font-black opacity-80">
                  🛒 {cart.reduce((sum, item) => sum + item.qty, 0)}개 담김
                </div>
                <div className="text-lg font-black tracking-[-0.04em]">
                  {finalTotal.toLocaleString()}원
                </div>
              </div>

              <div className="rounded-lg bg-[#050505] px-3 py-2 text-sm font-black text-[#f4d56d]">
                주문하기
              </div>
            </button>
          </div>
        )}

        {showAddressSearch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505]/92 p-4">
            <div className="max-h-[86vh] w-full max-w-md overflow-y-auto rounded-3xl border border-[#d4af3735] bg-gradient-to-b from-[#111111] to-[#050505] p-3 shadow-[0_0_55px_rgba(212,175,55,.18)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-[#f4d56d]">
                    주소검색
                  </h2>
                  <div className="mt-1 text-xs text-zinc-400">
                    아파트명, 건물명, 도로명주소 검색 가능
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddressSearch(false)}
                  className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-black text-[#fff2b8]"
                >
                  닫기
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  placeholder="예: 효자동 우미린 / 전주 더샵"
                  value={addressKeyword}
                  onChange={(e) => setAddressKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") searchAddressKeyword();
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-[#d4af3724] bg-[#050505] p-2.5 text-sm text-[#fff8d9] outline-none placeholder:text-zinc-600 focus:border-yellow-500"
                />

                <button
                  type="button"
                  onClick={searchAddressKeyword}
                  className="rounded-lg bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] px-4 py-2.5 text-sm font-black text-black"
                >
                  검색
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {addressResults.length === 0 ? (
                  <div className="rounded-lg bg-zinc-900/80 p-3 text-sm text-zinc-500">
                    검색어를 입력하고 검색해주세요.
                  </div>
                ) : (
                  addressResults.map((place, index) => {
                    const mainAddress =
                      place.road_address_name ||
                      place.address_name ||
                      place.place_name;

                    return (
                      <button
                        key={`${place.id || index}`}
                        type="button"
                        onClick={() => selectAddressResult(place)}
                        className="w-full rounded-lg border border-[#d4af3718] bg-[#050505]/90 p-3 text-left"
                      >
                        <div className="text-sm font-black text-[#f4d56d]">
                          {place.place_name}
                        </div>
                        <div className="mt-1 text-xs text-zinc-300">
                          {mainAddress}
                        </div>
                        {place.phone && (
                          <div className="mt-1 text-xs text-zinc-500">
                            {place.phone}
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {mobileCartOpen && (
          <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm md:hidden">
            <div className="absolute bottom-0 left-0 right-0 max-h-[86vh] overflow-y-auto rounded-t-[28px] border-t border-[#d4af3748] bg-[#070707] p-3 shadow-[0_-18px_60px_rgba(212,175,55,.16)]">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-[#d4af37]">HWANGJE CART</div>
                  <div className="text-xl font-black text-[#fff2b8]">장바구니</div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileCartOpen(false)}
                  className="rounded-full border border-[#d4af3735] bg-[#111111] px-4 py-3 text-sm font-black text-[#f4d56d]"
                >
                  닫기
                </button>
              </div>

              {cart.length === 0 && (
                <div className="rounded-xl border border-zinc-800 bg-[#111111] p-4 text-center text-sm font-bold text-zinc-500">
                  메뉴를 담아주세요
                </div>
              )}

              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.cartId} className="rounded-xl border border-[#d4af3724] bg-[#101010] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-[#fff8d9]">{item.name}</div>
                        {item.options.length > 0 && (
                          <div className="mt-1 space-y-0.5 text-xs text-zinc-400">
                            {item.options.map((option, index) => (
                              <div key={index}>
                                - {option.groupName}: {option.optionName}
                                {option.price > 0 && ` +${option.price.toLocaleString()}원`}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-2 text-sm font-black text-[#f4d56d]">{item.total.toLocaleString()}원</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button onClick={() => decreaseCart(item.cartId)} className="rounded-md bg-zinc-800 px-2 py-1 text-xs font-black">-</button>
                        <div className="min-w-6 text-center text-sm font-black">{item.qty}</div>
                        <button onClick={() => increaseCart(item.cartId)} className="rounded-md bg-[#d4af37] px-2 py-1 text-xs font-black text-black">+</button>
                      </div>
                    </div>
                    <button onClick={() => removeCart(item.cartId)} className="mt-2 w-full rounded-lg border border-red-500/30 bg-red-950/35 p-2 text-xs font-black text-red-300">삭제</button>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-xl border border-[#d4af3728] bg-black/50 p-3">
                <div className="flex justify-between text-sm text-zinc-400"><span>메뉴금액</span><span>{menuTotal.toLocaleString()}원</span></div>
                <div className="mt-2 flex justify-between text-sm text-zinc-400"><span>배달비</span><span>{deliveryFee.toLocaleString()}원</span></div>
                {useStampReward && <div className="mt-2 flex justify-between text-sm text-green-400"><span>스탬프 할인</span><span>-{finalStampDiscount.toLocaleString()}원</span></div>}
                <div className="mt-3 flex justify-between border-t border-zinc-800 pt-3 text-lg font-black text-[#f4d56d]"><span>결제금액</span><span>{finalTotal.toLocaleString()}원</span></div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowOrderForm(true);
                  setMobileCartOpen(false);
                  setTimeout(() => orderFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
                }}
                disabled={!storeStatus.isOpen || cart.length === 0 || menuTotal < 10000 || deliveryDistance > MAX_DELIVERY_DISTANCE_KM}
                className={`mt-3 w-full rounded-xl p-3 text-sm font-black ${
                  !storeStatus.isOpen || cart.length === 0 || menuTotal < 10000 || deliveryDistance > MAX_DELIVERY_DISTANCE_KM
                    ? "bg-zinc-800 text-zinc-500"
                    : "bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] text-black"
                }`}
              >
                주문정보 입력하기
              </button>
            </div>
          </div>
        )}

        {selectedMenu && (
          <div className="fixed inset-0 z-[90] bg-[#050505] text-white">
            <div className="flex h-[100dvh] flex-col overflow-hidden">
              <div className="relative shrink-0 border-b border-[#d4af3730] bg-gradient-to-b from-[#151006] via-[#0b0b0b] to-[#050505] px-4 pb-5 pt-[max(14px,env(safe-area-inset-top))] shadow-[0_12px_40px_rgba(0,0,0,.55)]">
                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_22%_15%,rgba(244,213,109,.22),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(212,175,55,.14),transparent_28%)]" />

                <div className="relative flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={closeOptionModal}
                    className="grid h-10 w-10 place-items-center rounded-full border border-[#d4af3740] bg-black/45 text-xl font-black text-[#fff2b8] shadow-lg shadow-black/40"
                    aria-label="메뉴 상세 닫기"
                  >
                    ‹
                  </button>

                  <div className="min-w-0 flex-1 text-center">
                    <div className="truncate text-xs font-black uppercase tracking-[0.22em] text-[#d4af37]">
                      HWANGJE ORDER
                    </div>
                    <div className="truncate text-sm font-black text-[#fff8d9]">메뉴 상세</div>
                  </div>

                  <button
                    type="button"
                    onClick={scrollToCart}
                    className="grid h-10 min-w-10 place-items-center rounded-full border border-[#d4af3740] bg-black/45 px-3 text-sm font-black text-[#f4d56d] shadow-lg shadow-black/40"
                    aria-label="장바구니로 이동"
                  >
                    🛒
                  </button>
                </div>

                <div className="relative mt-5 overflow-hidden rounded-[28px] border border-[#d4af3735] bg-gradient-to-br from-[#1a1304] via-[#111111] to-[#050505] p-5 shadow-[0_0_42px_rgba(212,175,55,.14)]">
                  <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#d4af37]/10 blur-2xl" />
                  <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-[#fff1a8]/8 blur-3xl" />

                  <div className="relative flex min-h-[150px] flex-col justify-between">
                    <div>
                      <div className="mb-2 inline-flex rounded-full border border-[#d4af3745] bg-black/35 px-3 py-1 text-xs font-black text-[#f4d56d]">
                        황제떡볶이 대표 메뉴
                      </div>

                      <h2 className="text-[26px] font-black leading-tight tracking-[-0.06em] text-[#fff6cf] md:text-3xl">
                        {selectedMenu.name}
                      </h2>

                      {selectedMenu.description && (
                        <p className="mt-2 text-sm font-medium leading-relaxed text-zinc-300 md:text-base">
                          {selectedMenu.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-5 flex items-end justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-zinc-500">기본가격</div>
                        <div className="text-2xl font-black text-[#f4d56d]">
                          {selectedMenu.price.toLocaleString()}원
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[#d4af3730] bg-black/35 px-3 py-2 text-right">
                        <div className="text-xs font-black text-zinc-500">옵션 포함</div>
                        <div className="text-sm font-black text-[#fff2b8]">
                          {selectedMenuTotal.toLocaleString()}원
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-32 pt-4 [-webkit-overflow-scrolling:touch]">
                {getGroupsByMenuId(selectedMenu.id).length === 0 && (
                  <div className="rounded-2xl border border-[#d4af3724] bg-[#101010] p-4 text-sm font-bold text-zinc-400">
                    추가 옵션 없이 바로 담을 수 있습니다.
                  </div>
                )}

                <div className="space-y-5">
                  {getGroupsByMenuId(selectedMenu.id).map((group) => (
                    <section
                      key={group.id}
                      className="overflow-hidden rounded-[24px] border border-[#d4af372c] bg-gradient-to-b from-[#111111] to-[#070707] shadow-[0_0_24px_rgba(212,175,55,.08)]"
                    >
                      <div className="border-b border-[#d4af371d] bg-[#0c0c0c] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-xl font-black tracking-[-0.04em] /* 황제수정: 카테고리 제목 확대 */ text-[#fff8d9]">
                              {group.name}
                            </h3>
                            <p className="mt-0.5 text-xs font-bold text-zinc-500">
                              {group.type === "single" ? "하나만 선택" : "여러 개 선택"}
                            </p>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${
                              group.required
                                ? "bg-[#d4af37] text-black"
                                : "border border-[#d4af3735] text-[#f4d56d]"
                            }`}
                          >
                            {group.required ? "필수" : "선택"}
                          </span>
                        </div>
                      </div>

                      <div className="divide-y divide-[#ffffff0c]">
                        {getItemsByGroupId(group.id).map((option) => {
                          const checked =
                            selectedOptions[group.id]?.some(
                              (item) => item.id === option.id,
                            ) || false;

                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => toggleOption(group, option)}
                              disabled={option.is_soldout}
                              className={`flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition active:scale-[0.99] ${
                                option.is_soldout
                                  ? "bg-zinc-900/60 text-zinc-600"
                                  : checked
                                    ? "bg-[#d4af37]/12"
                                    : "bg-transparent text-white"
                              }`}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <span
                                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-black ${
                                    checked
                                      ? "border-[#d4af37] bg-[#d4af37] text-black"
                                      : "border-zinc-700 text-zinc-700"
                                  }`}
                                >
                                  {checked ? "✓" : ""}
                                </span>

                                <div className="min-w-0">
                                  <div className="truncate text-sm font-black text-[#fff8d9]">
                                    {option.name}
                                    {option.is_soldout && " (품절)"}
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0 text-sm font-black text-[#f4d56d]">
                                {option.price > 0
                                  ? `+${option.price.toLocaleString()}원`
                                  : "무료"}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </div>

              <div className="fixed bottom-0 left-0 right-0 z-[95] border-t border-[#d4af3735] bg-[#080808]/96 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_50px_rgba(0,0,0,.72)] backdrop-blur-xl">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center rounded-full border border-[#d4af3735] bg-[#111111] p-1">
                    <button
                      type="button"
                      onClick={() => setOptionModalQty((prev) => Math.max(1, prev - 1))}
                      className="grid h-9 w-9 place-items-center rounded-full bg-zinc-900 text-lg font-black text-[#f4d56d]"
                      aria-label="수량 감소"
                    >
                      -
                    </button>
                    <div className="min-w-12 text-center text-base font-black text-[#fff8d9]">
                      {optionModalQty}
                    </div>
                    <button
                      type="button"
                      onClick={() => setOptionModalQty((prev) => prev + 1)}
                      className="grid h-9 w-9 place-items-center rounded-full bg-[#d4af37] text-lg font-black text-black"
                      aria-label="수량 증가"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold text-zinc-500">총 합계</div>
                    <div className="text-xl font-black text-[#f4d56d]">
                      {(selectedMenuTotal * optionModalQty).toLocaleString()}원
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addCartWithOptions}
                  className="w-full rounded-3xl bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] p-5 text-lg font-black text-black shadow-[0_0_30px_rgba(212,175,55,.28)] active:scale-[0.99]"
                >
                  {(selectedMenuTotal * optionModalQty).toLocaleString()}원 담기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
