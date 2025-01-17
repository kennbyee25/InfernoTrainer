"use strict";

import { EntityName } from "../../../../sdk/EntityName";
import { Mob } from "../../../../sdk/Mob";
import { Settings } from "../../../../sdk/Settings";
import { UnitBonuses } from "../../../../sdk/Unit";
import { RangedWeapon } from "../../../../sdk/weapons/RangedWeapon";
import JalAkRekMejImage from "../../assets/images/Jal-AkRek-Mej.png";

export class JalAkRekXil extends Mob {
  mobName(): EntityName {
    return EntityName.JAL_AK_REK_XIL;
  }

  get combatLevel() {
    return 70;
  }

  drawUnderTile() {
    if (this.dying > -1) {
      this.region.context.fillStyle = "#964B0073";
    }
    {
      this.region.context.fillStyle = "#00FF00";
    }

    // Draw mob
    this.region.context.fillRect(
      -(this.size * Settings.tileSize) / 2,
      -(this.size * Settings.tileSize) / 2,
      this.size * Settings.tileSize,
      this.size * Settings.tileSize,
    );
  }
  setStats() {
    this.weapons = {
      range: new RangedWeapon(),
    };

    // non boosted numbers
    this.stats = {
      attack: 1,
      strength: 1,
      defence: 95,
      range: 120,
      magic: 1,
      hitpoint: 15,
    };

    // with boosts
    this.currentStats = JSON.parse(JSON.stringify(this.stats));
  }

  get bonuses(): UnitBonuses {
    return {
      attack: {
        stab: 0,
        slash: 0,
        crush: 0,
        magic: 0,
        range: 25,
      },
      defence: {
        stab: 0,
        slash: 0,
        crush: 0,
        magic: 0,
        range: 25,
      },
      other: {
        meleeStrength: 0,
        rangedStrength: 25,
        magicDamage: 0,
        prayer: 0,
      },
    };
  }

  get attackSpeed() {
    return 4;
  }

  get attackRange() {
    return 15;
  }

  get size() {
    return 1;
  }

  get image() {
    return JalAkRekMejImage;
  }

  get sound(): string {
    return null;
  }

  attackStyleForNewAttack() {
    return "range";
  }

  attackAnimation(tickPercent: number) {
    this.region.context.translate(Math.sin(tickPercent * Math.PI * 4) * 2, Math.sin(tickPercent * Math.PI * -2));
  }
}
