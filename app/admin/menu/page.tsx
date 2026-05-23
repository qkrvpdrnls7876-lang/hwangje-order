"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
  menu_id: number | null;
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
  id: number;
  menu_id: number;
  group_id: number;
};

export default function AdminMenuPage() {
  const router = useRouter();

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/admin");
  };

  const [menus, setMenus] = useState<Menu[]>([]);
  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [items, setItems] = useState<OptionItem[]>([]);
  const [links, setLinks] = useState<GroupMenuLink[]>([]);

  const [form, setForm] = useState({
    name: "",
    price: "",
    description: "",
    category: "",
  });

  const [groupForm, setGroupForm] = useState({
    name: "",
    type: "single",
    required: false,
  });

  const [selectedMenuIds, setSelectedMenuIds] = useState<number[]>([]);

  const [itemForm, setItemForm] = useState({
    group_id: "",
    name: "",
    price: "",
  });

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
      .order("id", { ascending: true });

    if (menusResult.error) {
      alert("메뉴 불러오기 실패: " + menusResult.error.message);
      return;
    }

    if (groupsResult.error) {
      alert("옵션그룹 불러오기 실패: " + groupsResult.error.message);
      return;
    }

    if (itemsResult.error) {
      alert("옵션항목 불러오기 실패: " + itemsResult.error.message);
      return;
    }

    if (linksResult.error) {
      alert(
        "옵션그룹 연결정보 불러오기 실패: " +
          linksResult.error.message +
          "\nmenu_option_group_menus 테이블이 있는지 확인해주세요.",
      );
      return;
    }

    const menuData = menusResult.data || [];
    const groupData = groupsResult.data || [];
    const linkData = linksResult.data || [];

    // 예전 구조(menu_option_groups.menu_id)로 만든 옵션그룹도 화면에서 계속 보이게 자동 보정
    const legacyLinks: GroupMenuLink[] = groupData
      .filter((group) => group.menu_id)
      .filter(
        (group) =>
          !linkData.some(
            (link) =>
              link.group_id === group.id && link.menu_id === group.menu_id,
          ),
      )
      .map((group, index) => ({
        id: -100000 - index,
        group_id: group.id,
        menu_id: Number(group.menu_id),
      }));

    setMenus(menuData);
    setGroups(groupData);
    setItems(itemsResult.data || []);
    setLinks([...linkData, ...legacyLinks]);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const isRlsError = (message?: string) => {
    const lower = (message || "").toLowerCase();

    return (
      lower.includes("row-level security") ||
      lower.includes("rls") ||
      lower.includes("policy")
    );
  };

  const getRlsPolicyMessage = () => {
    return [
      "옵션그룹 연결 테이블 권한이 막혀있습니다.",
      "",
      "Supabase SQL Editor에서 menu_option_group_menus 테이블 RLS 정책을 열어줘야 합니다.",
      "",
      "실행할 SQL:",
      "",
      "alter table public.menu_option_group_menus enable row level security;",
      "",
      'drop policy if exists "allow anon select menu option group menus" on public.menu_option_group_menus;',
      'drop policy if exists "allow anon insert menu option group menus" on public.menu_option_group_menus;',
      'drop policy if exists "allow anon delete menu option group menus" on public.menu_option_group_menus;',
      "",
      'create policy "allow anon select menu option group menus"',
      "on public.menu_option_group_menus",
      "for select",
      "to anon",
      "using (true);",
      "",
      'create policy "allow anon insert menu option group menus"',
      "on public.menu_option_group_menus",
      "for insert",
      "to anon",
      "with check (true);",
      "",
      'create policy "allow anon delete menu option group menus"',
      "on public.menu_option_group_menus",
      "for delete",
      "to anon",
      "using (true);",
    ].join("\n");
  };

  const insertGroupMenuLinks = async (groupId: number, menuIds: number[]) => {
    const nextLinks = menuIds.map((menuId) => ({
      menu_id: menuId,
      group_id: groupId,
    }));

    const { error } = await supabase
      .from("menu_option_group_menus")
      .insert(nextLinks);

    if (error) {
      if (isRlsError(error.message)) {
        alert(getRlsPolicyMessage());
        return false;
      }

      alert("옵션그룹 연결 실패: " + error.message);
      return false;
    }

    return true;
  };

  const deleteGroupMenuLinks = async (target: {
    group_id?: number;
    menu_id?: number;
  }) => {
    let query = supabase.from("menu_option_group_menus").delete();

    if (target.group_id) {
      query = query.eq("group_id", target.group_id);
    }

    if (target.menu_id) {
      query = query.eq("menu_id", target.menu_id);
    }

    const { error } = await query;

    if (error) {
      if (isRlsError(error.message)) {
        alert(getRlsPolicyMessage());
        return false;
      }

      alert("옵션그룹 연결 삭제 실패: " + error.message);
      return false;
    }

    return true;
  };

  const addMenu = async () => {
    if (!form.name.trim()) {
      alert("메뉴명을 입력하세요");
      return;
    }

    const priceNumber = parseInt(form.price);

    if (isNaN(priceNumber)) {
      alert("가격은 숫자로 입력하세요");
      return;
    }

    const { error } = await supabase.from("menus").insert({
      name: form.name.trim(),
      price: priceNumber,
      description: form.description.trim(),
      category: form.category.trim(),
      is_soldout: false,
    });

    if (error) {
      alert("메뉴 추가 실패: " + error.message);
      return;
    }

    setForm({
      name: "",
      price: "",
      description: "",
      category: "",
    });

    fetchAll();
  };

  const updateMenu = async (id: number, field: string, value: string) => {
    const updateData =
      field === "price"
        ? { [field]: parseInt(value) || 0 }
        : { [field]: value.trim() };

    const { error } = await supabase
      .from("menus")
      .update(updateData)
      .eq("id", id);

    if (error) {
      alert("메뉴 수정 실패: " + error.message);
      return;
    }

    fetchAll();
  };

  const toggleMenuSoldout = async (id: number, current: boolean) => {
    const { error } = await supabase
      .from("menus")
      .update({ is_soldout: !current })
      .eq("id", id);

    if (error) {
      alert("품절 변경 실패: " + error.message);
      return;
    }

    fetchAll();
  };

  const deleteMenu = async (id: number) => {
    const ok = confirm(
      "메뉴를 삭제할까요? 연결된 옵션도 같이 삭제될 수 있습니다.",
    );

    if (!ok) return;

    await deleteGroupMenuLinks({ menu_id: id });

    const { error } = await supabase.from("menus").delete().eq("id", id);

    if (error) {
      alert("메뉴 삭제 실패: " + error.message);
      return;
    }

    fetchAll();
  };

  const toggleSelectedMenu = (menuId: number) => {
    setSelectedMenuIds((prev) =>
      prev.includes(menuId)
        ? prev.filter((id) => id !== menuId)
        : [...prev, menuId],
    );
  };

  const selectAllMenus = () => {
    setSelectedMenuIds(menus.map((menu) => menu.id));
  };

  const clearSelectedMenus = () => {
    setSelectedMenuIds([]);
  };

  const addGroup = async () => {
    if (!groupForm.name.trim()) {
      alert("옵션그룹 이름을 입력하세요");
      return;
    }

    if (selectedMenuIds.length === 0) {
      alert("연결할 메뉴를 1개 이상 선택하세요");
      return;
    }

    // 기존 menu_id 컬럼이 not null인 경우를 대비해 첫 번째 메뉴 id를 같이 넣음.
    // 실제 연결은 menu_option_group_menus 테이블이 담당함.
    const { data, error } = await supabase
      .from("menu_option_groups")
      .insert({
        menu_id: selectedMenuIds[0],
        name: groupForm.name.trim(),
        type: groupForm.type,
        required: groupForm.required,
      })
      .select("id")
      .single();

    if (error) {
      alert("옵션그룹 추가 실패: " + error.message);
      return;
    }

    if (!data?.id) {
      alert("옵션그룹 ID 생성 실패");
      return;
    }

    const linked = await insertGroupMenuLinks(data.id, selectedMenuIds);

    if (!linked) {
      alert(
        "옵션그룹 자체는 생성됐지만 연결 저장이 막혔습니다.\nSupabase RLS 정책 적용 후 다시 연결해주세요.",
      );
      fetchAll();
      return;
    }

    setGroupForm({
      name: "",
      type: "single",
      required: false,
    });
    setSelectedMenuIds([]);

    fetchAll();
  };

  const deleteGroup = async (id: number) => {
    const ok = confirm(
      "옵션그룹을 삭제할까요? 안에 있는 옵션항목도 같이 삭제됩니다.",
    );

    if (!ok) return;

    await deleteGroupMenuLinks({ group_id: id });

    const { error } = await supabase
      .from("menu_option_groups")
      .delete()
      .eq("id", id);

    if (error) {
      alert("옵션그룹 삭제 실패: " + error.message);
      return;
    }

    fetchAll();
  };

  const updateGroup = async (
    id: number,
    updateData: Partial<Pick<OptionGroup, "name" | "type" | "required">>,
  ) => {
    const { error } = await supabase
      .from("menu_option_groups")
      .update(updateData)
      .eq("id", id);

    if (error) {
      alert("옵션그룹 수정 실패: " + error.message);
      return;
    }

    fetchAll();
  };

  const connectGroupToMenu = async (groupId: number, menuId: number) => {
    const exists = links.some(
      (link) => link.group_id === groupId && link.menu_id === menuId,
    );

    if (exists) return;

    const linked = await insertGroupMenuLinks(groupId, [menuId]);

    if (!linked) return;

    fetchAll();
  };

  const disconnectGroupFromMenu = async (groupId: number, menuId: number) => {
    const group = groups.find((item) => item.id === groupId);

    // 기존 구조로 만들어진 첫 연결(menu_id)은 삭제하면 예전 로직이 꼬일 수 있어서 연결테이블만 제거.
    const realLink = links.find(
      (link) =>
        link.group_id === groupId && link.menu_id === menuId && link.id > 0,
    );

    if (!realLink) {
      alert(
        "기존 방식으로 붙어있는 기본 연결입니다. 그룹을 삭제하거나 새 공용그룹으로 다시 만들어주세요.",
      );
      return;
    }

    const deleted = await deleteGroupMenuLinks({
      group_id: groupId,
      menu_id: menuId,
    });

    if (!deleted) return;

    // menu_option_groups.menu_id가 해제한 메뉴와 같고 다른 연결이 있으면 대표 menu_id 변경
    if (group?.menu_id === menuId) {
      const otherLink = links.find(
        (link) => link.group_id === groupId && link.menu_id !== menuId,
      );

      if (otherLink) {
        await supabase
          .from("menu_option_groups")
          .update({ menu_id: otherLink.menu_id })
          .eq("id", groupId);
      }
    }

    fetchAll();
  };

  const toggleGroupMenuConnection = async (groupId: number, menuId: number) => {
    const exists = links.some(
      (link) => link.group_id === groupId && link.menu_id === menuId,
    );

    if (exists) {
      await disconnectGroupFromMenu(groupId, menuId);
    } else {
      await connectGroupToMenu(groupId, menuId);
    }
  };

  const addItem = async () => {
    if (!itemForm.group_id) {
      alert("옵션그룹을 선택하세요");
      return;
    }

    if (!itemForm.name.trim()) {
      alert("옵션명을 입력하세요");
      return;
    }

    const priceNumber = itemForm.price.trim() ? parseInt(itemForm.price) : 0;

    if (isNaN(priceNumber)) {
      alert("옵션 가격은 숫자로 입력하세요");
      return;
    }

    const { error } = await supabase.from("menu_option_items").insert({
      group_id: Number(itemForm.group_id),
      name: itemForm.name.trim(),
      price: priceNumber,
      is_soldout: false,
    });

    if (error) {
      alert("옵션항목 추가 실패: " + error.message);
      return;
    }

    setItemForm({
      group_id: "",
      name: "",
      price: "",
    });

    fetchAll();
  };

  const updateItem = async (id: number, field: string, value: string) => {
    const updateData =
      field === "price"
        ? { [field]: parseInt(value) || 0 }
        : { [field]: value.trim() };

    const { error } = await supabase
      .from("menu_option_items")
      .update(updateData)
      .eq("id", id);

    if (error) {
      alert("옵션항목 수정 실패: " + error.message);
      return;
    }

    fetchAll();
  };

  const toggleItemSoldout = async (id: number, current: boolean) => {
    const { error } = await supabase
      .from("menu_option_items")
      .update({ is_soldout: !current })
      .eq("id", id);

    if (error) {
      alert("옵션 품절 변경 실패: " + error.message);
      return;
    }

    fetchAll();
  };

  const deleteItem = async (id: number) => {
    const ok = confirm("옵션항목을 삭제할까요?");

    if (!ok) return;

    const { error } = await supabase
      .from("menu_option_items")
      .delete()
      .eq("id", id);

    if (error) {
      alert("옵션항목 삭제 실패: " + error.message);
      return;
    }

    fetchAll();
  };

  const getGroupsByMenuId = (menuId: number) => {
    return groups.filter((group) =>
      links.some(
        (link) => link.group_id === group.id && link.menu_id === menuId,
      ),
    );
  };

  const getItemsByGroupId = (groupId: number) => {
    return items.filter((item) => item.group_id === groupId);
  };

  const getMenuNamesByGroupId = (groupId: number) => {
    const menuIds = links
      .filter((link) => link.group_id === groupId)
      .map((link) => link.menu_id);

    return menus
      .filter((menu) => menuIds.includes(menu.id))
      .map((menu) => menu.name);
  };

  const totalOptions = items.length;
  const soldoutMenus = menus.filter((menu) => menu.is_soldout).length;
  const soldoutItems = items.filter((item) => item.is_soldout).length;
  const linkedGroups = groups.filter(
    (group) => getMenuNamesByGroupId(group.id).length > 0,
  ).length;

  const sectionClass =
    "rounded-[14px] border border-zinc-800 bg-[#101010] shadow-[0_18px_60px_rgba(0,0,0,.28)]";
  const inputClass =
    "w-full rounded-[10px] border border-zinc-800 bg-[#070707] px-3 py-3 text-sm font-bold text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-[#d4af37]/70";
  const labelClass =
    "mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500";

  return (
    <main className="min-h-screen overflow-hidden bg-[#070707] pt-9 text-zinc-100">
      <div className="fixed left-0 right-0 top-0 z-[1000] flex h-9 items-center justify-between border-b border-[#d4af3720] bg-[#080808]/95 px-3 text-xs text-zinc-400 backdrop-blur-xl [-webkit-app-region:drag]">
        <button
          type="button"
          onClick={goBack}
          className="flex items-center gap-2 rounded-md px-2 py-1 font-black tracking-[-0.03em] text-[#d4af37] hover:bg-white/[0.04] [-webkit-app-region:no-drag]"
        >
          <span className="h-2 w-2 rounded-full bg-[#d4af37]" />← 황제POS /
          메뉴관리
        </button>

        <div className="flex items-center gap-1 [-webkit-app-region:no-drag]">
          <button
            type="button"
            onClick={() => (window as any).hwangjePOS?.minimizeWindow?.()}
            className="flex h-7 w-9 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            —
          </button>

          <button
            type="button"
            onClick={() => (window as any).hwangjePOS?.toggleMaximizeWindow?.()}
            className="flex h-7 w-9 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            □
          </button>

          <button
            type="button"
            onClick={() => (window as any).hwangjePOS?.closeWindow?.()}
            className="flex h-7 w-9 items-center justify-center rounded-md text-zinc-400 hover:bg-red-600 hover:text-white"
          >
            ×
          </button>
        </div>
      </div>

      <div className="grid min-h-[calc(100vh-36px)] grid-cols-1 lg:grid-cols-[228px_1fr]">
        <aside className="hidden border-r border-[#d4af37]/15 bg-[linear-gradient(180deg,#111111_0%,#070707_100%)] lg:flex lg:flex-col">
          <div className="border-b border-[#d4af37]/10 px-6 py-7">
            <div className="text-[11px] font-black tracking-[0.28em] text-[#d4af37]">
              HWANGJEE
            </div>
            <div className="mt-1 text-4xl font-black tracking-[-0.08em] text-[#f0d98a]">
              POS
            </div>
            <div className="mt-1 text-xs font-bold text-[#d4af37]/80">
              황제떡볶이 효자점
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-5">
            <a
              href="/admin"
              className="block rounded-[10px] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white"
            >
              주문 관리
            </a>
            <a
              href="/admin/sales"
              className="block rounded-[10px] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white"
            >
              매출 관리
            </a>
            <div className="flex w-full items-center justify-between rounded-[10px] border border-[#d4af37]/20 bg-[#d4af37]/10 px-4 py-3 text-sm font-bold text-[#f0d98a]">
              <span>메뉴 관리</span>
              <span className="rounded-full bg-[#d4af37] px-2 py-0.5 text-xs text-black">
                ON
              </span>
            </div>
            <a
              href="/rider"
              className="block rounded-[10px] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white"
            >
              라이더 관리
            </a>
            <a
              href="/kitchen"
              className="block rounded-[10px] px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.04] hover:text-white"
            >
              주방 모니터
            </a>
          </nav>

          <div className="mx-4 mb-4 rounded-[12px] border border-[#d4af37]/20 bg-black/40 p-4">
            <div className="text-xs font-bold text-zinc-500">메뉴 현황</div>
            <div className="mt-1 text-2xl font-black tracking-[-0.05em] text-[#f0d98a]">
              {menus.length}개
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-zinc-500">옵션그룹</div>
                <div className="font-black text-zinc-100">
                  {groups.length}개
                </div>
              </div>
              <div>
                <div className="text-zinc-500">옵션항목</div>
                <div className="font-black text-[#d4af37]">
                  {totalOptions}개
                </div>
              </div>
            </div>
          </div>
        </aside>

        <section className="min-h-[calc(100vh-36px)] overflow-y-auto bg-[#090909]">
          <header className="border-b border-zinc-800 bg-[#0b0b0b] px-4 py-5 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <button
                  type="button"
                  onClick={goBack}
                  className="mb-3 inline-flex items-center rounded-[9px] border border-zinc-700 bg-[#111111] px-3 py-2 text-xs font-black text-zinc-300 transition hover:border-[#d4af37]/50 hover:text-[#f0d98a]"
                >
                  ← 뒤로가기
                </button>

                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#d4af37]">
                  MENU CONTROL
                </div>
                <h1 className="mt-1 text-4xl font-black tracking-[-0.07em] text-zinc-100">
                  메뉴관리
                </h1>
                <p className="mt-2 text-sm text-zinc-500">
                  메뉴 · 공용 옵션그룹 · 옵션항목 · 품절 상태를 관리합니다.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                <div className="rounded-[10px] border border-zinc-800 bg-[#111111] px-3 py-2">
                  <span className="text-zinc-500">메뉴</span>
                  <div className="mt-1 font-black text-[#f0d98a]">
                    {menus.length}개
                  </div>
                </div>
                <div className="rounded-[10px] border border-zinc-800 bg-[#111111] px-3 py-2">
                  <span className="text-zinc-500">품절메뉴</span>
                  <div className="mt-1 font-black text-red-300">
                    {soldoutMenus}개
                  </div>
                </div>
                <div className="rounded-[10px] border border-zinc-800 bg-[#111111] px-3 py-2">
                  <span className="text-zinc-500">연결그룹</span>
                  <div className="mt-1 font-black text-zinc-100">
                    {linkedGroups}개
                  </div>
                </div>
                <div className="rounded-[10px] border border-zinc-800 bg-[#111111] px-3 py-2">
                  <span className="text-zinc-500">품절옵션</span>
                  <div className="mt-1 font-black text-red-300">
                    {soldoutItems}개
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 lg:hidden">
              <a
                href="/admin"
                className="rounded-[9px] border border-zinc-700 px-3 py-2 text-xs font-black text-zinc-300"
              >
                주문
              </a>
              <a
                href="/admin/sales"
                className="rounded-[9px] border border-zinc-700 px-3 py-2 text-xs font-black text-zinc-300"
              >
                매출
              </a>
              <a
                href="/rider"
                className="rounded-[9px] border border-zinc-700 px-3 py-2 text-xs font-black text-zinc-300"
              >
                라이더
              </a>
              <a
                href="/kitchen"
                className="rounded-[9px] border border-zinc-700 px-3 py-2 text-xs font-black text-zinc-300"
              >
                주방
              </a>
            </div>
          </header>

          <div className="px-4 py-5 lg:px-8">
            <div className="mb-5 rounded-[12px] border border-red-500/25 bg-red-950/20 p-4 text-sm font-bold leading-relaxed text-red-200">
              옵션그룹 연결 실패가 뜨면 Supabase에서{" "}
              <span className="text-red-100">menu_option_group_menus</span>{" "}
              테이블 RLS 정책이 막힌 상태입니다. 이 페이지는 오류 내용을 정확히
              보여주고 필요한 SQL을 안내합니다.
            </div>

            <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
              <section className={`${sectionClass} p-5`}>
                <div className="mb-5 flex items-center justify-between border-b border-zinc-800 pb-4">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#d4af37]">
                      CREATE MENU
                    </div>
                    <h2 className="mt-1 text-2xl font-black tracking-[-0.05em] text-zinc-100">
                      새 메뉴 추가
                    </h2>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div>
                    <label className={labelClass}>메뉴명</label>
                    <input
                      placeholder="예: 국물떡볶이"
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>가격</label>
                    <input
                      placeholder="예: 9000"
                      value={form.price}
                      onChange={(e) =>
                        setForm({ ...form, price: e.target.value })
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>설명</label>
                    <input
                      placeholder="메뉴 설명"
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>카테고리</label>
                    <input
                      placeholder="예: 떡볶이 / 사이드 / 음료"
                      value={form.category}
                      onChange={(e) =>
                        setForm({ ...form, category: e.target.value })
                      }
                      className={inputClass}
                    />
                  </div>
                  <button
                    onClick={addMenu}
                    className="mt-2 rounded-[10px] border border-[#d4af37]/60 bg-[#d4af37] px-4 py-3 text-sm font-black text-black transition hover:bg-[#f0c75a]"
                  >
                    메뉴 추가
                  </button>
                </div>
              </section>

              <section className={`${sectionClass} p-5`}>
                <div className="mb-5 flex items-center justify-between border-b border-zinc-800 pb-4">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#d4af37]">
                      SHARED OPTION GROUP
                    </div>
                    <h2 className="mt-1 text-2xl font-black tracking-[-0.05em] text-zinc-100">
                      공용 옵션그룹 추가
                    </h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      옵션그룹을 한 번 만들고 여러 메뉴에 연결합니다.
                    </p>
                  </div>
                  <div className="rounded-[9px] border border-[#d4af37]/30 bg-[#d4af37]/10 px-3 py-2 text-xs font-black text-[#d4af37]">
                    선택 {selectedMenuIds.length}개
                  </div>
                </div>

                <div className="grid gap-3">
                  <div>
                    <label className={labelClass}>옵션그룹명</label>
                    <input
                      placeholder="예: 맵기 / 토핑 / 음료"
                      value={groupForm.name}
                      onChange={(e) =>
                        setGroupForm({ ...groupForm, name: e.target.value })
                      }
                      className={inputClass}
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className={labelClass}>선택 방식</label>
                      <select
                        value={groupForm.type}
                        onChange={(e) =>
                          setGroupForm({ ...groupForm, type: e.target.value })
                        }
                        className={inputClass}
                      >
                        <option value="single">하나만 선택</option>
                        <option value="multiple">여러 개 선택</option>
                      </select>
                    </div>
                    <label className="mt-6 flex items-center gap-3 rounded-[10px] border border-zinc-800 bg-[#070707] px-3 py-3 text-sm font-black text-zinc-300">
                      <input
                        type="checkbox"
                        checked={groupForm.required}
                        onChange={(e) =>
                          setGroupForm({
                            ...groupForm,
                            required: e.target.checked,
                          })
                        }
                      />
                      필수 선택
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={selectAllMenus}
                      className="rounded-[9px] border border-zinc-700 bg-[#111111] px-3 py-2 text-xs font-black text-zinc-300 transition hover:border-[#d4af37]/50"
                    >
                      전체선택
                    </button>
                    <button
                      type="button"
                      onClick={clearSelectedMenus}
                      className="rounded-[9px] border border-zinc-700 bg-[#111111] px-3 py-2 text-xs font-black text-zinc-300 transition hover:border-[#d4af37]/50"
                    >
                      선택해제
                    </button>
                  </div>

                  <div className="max-h-[240px] overflow-y-auto rounded-[12px] border border-zinc-800 bg-[#070707] p-3">
                    <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                      {menus.map((menu) => (
                        <button
                          key={menu.id}
                          type="button"
                          onClick={() => toggleSelectedMenu(menu.id)}
                          className={`rounded-[10px] border px-3 py-2 text-left text-xs font-black transition ${selectedMenuIds.includes(menu.id) ? "border-[#d4af37] bg-[#d4af37] text-black" : "border-zinc-800 bg-[#101010] text-zinc-400 hover:border-zinc-600"}`}
                        >
                          {selectedMenuIds.includes(menu.id) ? "☑ " : "☐ "}
                          {menu.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={addGroup}
                    className="rounded-[10px] border border-[#d4af37]/60 bg-[#d4af37] px-4 py-3 text-sm font-black text-black transition hover:bg-[#f0c75a]"
                  >
                    공용 옵션그룹 추가
                  </button>
                </div>
              </section>
            </div>

            <section className={`${sectionClass} mt-5 p-5`}>
              <div className="mb-5 flex items-center justify-between border-b border-zinc-800 pb-4">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#d4af37]">
                    OPTION ITEM
                  </div>
                  <h2 className="mt-1 text-2xl font-black tracking-[-0.05em] text-zinc-100">
                    옵션항목 추가
                  </h2>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr_.7fr_180px]">
                <select
                  value={itemForm.group_id}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, group_id: e.target.value })
                  }
                  className={inputClass}
                >
                  <option value="">옵션그룹 선택</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} /{" "}
                      {getMenuNamesByGroupId(group.id).join(", ") ||
                        "연결메뉴 없음"}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="옵션명 예: 중간맛 / 치즈추가"
                  value={itemForm.name}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, name: e.target.value })
                  }
                  className={inputClass}
                />
                <input
                  placeholder="추가금액"
                  value={itemForm.price}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, price: e.target.value })
                  }
                  className={inputClass}
                />
                <button
                  onClick={addItem}
                  className="rounded-[10px] border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-sm font-black text-emerald-300 transition hover:bg-emerald-500/25"
                >
                  옵션항목 추가
                </button>
              </div>
            </section>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
              <section className={`${sectionClass} p-5`}>
                <div className="mb-5 flex items-center justify-between border-b border-zinc-800 pb-4">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#d4af37]">
                      OPTION GROUPS
                    </div>
                    <h2 className="mt-1 text-2xl font-black tracking-[-0.05em] text-zinc-100">
                      공용 옵션그룹 목록
                    </h2>
                  </div>
                  <div className="text-sm font-black text-[#d4af37]">
                    {groups.length}개
                  </div>
                </div>

                {groups.length === 0 && (
                  <div className="rounded-[12px] border border-zinc-800 bg-[#070707] p-8 text-center text-sm font-bold text-zinc-500">
                    등록된 옵션그룹이 없습니다.
                  </div>
                )}

                <div className="space-y-3">
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      className="rounded-[12px] border border-zinc-800 bg-[#070707] p-4"
                    >
                      <div className="grid gap-3 md:grid-cols-[1fr_150px_120px]">
                        <input
                          defaultValue={group.name}
                          onBlur={(e) =>
                            updateGroup(group.id, { name: e.target.value })
                          }
                          className={inputClass}
                        />
                        <select
                          value={group.type}
                          onChange={(e) =>
                            updateGroup(group.id, { type: e.target.value })
                          }
                          className={inputClass}
                        >
                          <option value="single">하나만 선택</option>
                          <option value="multiple">여러 개 선택</option>
                        </select>
                        <label className="flex items-center gap-2 rounded-[10px] border border-zinc-800 bg-[#101010] px-3 py-3 text-sm font-black text-zinc-300">
                          <input
                            type="checkbox"
                            checked={group.required}
                            onChange={(e) =>
                              updateGroup(group.id, {
                                required: e.target.checked,
                              })
                            }
                          />
                          필수
                        </label>
                      </div>

                      <div className="mt-3 rounded-[10px] border border-zinc-800 bg-[#101010] p-3">
                        <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                          연결 메뉴
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          {menus.map((menu) => {
                            const checked = links.some(
                              (link) =>
                                link.group_id === group.id &&
                                link.menu_id === menu.id,
                            );
                            return (
                              <button
                                key={menu.id}
                                type="button"
                                onClick={() =>
                                  toggleGroupMenuConnection(group.id, menu.id)
                                }
                                className={`rounded-[9px] border px-2 py-2 text-left text-xs font-black transition ${checked ? "border-[#d4af37] bg-[#d4af37] text-black" : "border-zinc-800 bg-[#070707] text-zinc-500 hover:border-zinc-600"}`}
                              >
                                {checked ? "☑ " : "☐ "}
                                {menu.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-3 rounded-[10px] border border-zinc-800 bg-[#101010] p-3">
                        <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                          옵션항목
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          {getItemsByGroupId(group.id).map((item) => (
                            <div
                              key={item.id}
                              className="rounded-[10px] border border-zinc-800 bg-[#070707] p-3"
                            >
                              <input
                                defaultValue={item.name}
                                onBlur={(e) =>
                                  updateItem(item.id, "name", e.target.value)
                                }
                                className={inputClass}
                              />
                              <input
                                defaultValue={item.price}
                                onBlur={(e) =>
                                  updateItem(item.id, "price", e.target.value)
                                }
                                className={`${inputClass} mt-2 text-[#d4af37]`}
                              />
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                <button
                                  onClick={() =>
                                    toggleItemSoldout(item.id, item.is_soldout)
                                  }
                                  className={`rounded-[9px] border px-3 py-2 text-xs font-black ${item.is_soldout ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" : "border-red-500/40 bg-red-950/40 text-red-300"}`}
                                >
                                  {item.is_soldout
                                    ? "판매중 변경"
                                    : "품절 처리"}
                                </button>
                                <button
                                  onClick={() => deleteItem(item.id)}
                                  className="rounded-[9px] border border-zinc-700 bg-[#111111] px-3 py-2 text-xs font-black text-zinc-300 hover:border-red-500/40 hover:text-red-300"
                                >
                                  삭제
                                </button>
                              </div>
                            </div>
                          ))}
                          {getItemsByGroupId(group.id).length === 0 && (
                            <div className="rounded-[10px] border border-zinc-800 bg-[#070707] p-4 text-sm font-bold text-zinc-500">
                              옵션항목 없음
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => deleteGroup(group.id)}
                        className="mt-3 w-full rounded-[10px] border border-zinc-700 bg-[#111111] px-4 py-3 text-sm font-black text-zinc-300 transition hover:border-red-500/40 hover:text-red-300"
                      >
                        옵션그룹 삭제
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className={`${sectionClass} p-5`}>
                <div className="mb-5 flex items-center justify-between border-b border-zinc-800 pb-4">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#d4af37]">
                      MENU LIST
                    </div>
                    <h2 className="mt-1 text-2xl font-black tracking-[-0.05em] text-zinc-100">
                      메뉴 목록
                    </h2>
                  </div>
                  <div className="text-sm font-black text-[#d4af37]">
                    {menus.length}개
                  </div>
                </div>

                {menus.length === 0 && (
                  <div className="rounded-[12px] border border-zinc-800 bg-[#070707] p-8 text-center text-sm font-bold text-zinc-500">
                    등록된 메뉴가 없습니다.
                  </div>
                )}

                <div className="space-y-3">
                  {menus.map((menu) => (
                    <div
                      key={menu.id}
                      className="rounded-[12px] border border-zinc-800 bg-[#070707] p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="text-xs font-bold text-zinc-500">
                          MENU ID {menu.id}
                        </div>
                        <div
                          className={`rounded-md border px-2 py-1 text-xs font-black ${menu.is_soldout ? "border-red-500/40 bg-red-950/40 text-red-300" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"}`}
                        >
                          {menu.is_soldout ? "품절" : "판매중"}
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <input
                          defaultValue={menu.name}
                          onBlur={(e) =>
                            updateMenu(menu.id, "name", e.target.value)
                          }
                          className={`${inputClass} text-lg`}
                        />
                        <input
                          defaultValue={menu.price}
                          onBlur={(e) =>
                            updateMenu(menu.id, "price", e.target.value)
                          }
                          className={`${inputClass} text-[#d4af37]`}
                        />
                        <input
                          defaultValue={menu.description || ""}
                          onBlur={(e) =>
                            updateMenu(menu.id, "description", e.target.value)
                          }
                          className={inputClass}
                        />
                        <input
                          defaultValue={menu.category || ""}
                          onBlur={(e) =>
                            updateMenu(menu.id, "category", e.target.value)
                          }
                          className={inputClass}
                        />
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          onClick={() =>
                            toggleMenuSoldout(menu.id, menu.is_soldout)
                          }
                          className="rounded-[9px] border border-red-500/35 bg-red-950/30 px-3 py-2 text-xs font-black text-red-300 transition hover:bg-red-900/40"
                        >
                          {menu.is_soldout ? "판매중 변경" : "품절 처리"}
                        </button>
                        <button
                          onClick={() => deleteMenu(menu.id)}
                          className="rounded-[9px] border border-zinc-700 bg-[#111111] px-3 py-2 text-xs font-black text-zinc-300 transition hover:border-red-500/40 hover:text-red-300"
                        >
                          메뉴 삭제
                        </button>
                      </div>

                      <div className="mt-3 rounded-[10px] border border-zinc-800 bg-[#101010] p-3">
                        <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                          연결된 옵션
                        </div>
                        <div className="space-y-2">
                          {getGroupsByMenuId(menu.id).map((group) => (
                            <div
                              key={group.id}
                              className="rounded-[9px] border border-zinc-800 bg-[#070707] p-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-black text-zinc-100">
                                    {group.name}
                                  </div>
                                  <div className="mt-1 text-xs text-zinc-500">
                                    {group.type === "single"
                                      ? "하나만 선택"
                                      : "여러 개 선택"}{" "}
                                    / {group.required ? "필수" : "선택"}
                                  </div>
                                </div>
                                <div className="text-xs font-black text-[#d4af37]">
                                  {getItemsByGroupId(group.id).length}개
                                </div>
                              </div>
                            </div>
                          ))}
                          {getGroupsByMenuId(menu.id).length === 0 && (
                            <div className="text-sm font-bold text-zinc-500">
                              연결된 옵션그룹이 없습니다.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
