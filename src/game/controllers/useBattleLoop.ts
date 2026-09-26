import { useEffect } from "react";
import { STAGES, STAGE_ATK_SCALE, STAGE_HP_SCALE } from "../stages";
import { ENEMY_MAP, MOVE_SPEED_MULTIPLIER, WAVE_ATK_SCALE, WAVE_HP_SCALE } from "../constants";
import { makeUnit } from "../units/createUnit";
import { updateKnockback, applyKnockback } from "../combat/knockback";
import { resolveFrontlineCollision, resolveSameTeamSpacing } from "../combat/collision";
import { incomingDamage, outgoingDamage, regenAmount } from "../combat/damage";
import { STORAGE_KEYS, saveJson, saveNumber } from "../storage";

export function useBattleLoop(ctx: any) {
  const { battleState, gameSpeed, setCastleHit, setDamagePopups, setDeathEffects, goldRef, battleGoldMax, goldPerSecond, setBattleGold, spawnTimerRef, setDeployCooldowns, heroesRef, enemiesRef, stageRef, waveRef, spawnRef, uidRef, bossSpawnAnnouncedRef, setNotice, bossSummonTimerRef, bossEnrageTriggeredRef, bossFieldTickRef, bossChargeRef, bossPhaseRef, enemyCastleRef, setEnemyCastleHp, popupUidRef, castleRef, setCastleHp, deathUidRef, setHeroes, setEnemies, finalClearNotifiedRef, setWaveIndex, setUnlockedStage, setClearedStages, setGems, setKingdomGold, setBattleState } = ctx;
  useEffect(() => {
    if (battleState !== "playing") return;

    const interval = window.setInterval(() => {
      const dt = 0.05 * gameSpeed;
      setCastleHit(null);
      setDamagePopups((popups) => popups.slice(-24));
      setDeathEffects((effects) => effects.map((effect) => ({ ...effect, life: effect.life - dt })).filter((effect) => effect.life > 0));

      goldRef.current = Math.min(battleGoldMax, goldRef.current + dt * goldPerSecond);
      setBattleGold(goldRef.current);

      spawnTimerRef.current -= dt;

      setDeployCooldowns((cooldowns) => {
        const next = { ...cooldowns };
        for (const id of Object.keys(next)) next[id] = Math.max(0, next[id] - dt);
        return next;
      });

      let nextHeroes = heroesRef.current.map((u) => {
        const unit = updateKnockback({
          ...u,
          attackTimer: Math.max(0, u.attackTimer - dt),
          hitFlash: Math.max(0, u.hitFlash - dt),
          attackFlash: Math.max(0, u.attackFlash - dt),
        }, dt);
        const healed = Math.min(unit.hp, unit.currentHp + regenAmount(unit, dt));
        if (unit.burnTimer <= 0) return { ...unit, currentHp: healed };
        const burnTick = Math.min(unit.burnTimer, dt);
        return {
          ...unit,
          currentHp: Math.max(0, healed - unit.burnDamage * burnTick),
          burnTimer: Math.max(0, unit.burnTimer - dt),
        };
      });

      let nextEnemies = enemiesRef.current.map((u) => {
        const unit = updateKnockback({
          ...u,
          attackTimer: Math.max(0, u.attackTimer - dt),
          hitFlash: Math.max(0, u.hitFlash - dt),
          attackFlash: Math.max(0, u.attackFlash - dt),
        }, dt);
        if (unit.burnTimer <= 0) return unit;
        const burnTick = Math.min(unit.burnTimer, dt);
        return {
          ...unit,
          currentHp: Math.max(0, unit.currentHp - unit.burnDamage * burnTick),
          burnTimer: Math.max(0, unit.burnTimer - dt),
        };
      });

      // Spawn the current wave with gentle per-wave scaling.
      const stage = STAGES[stageRef.current];
      const wave = stage.waves[waveRef.current];
      const waveMeta = stage.waveMeta[waveRef.current];
      const totalInWave = wave?.reduce((sum, group) => sum + group.count, 0) ?? 0;
      if (wave && spawnRef.current < totalInWave && spawnTimerRef.current <= 0) {
        const sequence = wave.flatMap((group) => Array.from({ length: group.count }, () => group));
        const group = sequence[spawnRef.current];
        const baseEnemy = ENEMY_MAP[group.enemy];
        const hpScale = 1 + stageRef.current * STAGE_HP_SCALE + waveRef.current * WAVE_HP_SCALE + (waveMeta?.boss ? 0.35 : 0);
        const atkScale = 1 + stageRef.current * STAGE_ATK_SCALE + waveRef.current * WAVE_ATK_SCALE + (waveMeta?.boss ? 0.15 : 0);
        const enemyDef = {
          ...baseEnemy,
          hp: Math.round(baseEnemy.hp * hpScale),
          atk: Math.round(baseEnemy.atk * atkScale),
        };
        const uid = 1000 + uidRef.current++;
        nextEnemies.push(makeUnit(enemyDef, "enemy", 90 + Math.random() * 4, uid));
        if (waveMeta?.boss && stage.bossName && !bossSpawnAnnouncedRef.current && ["morgarE", "ignisE", "voltrasE", "arcanonE"].includes(enemyDef.id)) {
          bossSpawnAnnouncedRef.current = true;
          setNotice(`⚠ BOSS 등장 · ${stage.bossName}`);
        }
        spawnRef.current += 1;
        spawnTimerRef.current = group.gap ?? 0.8;
      }

      const bossMechanic = stage.bossMechanic;
      const bossWaveActive = Boolean(waveMeta?.boss && bossMechanic);
      if (bossWaveActive && bossMechanic?.summonEnemy && bossMechanic.summonInterval) {
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
      if (bossWaveActive && bossMechanic?.auraAtk) {
        nextEnemies = nextEnemies.map((enemy) => ({ ...enemy, atk: enemy.atk * (1 + bossMechanic.auraAtk! * dt * 0.15) }));
      }
      if (bossWaveActive && bossMechanic?.deathEnrage && !bossEnrageTriggeredRef.current && spawnRef.current >= totalInWave && nextEnemies.length === 0) {
        bossEnrageTriggeredRef.current = true;
        spawnTimerRef.current = Math.min(spawnTimerRef.current, 0.35);
        setNotice(`${stage.bossName ?? "BOSS"} 격파 · 남은 군세 광폭화!`);
      }

      if (bossWaveActive && bossMechanic?.fieldDamagePerSecond) {
        bossFieldTickRef.current -= dt;
        if (bossFieldTickRef.current <= 0) {
          nextHeroes = nextHeroes.map((hero) => ({ ...hero, currentHp: Math.max(0, hero.currentHp - bossMechanic.fieldDamagePerSecond!) }));
          bossFieldTickRef.current = 1;
        }
      }
      if (bossWaveActive && bossMechanic?.enemyAttackSpeedPerStack) {
        bossChargeRef.current += dt;
        const stacks = Math.min(10, Math.floor(bossChargeRef.current / 4));
        const speedMultiplier = Math.max(0.55, 1 - stacks * bossMechanic.enemyAttackSpeedPerStack);
        nextEnemies = nextEnemies.map((enemy) => ({ ...enemy, attackTimer: Math.min(enemy.attackTimer, enemy.attackInterval * speedMultiplier) }));
      }
      if (bossWaveActive && bossMechanic?.phaseElements?.length) {
        const progress = 1 - enemyCastleRef.current / Math.max(1, stage.enemyCastleHp);
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
      // Heroes move, attack, and hit the enemy castle when the lane is clear.
      for (let i = 0; i < nextHeroes.length; i++) {
        const hero = nextHeroes[i];
        if (hero.currentHp <= 0 || hero.knockbackTimer > 0) continue;

        const livingEnemies = nextEnemies.filter((e) => e.currentHp > 0);
        const frontTarget = livingEnemies
          .filter((e) => e.x >= hero.x)
          .sort((a, b) => a.x - b.x)[0] ?? livingEnemies
          .sort((a, b) => Math.abs(a.x - hero.x) - Math.abs(b.x - hero.x))[0];
        const assassinTarget = hero.id === "assassin"
          ? livingEnemies
              .filter((e) => e.rangeType === "ranged")
              .sort((a, b) => a.currentHp - b.currentHp || a.x - b.x)[0]
          : undefined;
        const target = assassinTarget ?? frontTarget;

        if (!target) {
          nextHeroes[i] = { ...hero, x: Math.min(87, hero.x + hero.speed * MOVE_SPEED_MULTIPLIER * dt / 100) };
          if (hero.x >= 84 && hero.attackTimer <= 0) {
            const finalWaveCleared =
              waveRef.current === stage.waves.length - 1 &&
              spawnRef.current >= totalInWave &&
              nextEnemies.every((enemy) => enemy.currentHp <= 0);
            if (finalWaveCleared) {
              const damage = hero.atk * 1.8;
              enemyCastleRef.current = Math.max(0, enemyCastleRef.current - damage);
              setEnemyCastleHp(enemyCastleRef.current);
              setCastleHit("enemy");
              nextHeroes[i].attackFlash = 0.16;
              nextHeroes[i].attackTargetX = 87;
            }
            nextHeroes[i].attackTimer = hero.attackInterval;
          }
          continue;
        }

        const distance = Math.abs(target.x - hero.x);
        if (distance > hero.range / 10) {
          nextHeroes[i] = { ...hero, x: Math.min(87, hero.x + hero.speed * MOVE_SPEED_MULTIPLIER * dt / 100) };
        } else if (hero.attackTimer <= 0) {
          const damage = outgoingDamage(hero, target, hero.atk);
          const splashRadius = hero.splashRadius ?? 0;
          const hitTargets = hero.attackType === "splash"
            ? nextEnemies
                .filter((enemy) => enemy.currentHp > 0 && Math.abs(enemy.x - target.x) <= splashRadius)
                .map((enemy) => enemy.uid)
            : [target.uid];

          for (const targetUid of hitTargets) {
            const targetIndex = nextEnemies.findIndex((enemy) => enemy.uid === targetUid);
            if (targetIndex < 0) continue;

            const isPrimaryTarget = targetUid === target.uid;
            const impactAtk = hero.attackType === "splash" && !isPrimaryTarget ? hero.atk * 0.65 : hero.atk;
            const hitTarget = applyKnockback(
              nextEnemies[targetIndex],
              nextEnemies[targetIndex].currentHp - damage,
              "hero",
              impactAtk,
            );

            nextEnemies[targetIndex] = hero.effect === "burn"
              ? { ...hitTarget, burnTimer: 3, burnDamage: Math.max(hitTarget.burnDamage, hero.atk * 0.12), hitFlash: 0.14 }
              : { ...hitTarget, hitFlash: 0.14 };
            const popupId = popupUidRef.current++;
            setDamagePopups((popups) => [...popups.slice(-24), { id: popupId, x: hitTarget.x, value: Math.max(1, Math.round(damage)), critical: damage >= hero.atk * 1.9 }]);
          }
          nextHeroes[i].attackTimer = hero.attackInterval;
          nextHeroes[i].attackFlash = 0.16;
          nextHeroes[i].attackTargetX = target.x;
        }
      }

      // Enemies move, attack heroes, or damage our castle.
      for (let i = 0; i < nextEnemies.length; i++) {
        const enemy = nextEnemies[i];
        if (enemy.currentHp <= 0 || enemy.knockbackTimer > 0) continue;

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
              castleRef.current = Math.max(0, castleRef.current - enemy.atk);
              setCastleHp(castleRef.current);
              setCastleHit("our");
              nextEnemies[i].attackTimer = enemy.attackInterval;
              nextEnemies[i].attackFlash = 0.16;
              nextEnemies[i].attackTargetX = 9;
            }
          } else {
            nextEnemies[i] = { ...enemy, x: Math.max(9, enemy.x - enemy.speed * MOVE_SPEED_MULTIPLIER * dt / 100) };
          }
          continue;
        }

        const distance = Math.abs(target.x - enemy.x);
        if (distance > enemy.range / 10) {
          nextEnemies[i] = { ...enemy, x: Math.max(9, enemy.x - enemy.speed * MOVE_SPEED_MULTIPLIER * dt / 100) };
        } else if (enemy.attackTimer <= 0) {
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
            const isPrimaryTarget = targetUid === target.uid;
            const impactAtk = enemy.attackType === "splash" && !isPrimaryTarget ? attackDamage * 0.65 : attackDamage;
            const hitHero = applyKnockback(
              nextHeroes[hitIndex],
              nextHeroes[hitIndex].currentHp - damage,
              "enemy",
              impactAtk,
            );
            nextHeroes[hitIndex] = enemy.effect === "burn"
              ? { ...hitHero, burnTimer: 3, burnDamage: Math.max(hitHero.burnDamage, enemy.atk * 0.12), hitFlash: 0.14 }
              : hitHero;
            const popupId = popupUidRef.current++;
            setDamagePopups((popups) => [...popups.slice(-24), { id: popupId, x: nextHeroes[hitIndex].x, value: Math.max(1, Math.round(damage)), critical: false }]);
          }
          nextEnemies[i].attackTimer = enragedBoss ? enemy.attackInterval * 0.65 : enemy.attackInterval;
          nextEnemies[i].attackFlash = enragedBoss ? 0.22 : 0.16;
          nextEnemies[i].attackTargetX = target.x;
        }
      }

      // Remove defeated units before collision and wave checks.
      const defeatedUnits = [...nextHeroes.filter((u) => u.currentHp <= 0), ...nextEnemies.filter((u) => u.currentHp <= 0)];
      if (defeatedUnits.length > 0) {
        setDeathEffects((effects) => [...effects, ...defeatedUnits.map((unit) => ({ id: deathUidRef.current++, x: unit.x, team: unit.team, life: 0.42 }))].slice(-20));
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

      // Keep same-team units from stacking into the same position.
      // Allied units may overlap; only enemies keep formation spacing.
      nextEnemies = resolveSameTeamSpacing(nextEnemies);

      const frontline = resolveFrontlineCollision(nextHeroes, nextEnemies);
      nextHeroes = frontline.heroes;
      nextEnemies = frontline.enemies;

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

      if (enemyCastleRef.current <= 0) {
        setEnemyCastleHp(0);
        const clearedStage = stageRef.current + 1;
        setUnlockedStage((current) => {
          const next = Math.max(current, Math.min(STAGES.length, clearedStage + 1));
          window.localStorage.setItem("btw-unlocked-stage", String(next));
          return next;
        });
        setClearedStages((current) => {
          const firstClear = !current.includes(clearedStage);
          if (firstClear) {
            setGems((currentGems) => {
              const nextGems = currentGems + stage.firstClearGems;
              window.localStorage.setItem("btw-gems", String(nextGems));
              return nextGems;
            });
          }
          const reward = firstClear ? stage.clearReward : stage.repeatReward;
          setKingdomGold((gold) => {
            const nextGold = gold + reward;
            saveNumber(STORAGE_KEYS.kingdomGold, nextGold);
            return nextGold;
          });
          if (!firstClear) return current;
          const next = [...current, clearedStage].sort((a, b) => a - b);
          window.localStorage.setItem("btw-cleared-stages", JSON.stringify(next));
          return next;
        });
        setBattleState("victory");
      } else if (castleRef.current <= 0) {
        setCastleHp(0);
        setBattleState("defeat");
      }
    }, 50);

    return () => window.clearInterval(interval);
  }, [battleState, gameSpeed, battleGoldMax, goldPerSecond]);
}
