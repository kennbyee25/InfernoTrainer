import { Equipment } from "../Equipment";
import { UnitEquipment } from "../Unit";
import { Player } from "../Player";

export class Gloves extends Equipment {
  
  assignToUnitEquipment(unitEquipment: UnitEquipment) {
    unitEquipment.gloves = this;
  }

  unassignToUnitEquipment(unitEquipment: UnitEquipment) {
    unitEquipment.gloves = null;
  }
  currentEquipment(player: Player): Equipment {
    return player.equipment.gloves;
  }
}