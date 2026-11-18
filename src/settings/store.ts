import { storageGet, storageSet } from "@/utils/storage";

export const SETTING_KEYS = [
  "dark-theme",
  "avatar-blur",
  "consent-skip",
  "force-remember",
  "hide-bvi",
  "hide-max",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

export type SettingsState = Record<SettingKey, boolean>;

export const SETTING_GROUPS = [
  { id: "interface", label: "Интерфейс" },
  { id: "privacy", label: "Приватность" },
  { id: "automation", label: "Автоматизация" },
] as const;

export type SettingGroupId = (typeof SETTING_GROUPS)[number]["id"];

export const SETTING_META: Record<
  SettingKey,
  { label: string; hint: string; group: SettingGroupId }
> = {
  "dark-theme": {
    label: "Тёмная тема",
    hint: "Кабинет и страница входа",
    group: "interface",
  },
  "hide-bvi": {
    label: "Скрыть BVI",
    hint: "Глазик на кабинете и входе",
    group: "interface",
  },
  "hide-max": {
    label: "Скрыть Max",
    hint: "Ссылки и поля мессенджера",
    group: "interface",
  },
  "avatar-blur": {
    label: "Скрытие фото",
    hint: "Глазик на аватаре профиля",
    group: "privacy",
  },
  "consent-skip": {
    label: "Пропуск соглашения",
    hint: "Оверлей и редирект consent-student",
    group: "automation",
  },
  "force-remember": {
    label: "Всегда «Запомнить»",
    hint: "Чекбокс на странице входа",
    group: "automation",
  },
};

const STORAGE_KEY = "vvsu-tweaks.settings";

const DEFAULTS: SettingsState = {
  "dark-theme": true,
  "avatar-blur": true,
  "consent-skip": true,
  "force-remember": true,
  "hide-bvi": true,
  "hide-max": true,
};

function isSettingKey(value: string): value is SettingKey {
  return (SETTING_KEYS as readonly string[]).includes(value);
}

export function getSettings(): SettingsState {
  const next: SettingsState = { ...DEFAULTS };

  try {
    const raw = storageGet(STORAGE_KEY);
    if (!raw) return next;

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return next;

    for (const key of SETTING_KEYS) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === "boolean") next[key] = value;
    }
  } catch {
    /* private mode / broken JSON */
  }

  return next;
}

export function isFeatureEnabled(key: SettingKey): boolean {
  return getSettings()[key];
}

export function isToggleableFeature(id: string): id is SettingKey {
  return isSettingKey(id);
}

/** Сохранить флаг и перезагрузить страницу, чтобы фичи применились чисто. */
export function setFeatureEnabled(key: SettingKey, enabled: boolean): void {
  const next = getSettings();
  next[key] = enabled;
  storageSet(STORAGE_KEY, JSON.stringify(next));
  location.reload();
}

export function getSettingsByGroup(): Array<{
  id: SettingGroupId;
  label: string;
  keys: SettingKey[];
}> {
  return SETTING_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    keys: SETTING_KEYS.filter((key) => SETTING_META[key].group === group.id),
  })).filter((group) => group.keys.length > 0);
}
