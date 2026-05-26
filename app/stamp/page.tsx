"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type StampCustomer = {
  phone: string;
  stamp_count: number;
  total_orders: number;
  last_rewarded_at?: string | null;
};

type StampRewardTier = {
  requiredStamps: number;
  discount: number;
  label: string;
  nextGuide: string;
};

export default function StampPage() {
  const [phone, setPhone] = useState("");
  const [customer, setCustomer] = useState<StampCustomer | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const normalizePhone = (value: string) => value.replace(/[^0-9]/g, "");

  const formatPhone = (value: string) => {
    const numbers = normalizePhone(value).slice(0, 11);

    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;

    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
  };

  // 황제수정: 손님 주문 페이지와 같은 스탬프 할인 정책으로 통일
  const getStampRewardTier = (stampCount: number): StampRewardTier => {
    if (stampCount >= 10) {
      return {
        requiredStamps: 10,
        discount: 6000,
        label: "스탬프 10개 = 6,000원 할인",
        nextGuide: "최대 할인 사용 가능",
      };
    }

    if (stampCount >= 5) {
      return {
        requiredStamps: 5,
        discount: 2500,
        label: "스탬프 5개 = 2,500원 할인",
        nextGuide: `${10 - stampCount}개 더 모으면 6,000원 할인 가능`,
      };
    }

    return {
      requiredStamps: 0,
      discount: 0,
      label: "5개부터 할인 사용 가능",
      nextGuide: `${5 - stampCount}개 더 모으면 2,500원 할인 가능`,
    };
  };

  const searchStamp = async () => {
    const cleanPhone = normalizePhone(phone);

    if (!cleanPhone) {
      alert("전화번호를 입력해주세요.");
      return;
    }

    if (!/^010\d{8}$/.test(cleanPhone)) {
      alert("010으로 시작하는 11자리 휴대폰번호를 입력해주세요.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("stamp_customers")
      .select("*")
      .eq("phone", cleanPhone)
      .maybeSingle();

    setLoading(false);
    setSearched(true);

    if (error) {
      alert("스탬프 조회 실패: " + error.message);
      return;
    }

    setCustomer(data as StampCustomer | null);
  };

  const stampCount = Number(customer?.stamp_count || 0);
  const rewardTier = getStampRewardTier(stampCount);
  const progressPercent = Math.min((stampCount / 10) * 100, 100);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] px-4 py-5 text-[#fff8d9]">
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/space-bg.png')" }}
      />
      <div className="fixed inset-0 z-0 bg-[#050505]/82" />

      <div className="relative z-10 mx-auto w-full max-w-[560px]">
        <section className="rounded-[30px] border border-[#d4af3735] bg-gradient-to-b from-[#151007]/95 via-black/86 to-[#050505]/96 p-5 text-center shadow-[0_0_42px_rgba(212,175,55,.16)] backdrop-blur-xl">
          <img
            src="/images/penguin-logo.png"
            alt="황제떡볶이"
            className="mx-auto w-[150px] object-contain drop-shadow-[0_0_42px_rgba(212,175,55,.75)]"
          />

          <div className="mt-4 inline-flex rounded-full border border-[#d4af3748] bg-[#120e05]/85 px-4 py-2 text-sm font-black text-[#f4d56d]">
            황제오더 앱 전용 혜택
          </div>

          <h1 className="mt-4 break-keep text-[36px] font-black leading-[1.05] tracking-[-0.08em] text-[#fff8d9]">
            내 스탬프 조회
          </h1>

          <p className="mt-3 break-keep text-[16px] font-bold leading-relaxed text-zinc-400">
            주문할 때 입력한 전화번호로 보유 스탬프와 사용 가능 할인을 확인합니다.
          </p>

          <div className="mt-6 space-y-3">
            <input
              placeholder="휴대폰번호 예: 01012345678"
              value={phone}
              onChange={(e) => {
                setPhone(formatPhone(e.target.value));
                setSearched(false);
                setCustomer(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") searchStamp();
              }}
              className="w-full rounded-2xl border border-[#d4af3728] bg-[#060606] p-4 text-center text-[20px] font-black text-[#fff8d9] outline-none placeholder:text-zinc-600 focus:border-[#d4af37]"
            />

            <button
              type="button"
              onClick={searchStamp}
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] p-4 text-[19px] font-black text-black shadow-lg shadow-[#d4af37]/20 disabled:opacity-60"
            >
              {loading ? "조회 중..." : "스탬프 조회하기"}
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-[30px] border border-[#d4af3728] bg-[#080808]/92 p-5 shadow-2xl shadow-black/70 backdrop-blur-xl">
          <div className="text-[13px] font-black uppercase tracking-[0.18em] text-[#d4af37]">
            REWARD POLICY
          </div>

          <h2 className="mt-2 text-[26px] font-black tracking-[-0.06em] text-[#fff8d9]">
            적립 기준
          </h2>

          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl border border-[#d4af3724] bg-[#111111] p-4">
              <div className="text-[17px] font-black text-[#f4d56d]">11,000원 이상</div>
              <div className="mt-1 text-[15px] font-bold text-zinc-400">스탬프 +1개 적립</div>
            </div>

            <div className="rounded-2xl border border-[#d4af3724] bg-[#111111] p-4">
              <div className="text-[17px] font-black text-[#f4d56d]">22,000원 이상</div>
              <div className="mt-1 text-[15px] font-bold text-zinc-400">스탬프 +2개 적립</div>
            </div>

            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/25 p-4">
              <div className="text-[17px] font-black text-emerald-300">할인 사용</div>
              <div className="mt-1 text-[15px] font-bold text-zinc-300">
                5개 = 2,500원 / 10개 = 6,000원
              </div>
            </div>
          </div>
        </section>

        {searched && (
          <section className="mt-4 rounded-[30px] border border-[#d4af3728] bg-[#080808]/92 p-5 shadow-2xl shadow-black/70 backdrop-blur-xl">
            {customer ? (
              <>
                <div className="text-center">
                  <div className="text-[15px] font-black text-zinc-500">현재 보유 스탬프</div>
                  <div className="mt-2 text-[72px] font-black leading-none tracking-[-0.08em] text-[#f4d56d]">
                    {stampCount}
                  </div>
                  <div className="mt-2 text-[17px] font-black text-zinc-300">
                    총 주문 {Number(customer.total_orders || 0)}회
                  </div>
                </div>

                <div className="mt-5 h-4 overflow-hidden rounded-full bg-zinc-900">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14]"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="mt-5 rounded-2xl border border-[#d4af3724] bg-[#111111] p-5 text-center">
                  <div className="text-[15px] font-black text-zinc-500">사용 가능 혜택</div>

                  <div
                    className={`mt-2 text-[28px] font-black tracking-[-0.06em] ${
                      rewardTier.discount > 0 ? "text-emerald-300" : "text-zinc-400"
                    }`}
                  >
                    {rewardTier.discount > 0
                      ? `${rewardTier.discount.toLocaleString()}원 할인 가능`
                      : rewardTier.label}
                  </div>

                  <div className="mt-3 text-[15px] font-bold text-zinc-400">
                    {rewardTier.nextGuide}
                  </div>
                </div>
              </>
            ) : (
              <div className="py-4 text-center">
                <div className="text-[28px] font-black tracking-[-0.06em] text-red-300">
                  스탬프 기록이 없습니다
                </div>
                <div className="mt-3 break-keep text-[16px] font-bold text-zinc-400">
                  첫 자사앱 주문 완료 후 스탬프가 적립됩니다.
                </div>
              </div>
            )}
          </section>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <a
            href="/"
            className="rounded-2xl bg-gradient-to-r from-[#fff1a8] via-[#d4af37] to-[#8a6a14] p-4 text-center text-[17px] font-black text-black"
          >
            주문하러 가기
          </a>
          <a
            href="/"
            className="rounded-2xl border border-[#d4af3735] bg-[#050505]/90 p-4 text-center text-[17px] font-black text-[#f4d56d]"
          >
            홈으로
          </a>
        </div>
      </div>
    </main>
  );
}
