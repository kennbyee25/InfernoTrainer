'use strict'

import { Settings } from './Settings'
import { Pathing } from './Pathing'
import { World } from './World'
import { GameObject, Location } from './GameObject'
import { Collision } from './Collision'
import { Mob } from './Mob'
import { Unit } from './Unit'

/*
 Basically, this entire file is lifted and modified to be as coherent as possible.
 This algorithm makes no sense and is copy pasta'd between basically every trainer.
 I have no clue how it works, nor do I care.
*/

export enum LineOfSightMask {
  NONE = 0x0,
  FULL_MASK = 0x20000,
  EAST_MASK = 0x1000,
  WEST_MASK = 0x10000,
  NORTH_MASK = 0x400,
  SOUTH_MASK = 0x4000
}

export class LineOfSight {
  static drawLOS (world: World, x: number, y: number, s: number, r: number, c: string, isNPC: boolean) {
    world.worldCtx.globalAlpha = 0.4
    world.worldCtx.fillStyle = c

    for (let x2 = -r; x2 < r + 1; x2++){
      for (let y2 = -r; y2 < r + 1; y2++){
        if (LineOfSight.hasLineOfSight(world, x, y, x + x2, y + y2, s, r, isNPC)) {
          world.worldCtx.fillRect(
            (x + x2) * Settings.tileSize,
            (y + y2) * Settings.tileSize,
            Settings.tileSize,
            Settings.tileSize
          )
        }      
      }
    }
    world.worldCtx.globalAlpha = 1
  }

  static mobHasLineOfSightOfPlayer (world: World, x: number, y: number, s: number, r: number = 1, isNPC: boolean = true) {
    return LineOfSight.hasLineOfSight(world, x, y, world.player.location.x, world.player.location.y, s, r, isNPC)
  }

  static playerHasLineOfSightOfMob (world: World, x: number, y: number, mob: GameObject, r = 1, isNPC = false) {
    const mobPoint = Pathing.closestPointTo(x, y, mob)
    return LineOfSight.hasLineOfSight(world, x, y, mobPoint.x, mobPoint.y, 1, r, false)
  }
  static mobHasLineOfSightToMob (world: World, mob1: GameObject, mob2: GameObject, r = 1) {
    const mob1Point = Pathing.closestPointTo(mob1.location.x, mob1.location.y, mob2)
    const mob2Point = Pathing.closestPointTo(mob2.location.x, mob2.location.y, mob1)
    return LineOfSight.hasLineOfSight(world, mob1Point.x, mob1Point.y, mob2Point.x, mob2Point.y, 1, r, false)
  }
  
  static hasLineOfSight (world: World, x1: number, y1: number, x2: number, y2: number, s: number = 1, r: number = 1, isNPC: boolean = false): boolean {
    const dx = x2 - x1
    const dy = y2 - y1
    if (Collision.collidesWithAnyLoSBlockingEntities(world, x1, y1, 1) || Collision.collidesWithAnyLoSBlockingEntities(world, x2, y2, 1) || Collision.collisionMath(x1, y1, s, x2, y2, 1)) {
      return false
    }
    // assume range 1 is melee
    if (r === 1) {
      return (dx < s && dx >= 0 && (dy === 1 || dy === -s)) || (dy > -s && dy <= 0 && (dx === -1 || dx === s))
    }
    if (isNPC) {
      const tx = Math.max(x1, Math.min(x1 + s - 1, x2))
      const ty = Math.max(y1 - s + 1, Math.min(y1, y2))
      return LineOfSight.hasLineOfSight(world, x2, y2, tx, ty, 1, r, false)
    }
    const dxAbs = Math.abs(dx)
    const dyAbs = Math.abs(dy)
    if (dxAbs > r || dyAbs > r) {
      return false
    }
    if (dxAbs > dyAbs) {
      let xTile = x1
      let y = (y1 << 16) + 0x8000
      const slope = Math.trunc((dy << 16) / dxAbs) // Integer division

      let xInc: number;
      let xMask: number;
      let yMask: number;

      if (dx > 0) {
        xInc = 1;
        xMask = LineOfSightMask.WEST_MASK | LineOfSightMask.FULL_MASK;
      } else {
        xInc = -1;
        xMask = LineOfSightMask.EAST_MASK | LineOfSightMask.FULL_MASK;
      }
      if (dy < 0) {
        y -= 1; // For correct rounding
        yMask = LineOfSightMask.NORTH_MASK | LineOfSightMask.FULL_MASK;
      } else {
        yMask = LineOfSightMask.SOUTH_MASK | LineOfSightMask.FULL_MASK;
      }


      while (xTile !== x2) {
        xTile += xInc
        const yTile = y >>> 16
        if ((Collision.collidesWithAnyLoSBlockingEntities(world, xTile, yTile, 1) & xMask) !== 0) {
          return false
        }
        y += slope
        const newYTile = y >>> 16
        if (newYTile !== yTile && (Collision.collidesWithAnyLoSBlockingEntities(world, xTile, newYTile, 1) & yMask) !== 0) {
          return false
        }
      }
    } else {
      let yTile = y1;
      let x = (x1 << 16) + 0x8000;
      let slope = Math.trunc((dx << 16) / dyAbs); // Integer division
      
      let yInc;
      let yMask;
      if (dy > 0) {
        yInc = 1;
        yMask = LineOfSightMask.SOUTH_MASK | LineOfSightMask.FULL_MASK;
      } else {
        yInc = -1;
        yMask = LineOfSightMask.NORTH_MASK | LineOfSightMask.FULL_MASK;
      }
      
      let xMask;
      if (dx < 0) {
        x -= 1; // For correct rounding
        xMask = LineOfSightMask.EAST_MASK | LineOfSightMask.FULL_MASK;
      } else {
        xMask = LineOfSightMask.WEST_MASK | LineOfSightMask.FULL_MASK;
      }
      while (yTile !== y2) {
        yTile += yInc
        const xTile = x >>> 16
        if ((Collision.collidesWithAnyLoSBlockingEntities(world, xTile, yTile, 1) & yMask) !== 0) {
          return false
        }
        x += slope
        const newXTile = x >>> 16
        if (newXTile !== xTile && (Collision.collidesWithAnyLoSBlockingEntities(world, newXTile, yTile, 1) & xMask) !== 0) {
          return false
        }
      }
    }
    return true
  }
}
