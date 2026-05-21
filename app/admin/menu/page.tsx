"use client";

import { useEffect, useState } from "react";
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
            (link) => link.group_id === group.id && link.menu_id === group.menu_id,
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

    const { error } = await supabase.from("menus").update(updateData).eq("id", id);

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
    const ok = confirm("메뉴를 삭제할까요? 연결된 옵션도 같이 삭제될 수 있습니다.");

    if (!ok) return;

    await supabase.from("menu_option_group_menus").delete().eq("menu_id", id);

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

    const insertLinks = selectedMenuIds.map((menuId) => ({
      menu_id: menuId,
      group_id: data.id,
    }));

    const { error: linkError } = await supabase
      .from("menu_option_group_menus")
      .insert(insertLinks);

    if (linkError) {
      alert("옵션그룹 연결 실패: " + linkError.message);
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
    const ok = confirm("옵션그룹을 삭제할까요? 안에 있는 옵션항목도 같이 삭제됩니다.");

    if (!ok) return;

    await supabase.from("menu_option_group_menus").delete().eq("group_id", id);

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

    const { error } = await supabase.from("menu_option_group_menus").insert({
      group_id: groupId,
      menu_id: menuId,
    });

    if (error) {
      alert("메뉴 연결 실패: " + error.message);
      return;
    }

    fetchAll();
  };

  const disconnectGroupFromMenu = async (groupId: number, menuId: number) => {
    const group = groups.find((item) => item.id === groupId);

    // 기존 구조로 만들어진 첫 연결(menu_id)은 삭제하면 예전 로직이 꼬일 수 있어서 연결테이블만 제거.
    const realLink = links.find(
      (link) =>
        link.group_id === groupId &&
        link.menu_id === menuId &&
        link.id > 0,
    );

    if (!realLink) {
      alert("기존 방식으로 붙어있는 기본 연결입니다. 그룹을 삭제하거나 새 공용그룹으로 다시 만들어주세요.");
      return;
    }

    const { error } = await supabase
      .from("menu_option_group_menus")
      .delete()
      .eq("group_id", groupId)
      .eq("menu_id", menuId);

    if (error) {
      alert("메뉴 연결 해제 실패: " + error.message);
      return;
    }

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
      links.some((link) => link.group_id === group.id && link.menu_id === menuId),
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

  return (
    <main className="min-h-screen bg-black p-4 text-white md:p-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-2 text-4xl font-black text-yellow-400">
          메뉴관리
        </h1>

        <p className="mb-8 text-zinc-400">
          메뉴 추가 · 가격 수정 · 품절 · 공용 옵션그룹 · 옵션항목 관리
        </p>

        <div className="mb-8 rounded-3xl border border-yellow-400/20 bg-zinc-900 p-5">
          <h2 className="mb-4 text-2xl font-black text-yellow-400">새 메뉴 추가</h2>

          <input
            placeholder="메뉴명"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mb-3 w-full rounded-xl border border-zinc-700 bg-black p-3"
          />

          <input
            placeholder="가격 예: 9000"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="mb-3 w-full rounded-xl border border-zinc-700 bg-black p-3"
          />

          <input
            placeholder="설명"
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            className="mb-3 w-full rounded-xl border border-zinc-700 bg-black p-3"
          />

          <input
            placeholder="카테고리 예: 떡볶이 / 사이드 / 음료"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="mb-4 w-full rounded-xl border border-zinc-700 bg-black p-3"
          />

          <button
            onClick={addMenu}
            className="w-full rounded-xl bg-yellow-400 p-4 font-black text-black"
          >
            메뉴 추가
          </button>
        </div>

        <div className="mb-8 rounded-3xl border border-yellow-400/20 bg-zinc-900 p-5">
          <h2 className="mb-2 text-2xl font-black text-yellow-400">
            공용 옵션그룹 추가
          </h2>

          <p className="mb-4 text-sm text-zinc-400">
            옵션그룹을 한 번 만들고 여러 메뉴에 체크로 연결합니다.
          </p>

          <input
            placeholder="옵션그룹명 예: 맵기 / 토핑 / 음료"
            value={groupForm.name}
            onChange={(e) =>
              setGroupForm({ ...groupForm, name: e.target.value })
            }
            className="mb-3 w-full rounded-xl border border-zinc-700 bg-black p-3"
          />

          <select
            value={groupForm.type}
            onChange={(e) =>
              setGroupForm({ ...groupForm, type: e.target.value })
            }
            className="mb-3 w-full rounded-xl border border-zinc-700 bg-black p-3"
          >
            <option value="single">하나만 선택</option>
            <option value="multiple">여러 개 선택</option>
          </select>

          <label className="mb-4 flex items-center gap-2">
            <input
              type="checkbox"
              checked={groupForm.required}
              onChange={(e) =>
                setGroupForm({ ...groupForm, required: e.target.checked })
              }
            />
            필수 선택
          </label>

          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={selectAllMenus}
              className="rounded-xl bg-zinc-700 px-4 py-2 text-sm font-black"
            >
              전체선택
            </button>

            <button
              type="button"
              onClick={clearSelectedMenus}
              className="rounded-xl bg-zinc-700 px-4 py-2 text-sm font-black"
            >
              선택해제
            </button>

            <div className="rounded-xl border border-yellow-400/20 bg-black px-4 py-2 text-sm font-black text-yellow-400">
              선택 {selectedMenuIds.length}개
            </div>
          </div>

          <div className="mb-4 grid gap-2 md:grid-cols-3">
            {menus.map((menu) => (
              <button
                key={menu.id}
                type="button"
                onClick={() => toggleSelectedMenu(menu.id)}
                className={`rounded-xl border p-3 text-left text-sm font-black ${
                  selectedMenuIds.includes(menu.id)
                    ? "border-yellow-400 bg-yellow-400 text-black"
                    : "border-zinc-700 bg-black text-white"
                }`}
              >
                {selectedMenuIds.includes(menu.id) ? "☑ " : "☐ "}
                {menu.name}
              </button>
            ))}
          </div>

          <button
            onClick={addGroup}
            className="w-full rounded-xl bg-yellow-400 p-4 font-black text-black"
          >
            공용 옵션그룹 추가
          </button>
        </div>

        <div className="mb-8 rounded-3xl border border-yellow-400/20 bg-zinc-900 p-5">
          <h2 className="mb-4 text-2xl font-black text-yellow-400">
            옵션항목 추가
          </h2>

          <select
            value={itemForm.group_id}
            onChange={(e) =>
              setItemForm({ ...itemForm, group_id: e.target.value })
            }
            className="mb-3 w-full rounded-xl border border-zinc-700 bg-black p-3"
          >
            <option value="">옵션그룹 선택</option>

            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} / {getMenuNamesByGroupId(group.id).join(", ") || "연결메뉴 없음"}
              </option>
            ))}
          </select>

          <input
            placeholder="옵션명 예: 중간맛 / 치즈추가 / 순대추가"
            value={itemForm.name}
            onChange={(e) =>
              setItemForm({ ...itemForm, name: e.target.value })
            }
            className="mb-3 w-full rounded-xl border border-zinc-700 bg-black p-3"
          />

          <input
            placeholder="추가금액 예: 4000 / 무료면 0"
            value={itemForm.price}
            onChange={(e) =>
              setItemForm({ ...itemForm, price: e.target.value })
            }
            className="mb-4 w-full rounded-xl border border-zinc-700 bg-black p-3"
          />

          <button
            onClick={addItem}
            className="w-full rounded-xl bg-green-600 p-4 font-black"
          >
            옵션항목 추가
          </button>
        </div>

        <div className="mb-8 rounded-3xl border border-yellow-400/20 bg-zinc-900 p-5">
          <h2 className="mb-4 text-2xl font-black text-yellow-400">
            공용 옵션그룹 목록
          </h2>

          {groups.length === 0 && (
            <div className="rounded-2xl bg-black p-4 text-zinc-500">
              등록된 옵션그룹이 없습니다.
            </div>
          )}

          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.id} className="rounded-2xl bg-black p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <input
                    defaultValue={group.name}
                    onBlur={(e) => updateGroup(group.id, { name: e.target.value })}
                    className="rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-black"
                  />

                  <select
                    value={group.type}
                    onChange={(e) => updateGroup(group.id, { type: e.target.value })}
                    className="rounded-xl border border-zinc-700 bg-zinc-950 p-3"
                  >
                    <option value="single">하나만 선택</option>
                    <option value="multiple">여러 개 선택</option>
                  </select>

                  <label className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 p-3">
                    <input
                      type="checkbox"
                      checked={group.required}
                      onChange={(e) =>
                        updateGroup(group.id, { required: e.target.checked })
                      }
                    />
                    필수 선택
                  </label>
                </div>

                <div className="mt-3 rounded-xl bg-zinc-950 p-3">
                  <div className="mb-2 text-sm font-black text-yellow-400">
                    연결 메뉴
                  </div>

                  <div className="grid gap-2 md:grid-cols-4">
                    {menus.map((menu) => {
                      const checked = links.some(
                        (link) => link.group_id === group.id && link.menu_id === menu.id,
                      );

                      return (
                        <button
                          key={menu.id}
                          type="button"
                          onClick={() => toggleGroupMenuConnection(group.id, menu.id)}
                          className={`rounded-xl border p-2 text-left text-xs font-black ${
                            checked
                              ? "border-yellow-400 bg-yellow-400 text-black"
                              : "border-zinc-700 bg-black text-zinc-400"
                          }`}
                        >
                          {checked ? "☑ " : "☐ "}
                          {menu.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 rounded-xl bg-zinc-950 p-3">
                  <div className="mb-2 text-sm font-black text-yellow-400">
                    옵션항목
                  </div>

                  <div className="grid gap-2 md:grid-cols-2">
                    {getItemsByGroupId(group.id).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-zinc-800 bg-black p-3"
                      >
                        <input
                          defaultValue={item.name}
                          onBlur={(e) => updateItem(item.id, "name", e.target.value)}
                          className="mb-2 w-full rounded-lg border border-zinc-800 bg-zinc-950 p-2 font-black"
                        />

                        <input
                          defaultValue={item.price}
                          onBlur={(e) => updateItem(item.id, "price", e.target.value)}
                          className="mb-2 w-full rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-yellow-400"
                        />

                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              toggleItemSoldout(item.id, item.is_soldout)
                            }
                            className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${
                              item.is_soldout
                                ? "bg-green-600"
                                : "bg-red-600"
                            }`}
                          >
                            {item.is_soldout ? "판매중" : "품절"}
                          </button>

                          <button
                            onClick={() => deleteItem(item.id)}
                            className="rounded-lg bg-zinc-700 px-3 py-2 text-sm font-bold"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}

                    {getItemsByGroupId(group.id).length === 0 && (
                      <div className="rounded-xl bg-black p-3 text-sm text-zinc-500">
                        옵션항목 없음
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => deleteGroup(group.id)}
                  className="mt-3 w-full rounded-xl bg-zinc-700 p-3 font-black"
                >
                  옵션그룹 삭제
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          {menus.map((menu) => (
            <div key={menu.id} className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="mb-4 flex justify-between gap-4">
                <div className="w-full">
                  <div className="mb-2 text-sm text-zinc-500">
                    메뉴 ID: {menu.id}
                  </div>

                  <input
                    defaultValue={menu.name}
                    onBlur={(e) => updateMenu(menu.id, "name", e.target.value)}
                    className="mb-3 w-full rounded-xl border border-zinc-700 bg-black p-3 text-xl font-black"
                  />

                  <input
                    defaultValue={menu.price}
                    onBlur={(e) =>
                      updateMenu(menu.id, "price", e.target.value)
                    }
                    className="mb-3 w-full rounded-xl border border-zinc-700 bg-black p-3 font-black text-yellow-400"
                  />

                  <input
                    defaultValue={menu.description || ""}
                    onBlur={(e) =>
                      updateMenu(menu.id, "description", e.target.value)
                    }
                    className="mb-3 w-full rounded-xl border border-zinc-700 bg-black p-3"
                  />

                  <input
                    defaultValue={menu.category || ""}
                    onBlur={(e) =>
                      updateMenu(menu.id, "category", e.target.value)
                    }
                    className="w-full rounded-xl border border-zinc-700 bg-black p-3"
                  />
                </div>

                <div
                  className={`h-fit whitespace-nowrap rounded-xl px-4 py-2 font-black ${
                    menu.is_soldout ? "bg-red-600" : "bg-green-600"
                  }`}
                >
                  {menu.is_soldout ? "품절" : "판매중"}
                </div>
              </div>

              <div className="mb-5 flex flex-wrap gap-2">
                <button
                  onClick={() => toggleMenuSoldout(menu.id, menu.is_soldout)}
                  className="rounded-xl bg-red-600 px-4 py-3 font-black"
                >
                  {menu.is_soldout ? "판매중 변경" : "품절 처리"}
                </button>

                <button
                  onClick={() => deleteMenu(menu.id)}
                  className="rounded-xl bg-zinc-700 px-4 py-3 font-black"
                >
                  메뉴 삭제
                </button>
              </div>

              <div className="rounded-2xl bg-black p-4">
                <h3 className="mb-3 text-xl font-black text-yellow-400">
                  연결된 옵션
                </h3>

                {getGroupsByMenuId(menu.id).length === 0 && (
                  <div className="text-zinc-500">
                    연결된 옵션그룹이 없습니다.
                  </div>
                )}

                <div className="space-y-4">
                  {getGroupsByMenuId(menu.id).map((group) => (
                    <div key={group.id} className="rounded-2xl bg-zinc-900 p-4">
                      <div className="mb-3">
                        <div className="text-lg font-black">
                          {group.name}
                        </div>

                        <div className="text-sm text-zinc-400">
                          {group.type === "single"
                            ? "하나만 선택"
                            : "여러 개 선택"}
                          {" / "}
                          {group.required ? "필수" : "선택"}
                        </div>
                      </div>

                      <div className="grid gap-2 md:grid-cols-2">
                        {getItemsByGroupId(group.id).map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between rounded-xl bg-black p-3"
                          >
                            <div>
                              <div className="font-bold">{item.name}</div>
                              <div className="text-sm text-yellow-400">
                                +{item.price.toLocaleString()}원
                              </div>
                            </div>

                            <div
                              className={`rounded-xl px-3 py-2 text-xs font-black ${
                                item.is_soldout ? "bg-red-600" : "bg-green-600"
                              }`}
                            >
                              {item.is_soldout ? "품절" : "판매중"}
                            </div>
                          </div>
                        ))}

                        {getItemsByGroupId(group.id).length === 0 && (
                          <div className="text-sm text-zinc-500">
                            옵션항목 없음
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {menus.length === 0 && (
            <div className="rounded-3xl bg-zinc-900 p-8 text-center text-zinc-400">
              등록된 메뉴가 없습니다.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
