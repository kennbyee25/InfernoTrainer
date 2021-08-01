import { find, intersection } from 'lodash'
import { Weapon, AttackBonuses } from '../gear/Weapon'
import { BasePrayer, PrayerGroups } from '../BasePrayer'
import { Unit, UnitTypes } from '../Unit'
import { XpDrop } from '../XpDrop'
import { World } from '../World'

export class MeleeWeapon extends Weapon {
  
  attack (world: World, from: Unit, to: Unit, bonuses: AttackBonuses = {}) {
    bonuses.attackStyle = bonuses.attackStyle || 'slash'
    super.attack(world, from, to, bonuses);
  }

  grantXp(from: Unit) {

    if (from.type === UnitTypes.PLAYER && this.damage > 0) {
      from.grantXp(new XpDrop('hitpoint', this.damage * 1.33));
      from.grantXp(new XpDrop('attack', this.damage * 4));
    }
  }

  _calculatePrayerEffects (from: Unit, to: Unit, bonuses: AttackBonuses) {
    bonuses.effectivePrayers = {}
    if (from.type !== UnitTypes.MOB) {
      const offensiveAttack = find(from.prayers, (prayer: BasePrayer) => prayer.feature() === 'offensiveAttack')
      if (offensiveAttack) {
        bonuses.effectivePrayers.attack = offensiveAttack
      }

      const offensiveStrength = find(from.prayers, (prayer: BasePrayer) => prayer.feature() === 'offensiveStrength')
      if (offensiveStrength) {
        bonuses.effectivePrayers.strength = offensiveStrength
      }

      const defence = find(from.prayers, (prayer: BasePrayer) => prayer.feature() === 'defence')
      if (defence) {
        bonuses.effectivePrayers.defence = defence
      }
    }

    if (to.type !== UnitTypes.MOB) {
      const overhead = find(to.prayers, (prayer: BasePrayer) => intersection(prayer.groups, [PrayerGroups.OVERHEADS]).length) as BasePrayer
      if (overhead) {
        bonuses.effectivePrayers.overhead = overhead
      }
    }
  }

  isBlockable (from: Unit, to: Unit, bonuses: AttackBonuses) {
    this._calculatePrayerEffects(from, to, bonuses)

    let prayerAttackBlockStyle = bonuses.attackStyle
    if (Weapon.isMeleeAttackStyle(prayerAttackBlockStyle)) {
      prayerAttackBlockStyle = 'melee' // because protect melee scans for the style as melee, generalize them
    }

    if (bonuses.effectivePrayers.overhead && bonuses.effectivePrayers.overhead.feature() === prayerAttackBlockStyle) {
      return true
    }
    return false
  }


  _strengthLevel (from: Unit, to: Unit, bonuses: AttackBonuses) {
    let prayerMultiplier = 1
    const strengthPrayer = bonuses.effectivePrayers.strength

    if (strengthPrayer) {
      if (strengthPrayer.name === 'Burst of Strength') {
        prayerMultiplier = 1.05
      } else if (strengthPrayer.name === 'Superhuman Strength') {
        prayerMultiplier = 1.1
      } else if (strengthPrayer.name === 'Ultimate Strength') {
        prayerMultiplier = 1.15
      } else if (strengthPrayer.name === 'Chivalry') {
        prayerMultiplier = 1.18
      } else if (strengthPrayer.name === 'Piety') {
        prayerMultiplier = 1.23
      }
    }
    return Math.floor((Math.floor(from.currentStats.strength * prayerMultiplier) + bonuses.styleBonus + 8) * bonuses.voidMultiplier)
  }

  _maxHit (from: Unit, to: Unit, bonuses: AttackBonuses) {
    return Math.floor(
      Math.floor(
        (this._strengthLevel(from, to, bonuses) * (from.bonuses.other.meleeStrength + 64) + 320) / 640
      ) * bonuses.gearMultiplier * bonuses.overallMultiplier
    )
  }

  _attackLevel (from: Unit, to: Unit, bonuses: AttackBonuses) {
    const attackPrayer = bonuses.effectivePrayers.attack
    let prayerMultiplier = 1
    if (attackPrayer) {
      if (attackPrayer.name === 'Clarity of Thought') {
        prayerMultiplier = 1.05
      } else if (attackPrayer.name === 'Improved Reflexes') {
        prayerMultiplier = 1.1
      } else if (attackPrayer.name === 'Incredible Reflexes') {
        prayerMultiplier = 1.15
      } else if (attackPrayer.name === 'Chivalry') {
        prayerMultiplier = 1.15
      } else if (attackPrayer.name === 'Piety') {
        prayerMultiplier = 1.2
      }
    }

    return Math.floor((Math.floor(from.currentStats.attack * prayerMultiplier) + bonuses.styleBonus + 8) * bonuses.voidMultiplier)
  }

  _attackRoll (from: Unit, to: Unit, bonuses: AttackBonuses) {
    return Math.floor((this._attackLevel(from, to, bonuses) * (from.bonuses.attack[bonuses.attackStyle] + 64)) * bonuses.gearMultiplier)
  }

  _defenceRoll (from: Unit, to: Unit, bonuses: AttackBonuses) {
    if (to.type === UnitTypes.MOB || to.type === UnitTypes.ENTITY) {
      return (to.currentStats.defence + 9) * (to.bonuses.defence[bonuses.attackStyle] + 64)
    } else {
      return this._defenceLevel(from, to, bonuses) * (to.bonuses.defence[bonuses.attackStyle] + 64)
    }
  }

  _defenceLevel (from: Unit, to: Unit, bonuses: AttackBonuses) {
    const defencePrayer = bonuses.effectivePrayers.defence
    let prayerMultiplier = 1
    if (defencePrayer) {
      if (defencePrayer.name === 'Thick Skin') {
        prayerMultiplier = 1.05
      } else if (defencePrayer.name === 'Mystic Will') {
        prayerMultiplier = 1.05
      } else if (defencePrayer.name === 'Rock Skin') {
        prayerMultiplier = 1.1
      } else if (defencePrayer.name === 'Mystic Lore') {
        prayerMultiplier = 1.1
      } else if (defencePrayer.name === 'Steel Skin') {
        prayerMultiplier = 1.15
      } else if (defencePrayer.name === 'Mystic Might') {
        prayerMultiplier = 1.15
      } else if (defencePrayer.name === 'Chivalry') {
        prayerMultiplier = 1.2
      } else if (defencePrayer.name === 'Piety') {
        prayerMultiplier = 1.25
      } else if (defencePrayer.name === 'Rigour') {
        prayerMultiplier = 1.25
      } else if (defencePrayer.name === 'Augury') {
        prayerMultiplier = 1.25
      }
    }
    return (Math.floor(from.currentStats.defence * prayerMultiplier) + bonuses.styleBonus + 8)
  }

  get isMeleeAttack () {
    return true
  }
}