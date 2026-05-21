"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type StampCustomer = {
  phone: string;
  stamp_count: number;
  total_orders: number;
};

export default function StampPage() {
  const [phone, setPhone] = useState("");
  const [customer, setCustomer] = useState<StampCustomer | null>(null);
  const [searched, setSearched] = useState(false);

  const normalizePhone = (value: string) => {
    return value.replace(/[^0-9]/g, "");
  };

  const searchStamp = async () => {
    const cleanPhone = normalizePhone(phone);

    if (!cleanPhone) {
      alert("전화번호를 입력해주세요.");
      return;
    }

    const { data, error } = await supabase
      .from("stamp_customers")
      .select("*")
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (error) {
      alert("스탬프 조회 실패: " + error.message);
      return;
    }

    setCustomer(data);
    setSearched(true);
  };

  const stampCount = customer?.stamp_count || 0;
  const discount = stampCount >= 5 ? stampCount * 1000 : 0;

  return (
    <main className="relative min-h-screen overflow-hidden bg-black p-4 text-white">
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/space-bg.png')" }}
      />

      <div className="fixed inset-0 z-0 bg-black/60" />

      <div className="relative z-10 mx-auto max-w-xl">
        <div className="mt-10 rounded-3xl border border-yellow-400/20 bg-black/80 p-6 text-center shadow-2xl backdrop-blur">
          <img
            src="/images/penguin-logo.png"
            alt="황제떡볶이"
            className="mx-auto mb-4 w-40 object-contain drop-shadow-[0_0_60px_rgba(250,204,21,.8)]"
          />

          <h1 className="text-4xl font-black text-yellow-400">
            내 스탬프 조회
          </h1>

          <p className="mt-3 text-zinc-300">
            주문할 때 사용한 전화번호로 조회해주세요.
          </p>

          <div className="mt-6 space-y-3">
            <input
              placeholder="전화번호 예: 01012345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-black p-4 text-center text-xl font-bold"
            />

            <button
              onClick={searchStamp}
              className="w-full rounded-xl bg-yellow-400 p-4 font-black text-black"
            >
              스탬프 조회하기
            </button>
          </div>
        </div>

        {searched && (
          <div className="mt-5 rounded-3xl border border-yellow-400/20 bg-black/80 p-6 shadow-2xl backdrop-blur">
            {customer ? (
              <>
                <div className="text-center">
                  <div className="text-zinc-400">현재 보유 스탬프</div>

                  <div className="mt-2 text-6xl font-black text-yellow-400">
                    {stampCount}개
                  </div>

                  <div className="mt-4 text-zinc-300">
                    총 주문완료 횟수 {customer.total_orders}회
                  </div>
                </div>

                <div className="mt-6 rounded-2xl bg-zinc-950 p-5 text-center">
                  {stampCount >= 5 ? (
                    <>
                      <div className="text-zinc-400">사용 가능 할인</div>

                      <div className="mt-2 text-4xl font-black text-green-400">
                        {discount.toLocaleString()}원
                      </div>

                      <div className="mt-3 text-sm text-zinc-400">
                        주문 시 스탬프 조회 후 할인 사용 가능
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xl font-black text-zinc-300">
                        5개부터 할인 사용 가능
                      </div>

                      <div className="mt-2 text-zinc-400">
                        {5 - stampCount}개 더 모으면 사용할 수 있어요.
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="text-2xl font-black text-red-400">
                  스탬프 기록이 없습니다.
                </div>

                <div className="mt-3 text-zinc-400">
                  첫 주문 완료 후 스탬프가 적립됩니다.
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 text-center">
          <a
            href="/"
            className="inline-block rounded-xl bg-zinc-800 px-6 py-3 font-black"
          >
            주문하러 가기
          </a>
        </div>
      </div>
    </main>
  );
}