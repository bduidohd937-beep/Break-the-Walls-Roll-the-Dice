import { useEffect, useState } from "react";

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export function FullscreenToggle({ className = "" }: { className?: string }) {
  const [active, setActive] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const sync = () => {
      const doc = document as FullscreenDocument;
      setActive(Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement));
    };
    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const toggle = async () => {
    const doc = document as FullscreenDocument;
    const element = document.documentElement as FullscreenElement;
    try {
      if (doc.fullscreenElement ?? doc.webkitFullscreenElement) {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else await doc.webkitExitFullscreen?.();
      } else if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen();
      } else {
        setUnavailable(true);
      }
    } catch {
      setUnavailable(true);
    }
  };

  const label = unavailable
    ? "이 브라우저는 전체화면을 지원하지 않습니다. 브라우저 메뉴에서 홈 화면에 추가해 실행해 주세요."
    : active ? "전체화면 종료" : "전체화면";

  return <button type="button" className={`fullscreen-toggle ${className}`} onClick={toggle} aria-label={label} title={label}>
    {unavailable ? "!" : active ? "⤢" : "⛶"}
  </button>;
}
