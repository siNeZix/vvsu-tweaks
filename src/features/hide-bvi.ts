import type { Feature } from "./types";
import { injectStyle } from "@/utils/dom";
import { isFeatureEnabled } from "@/settings/store";

const STYLE_ID = "vvsu-tweaks-hide-bvi";

function hideBviButton(): void {
  injectStyle(
    `
a.bvi-open,
button.bvi-open,
.btn-top-nav.bvi-open,
.btn-outline-primary.bvi-open {
  display: none !important;
}
`,
    STYLE_ID,
  );
  console.info("[vvsu-tweaks] hide-bvi: BVI button hidden");
}

export const hideBvi: Feature = {
  id: "hide-bvi",
  name: "Скрыть глазик BVI",
  hosts: ["cabinet", "openid"],
  run() {
    if (!isFeatureEnabled("hide-bvi")) return;
    hideBviButton();
  },
};
