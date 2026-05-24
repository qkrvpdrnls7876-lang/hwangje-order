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
  sort_order: number | null;
};

type OptionGroup = {
  id: number;
  menu_id: number | null;
  name: string;
  type: string;
  required: boolean;
  sort_order: number | null;
};

type OptionItem = {
  id: number;
  group_id: number;
  name: string;
  price: number;
  is_soldout: boolean;
  sort_order: number | null;
};

type GroupMenuLink = {
  id: number;
  menu_id: number;
  group_id: number;
};


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
  tone: "danger" | "gold";
  onConfirm: () => void | Promise<void>;
} | null;

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
  const [openMenuOptionIds, setOpenMenuOptionIds] = useState<number[]>([]);
  const [openGroupMenuIds, setOpenGroupMenuIds] = useState<number[]>([]);
  const [openGroupItemIds, setOpenGroupItemIds] = useState<number[]>([]);

  const [itemForm, setItemForm] = useState({
    group_id: "",
    name: "",
    price: "",
  });

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>(null);

  const showToast = (
    message: string,
    title = "황제POS",
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
      setToast((current) =>
        current?.id === nextToast.id ? null : current,
      );
    }, 4200);
  };

  const openConfirm = (dialog: ConfirmDialog) => {
    setConfirmDialog(dialog);
  };

  const runConfirm = async () => {
    if (!confirmDialog) return;

    const action = confirmDialog.onConfirm;
    setConfirmDialog(null);
    await action();
  };

  const fetchAll = async () => {
    const menusResult = await supabase
      .from("menus")
      .select("*")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true });

    const groupsResult = await supabase
      .from("menu_option_groups")
      .select("*")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true });

    const itemsResult = await supabase
      .from("menu_option_items")
      .select("*")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true });

    const linksResult = await supabase
      .from("menu_option_group_menus")
      .select("*")
      .order("id", { ascending: true });

    if (menusResult.error) {
      showToast("메뉴 불러오기 실패: " + menusResult.error.message);
      return;
    }

    if (groupsResult.error) {
      showToast("옵션그룹 불러오기 실패: " + groupsResult.error.message);
      return;
    }

    if (itemsResult.error) {
      showToast("옵션항목 불러오기 실패: " + itemsResult.error.message);
      return;
    }

    if (linksResult.error) {
      showToast(
        "옵션그룹 연결정보 불러오기 실패: " +
          linksResult.error.message +
          "\nmenu_option_group_menus 테이블이 있는지 확인해주세요.",
      );
      return;
    }

    const menuData = (menusResult.data || []).map((menu) => ({
      ...menu,
      sort_order: menu.sort_order ?? menu.id,
    }));
    const groupData = (groupsResult.data || []).map((group) => ({
      ...group,
      sort_order: group.sort_order ?? group.id,
    }));
    const itemData = (itemsResult.data || []).map((item) => ({
      ...item,
      sort_order: item.sort_order ?? item.id,
    }));
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
    setItems(itemData);
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
        showToast(getRlsPolicyMessage());
        return false;
      }

      showToast("옵션그룹 연결 실패: " + error.message);
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
        showToast(getRlsPolicyMessage());
        return false;
      }

      showToast("옵션그룹 연결 삭제 실패: " + error.message);
      return false;
    }

    return true;
  };

  const addMenu = async () => {
    if (!form.name.trim()) {
      showToast("메뉴명을 입력하세요");
      return;
    }

    const priceNumber = parseInt(form.price);

    if (isNaN(priceNumber)) {
      showToast("가격은 숫자로 입력하세요");
      return;
    }

    const { error } = await supabase.from("menus").insert({
      name: form.name.trim(),
      price: priceNumber,
      description: form.description.trim(),
      category: form.category.trim(),
      sort_order: getNextSortOrder(menus),
      is_soldout: false,
    });

    if (error) {
      showToast("메뉴 추가 실패: " + error.message);
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
      showToast("메뉴 수정 실패: " + error.message);
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
      showToast("품절 변경 실패: " + error.message);
      return;
    }

    fetchAll();
  };

  const deleteMenu = async (id: number) => {
    openConfirm({
      title: "메뉴 삭제",
      message: "메뉴를 삭제할까요? 연결된 옵션도 같이 삭제될 수 있습니다.",
      confirmText: "삭제",
      cancelText: "취소",
      tone: "danger",
      onConfirm: async () => {
        await deleteGroupMenuLinks({ menu_id: id });

        const { error } = await supabase.from("menus").delete().eq("id", id);

        if (error) {
          showToast("메뉴 삭제 실패: " + error.message, "삭제 실패", "error");
          return;
        }

        showToast("메뉴를 삭제했습니다.", "삭제 완료", "success");
        fetchAll();
      },
    });
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
      showToast("옵션그룹 이름을 입력하세요");
      return;
    }

    if (selectedMenuIds.length === 0) {
      showToast("연결할 메뉴를 1개 이상 선택하세요");
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
        sort_order: getNextSortOrder(groups),
      })
      .select("id")
      .single();

    if (error) {
      showToast("옵션그룹 추가 실패: " + error.message);
      return;
    }

    if (!data?.id) {
      showToast("옵션그룹 ID 생성 실패");
      return;
    }

    const linked = await insertGroupMenuLinks(data.id, selectedMenuIds);

    if (!linked) {
      showToast(
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
    openConfirm({
      title: "옵션그룹 삭제",
      message: "옵션그룹을 삭제할까요? 안에 있는 옵션항목도 같이 삭제됩니다.",
      confirmText: "삭제",
      cancelText: "취소",
      tone: "danger",
      onConfirm: async () => {
        await deleteGroupMenuLinks({ group_id: id });

        const { error } = await supabase
          .from("menu_option_groups")
          .delete()
          .eq("id", id);

        if (error) {
          showToast("옵션그룹 삭제 실패: " + error.message, "삭제 실패", "error");
          return;
        }

        showToast("옵션그룹을 삭제했습니다.", "삭제 완료", "success");
        fetchAll();
      },
    });
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
      showToast("옵션그룹 수정 실패: " + error.message);
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
      showToast(
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
      showToast("옵션그룹을 선택하세요");
      return;
    }

    if (!itemForm.name.trim()) {
      showToast("옵션명을 입력하세요");
      return;
    }

    const priceNumber = itemForm.price.trim() ? parseInt(itemForm.price) : 0;

    if (isNaN(priceNumber)) {
      showToast("옵션 가격은 숫자로 입력하세요");
      return;
    }

    const { error } = await supabase.from("menu_option_items").insert({
      group_id: Number(itemForm.group_id),
      name: itemForm.name.trim(),
      price: priceNumber,
      sort_order: getNextSortOrder(getItemsByGroupId(Number(itemForm.group_id))),
      is_soldout: false,
    });

    if (error) {
      showToast("옵션항목 추가 실패: " + error.message);
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
      showToast("옵션항목 수정 실패: " + error.message);
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
      showToast("옵션 품절 변경 실패: " + error.message);
      return;
    }

    fetchAll();
  };

  const deleteItem = async (id: number) => {
    openConfirm({
      title: "옵션항목 삭제",
      message: "옵션항목을 삭제할까요?",
      confirmText: "삭제",
      cancelText: "취소",
      tone: "danger",
      onConfirm: async () => {
        const { error } = await supabase
          .from("menu_option_items")
          .delete()
          .eq("id", id);

        if (error) {
          showToast("옵션항목 삭제 실패: " + error.message, "삭제 실패", "error");
          return;
        }

        showToast("옵션항목을 삭제했습니다.", "삭제 완료", "success");
        fetchAll();
      },
    });
  };

  const toggleMenuOptionOpen = (menuId: number) => {
    setOpenMenuOptionIds((prev) =>
      prev.includes(menuId)
        ? prev.filter((id) => id !== menuId)
        : [...prev, menuId],
    );
  };

  const toggleGroupMenusOpen = (groupId: number) => {
    setOpenGroupMenuIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId],
    );
  };

  const toggleGroupItemsOpen = (groupId: number) => {
    setOpenGroupItemIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId],
    );
  };

  const getGroupsByMenuId = (menuId: number) => {
    return groups.filter((group) =>
      links.some(
        (link) => link.group_id === group.id && link.menu_id === menuId,
      ),
    );
  };

  const getItemsByGroupId = (groupId: number) => {
    return items
      .filter((item) => item.group_id === groupId)
      .sort((a, b) => getSortOrder(a) - getSortOrder(b));
  };

  const getMenuNamesByGroupId = (groupId: number) => {
    const menuIds = links
      .filter((link) => link.group_id === groupId)
      .map((link) => link.menu_id);

    return menus
      .filter((menu) => menuIds.includes(menu.id))
      .map((menu) => menu.name);
  };

  const getSortOrder = (item: { id: number; sort_order: number | null }) => {
    return Number(item.sort_order ?? item.id);
  };

  const getNextSortOrder = (list: { id: number; sort_order: number | null }[]) => {
    if (list.length === 0) return 10;
    return Math.max(...list.map((item) => getSortOrder(item))) + 10;
  };

  const swapSortOrder = async (params: {
    table: "menus" | "menu_option_groups" | "menu_option_items";
    current: { id: number; sort_order: number | null };
    target: { id: number; sort_order: number | null };
    successMessage: string;
  }) => {
    const currentSort = getSortOrder(params.current);
    const targetSort = getSortOrder(params.target);

    const first = await supabase
      .from(params.table)
      .update({ sort_order: targetSort })
      .eq("id", params.current.id);

    if (first.error) {
      showToast("순서 변경 실패: " + first.error.message, "변경 실패", "error");
      return;
    }

    const second = await supabase
      .from(params.table)
      .update({ sort_order: currentSort })
      .eq("id", params.target.id);

    if (second.error) {
      showToast("순서 변경 실패: " + second.error.message, "변경 실패", "error");
      return;
    }

    showToast(params.successMessage, "순서 변경 완료", "success");
    fetchAll();
  };

  const moveMenu = async (menuId: number, direction: "up" | "down") => {
    const index = menus.findIndex((menu) => menu.id === menuId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (index < 0 || targetIndex < 0 || targetIndex >= menus.length) return;

    await swapSortOrder({
      table: "menus",
      current: menus[index],
      target: menus[targetIndex],
      successMessage: "메뉴 순서를 변경했습니다.",
    });
  };

  const moveGroup = async (groupId: number, direction: "up" | "down") => {
    const index = groups.findIndex((group) => group.id === groupId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (index < 0 || targetIndex < 0 || targetIndex >= groups.length) return;

    await swapSortOrder({
      table: "menu_option_groups",
      current: groups[index],
      target: groups[targetIndex],
      successMessage: "옵션그룹 순서를 변경했습니다.",
    });
  };

  const moveItem = async (groupId: number, itemId: number, direction: "up" | "down") => {
    const groupItems = getItemsByGroupId(groupId);
    const index = groupItems.findIndex((item) => item.id === itemId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (index < 0 || targetIndex < 0 || targetIndex >= groupItems.length) return;

    await swapSortOrder({
      table: "menu_option_items",
      current: groupItems[index],
      target: groupItems[targetIndex],
      successMessage: "옵션항목 순서를 변경했습니다.",
    });
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
const compactInputClass =
  "w-full rounded-[8px] border border-zinc-800 bg-[#050505] px-2.5 py-2 text-xs font-bold text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-[#d4af37]/70";
  const hwangjeScrollClass =
    "max-h-[650px] overflow-y-auto pr-2 [scrollbar-color:#d4af37_#070707] [scrollbar-width:thin]";

  return (
    <main className="min-h-screen overflow-hidden bg-[#070707] pt-9 text-zinc-100">
      <style jsx global>{`
        .hwangje-scroll::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }

        .hwangje-scroll::-webkit-scrollbar-track {
          background: #070707;
          border-radius: 999px;
          border: 1px solid rgba(212, 175, 55, 0.08);
        }

        .hwangje-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #d4af37 0%, #7a6320 100%);
          border-radius: 999px;
          border: 2px solid #070707;
        }

        .hwangje-scroll::-webkit-scrollbar-thumb:hover {
          background: #f0d98a;
        }
      `}</style>

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

                <div className={`${hwangjeScrollClass} hwangje-scroll space-y-3`}>
                  {groups.map((group, groupIndex) => {
                    const groupMenusOpen = openGroupMenuIds.includes(group.id);
                    const groupItemsOpen = openGroupItemIds.includes(group.id);
                    const linkedMenuNames = getMenuNamesByGroupId(group.id);
                    const groupItems = getItemsByGroupId(group.id);

                    return (
                      <div
                        key={group.id}
                        className="rounded-[12px] border border-zinc-800 bg-[#070707] p-3"
                      >
                        <div className="grid gap-2 md:grid-cols-[1fr_140px_96px]">
                          <input
                            defaultValue={group.name}
                            onBlur={(e) =>
                              updateGroup(group.id, { name: e.target.value })
                            }
                            className={compactInputClass}
                          />
                          <select
                            value={group.type}
                            onChange={(e) =>
                              updateGroup(group.id, { type: e.target.value })
                            }
                            className={compactInputClass}
                          >
                            <option value="single">하나만 선택</option>
                            <option value="multiple">여러 개 선택</option>
                          </select>
                          <label className="flex items-center justify-center gap-2 rounded-[8px] border border-zinc-800 bg-[#101010] px-2.5 py-2 text-xs font-black text-zinc-300">
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

                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => moveGroup(group.id, "up")}
                            disabled={groupIndex === 0}
                            className="rounded-[8px] border border-[#d4af37]/25 bg-[#101010] px-2.5 py-2 text-[11px] font-black text-[#d4af37] transition hover:border-[#d4af37] disabled:border-zinc-800 disabled:text-zinc-600"
                          >
                            ↑ 위로
                          </button>
                          <button
                            type="button"
                            onClick={() => moveGroup(group.id, "down")}
                            disabled={groupIndex === groups.length - 1}
                            className="rounded-[8px] border border-[#d4af37]/25 bg-[#101010] px-2.5 py-2 text-[11px] font-black text-[#d4af37] transition hover:border-[#d4af37] disabled:border-zinc-800 disabled:text-zinc-600"
                          >
                            ↓ 아래로
                          </button>
                        </div>

                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => toggleGroupMenusOpen(group.id)}
                            className="flex items-center justify-between rounded-[9px] border border-zinc-800 bg-[#101010] px-3 py-2 text-left transition hover:border-[#d4af37]/40"
                          >
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                                연결 메뉴
                              </div>
                              <div className="mt-0.5 text-xs font-bold text-zinc-400">
                                {linkedMenuNames.length > 0
                                  ? `${linkedMenuNames.length}개 메뉴 연결됨`
                                  : "연결 메뉴 없음"}
                              </div>
                            </div>
                            <div className="rounded-md border border-[#d4af37]/30 bg-[#d4af37]/10 px-2 py-1 text-[11px] font-black text-[#d4af37]">
                              {groupMenusOpen ? "접기 ▲" : "열기 ▼"}
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleGroupItemsOpen(group.id)}
                            className="flex items-center justify-between rounded-[9px] border border-zinc-800 bg-[#101010] px-3 py-2 text-left transition hover:border-[#d4af37]/40"
                          >
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                                옵션항목
                              </div>
                              <div className="mt-0.5 text-xs font-bold text-zinc-400">
                                {groupItems.length > 0
                                  ? `${groupItems.length}개 옵션항목`
                                  : "옵션항목 없음"}
                              </div>
                            </div>
                            <div className="rounded-md border border-[#d4af37]/30 bg-[#d4af37]/10 px-2 py-1 text-[11px] font-black text-[#d4af37]">
                              {groupItemsOpen ? "접기 ▲" : "열기 ▼"}
                            </div>
                          </button>
                        </div>

                        {groupMenusOpen && (
                          <div className="mt-2 rounded-[10px] border border-zinc-800 bg-[#101010] p-3">
                            <div className="grid max-h-[260px] gap-2 overflow-y-auto pr-1 hwangje-scroll md:grid-cols-2">
                              {menus.map((menu, menuIndex) => {
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
                                    className={`rounded-[8px] border px-2.5 py-2 text-left text-xs font-black transition ${
                                      checked
                                        ? "border-[#d4af37] bg-[#d4af37] text-black"
                                        : "border-zinc-800 bg-[#070707] text-zinc-500 hover:border-zinc-600"
                                    }`}
                                  >
                                    {checked ? "☑ " : "☐ "}
                                    {menu.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {groupItemsOpen && (
                          <div className="mt-2 rounded-[10px] border border-zinc-800 bg-[#101010] p-3">
                            <div className="grid max-h-[360px] gap-2 overflow-y-auto pr-1 hwangje-scroll md:grid-cols-2">
                              {groupItems.map((item, itemIndex) => (
                                <div
                                  key={item.id}
                                  className="rounded-[9px] border border-zinc-800 bg-[#070707] p-2.5"
                                >
                                  <input
                                    defaultValue={item.name}
                                    onBlur={(e) =>
                                      updateItem(item.id, "name", e.target.value)
                                    }
                                    className={compactInputClass}
                                  />
                                  <input
                                    defaultValue={item.price}
                                    onBlur={(e) =>
                                      updateItem(item.id, "price", e.target.value)
                                    }
                                    className={`${compactInputClass} mt-2 text-[#d4af37]`}
                                  />
                                  <div className="mt-2 grid grid-cols-2 gap-2">
                                    <button
                                      type="button"
                                      onClick={() => moveItem(group.id, item.id, "up")}
                                      disabled={itemIndex === 0}
                                      className="rounded-[8px] border border-[#d4af37]/25 bg-[#101010] px-2.5 py-2 text-[11px] font-black text-[#d4af37] transition hover:border-[#d4af37] disabled:border-zinc-800 disabled:text-zinc-600"
                                    >
                                      ↑ 위
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveItem(group.id, item.id, "down")}
                                      disabled={itemIndex === groupItems.length - 1}
                                      className="rounded-[8px] border border-[#d4af37]/25 bg-[#101010] px-2.5 py-2 text-[11px] font-black text-[#d4af37] transition hover:border-[#d4af37] disabled:border-zinc-800 disabled:text-zinc-600"
                                    >
                                      ↓ 아래
                                    </button>
                                  </div>
                                  <div className="mt-2 grid grid-cols-2 gap-2">
                                    <button
                                      onClick={() =>
                                        toggleItemSoldout(item.id, item.is_soldout)
                                      }
                                      className={`rounded-[8px] border px-2.5 py-2 text-[11px] font-black ${
                                        item.is_soldout
                                          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                                          : "border-red-500/40 bg-red-950/40 text-red-300"
                                      }`}
                                    >
                                      {item.is_soldout ? "판매중 변경" : "품절 처리"}
                                    </button>
                                    <button
                                      onClick={() => deleteItem(item.id)}
                                      className="rounded-[8px] border border-zinc-700 bg-[#111111] px-2.5 py-2 text-[11px] font-black text-zinc-300 hover:border-red-500/40 hover:text-red-300"
                                    >
                                      삭제
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {groupItems.length === 0 && (
                                <div className="rounded-[8px] border border-zinc-800 bg-[#070707] p-3 text-xs font-bold text-zinc-500">
                                  옵션항목 없음
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <button
                          onClick={() => deleteGroup(group.id)}
                          className="mt-2 w-full rounded-[9px] border border-zinc-700 bg-[#111111] px-3 py-2 text-xs font-black text-zinc-300 transition hover:border-red-500/40 hover:text-red-300"
                        >
                          옵션그룹 삭제
                        </button>
                      </div>
                    );
                  })}
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

                <div className={`${hwangjeScrollClass} hwangje-scroll space-y-2`}>
                  {menus.map((menu, menuIndex) => {
                    const menuGroups = getGroupsByMenuId(menu.id);
                    const optionOpen = openMenuOptionIds.includes(menu.id);

                    return (
                      <div
                        key={menu.id}
                        className="rounded-[10px] border border-zinc-800 bg-[#070707] p-3"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[10px] font-bold text-zinc-600">
                              MENU ID {menu.id} · SORT {getSortOrder(menu)}
                            </div>
                            <div className="mt-0.5 truncate text-sm font-black text-zinc-100">
                              {menu.name || "메뉴명 없음"}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveMenu(menu.id, "up")}
                              disabled={menuIndex === 0}
                              className="rounded-md border border-[#d4af37]/25 bg-[#101010] px-2 py-1 text-[11px] font-black text-[#d4af37] transition hover:border-[#d4af37] disabled:border-zinc-800 disabled:text-zinc-600"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => moveMenu(menu.id, "down")}
                              disabled={menuIndex === menus.length - 1}
                              className="rounded-md border border-[#d4af37]/25 bg-[#101010] px-2 py-1 text-[11px] font-black text-[#d4af37] transition hover:border-[#d4af37] disabled:border-zinc-800 disabled:text-zinc-600"
                            >
                              ↓
                            </button>
                            <div
                              className={`rounded-md border px-2 py-1 text-[11px] font-black ${
                                menu.is_soldout
                                  ? "border-red-500/40 bg-red-950/40 text-red-300"
                                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                              }`}
                            >
                              {menu.is_soldout ? "품절" : "판매중"}
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-2 md:grid-cols-[1fr_110px]">
                          <input
                            defaultValue={menu.name}
                            onBlur={(e) =>
                              updateMenu(menu.id, "name", e.target.value)
                            }
                            className={compactInputClass}
                          />

                          <input
                            defaultValue={menu.price}
                            onBlur={(e) =>
                              updateMenu(menu.id, "price", e.target.value)
                            }
                            className={`${compactInputClass} text-[#d4af37]`}
                          />

                          <input
                            defaultValue={menu.description || ""}
                            onBlur={(e) =>
                              updateMenu(menu.id, "description", e.target.value)
                            }
                            className={`${compactInputClass} md:col-span-2`}
                          />

                          <input
                            defaultValue={menu.category || ""}
                            onBlur={(e) =>
                              updateMenu(menu.id, "category", e.target.value)
                            }
                            className={`${compactInputClass} md:col-span-2`}
                          />
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button
                            onClick={() =>
                              toggleMenuSoldout(menu.id, menu.is_soldout)
                            }
                            className="rounded-[8px] border border-red-500/35 bg-red-950/30 px-2.5 py-2 text-[11px] font-black text-red-300 transition hover:bg-red-900/40"
                          >
                            {menu.is_soldout ? "판매중 변경" : "품절 처리"}
                          </button>

                          <button
                            onClick={() => deleteMenu(menu.id)}
                            className="rounded-[8px] border border-zinc-700 bg-[#111111] px-2.5 py-2 text-[11px] font-black text-zinc-300 transition hover:border-red-500/40 hover:text-red-300"
                          >
                            메뉴 삭제
                          </button>
                        </div>

                        <div className="mt-2 rounded-[9px] border border-zinc-800 bg-[#101010]">
                          <button
                            type="button"
                            onClick={() => toggleMenuOptionOpen(menu.id)}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                          >
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                                연결된 옵션
                              </div>
                              <div className="mt-0.5 text-xs font-bold text-zinc-400">
                                {menuGroups.length > 0
                                  ? `${menuGroups.length}개 옵션그룹 연결됨`
                                  : "연결된 옵션그룹 없음"}
                              </div>
                            </div>

                            <div className="shrink-0 rounded-md border border-[#d4af37]/30 bg-[#d4af37]/10 px-2 py-1 text-[11px] font-black text-[#d4af37]">
                              {optionOpen ? "접기 ▲" : "열기 ▼"}
                            </div>
                          </button>

                          {optionOpen && (
                            <div className="border-t border-zinc-800 p-3">
                              <div className="space-y-2">
                                {menuGroups.map((group) => (
                                  <div
                                    key={group.id}
                                    className="rounded-[8px] border border-zinc-800 bg-[#070707] p-2.5"
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="truncate text-sm font-black text-zinc-100">
                                          {group.name}
                                        </div>
                                        <div className="mt-1 text-[11px] text-zinc-500">
                                          {group.type === "single"
                                            ? "하나만 선택"
                                            : "여러 개 선택"}{" "}
                                          / {group.required ? "필수" : "선택"}
                                        </div>
                                      </div>

                                      <div className="shrink-0 text-xs font-black text-[#d4af37]">
                                        {getItemsByGroupId(group.id).length}개
                                      </div>
                                    </div>
                                  </div>
                                ))}

                                {menuGroups.length === 0 && (
                                  <div className="rounded-[8px] border border-zinc-800 bg-[#070707] p-3 text-xs font-bold text-zinc-500">
                                    연결된 옵션그룹이 없습니다.
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-5 right-5 z-[1400] w-[380px] max-w-[calc(100vw-32px)] rounded-[14px] border border-[#d4af37]/35 bg-[#0b0b0b]/96 p-4 text-sm shadow-[0_22px_80px_rgba(0,0,0,.75)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div
                className={`font-black ${
                  toast.tone === "error"
                    ? "text-red-300"
                    : toast.tone === "success"
                      ? "text-emerald-300"
                      : toast.tone === "warning"
                        ? "text-amber-300"
                        : "text-[#f0d98a]"
                }`}
              >
                {toast.title}
              </div>
              <div className="mt-2 whitespace-pre-line leading-relaxed text-zinc-300">
                {toast.message}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setToast(null)}
              className="shrink-0 text-xl leading-none text-zinc-500 transition hover:text-white"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[16px] border border-[#d4af37]/40 bg-[#0d0d0d] p-5 shadow-[0_28px_100px_rgba(0,0,0,.78)]">
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#d4af37]">
              HWANGJE POS
            </div>
            <div className="mt-2 text-2xl font-black tracking-[-0.05em] text-zinc-100">
              {confirmDialog.title}
            </div>
            <div className="mt-3 whitespace-pre-line text-sm font-bold leading-relaxed text-zinc-400">
              {confirmDialog.message}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="rounded-[10px] border border-zinc-700 bg-[#111111] px-4 py-3 text-sm font-black text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                {confirmDialog.cancelText}
              </button>
              <button
                type="button"
                onClick={runConfirm}
                className={`rounded-[10px] px-4 py-3 text-sm font-black transition ${
                  confirmDialog.tone === "danger"
                    ? "border border-red-500/40 bg-red-950/60 text-red-200 hover:bg-red-900/70"
                    : "border border-[#d4af37]/60 bg-[#d4af37] text-black hover:bg-[#f0c75a]"
                }`}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
