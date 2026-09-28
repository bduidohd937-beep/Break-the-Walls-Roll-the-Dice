import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { Unit } from "../types";
import { BOSS_ENEMY_KEYS, STAGES, STAGE_ATK_SCALE, STAGE_HP_SCALE } from "../stages";
import { ENEMY_MAP, MOVE_SPEED_MULTIPLIER, WAVE_ATK_SCALE, WAVE_HP_SCALE } from "../constants";
import { makeUnit } from "../units/createUnit";
import { applyKnockback } from "../combat/knockback";
import { resolveFrontlineCollision, resolveSameTeamSpacing } from "../combat/collision";
import { incomingDamage } from "../combat/damage";
import { runHeroPhase } from "../combat/heroPhase";
import { advanceEnemyStatus, advanceHeroStatus } from "../combat/statusTick";
import { spawnWaveEnemy } from "../combat/waveSpawner";
import { spriteDeathDuration, UNIT_SPRITES, type BattleDeathEffect } from "../visuals/sprites";
import type { BattleReward, BattleState, DamagePopup } from "../combat/types";
import type { CombatAbilityIntegration, CombatEvent } from "../combat/abilities";
import { effectiveMoveSpeed, hasAbilityStatus, resolveAbilityDamage } from "../combat/abilities/effects";

type Setter<T> = Dispatch<SetStateAction<T>>;
type Ref<T> = MutableRefObject<T>;
export type { BattleReward } from "../combat/types";
type BattleLoopContext = {
  battleState: BattleState; paused:boolean; gameSpeed:number; battleGoldMax:number; goldPerSecond:number; clearedStages:number[];
  setCastleHit:Setter<"our"|"enemy"|null>; setDamagePopups:Setter<DamagePopup[]>; setDeathEffects:Setter<BattleDeathEffect[]>; setBattleGold:Setter<number>;
  setDeployCooldowns:Setter<Record<string,number>>; setNotice:Setter<string>; setEnemyCastleHp:Setter<number>; setCastleHp:Setter<number>;
  setHeroes:Setter<Unit[]>; setEnemies:Setter<Unit[]>; setWaveIndex:Setter<number>; setUnlockedStage:Setter<number>;
  setClearedStages:Setter<number[]>; setGems:Setter<number>; setKingdomGold:Setter<number>; setBattleState:Setter<BattleState>; setBattleReward:Setter<BattleReward|null>;
  goldRef:Ref<number>; spawnTimerRef:Ref<number>; heroesRef:Ref<Unit[]>; enemiesRef:Ref<Unit[]>; stageRef:Ref<number>; waveRef:Ref<number>;
  spawnRef:Ref<number>; uidRef:Ref<number>; bossSpawnAnnouncedRef:Ref<boolean>; bossSummonTimerRef:Ref<number>;
  bossEnrageTriggeredRef:Ref<boolean>; bossFieldTickRef:Ref<number>; bossChargeRef:Ref<number>; bossPhaseRef:Ref<number>;
  enemyCastleRef:Ref<number>; popupUidRef:Ref<number>; castleRef:Ref<number>; deathUidRef:Ref<number>; finalClearNotifiedRef:Ref<boolean>; victoryAwardedRef:Ref<boolean>;
  combatEventUidRef:Ref<number>; abilityIntegrationRef:Ref<CombatAbilityIntegration>;
};

export function useBattleLoop(ctx: BattleLoopContext) {
  const { battleState, paused, gameSpeed, clearedStages, setCastleHit, setDamagePopups, setDeathEffects, goldRef, battleGoldMax, goldPerSecond, setBattleGold, spawnTimerRef, setDeployCooldowns, heroesRef, enemiesRef, stageRef, waveRef, spawnRef, uidRef, bossSpawnAnnouncedRef, setNotice, bossSummonTimerRef, bossEnrageTriggeredRef, bossFieldTickRef, bossChargeRef, bossPhaseRef, enemyCastleRef, setEnemyCastleHp, popupUidRef, combatEventUidRef, abilityIntegrationRef, castleRef, setCastleHp, deathUidRef, setHeroes, setEnemies, finalClearNotifiedRef, victoryAwardedRef, setWaveIndex, setUnlockedStage, setClearedStages, setGems, setKingdomGold, setBattleState, setBattleReward } = ctx;
  useEffect(() => {
    if (battleState !== "playing" || paused) return;

    const interval = window.setInterval(() => {
      const dt = 0.05 * gameSpeed;
      setCastleHit(null);
      setDamagePopups((popups) => popups.slice(-24));
      setDeathEffects((effects) => effects.map((effect) => ({ ...effect, life: effect.life - 0.05 })).filter((effect) => effect.life > 0));

      goldRef.current = Math.min(battleGoldMax, goldRef.current + dt * goldPerSecond);
      setBattleGold(goldRef.current);

      spawnTimerRef.current -= dt;

      setDeployCooldowns((cooldowns) => {
        const next = { ...cooldowns };
        for (const id of Object.keys(next)) next[id] = Math.max(0, next[id] - dt);
        return next;
      });

      let nextHeroes = heroesRef.current.map((unit) => advanceHeroStatus(unit, dt));
      let nextEnemies = enemiesRef.current.map((unit) => advanceEnemyStatus(unit, dt));
      const abilitiesActive = abilityIntegrationRef.current.hasAbilities();
      const publishCombatEvent = (event: CombatEvent) => {
        const result = abilityIntegrationRef.current.publish(event, [...nextHeroes, ...nextEnemies]);
        nextHeroes = result.units.filter((unit) => unit.team === "hero");
        nextEnemies = result.units.filter((unit) => unit.team === "enemy");
        for (const change of result.resourceChanges ?? []) {
          if (change.resource !== "BATTLE_GOLD") continue;
          goldRef.current = Math.min(battleGoldMax, Math.max(0, goldRef.current + change.amount));
          setBattleGold(Math.floor(goldRef.current));
        }
      };

      if (abilitiesActive) publishCombatEvent({
        type: "SIMULATION_TICK",
        eventId: combatEventUidRef.current++,
        origin: "SYSTEM",
        deltaSeconds: dt
      });
      if (abilitiesActive) for (const unit of [...nextHeroes, ...nextEnemies]) {
        const previous = unit.team === "hero"
          ? heroesRef.current.find((candidate) => candidate.uid === unit.uid)
          : enemiesRef.current.find((candidate) => candidate.uid === unit.uid);
        if (previous && previous.currentHp !== unit.currentHp) {
          publishCombatEvent({
            type: "HP_CHANGED",
            eventId: combatEventUidRef.current++,
            origin: unit.burnTimer > 0 ? "STATUS" : "SYSTEM",
            unitUid: unit.uid,
            previousHp: previous.currentHp,
            currentHp: unit.currentHp
          });
        }
      }

      // Spawn the current wave with gentle per-wave scaling.
      const stage = STAGES[stageRef.current];
      const wave = stage.waves[waveRef.current];
      const waveMeta = stage.waveMeta[waveRef.current];
      const spawnResult = spawnWaveEnemy({
        stageIndex: stageRef.current,
        waveIndex: waveRef.current,
        wave,
        waveMeta,
        spawnedInWave: spawnRef.current,
        spawnTimer: spawnTimerRef.current,
        uid: 1000 + uidRef.current
      });
      const totalInWave = spawnResult.totalInWave;
      if (spawnResult.enemy) {
        nextEnemies.push(spawnResult.enemy);
        uidRef.current += 1;
        spawnRef.current = spawnResult.spawnedInWave;
        spawnTimerRef.current = spawnResult.spawnTimer;
      }

      const bossMechanic = stage.bossMechanic;
      const bossWaveActive = Boolean(waveMeta?.boss && bossMechanic);
      const bossKey = BOSS_ENEMY_KEYS[stage.id];
      const bossId = bossKey ? ENEMY_MAP[bossKey].id : undefined;
      const livingBoss = nextEnemies.find((enemy) => enemy.id === bossId && enemy.currentHp > 0);
      const bossAlive = bossWaveActive && Boolean(livingBoss);
      if (bossAlive && bossMechanic?.summonEnemy && bossMechanic.summonInterval) {
        bossSummonTimerRef.current -= dt;
        if (bossSummonTimerRef.current <= 0 && spawnRef.current >= totalInWave) {
          const summonDef = ENEMY_MAP[bossMechanic.summonEnemy];
          const summonScale = 1 + stageRef.current * STAGE_HP_SCALE;
          const summon = makeUnit({ ...summonDef, hp: Math.round(summonDef.hp * summonScale), atk: Math.round(summonDef.atk * summonScale) }, "enemy", 91, 1000 + uidRef.current++);
          nextEnemies.push(summon);
          bossSummonTimerRef.current = bossMechanic.summonInterval;
          setNotice(`${stage.bossName ?? "BOSS"} · 증원!`);
        }
      }
      if (bossAlive && bossMechanic?.fieldDamagePerSecond) {
        bossFieldTickRef.current -= dt;
        if (bossFieldTickRef.current <= 0) {
          nextHeroes = nextHeroes.map((hero) => ({ ...hero, currentHp: Math.max(0, hero.currentHp - bossMechanic.fieldDamagePerSecond!) }));
          bossFieldTickRef.current = 1;
        }
      }
      if (bossAlive && bossMechanic?.enemyAttackSpeedPerStack) {
        bossChargeRef.current += dt;
        const stacks = Math.min(10, Math.floor(bossChargeRef.current / 4));
        const speedMultiplier = Math.max(0.55, 1 - stacks * bossMechanic.enemyAttackSpeedPerStack);
        nextEnemies = nextEnemies.map((enemy) => ({ ...enemy, attackTimer: Math.min(enemy.attackTimer, enemy.attackInterval * speedMultiplier) }));
      }
      const heroPhase = runHeroPhase({
        heroes: nextHeroes,
        enemies: nextEnemies,
        dt,
        stage,
        stageIndex: stageRef.current,
        waveIndex: waveRef.current,
        spawnedInWave: spawnRef.current,
        totalInWave,
        bossKey,
        bossSpawnAnnounced: bossSpawnAnnouncedRef.current,
        enemyCastleHp: enemyCastleRef.current,
        nextUid: uidRef.current,
        nextPopupUid: popupUidRef.current,
        nextCombatEventId: combatEventUidRef.current,
        collectCombatEvents: abilitiesActive
      });
      nextHeroes = heroPhase.heroes;
      nextEnemies = heroPhase.enemies;
      enemyCastleRef.current = heroPhase.enemyCastleHp;
      bossSpawnAnnouncedRef.current = heroPhase.bossSpawnAnnounced;
      uidRef.current = heroPhase.nextUid;
      popupUidRef.current = heroPhase.nextPopupUid;
      combatEventUidRef.current = heroPhase.nextCombatEventId;
      for (const event of heroPhase.combatEvents) publishCombatEvent(event);
      if (heroPhase.enemyCastleHit) {
        setEnemyCastleHp(enemyCastleRef.current);
        setCastleHit("enemy");
      }
      for (const popup of heroPhase.damagePopups) {
        setDamagePopups((popups) => [...popups.slice(-24), popup]);
      }
      if (heroPhase.notice) setNotice(heroPhase.notice);

      // Resolve boss death after hero damage, before surviving enemies attack.
      const bossAfterAttack = nextEnemies.find((enemy) => enemy.id === bossId && enemy.currentHp > 0);
      const bossWasAlive = Boolean(livingBoss || enemiesRef.current.some((enemy) => enemy.id === bossId && enemy.currentHp > 0));
      if (bossWaveActive && bossMechanic?.deathEnrage && bossWasAlive && !bossAfterAttack && !bossEnrageTriggeredRef.current) {
        bossEnrageTriggeredRef.current = true;
        nextEnemies = nextEnemies.map((enemy) => enemy.currentHp > 0 && enemy.id !== bossId ? { ...enemy, deathEnraged: true } : enemy);
        setNotice(`${stage.bossName ?? "BOSS"} 격파 · 남은 군세 광폭화!`);
      }
      if (bossWaveActive && bossMechanic?.auraAtk) {
        nextEnemies = nextEnemies.map((enemy) => ({ ...enemy, atk: enemy.baseAtk * (1 + (bossAfterAttack && enemy.id !== bossId && enemy.currentHp > 0 ? bossMechanic.auraAtk! : 0) + (enemy.deathEnraged ? bossMechanic.deathEnrage ?? 0 : 0)) }));
      }
      if (bossAfterAttack && bossMechanic?.phaseElements?.length) {
        const progress = 1 - bossAfterAttack.currentHp / Math.max(1, bossAfterAttack.hp);
        const phaseIndex = Math.min(bossMechanic.phaseElements.length - 1, Math.floor(progress * bossMechanic.phaseElements.length));
        if (phaseIndex !== bossPhaseRef.current) {
          bossPhaseRef.current = phaseIndex;
          const phase = bossMechanic.phaseElements[phaseIndex];
          setNotice(`${stage.bossName ?? "BOSS"} · ${phase} 페이즈`);
          if (phaseIndex > 0 && bossMechanic.summonEnemy) {
            const phaseDef = ENEMY_MAP[bossMechanic.summonEnemy];
            nextEnemies.push(makeUnit({ ...phaseDef, hp: Math.round(phaseDef.hp * (1 + phaseIndex * 0.35)), atk: Math.round(phaseDef.atk * (1 + phaseIndex * 0.25)) }, "enemy", 90, 1000 + uidRef.current++));
          }
        }
      }

      // Enemies move, attack heroes, or damage our castle.
      for (let i = 0; i < nextEnemies.length; i++) {
        const enemy = nextEnemies[i];
        if (enemy.currentHp <= 0 || enemy.knockbackTimer > 0 || hasAbilityStatus(enemy, "STUN")) continue;

        const livingHeroes = nextHeroes.filter((h) => h.currentHp > 0);
        const frontTarget = livingHeroes
          .filter((h) => h.x <= enemy.x)
          .sort((a, b) => b.x - a.x)[0] ?? livingHeroes
          .sort((a, b) => Math.abs(a.x - enemy.x) - Math.abs(b.x - enemy.x))[0];

        // Enemy roles matter: assassins dive toward fragile backliners while other enemies hold the frontline.
        const assassinTarget = enemy.id === "assassinE"
          ? livingHeroes
              .filter((h) => h.rangeType === "ranged")
              .sort((a, b) => a.currentHp - b.currentHp || b.x - a.x)[0]
          : undefined;
        const target = assassinTarget ?? frontTarget;

        if (!target) {
          if (enemy.x <= 13) {
            if (enemy.attackTimer <= 0) {
              const castleHpBeforeAttack = castleRef.current;
              castleRef.current = Math.max(0, castleRef.current - enemy.atk);
              setCastleHp(castleRef.current);
              setCastleHit("our");
              nextEnemies[i].attackTimer = enemy.attackInterval;
              nextEnemies[i].attackFlash = 0.16;
              nextEnemies[i].attackAnimationTimer = enemy.attackInterval;
              nextEnemies[i].attackAnimationSequence = (nextEnemies[i].attackAnimationSequence ?? 0) + 1;
              nextEnemies[i].attackTargetX = 9;
              if (abilitiesActive) publishCombatEvent({
                type: "CASTLE_ATTACK",
                eventId: combatEventUidRef.current++,
                attackId: combatEventUidRef.current++,
                origin: "BASIC_ATTACK",
                attackerUid: enemy.uid,
                castle: "hero",
                actualDamage: castleHpBeforeAttack - castleRef.current
              });
            }
          } else {
            nextEnemies[i] = { ...enemy, x: Math.max(9, enemy.x - effectiveMoveSpeed(enemy) * (enemy.slowTimer > 0 ? enemy.slowMultiplier : 1) * MOVE_SPEED_MULTIPLIER * dt / 100) };
          }
          continue;
        }

        const distance = Math.abs(target.x - enemy.x);
        if (distance > enemy.range / 10) {
          nextEnemies[i] = { ...enemy, x: Math.max(9, enemy.x - effectiveMoveSpeed(enemy) * (enemy.slowTimer > 0 ? enemy.slowMultiplier : 1) * MOVE_SPEED_MULTIPLIER * dt / 100) };
        } else if (enemy.attackTimer <= 0) {
          const attackId = abilitiesActive ? combatEventUidRef.current++ : 0;
          const damageEvents: CombatEvent[] = [];
          const enragedBoss = enemy.id === "fireOgreE" && enemy.currentHp / enemy.hp <= 0.5;
          const backlinePressure = enemy.id === "assassinE" && target.rangeType === "ranged";
          const attackDamage = (enragedBoss ? enemy.atk * 1.2 : enemy.atk) * (backlinePressure ? 1.2 : 1);
          const splashRadius = enemy.splashRadius ?? 0;
          const hitTargets = enemy.attackType === "splash"
            ? nextHeroes
                .filter((heroTarget) => heroTarget.currentHp > 0 && Math.abs(heroTarget.x - target.x) <= splashRadius)
                .map((heroTarget) => heroTarget.uid)
            : [target.uid];

          for (const targetUid of hitTargets) {
            const hitIndex = nextHeroes.findIndex((heroTarget) => heroTarget.uid === targetUid);
            if (hitIndex < 0) continue;
            const damage = incomingDamage(nextHeroes[hitIndex], attackDamage);
            const hpBeforeHit = nextHeroes[hitIndex].currentHp;
            const isPrimaryTarget = targetUid === target.uid;
            const impactAtk = enemy.attackType === "splash" && !isPrimaryTarget ? attackDamage * 0.65 : attackDamage;
            const resolvedDamage = resolveAbilityDamage(nextHeroes[hitIndex], damage, enemy);
            const hitHero = applyKnockback(
              resolvedDamage.unit,
              nextHeroes[hitIndex].currentHp - resolvedDamage.hpDamage,
              "enemy",
              impactAtk,
            );
            nextHeroes[hitIndex] = enemy.effect === "burn"
              ? { ...hitHero, burnTimer: 3, burnDamage: Math.max(hitHero.burnDamage, enemy.atk * 0.12), hitFlash: 0.14 }
              : hitHero;
            if (abilitiesActive) damageEvents.push({
              type: "DAMAGE_APPLIED",
              eventId: combatEventUidRef.current++,
              attackId,
              origin: "BASIC_ATTACK",
              sourceUid: enemy.uid,
              targetUid,
              actualDamage: Math.max(0, hpBeforeHit - Math.max(0, hitHero.currentHp))
            });
            const popupId = popupUidRef.current++;
            const popupX = hitHero.x;
            setDamagePopups((popups) => [...popups.slice(-24), { id: popupId, x: popupX, value: Math.max(1, Math.round(damage)), critical: false }]);
          }
          nextEnemies[i].attackTimer = enragedBoss ? enemy.attackInterval * 0.65 : enemy.attackInterval;
          nextEnemies[i].attackFlash = enragedBoss ? 0.22 : 0.16;
          nextEnemies[i].attackAnimationTimer = enemy.attackInterval;
              nextEnemies[i].attackAnimationSequence = (nextEnemies[i].attackAnimationSequence ?? 0) + 1;
          nextEnemies[i].attackTargetX = target.x;
          if (abilitiesActive) publishCombatEvent({
            type: "BASIC_ATTACK",
            eventId: combatEventUidRef.current++,
            attackId,
            origin: "BASIC_ATTACK",
            attackerUid: enemy.uid,
            targetUid: target.uid
          });
          if (abilitiesActive) for (const event of damageEvents) publishCombatEvent(event);
        }
      }

      // Remove defeated units before collision and wave checks.
      const defeatedUnits = [...nextHeroes.filter((u) => u.currentHp <= 0), ...nextEnemies.filter((u) => u.currentHp <= 0)];
      if (defeatedUnits.length > 0) {
        if (abilitiesActive) for (const unit of defeatedUnits) {
          publishCombatEvent({
            type: "UNIT_DEATH",
            eventId: combatEventUidRef.current++,
            origin: "SYSTEM",
            unitUid: unit.uid
          });
        }
        setDeathEffects((effects) => [...effects, ...defeatedUnits.map((unit) => ({ id: deathUidRef.current++, x: unit.x, team: unit.team, life: spriteDeathDuration(unit.id), duration: spriteDeathDuration(unit.id), unit: UNIT_SPRITES[unit.id] ? { ...unit, alive: false, currentHp: 0 } : undefined }))].slice(-20));
      }
      const defeatedEnemies = nextEnemies.filter((e) => e.currentHp <= 0).length;
      if (defeatedEnemies > 0) {
        goldRef.current = Math.min(battleGoldMax, goldRef.current + defeatedEnemies * 20);
        setBattleGold(Math.floor(goldRef.current));
      }

      nextHeroes = nextHeroes
        .filter((unit) => unit.currentHp > 0)
        .map((unit) => ({ ...unit, alive: true }));
      nextEnemies = nextEnemies
        .filter((unit) => unit.currentHp > 0)
        .map((unit) => ({ ...unit, alive: true }));
      if (abilitiesActive) abilityIntegrationRef.current.cleanup(new Set([...nextHeroes, ...nextEnemies].map((unit) => unit.uid)));

      // Keep same-team units from stacking into the same position.
      // Allied units may overlap; only enemies keep formation spacing.
      nextEnemies = resolveSameTeamSpacing(nextEnemies);

      const frontline = resolveFrontlineCollision(nextHeroes, nextEnemies);
      nextHeroes = frontline.heroes.map((unit) => ({ ...unit, moving: Math.abs(unit.x - (heroesRef.current.find((old) => old.uid === unit.uid)?.x ?? unit.x)) > 0.01 }));
      nextEnemies = frontline.enemies.map((unit) => ({ ...unit, moving: Math.abs(unit.x - (enemiesRef.current.find((old) => old.uid === unit.uid)?.x ?? unit.x)) > 0.01 }));

      heroesRef.current = nextHeroes;
      enemiesRef.current = nextEnemies;
      setHeroes(nextHeroes);
      setEnemies(nextEnemies);

      const waveCleared = spawnRef.current >= totalInWave && nextEnemies.length === 0;
      if (waveCleared && waveRef.current < stage.waves.length - 1) {
        const reward = stage.waveMeta[waveRef.current]?.reward ?? 0;
        goldRef.current = Math.min(battleGoldMax, goldRef.current + reward);
        setBattleGold(Math.floor(goldRef.current));
        waveRef.current += 1;
        spawnRef.current = 0;
        spawnTimerRef.current = 1.4;
        setWaveIndex(waveRef.current);
        setNotice(`WAVE ${waveRef.current + 1} · ${stage.waveMeta[waveRef.current]?.name ?? "다음 전투"}`);
      } else if (waveCleared && waveRef.current === stage.waves.length - 1 && !finalClearNotifiedRef.current) {
        finalClearNotifiedRef.current = true;
        setNotice("FINAL WAVE CLEAR · 적 성을 파괴하면 스테이지 클리어!");
      }

      if (enemyCastleRef.current <= 0 && !victoryAwardedRef.current) {
        victoryAwardedRef.current = true;
        setEnemyCastleHp(0);
        const clearedStage = stageRef.current + 1;
        setUnlockedStage((current) => Math.max(current, Math.min(STAGES.length, clearedStage + 1)));
        const firstClear = !clearedStages.includes(clearedStage);
        const reward = { gold: firstClear ? stage.clearReward : stage.repeatReward, gems: firstClear ? stage.firstClearGems : 0, firstClear };
        if (firstClear) {
          setClearedStages((current) => current.includes(clearedStage) ? current : [...current, clearedStage].sort((a, b) => a - b));
          setGems((currentGems) => currentGems + stage.firstClearGems);
        }
        setKingdomGold((gold) => gold + reward.gold);
        setBattleReward(reward);
        setBattleState("victory");
      } else if (castleRef.current <= 0) {
        setCastleHp(0);
        setBattleState("defeat");
      }
    }, 50);

    return () => window.clearInterval(interval);
  }, [battleState, paused, gameSpeed, battleGoldMax, goldPerSecond]);
}
