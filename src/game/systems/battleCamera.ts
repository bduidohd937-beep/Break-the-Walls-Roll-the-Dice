export type BattleViewMode = "wide" | "narrow";
export type BattleDeckPage = 0 | 1;

export const BATTLE_WORLD_PERCENT = 100;
export const BATTLE_NARROW_VIEW_SPAN = 42;
export const BATTLE_NARROW_DEFAULT_LEFT = (BATTLE_WORLD_PERCENT - BATTLE_NARROW_VIEW_SPAN) / 2;

export type BattleCameraGeometry = {
  span: number;
  left: number;
  worldScale: number;
  worldWidthPercent: number;
  worldOffsetPercent: number;
};

export function getBattleCameraGeometry(viewMode: BattleViewMode, cameraLeft: number): BattleCameraGeometry {
  const span = viewMode === "wide" ? BATTLE_WORLD_PERCENT : BATTLE_NARROW_VIEW_SPAN;
  const left = Math.max(0, Math.min(BATTLE_WORLD_PERCENT - span, cameraLeft));
  const worldScale = BATTLE_WORLD_PERCENT / span;

  return {
    span,
    left,
    worldScale,
    worldWidthPercent: worldScale * BATTLE_WORLD_PERCENT,
    worldOffsetPercent: left === 0 ? 0 : -(left / span) * BATTLE_WORLD_PERCENT
  };
}

export function projectBattleWorldX(worldX: number, viewMode: BattleViewMode, cameraLeft: number): number {
  if (viewMode === "wide") return worldX;
  const { span, left } = getBattleCameraGeometry(viewMode, cameraLeft);
  return ((worldX - left) / span) * BATTLE_WORLD_PERCENT;
}

export function cameraLeftAfterDrag(
  startCameraLeft: number,
  dragDeltaPixels: number,
  viewportWidth: number,
  span = BATTLE_NARROW_VIEW_SPAN
): number {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) return startCameraLeft;
  const maxLeft = BATTLE_WORLD_PERCENT - span;
  return Math.max(0, Math.min(maxLeft, startCameraLeft - (dragDeltaPixels / viewportWidth) * span));
}

export function battleDeckPageAfterSwipe(currentPage: BattleDeckPage, dragDeltaPixels: number, deckCount: number, threshold = 42): BattleDeckPage {
  if (Math.abs(dragDeltaPixels) < threshold) return currentPage;
  if (dragDeltaPixels < 0) return deckCount > 5 ? 1 : currentPage;
  return 0;
}
