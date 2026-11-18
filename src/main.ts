import { isVvsuHost } from "@/utils/host";
import { runFeatures } from "@/features";
import { primeAvatarBlur } from "@/features/avatar-blur";
import { primeDarkTheme } from "@/features/dark-theme";
import { version } from "../package.json";

function bootstrap(): void {
  // До runFeatures / await: тема и blur из storage до первой отрисовки
  primeDarkTheme();
  primeAvatarBlur();

  console.info(`[vvsu-tweaks] v${version}`);
  runFeatures();
}

/** document-start может прийти раньше, чем парсер создаст <html>. */
function whenDocumentElement(run: () => void): void {
  if (document.documentElement) {
    run();
    return;
  }

  const observer = new MutationObserver(() => {
    if (!document.documentElement) return;
    observer.disconnect();
    run();
  });
  observer.observe(document, { childList: true });
}

if (isVvsuHost()) whenDocumentElement(bootstrap);
