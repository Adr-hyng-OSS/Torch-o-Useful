import { Compare, Logger, isTorchIncluded, torchFireEffects, prioritizeMainHand } from "./packages";
import {EntityDamageCause, EntityEquipmentInventoryComponent, EquipmentSlot, MinecraftItemTypes, Player, TicksPerSecond, world} from "@minecraft/server";

const DEFAULT_EFFECTS: Map<string, number> = new Map([
  [MinecraftItemTypes.torch.id, 40],
  [MinecraftItemTypes.soulTorch.id, 60],
  [MinecraftItemTypes.redstoneTorch.id, 40]
]);

world.afterEvents.entityHurt.subscribe((event) => {
  const player: Player = event.damageSource.damagingEntity as Player;
  const cause: EntityDamageCause = event.damageSource.cause;
  const hurtedEntity = event.hurtEntity;
  if(!(player instanceof Player)) return;
  if(!hurtedEntity) return;
  if(!Compare.types.isEqual(cause, EntityDamageCause.entityAttack)) return;
  const equipment = (player.getComponent(EntityEquipmentInventoryComponent.componentId) as EntityEquipmentInventoryComponent);
  const mainHand = equipment.getEquipment(EquipmentSlot.mainhand)?.typeId;
  const offHand = equipment.getEquipment(EquipmentSlot.offhand)?.typeId;
  if(!([isTorchIncluded(mainHand), isTorchIncluded(offHand)].some(hand => hand === true))) return;
  const updatedTorchFireEffects = Object.assign({}, DEFAULT_EFFECTS, torchFireEffects);
  Object.keys(updatedTorchFireEffects).forEach((key) => {
    if (typeof updatedTorchFireEffects[key] === "number") updatedTorchFireEffects[key] = Math.round(updatedTorchFireEffects[key] / TicksPerSecond);
  });
  if (prioritizeMainHand) {
    if (isTorchIncluded(mainHand)) {
      hurtedEntity.setOnFire(updatedTorchFireEffects[mainHand] ?? 0, true);
      Logger.warn("Prioritize Main Hand");
    } else if (isTorchIncluded(offHand)) {
      hurtedEntity.setOnFire(updatedTorchFireEffects[offHand] ?? 0, true);
      Logger.warn("Prioritize Off Hand");
    }
  } else {
    if (isTorchIncluded(offHand)) {
      hurtedEntity.setOnFire(updatedTorchFireEffects[offHand] ?? 0, true);
      Logger.warn("Prioritize Off Hand");
    } else if (isTorchIncluded(mainHand)) {
      hurtedEntity.setOnFire(updatedTorchFireEffects[mainHand] ?? 0, true);
      Logger.warn("Prioritize Main Hand");
    }
  }
});