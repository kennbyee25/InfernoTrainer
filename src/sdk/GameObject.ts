import { clamp } from "lodash";
import { CollisionType } from "./Collision";
import { LineOfSight, LineOfSightMask } from "./LineOfSight";

export interface Location {
  x: number;
  y: number;
}

export class GameObject {
  location: Location;
  dying: number = -1;

  get size () {
    return 1;
  }

  get type () {
    return -1;
  }

  get collisionType() {
    return CollisionType.BLOCK_MOVEMENT;
  }

  get lineOfSight(): LineOfSightMask {
    return LineOfSightMask.FULL_MASK
  }

  // Returns true if this mob is on the specified tile.
  isOnTile (x: number, y: number) {
    return (x >= this.location.x && x <= this.location.x + this.size) && (y <= this.location.y && y >= this.location.y - this.size)
  }

  // Returns the closest tile on this mob to the specified point.
  getClosestTileTo (x: number, y: number) {
    // We simply clamp the target point to our own boundary box.
    return [clamp(x, this.location.x, this.location.x + this.size), clamp(y, this.location.y, this.location.y - this.size)]
  }

  constructor(){
    
  }
}
