# 프로젝트 구조와 변경 원칙

이 문서는 기능이 늘어날 때 파일 충돌과 회귀를 줄이기 위한 현재 구조의 기준입니다. 저장 데이터 키와 게임 규칙은 파일 이동만으로 변경하지 않습니다.

## 현재 폴더 책임

```text
src/
  assets/heroes/       영웅 이미지와 애니메이션 원본·가공 자산
  components/battle/   전투 화면·유닛·출전 로비·스테이지 선택
  components/kingdom/  왕국 허브·채집·상점·보관 화면
  components/heroes/   영웅 관리·합성·영웅 저장소
  components/summon/   소환 화면
  components/shared/   여러 기능에서 함께 쓰는 UI와 영웅 이미지
  components/devtools/ 개발 전용 스프라이트 검사 화면
  game/combat/         충돌, 피해, 넉백 등 순수 전투 계산
  game/controllers/    React 상태와 게임 시스템을 연결하는 훅
  game/systems/        경제, 성장, 소환, 저장 검증 등 도메인 규칙
  game/units/          전투 유닛 생성
  game/visuals/        스프라이트 프레임과 시각 데이터 매핑
  game/constants.ts    영웅·적 기본 데이터와 공용 상수
  game/stages.ts       스테이지와 웨이브 데이터
  game/storage.ts      일반·개발자 프로필 저장 키와 저장 접근
  game/types.ts        게임 전역 타입
  App.tsx              화면과 시스템을 조립하는 애플리케이션 루트
  main.tsx             React 진입점과 개발용 스프라이트 화면 분기
  styles/index.css     전역 스타일 진입점과 로드 순서
  styles/base.css      공용 토큰·기본 화면·초기 UI 스타일
  styles/battle.css    전투 연출·배치·전투 경제 스타일
  styles/features.css  영웅·소환·채집·성장 기능 스타일
  styles/hub.css       왕국 허브 셸과 메뉴 스타일
  styles/responsive.css 모바일 가로 화면과 반응형 보정
```

## 의존 방향

새 코드는 가능한 한 아래 방향만 따릅니다.

```text
main → app/root → feature components → controllers → systems/combat → types
                                    ↘ visuals/assets
```

- `game/systems`와 `game/combat`은 화면 컴포넌트를 import하지 않습니다.
- 컴포넌트는 저장소에 직접 쓰지 않고 컨트롤러나 전달받은 콜백을 사용합니다.
- 저장 키 문자열은 `game/storage.ts`에서만 정의합니다.
- 영웅과 스테이지의 안정적인 ID는 저장 데이터 호환성이 있으므로 이름을 바꾸지 않습니다.
- 이미지 교체는 `game/visuals`의 매핑을 통해 연결하고 전투 규칙에 파일 경로를 넣지 않습니다.
- 플레이어 진행 저장 상태는 `game/controllers/usePlayerProgress.ts`에서 기존 저장 키와 검증 규칙을 그대로 사용합니다.
- 허브 탭과 로비 열림 상태는 `game/controllers/useHubNavigation.ts`에서 관리합니다.
- 왕국·보유 영웅·자원·일꾼 저장 상태는 `game/controllers/useKingdomProfile.ts`에서 기존 저장 형식을 유지합니다.
- 소환 보관함·영혼·파편·천장 기록은 `game/controllers/useSummonProfile.ts`에서 기존 저장 형식을 유지합니다.
- 출전 덱 저장과 영웅 편성 UI 상태는 `game/controllers/useHeroFormation.ts`에서 관리합니다.

## 대규모 정돈 순서

구조 변경은 한 번에 섞지 않고 다음 순서로 진행합니다.

1. 설치 잠금과 빌드 검사를 먼저 고정합니다.
2. CSS는 기존 선언 순서를 유지한 채 영역별 파일로 분리합니다.
3. 컴포넌트를 기능 폴더로 이동하고 import 경로만 변경합니다.
4. `App.tsx`의 저장 프로필과 허브 상태를 전용 훅으로 분리합니다.
5. 전투 루프는 이동, 공격, 웨이브, 보상 단위로 나눕니다.

각 단계는 독립 커밋으로 만들고 `npm run check`를 통과한 뒤 다음 단계로 넘어갑니다. 기능 변경과 파일 이동을 같은 커밋에 섞지 않습니다.

## 현재 보호 대상

- localStorage 키와 일반·개발자 프로필 분리 방식
- 영웅 ID, 스테이지 ID, 편성 슬롯 저장 형식
- 전투 수치와 보상 수치
- 세렌티아 스프라이트 프레임 크기와 애니메이션 타이밍
- 모바일 가로 화면의 전투·허브 레이아웃

## 다음 구조 개선 후보

- `App.tsx`에서 프로필 상태와 화면 조립 분리
- `useBattleLoop.ts`에서 순수 계산과 React 타이머 제어 분리
- 저장 데이터와 전투 경제에 대한 최소 회귀 테스트 추가
