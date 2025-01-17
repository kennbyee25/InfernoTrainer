import HealSplat from "../assets/images/hitsplats/heal.png";
import MissSplat from "../assets/images/hitsplats/miss.png";
import DamageSplat from "../assets/images/hitsplats/damage.png";
import { Settings } from "./Settings";
import { LineOfSight, LineOfSightMask } from "./LineOfSight";
import { remove, filter, clamp } from "lodash";
import { BasePrayer } from "./BasePrayer";
import { Projectile } from "./weapons/Projectile";
import { XpDrop } from "./XpDrop";
import { Location } from "./Location";
import { Pathing } from "./Pathing";
import { ImageLoader } from "./utils/ImageLoader";
import { Weapon } from "./gear/Weapon";
import { Offhand } from "./gear/Offhand";
import { Helmet } from "./gear/Helmet";
import { Necklace } from "./gear/Necklace";
import { Chest } from "./gear/Chest";
import { Legs } from "./gear/Legs";
import { Feet } from "./gear/Feet";
import { Gloves } from "./gear/Gloves";
import { Ring } from "./gear/Ring";
import { Cape } from "./gear/Cape";
import { Ammo } from "./gear/Ammo";
import { SetEffect } from "./SetEffect";
import { EntityName } from "./EntityName";
import { Item } from "./Item";
import { PrayerController } from "./PrayerController";
import { Region } from "./Region";
import { Player } from "./Player";
import { CollisionType } from "./Collision";
/* eslint-disable @typescript-eslint/no-explicit-any */

export enum UnitTypes {
  MOB = 0,
  PLAYER = 1,
  ENTITY = 2,
}

export class UnitEquipment {
  weapon?: Weapon = null;
  offhand?: Offhand = null;
  helmet?: Helmet = null;
  necklace?: Necklace = null;
  chest?: Chest = null;
  legs?: Legs = null;
  feet?: Feet = null;
  gloves?: Gloves = null;
  ring?: Ring = null;
  cape?: Cape = null;
  ammo?: Ammo = null;
}

export interface UnitOptions {
  aggro?: Unit;
  equipment?: UnitEquipment;
  spawnDelay?: number;
  cooldown?: number;
  inventory?: Item[];
}

export interface UnitStats {
  attack: number;
  strength: number;
  defence: number;
  range: number;
  magic: number;
  hitpoint: number;
  prayer?: number;
}

export interface UnitBonuses {
  attack: UnitStyleBonuses;
  defence: UnitStyleBonuses;
  other: UnitOtherBonuses;
  targetSpecific?: UnitTargetBonuses;
}

export interface UnitStyleBonuses {
  stab: number;
  slash: number;
  crush: number;
  magic: number;
  range: number;
}

export interface UnitOtherBonuses {
  meleeStrength: number;
  rangedStrength: number;
  magicDamage: number;
  prayer: number;
  crystalAccuracy?: number;
  crystalDamage?: number;
}

export interface UnitTargetBonuses {
  undead: number;
  slayer: number;
}

export class Unit {
  prayerController: PrayerController;
  lastOverhead?: BasePrayer = null;
  aggro?: Unit;
  perceivedLocation: Location;
  attackDelay = 0;
  hasLOS = false;
  frozen = 0;
  stunned = 0;
  incomingProjectiles: Projectile[] = [];
  healHitsplatImage: HTMLImageElement = ImageLoader.createImage(HealSplat);
  missedHitsplatImage: HTMLImageElement = ImageLoader.createImage(MissSplat);
  damageHitsplatImage: HTMLImageElement = ImageLoader.createImage(DamageSplat);
  unitImage: HTMLImageElement = ImageLoader.createImage(this.image);
  currentStats: UnitStats;
  stats: UnitStats;
  equipment: UnitEquipment = new UnitEquipment();
  setEffects: (typeof SetEffect)[] = [];
  autoRetaliate = false;
  spawnDelay = 0;

  get deathAnimationLength(): number {
    return 3;
  }

  get completeSetEffects(): SetEffect[] {
    return null;
  }

  get type(): UnitTypes {
    return UnitTypes.MOB;
  }

  get isPlayer(): boolean {
    return false;
  }

  mobName(): EntityName {
    return null;
  }

  get combatLevel() {
    const base = 0.25 * (this.stats.defence + this.stats.hitpoint + Math.floor((this.stats.prayer || 0) * 0.5));
    const melee = (13 / 40) * (this.stats.attack + this.stats.strength);
    const range = (13 / 40) * Math.floor(this.stats.range * (3 / 2));
    const mage = (13 / 40) * Math.floor(this.stats.magic * (3 / 2));
    return Math.floor(base + Math.max(melee, range, mage));
  }

  combatLevelColor(against: Unit) {
    // https://oldschool.runescape.wiki/w/Combat_level#Colours
    const colorScale = [
      "#ff0000", //+ 10
      "#ff3000",
      "#ff3000",
      "#ff3000",
      "#ff7000",
      "#ff7000",
      "#ff7000",
      "#ffb000",
      "#ffb000",
      "#ffb000",
      "#ffff00", // + 0
      "#c0ff00",
      "#c0ff00",
      "#c0ff00",
      "#80ff00",
      "#80ff00",
      "#80ff00",
      "#40ff00",
      "#40ff00",
      "#40ff00",
      "#00ff00", // -10
    ];

    const myCombatLevel = this.combatLevel;
    const theirCombatLevel = against.combatLevel;
    const difference = Math.min(10, Math.max(-10, theirCombatLevel - myCombatLevel));

    return colorScale[10 - difference];
  }

  constructor(region: Region, location: Location, options?: UnitOptions) {
    this.region = region;
    this.aggro = options.aggro || null;
    this.perceivedLocation = location;
    this.location = location;
    this.setStats();
    this.spawnDelay = options.spawnDelay || 0;
    this.autoRetaliate = true;
    this.currentStats.hitpoint = this.stats.hitpoint;

    if (options.cooldown) {
      this.attackDelay = options.cooldown;
    }
  }

  contextActions(region: Region, x: number, y: number) {
    return [];
  }

  setAggro(mob: Unit) {
    this.aggro = mob;
  }

  grantXp(xpDrop: XpDrop) {
    // Override me
  }
  setStats() {
    // Override me
  }
  movementStep() {
    // Override me
  }
  attackStep() {
    // Override me
  }
  draw(tickPercent: number) {
    // Override me
  }
  drawUILayer(tickPercent: number) {
    // Override me
  }
  removedFromWorld() {
    // Override me
  }

  static mergeEquipmentBonuses(firstBonuses: UnitBonuses, secondBonuses: UnitBonuses): UnitBonuses {
    return {
      attack: {
        stab: firstBonuses.attack.stab + secondBonuses.attack.stab,
        slash: firstBonuses.attack.slash + secondBonuses.attack.slash,
        crush: firstBonuses.attack.crush + secondBonuses.attack.crush,
        magic: firstBonuses.attack.magic + secondBonuses.attack.magic,
        range: firstBonuses.attack.range + secondBonuses.attack.range,
      },
      defence: {
        stab: firstBonuses.defence.stab + secondBonuses.defence.stab,
        slash: firstBonuses.defence.slash + secondBonuses.defence.slash,
        crush: firstBonuses.defence.crush + secondBonuses.defence.crush,
        magic: firstBonuses.defence.magic + secondBonuses.defence.magic,
        range: firstBonuses.defence.range + secondBonuses.defence.range,
      },
      other: {
        meleeStrength: firstBonuses.other.meleeStrength + secondBonuses.other.meleeStrength,
        rangedStrength: firstBonuses.other.rangedStrength + secondBonuses.other.rangedStrength,
        magicDamage: firstBonuses.other.magicDamage + secondBonuses.other.magicDamage,
        prayer: firstBonuses.other.prayer + secondBonuses.other.prayer,
        crystalAccuracy: (firstBonuses.other.crystalAccuracy || 0) + (secondBonuses.other.crystalAccuracy || 0),
        crystalDamage: (firstBonuses.other.crystalDamage || 0) + (secondBonuses.other.crystalDamage || 0),
      },
      targetSpecific: {
        undead: firstBonuses.targetSpecific.undead + secondBonuses.targetSpecific.undead,
        slayer: firstBonuses.targetSpecific.slayer + secondBonuses.targetSpecific.slayer,
      },
    };
  }

  static emptyBonuses(): UnitBonuses {
    return {
      attack: {
        stab: 0,
        slash: 0,
        crush: 0,
        magic: 0,
        range: 0,
      },
      defence: {
        stab: 0,
        slash: 0,
        crush: 0,
        magic: 0,
        range: 0,
      },
      other: {
        meleeStrength: 0,
        rangedStrength: 0,
        magicDamage: 1,
        prayer: 0,
        crystalAccuracy: 1,
        crystalDamage: 1,
      },
      targetSpecific: {
        undead: 0,
        slayer: 0,
      },
    };
  }

  get bonuses(): UnitBonuses {
    return Unit.emptyBonuses();
  }

  get attackSpeed() {
    return 0;
  }

  get flinchDelay() {
    return Math.floor(this.attackSpeed / 2);
  }

  get attackRange() {
    return 0;
  }

  get maxHit() {
    return 0;
  }

  get image(): string {
    return null;
  }

  // Returns true if the NPC can move towards the unit it is aggro'd against.
  canMove() {
    return !this.hasLOS && !this.isFrozen() && !this.isStunned() && !this.isDying();
  }

  canAttack() {
    return !this.isDying() && !this.isStunned();
  }

  freeze(ticks: number) {
    if (ticks < this.frozen) {
      return;
    }
    this.perceivedLocation = this.location;
    this.frozen = ticks;
  }

  isFrozen() {
    return this.frozen > 0;
  }

  isStunned() {
    return this.stunned > 0;
  }

  region: Region;
  location: Location;
  dying = -1;
  _serialNumber: string;
  get serialNumber(): string {
    if (!this._serialNumber) {
      this._serialNumber = String(Math.random());
    }
    return this._serialNumber;
  }

  get size() {
    return 1;
  }
  isDying() {
    return this.dying > 0;
  }

  get collisionType() {
    return CollisionType.BLOCK_MOVEMENT;
  }

  get lineOfSight(): LineOfSightMask {
    return LineOfSightMask.FULL_MASK;
  }

  // Returns true if this game object is on the specified tile.
  isOnTile(x: number, y: number) {
    return (
      x >= this.location.x &&
      x <= this.location.x + this.size &&
      y <= this.location.y &&
      y >= this.location.y - this.size
    );
  }

  // Returns the closest tile on this mob to the specified point.
  getClosestTileTo(x: number, y: number) {
    // We simply clamp the target point to our own boundary box.
    return [
      clamp(x, this.location.x, this.location.x + this.size - 1),
      clamp(y, this.location.y - this.size + 1, this.location.y),
    ];
  }

  // TODO more modular
  get rangeAttackAnimation() {
    return null;
  }

  get sound(): string {
    return null;
  }

  get color(): string {
    return "#FFFFFF00";
  }

  shouldShowAttackAnimation() {
    return this.attackDelay === this.attackSpeed && this.dying === -1 && this.isStunned() === false;
  }

  setHasLOS() {
    if (!this.aggro) {
      this.hasLOS = false;
      return;
    }
    if (this.aggro.type === UnitTypes.PLAYER) {
      this.hasLOS = LineOfSight.mobHasLineOfSightOfPlayer(
        this.region,
        this.aggro as Player,
        this.location.x,
        this.location.y,
        this.size,
        this.attackRange,
        true,
      );
    } else if (this.type === UnitTypes.PLAYER) {
      this.hasLOS = LineOfSight.playerHasLineOfSightOfMob(
        this.region,
        this.location.x,
        this.location.y,
        this.aggro,
        this.attackRange,
      );
    } else if (this.type === UnitTypes.MOB && this.aggro.type === UnitTypes.MOB) {
      this.hasLOS = LineOfSight.mobHasLineOfSightToMob(this.region, this, this.aggro, this.attackRange);
    } else if (this.aggro.type === UnitTypes.MOB) {
      this.hasLOS = LineOfSight.playerHasLineOfSightOfMob(
        this.region,
        this.location.x,
        this.location.y,
        this.aggro,
        this.attackRange,
      );
    } else if (this.aggro.type === UnitTypes.ENTITY) {
      this.hasLOS = false;
    }
  }

  // Returns true if this mob is in melee range of its target.
  isWithinMeleeRange() {
    const targetX = this.aggro.location.x;
    const targetY = this.aggro.location.y;
    let isWithinMeleeRange = false;

    if (
      targetX === this.location.x - 1 &&
      targetY <= this.location.y + 1 &&
      targetY > this.location.y - this.size - 1
    ) {
      isWithinMeleeRange = true;
    } else if (targetY === this.location.y + 1 && targetX >= this.location.x && targetX < this.location.x + this.size) {
      isWithinMeleeRange = true;
    } else if (
      targetX === this.location.x + this.size &&
      targetY <= this.location.y + 1 &&
      targetY > this.location.y - this.size - 1
    ) {
      isWithinMeleeRange = true;
    } else if (
      targetY === this.location.y - this.size &&
      targetX >= this.location.x &&
      targetX < this.location.x + this.size
    ) {
      isWithinMeleeRange = true;
    }
    return isWithinMeleeRange;
  }

  addProjectile(projectile: Projectile) {
    if (this.spawnDelay > 0 && this.autoRetaliate && !this.aggro) {
      this.setAggro(projectile.from);
    }
    this.incomingProjectiles.push(projectile);
  }

  setLocation(location: Location) {
    this.location = location;
  }

  attackAnimation(tickPercent: number) {
    // override pls
  }

  dead() {
    this.perceivedLocation = this.location;
    this.dying = this.deathAnimationLength;
  }

  detectDeath() {
    if (this.dying === -1 && this.currentStats.hitpoint <= 0) {
      this.dead();
      return;
    }

    if (this.dying > 0) {
      this.dying--;
    }
    if (this.dying === 0) {
      this.removedFromWorld();
    }
  }

  processIncomingAttacks() {
    this.incomingProjectiles = filter(
      this.incomingProjectiles,
      (projectile: Projectile) => projectile.remainingDelay > -1,
    );
    this.incomingProjectiles.forEach((projectile) => {
      projectile.currentLocation = {
        x: Pathing.linearInterpolation(
          projectile.currentLocation.x,
          projectile.to.location.x + projectile.to.size / 2,
          1 / (projectile.remainingDelay + 1),
        ),
        y: Pathing.linearInterpolation(
          projectile.currentLocation.y,
          projectile.to.location.y - projectile.to.size / 2 + 1,
          1 / (projectile.remainingDelay + 1),
        ),
      };
      projectile.remainingDelay--;

      if (projectile.remainingDelay === 0) {
        // Some attacks can be nullified if they land after the attackers death.
        if (
          projectile.options &&
          projectile.options.cancelOnDeath === true &&
          projectile.from &&
          projectile.from.isDying() === true
        ) {
          return;
        }

        if (projectile.damage < 0) {
          // subtracting a negative gives a positive
          if (this.currentStats.hitpoint < this.stats.hitpoint) {
            this.currentStats.hitpoint -= projectile.damage;
            this.currentStats.hitpoint = Math.min(this.currentStats.hitpoint, this.stats.hitpoint);
          }
        } else {
          this.currentStats.hitpoint -= projectile.damage;
        }
        this.damageTaken();
        if (this.shouldChangeAggro(projectile)) {
          this.setAggro(projectile.from);

          if (this.attackDelay < this.flinchDelay + 1) {
            this.attackDelay = this.flinchDelay + 1;
          }
        }
      }
    });
    this.currentStats.hitpoint = Math.max(0, this.currentStats.hitpoint);
    this.postAttacksEvent();
  }

  shouldChangeAggro(projectile: Projectile) {
    return !this.aggro && this.autoRetaliate;
  }

  postAttacksEvent() {
    // Override me
  }

  damageTaken() {
    // Override me
  }

  drawHitsplat(projectile: Projectile): boolean {
    return true;
  }

  drawHPBar() {
    this.region.context.fillStyle = "red";
    this.region.context.fillRect(
      (-this.size / 2) * Settings.tileSize,
      (-this.size / 2) * Settings.tileSize,
      Settings.tileSize * this.size,
      5,
    );

    this.region.context.fillStyle = "green";
    const w = Math.min(1, this.currentStats.hitpoint / this.stats.hitpoint) * (Settings.tileSize * this.size);
    this.region.context.fillRect((-this.size / 2) * Settings.tileSize, (-this.size / 2) * Settings.tileSize, w, 5);
  }

  drawHitsplats() {
    let projectileOffsets = [
      [0, 12],
      [0, 28],
      [-14, 20],
      [14, 20],
    ];

    let projectileCounter = 0;
    this.incomingProjectiles.forEach((projectile) => {
      if (projectile.remainingDelay > 0) {
        return;
      }
      if (projectileCounter > 3) {
        return;
      }
      projectileCounter++;
      if (this.drawHitsplat(projectile)) {
        let image = projectile.damage === 0 ? this.missedHitsplatImage : this.damageHitsplatImage;
        if (!projectile.offsetX && !projectile.offsetY) {
          projectile.offsetX = projectileOffsets[0][0];
          projectile.offsetY = projectileOffsets[0][1];
        }

        projectileOffsets = remove(projectileOffsets, (offset) => {
          return offset[0] !== projectile.offsetX || offset[1] !== projectile.offsetY;
        });

        if (projectile.damage < 0) {
          image = this.healHitsplatImage;
        }

        this.region.context.drawImage(
          image,
          projectile.offsetX - 12,
          -((this.size + 1) * Settings.tileSize) / 2 - projectile.offsetY,
          24,
          23,
        );
        this.region.context.fillStyle = "#FFFFFF";
        this.region.context.font = "16px Stats_11";
        this.region.context.textAlign = "center";
        this.region.context.fillText(
          String(Math.abs(projectile.damage)),
          projectile.offsetX,
          -((this.size + 1) * Settings.tileSize) / 2 - projectile.offsetY + 15,
        );
        this.region.context.textAlign = "left";
      }
    });
  }

  drawOverheadPrayers() {
    if (!this.prayerController) {
      return;
    }

    const overhead = this.prayerController.overhead();
    if (overhead) {
      const overheadImg = overhead.overheadImage();
      if (overheadImg) {
        this.region.context.drawImage(
          overheadImg,
          -Settings.tileSize / 2,
          -Settings.tileSize * 3,
          Settings.tileSize,
          Settings.tileSize,
        );
      }
    }
  }

  // The rendering context is the world.
  drawIncomingProjectiles(tickPercent: number) {
    this.incomingProjectiles.forEach((projectile) => {
      if (projectile.options.hidden) {
        return;
      }

      if (projectile.remainingDelay < 0) {
        return;
      }

      const startX = projectile.currentLocation.x;
      const startY = projectile.currentLocation.y;
      const endX = projectile.to.location.x + projectile.to.size / 2;
      const endY = projectile.to.location.y - projectile.to.size / 2 + 1;

      const perceivedX = Pathing.linearInterpolation(startX, endX, tickPercent / (projectile.remainingDelay + 1));
      const perceivedY = Pathing.linearInterpolation(startY, endY, tickPercent / (projectile.remainingDelay + 1));

      this.region.context.save();
      this.region.context.translate(perceivedX * Settings.tileSize, perceivedY * Settings.tileSize);

      if (projectile.image) {
        this.region.context.rotate(Math.PI);
        this.region.context.drawImage(
          projectile.image,
          -Settings.tileSize / 2,
          -Settings.tileSize / 2,
          Settings.tileSize,
          Settings.tileSize,
        );
      } else {
        this.region.context.beginPath();

        this.region.context.fillStyle = "#D1BB7773";
        if (
          projectile.attackStyle === "slash" ||
          projectile.attackStyle === "crush" ||
          projectile.attackStyle === "stab"
        ) {
          this.region.context.fillStyle = "#FF000073";
        } else if (projectile.attackStyle === "range") {
          this.region.context.fillStyle = "#00FF0073";
        } else if (projectile.attackStyle === "magic") {
          this.region.context.fillStyle = "#0000FF73";
        } else if (projectile.attackStyle === "heal") {
          this.region.context.fillStyle = "#9813aa73";
        } else {
          console.log("[WARN] This style is not accounted for in custom coloring: ", projectile.attackStyle);
        }
        this.region.context.arc(0, 0, 5, 0, 2 * Math.PI);
        this.region.context.fill();
      }
      this.region.context.restore();

      // if (projectile.closestTile && this.mobName() == EntityName.JAL_TOK_JAD){
      //   this.region.context.strokeStyle = 'red';
      //   this.region.context.strokeRect(projectile.closestTile.x * Settings.tileSize, projectile.closestTile.y * Settings.tileSize, Settings.tileSize, Settings.tileSize);
      // }
    });
  }
}
