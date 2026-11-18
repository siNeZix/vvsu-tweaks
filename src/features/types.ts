import type { VvsuHost } from "@/utils/host";

export interface Feature {
  /** Уникальный id фичи */
  id: string;
  /** Короткое описание */
  name: string;
  /** На каких хостах включать. Пусто = везде на vvsu.ru */
  hosts?: readonly VvsuHost[];
  /** Запуск фичи */
  run: () => void | Promise<void>;
}
