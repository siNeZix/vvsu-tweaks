import type { Feature } from "./types";
import { avatarBlur } from "./avatar-blur";
import { darkTheme } from "./dark-theme";
import { consentSkip } from "./consent-skip";
import { forceRemember } from "./force-remember";
import { hideBvi } from "./hide-bvi";
import { hideMax } from "./hide-max";
import { settingsPanel } from "./settings-panel";
import { signinError } from "./signin-error";
import { detectHost } from "@/utils/host";

const features: Feature[] = [
  signinError,
  consentSkip,
  forceRemember,
  avatarBlur,
  darkTheme,
  hideBvi,
  hideMax,
  settingsPanel,
];

export function runFeatures(): void {
  const host = detectHost();

  for (const feature of features) {
    if (feature.hosts && !feature.hosts.includes(host)) continue;

    try {
      Promise.resolve(feature.run())
        .then(() => console.debug(`[vvsu-tweaks] ${feature.id}: ok`))
        .catch((err) => console.error(`[vvsu-tweaks] ${feature.id}: failed`, err));
    } catch (err) {
      console.error(`[vvsu-tweaks] ${feature.id}: failed`, err);
    }
  }
}
