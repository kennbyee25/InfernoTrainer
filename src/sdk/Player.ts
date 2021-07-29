'use strict'
import { Pathing } from './Pathing'
import { Settings } from './Settings'
import { LineOfSight } from './LineOfSight'
import { minBy, range, filter, find, map, min, uniq } from 'lodash'
import { Unit, UnitTypes, UnitStats, UnitBonuses, UnitOptions, UnitEquipment } from './Unit'
import { XpDropController } from './XpDropController'
import { World } from './World'
import { Weapon } from './gear/Weapon'
import { BasePrayer } from './BasePrayer'
import { XpDrop, XpDropAggregator } from './XpDrop'
import { Location } from './GameObject'
import { Mob } from './Mob'
import { ImageLoader } from './utils/ImageLoader'
import { MapController } from './MapController'
import { ControlPanelController } from './ControlPanelController'
import { Equipment } from './Equipment'
import { SetEffect } from './SetEffect'

export interface PlayerStats extends UnitStats { 
  prayer: number
  run: number;
  specialAttack: number;
}


export class Player extends Unit {
  weapon?: Weapon;
  manualSpellCastSelection: Weapon;
  destinationLocation?: Location;

  stats: PlayerStats;
  currentStats: PlayerStats;
  xpDrops: XpDropAggregator;
  overhead: BasePrayer;
  running = true;
  prayerDrainCounter: number = 0;
  cachedBonuses: UnitBonuses = null;

  constructor (world: World, location: Location, options: UnitOptions) {
    super(world, location, options)
    this.destinationLocation = location
    this.equipment = options.equipment;
    this.equipmentChanged();
    this.clearXpDrops();

    ImageLoader.onAllImagesLoaded(() => MapController.controller.updateOrbsMask(this.currentStats, this.stats)  )

  }

  equipmentChanged() {

    let gear = [
      this.equipment.weapon, 
      this.equipment.offhand,
      this.equipment.helmet,
      this.equipment.necklace,
      this.equipment.chest,
      this.equipment.legs,
      this.equipment.feet,
      this.equipment.gloves,
      this.equipment.ring,
      this.equipment.cape,
      this.equipment.ammo,
    ]


    // updated gear bonuses
    this.cachedBonuses = Unit.emptyBonuses();
    gear.forEach((gear: Equipment) => {
      if (gear && gear.bonuses){
        this.cachedBonuses = Unit.mergeEquipmentBonuses(this.cachedBonuses, gear.bonuses);
      }
    })


    // update set effects
    const allSetEffects = [];
    gear.forEach((equipment: Equipment) => {
      if (equipment && equipment.equipmentSetEffect){
        allSetEffects.push(equipment.equipmentSetEffect)
      }
    })
    const completeSetEffects = [];
    uniq(allSetEffects).forEach((setEffect: typeof SetEffect) => {
      const itemsInSet = setEffect.itemsInSet();
      let setItemsEquipped = 0;
      find(itemsInSet, (itemName: string) => {
        gear.forEach((equipment: Equipment) => {
          if (!equipment){
            return;
          }
          if (itemName === equipment.itemName){
            setItemsEquipped++;
          }
        });
      })
      if (itemsInSet.length === setItemsEquipped) {
        completeSetEffects.push(setEffect)
      }
    });
    this.cachedSetEffects = completeSetEffects;
  }

  get bonuses(): UnitBonuses {
    return this.cachedBonuses;
  }

  setStats () {
    // non boosted numbers
    this.stats = {
      attack: 99,
      strength: 99,
      defence: 99,
      range: 99,
      magic: 99,
      hitpoint: 99,
      prayer: 99,
      run: 100,
      specialAttack: 100
    }

    // with boosts
    this.currentStats = {
      attack: 99,
      strength: 99,
      defence: 99,
      range: 99,
      magic: 99,
      hitpoint: 99,
      prayer: 99,
      run: 100,
      specialAttack: 100
    }

  }


  get prayerDrainResistance(): number {
    // https://oldschool.runescape.wiki/w/Prayer#Prayer_drain_mechanics
    return 2 * this.bonuses.other.prayer + 60;
  }
  
  get type () {
    return UnitTypes.PLAYER
  }

  clearXpDrops() {
    this.xpDrops = {};
  }

  grantXp(xpDrop: XpDrop) {
    if (!this.xpDrops[xpDrop.skill]){
      this.xpDrops[xpDrop.skill] = 0;
    }
    this.xpDrops[xpDrop.skill] += xpDrop.xp;
  }

  sendXpToController() {
    Object.keys(this.xpDrops).forEach((skill) => {
      XpDropController.controller.registerXpDrop({ skill, xp: Math.ceil(this.xpDrops[skill])});
    })
    
    this.clearXpDrops();
  }

  moveTo (x: number, y: number) {
    this.aggro = null
    this.manualSpellCastSelection = null

    const clickedOnEntities = Pathing.collideableEntitiesAtPoint(this.world, x, y, 1)
    if (clickedOnEntities.length) {
      // Clicked on an entity, scan around to find the best spot to actually path to
      const clickedOnEntity = clickedOnEntities[0]
      const maxDist = Math.ceil(clickedOnEntity.size / 2)
      let bestDistances = []
      let bestDistance = 9999
      for (let yOff = -maxDist; yOff < maxDist; yOff++) {
        for (let xOff = -maxDist; xOff < maxDist; xOff++) {
          const potentialX = x + xOff
          const potentialY = y + yOff
          const e = Pathing.collideableEntitiesAtPoint(this.world, potentialX, potentialY, 1)
          if (e.length === 0) {
            const distance = Pathing.dist(potentialX, potentialY, x, y)
            if (distance <= bestDistance) {
              if (bestDistances[0] && bestDistances[0].bestDistance > distance) {
                bestDistance = distance
                bestDistances = []
              }
              bestDistances.push({ x: potentialX, y: potentialY, bestDistance })
            }
          }
        }
      }
      const winner = minBy(bestDistances, (distance) => Pathing.dist(distance.x, distance.y, this.location.x, this.location.y))
      if (winner) {
        this.destinationLocation = { x: winner.x, y: winner.y }
      }
    } else {
      this.destinationLocation = { x, y }
    }
  }

  dead () {

  }

  attack () {
    if (this.manualSpellCastSelection) {
      this.manualSpellCastSelection.cast(this.world, this, this.aggro)
      this.manualSpellCastSelection = null
    } else {
      // use equipped weapon
      if (this.equipment.weapon){
        this.equipment.weapon.attack(this.world, this, this.aggro as Unit /* hack */)
      }else{
        console.log('TODO: Implement punching')
      }
    }

    // this.playAttackSound();
  }

  activatePrayers () {
    this.lastOverhead = this.overhead
    this.overhead = find(this.world.player.prayers, (prayer: BasePrayer) => prayer.isOverhead() && prayer.isActive)
    if (this.lastOverhead && !this.overhead) {
      this.lastOverhead.playOffSound()
    } else if (this.lastOverhead !== this.overhead) {
      this.overhead.playOnSound()
    }
  }

  pathToAggro () {
    if (this.aggro) {
      if (this.aggro.dying > -1) {
        this.aggro = null
        this.destinationLocation = this.location
        return
      }
      const isUnderAggrodMob = Pathing.collisionMath(this.location.x, this.location.y, 1, this.aggro.location.x, this.aggro.location.y, this.aggro.size)
      this.setHasLOS()

      if (isUnderAggrodMob) {
        const maxDist = Math.ceil(this.aggro.size / 2)
        let bestDistance = 9999
        let winner = null
        for (let yy = -maxDist; yy < maxDist; yy++) {
          for (let xx = -maxDist; xx < maxDist; xx++) {
            const x = this.location.x + xx
            const y = this.location.y + yy
            if (Pathing.canTileBePathedTo(this.world, x, y, 1, {} as Mob)) {
              const distance = Pathing.dist(this.location.x, this.location.y, x, y)
              if (distance > 0 && distance < bestDistance) {
                bestDistance = distance
                winner = { x, y }
              }
            }
          }
        }
        if (winner) {
          this.destinationLocation = { x: winner.x, y: winner.y }
        } else {
          console.log("I don't understand what could cause this, but i'd like to find out")
        }
      } else if (!this.hasLOS) {


        const seekingTiles: Location[] = [];
        // "When clicking on an npc, object, or player, the requested tiles will be all tiles"
        // "within melee range of the npc, object, or player."
        // For implementation reasons we also ensure the north/south tiles are added to seekingTiles *first* so that
        // in cases of ties, the north and south tiles are picked by minBy below.
        const aggroSize = this.aggro.size;
        range(0, aggroSize).forEach(xx => {
          [-1, this.aggro.size].forEach(yy => {
            // Don't path into an unpathable object.
            const px = this.aggro.location.x + xx;
            const py = this.aggro.location.y - yy;
            if (!Pathing.collidesWithAnyEntities(this.world, px, py, 1)) {
              seekingTiles.push({
                x: px,
                y: py
              });
            }
          });
        });
        range(0, aggroSize).forEach(yy => {
          [-1, this.aggro.size].forEach(xx => {
            // Don't path into an unpathable object.
            const px = this.aggro.location.x + xx;
            const py = this.aggro.location.y - yy;
            if (!Pathing.collidesWithAnyEntities(this.world, px, py, 1)) {
              seekingTiles.push({
                x: px,
                y: py
              });
            }
          });
        });
        // Create paths to all npc tiles
        const potentialPaths = map(seekingTiles, (point) => Pathing.constructPath(this.world, this.location, { x: point.x, y: point.y }));
        const potentialPathLengths = map(potentialPaths, (path) => path.length);
        // Figure out what the min distance is
        const shortestPathLength = min(potentialPathLengths);
        // Get all of the paths of the same minimum distance (can be more than 1)
        const shortestPaths = filter(map(potentialPathLengths, (length, index) => (length === shortestPathLength) ? seekingTiles[index] : null));
        // Take the path that is the shortest absolute distance from player
        this.destinationLocation = minBy(shortestPaths, (point) => Pathing.dist(this.location.x, this.location.y, point.x, point.y));

      } else {
        this.destinationLocation = this.location
      }
    }
  }

  moveTorwardsDestination () {
    this.perceivedLocation = this.location
    // Actually move the player forward by run speed.
    if (this.destinationLocation) {
      this.location = Pathing.path(this.world, this.location, this.destinationLocation, this.running ? 2 : 1, this.aggro)
    }
  }

  movementStep () {

  
    this.activatePrayers()

    this.pathToAggro()

    this.processIncomingAttacks()

    
    this.moveTorwardsDestination()
  }

  get attackRange () {
    if (this.manualSpellCastSelection) {
      return this.manualSpellCastSelection.attackRange
    }
    if (this.equipment.weapon){
      return this.equipment.weapon.attackRange
    }
    return 1;
  }

  get attackSpeed () {
    if (this.manualSpellCastSelection) {
      return this.manualSpellCastSelection.attackSpeed
    }
    if (this.equipment.weapon){
      return this.equipment.weapon.attackSpeed
    }
    return 4;
  }

  drainPrayer() {
    const prayerDrainThisTick = ControlPanelController.controls.PRAYER.getCurrentActivePrayers().reduce((a, b) => a + b.drainRate(), 0)
    this.prayerDrainCounter += prayerDrainThisTick;
    while (this.prayerDrainCounter > this.prayerDrainResistance) {
      this.currentStats.prayer--;
      this.prayerDrainCounter -= this.prayerDrainResistance;
    }
    if (this.currentStats.prayer <= 0){
      ControlPanelController.controls.PRAYER.getCurrentActivePrayers().forEach((prayer) => prayer.deactivate())
      this.currentStats.prayer = 0;
    }
  }

  attackStep () {
    
    
    this.drainPrayer();


    this.clearXpDrops();

    this.attackIfPossible()

    this.sendXpToController();

    if (this.world.mapController){
      this.world.mapController.updateOrbsMask(this.currentStats, this.stats);
    }
  }

  attackIfPossible () {
    this.attackCooldownTicks--

    if (this.canAttack() === false) {
      return;
    }
    
    if (this.aggro) {
      this.setHasLOS()
      if (this.hasLOS && this.aggro && this.attackCooldownTicks <= 0) {
        this.attack()
        this.attackCooldownTicks = this.attackSpeed
      }
    }
  }

  
  draw (tickPercent: number) {
    LineOfSight.drawLOS(this.world, this.location.x, this.location.y, this.size, this.attackRange, '#00FF0099', this.type === UnitTypes.MOB)

    this.world.worldCtx.save();
    const perceivedX = Pathing.linearInterpolation(this.perceivedLocation.x, this.location.x, tickPercent)
    const perceivedY = Pathing.linearInterpolation(this.perceivedLocation.y, this.location.y, tickPercent)

    // Perceived location

    this.world.worldCtx.globalAlpha = 0.7
    this.world.worldCtx.fillStyle = '#FFFF00'
    this.world.worldCtx.fillRect(
      perceivedX * Settings.tileSize,
      perceivedY * Settings.tileSize,
      Settings.tileSize,
      Settings.tileSize
    )
    this.world.worldCtx.globalAlpha = 1

    // Draw player on true tile
    this.world.worldCtx.fillStyle = '#fff'
    // feedback for when you shoot
    if (this.shouldShowAttackAnimation()) {
      this.world.worldCtx.fillStyle = '#00FFFF'
    }
    this.world.worldCtx.strokeStyle = '#FFFFFF73'
    this.world.worldCtx.lineWidth = 3
    this.world.worldCtx.fillRect(
      this.location.x * Settings.tileSize,
      this.location.y * Settings.tileSize,
      Settings.tileSize,
      Settings.tileSize
    )

    // Destination location
    this.world.worldCtx.strokeStyle = '#FFFFFF73'
    this.world.worldCtx.lineWidth = 3
    this.world.worldCtx.strokeRect(
      this.destinationLocation.x * Settings.tileSize,
      this.destinationLocation.y * Settings.tileSize,
      Settings.tileSize,
      Settings.tileSize
    )
    this.world.worldCtx.restore();
  }

  drawUILayer(tickPercent: number) {

    const perceivedX = Pathing.linearInterpolation(this.perceivedLocation.x, this.location.x, tickPercent)
    const perceivedY = Pathing.linearInterpolation(this.perceivedLocation.y, this.location.y, tickPercent)
    this.world.worldCtx.save();


    this.world.worldCtx.translate(
      perceivedX * Settings.tileSize + (this.size * Settings.tileSize) / 2,
      (perceivedY - this.size + 1) * Settings.tileSize + (this.size * Settings.tileSize) / 2
    )

    if (Settings.rotated === 'south') {
      this.world.worldCtx.rotate(Math.PI)
    }
    this.drawHPBar()
    this.drawHitsplats()
    this.drawOverheadPrayers()
    this.world.worldCtx.restore();
    this.drawIncomingProjectiles(tickPercent);

  }
}
