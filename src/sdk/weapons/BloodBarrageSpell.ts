import { World } from '../World'
import { Unit, UnitTypes } from '../Unit'
import { BarrageSpell } from './BarrageSpell'
import { ProjectileOptions } from './Projectile'
import { AttackBonuses } from '../gear/Weapon';
import { ItemName } from '../ItemName';

export class BloodBarrageSpell extends BarrageSpell {

  get itemName(): ItemName {
    return ItemName.BLOOD_BARRAGE
  }

  
  attack (world: World, from: Unit, to: Unit, bonuses: AttackBonuses = {}, options: ProjectileOptions = {}) {
    const startDamage = this.totalDamage;
    super.attack(world, from, to, bonuses, options)
    const attackDamage = this.totalDamage - startDamage;
    if (from.currentStats.hitpoint < from.stats.hitpoint) {
      from.currentStats.hitpoint += Math.floor(attackDamage * 0.25);
      from.currentStats.hitpoint = Math.max(Math.min(from.stats.hitpoint, from.currentStats.hitpoint), 0);
    }
  }
}
