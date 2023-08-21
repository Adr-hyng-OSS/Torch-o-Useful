import { EntityDamageCause, EntityEquipmentInventoryComponent, EquipmentSlot, MinecraftItemTypes, Player, TicksPerSecond, world } from "@minecraft/server";
import { Compare, Logger, configDBSchema, fetchScoreObj, isTorchIncluded} from "../packages";
import { configDB } from "main";


const DEFAULT_EFFECTS: Map<string, number> = new Map([
  [MinecraftItemTypes.torch.id, 40],
  [MinecraftItemTypes.soulTorch.id, 60],
  [MinecraftItemTypes.redstoneTorch.id, 40]
]);

const onHurtEvent = world.afterEvents.entityHurt.subscribe((event) => {
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

  let config = fetchScoreObj(player.id); configDB.set(configDBSchema(player.id), config);

  let handToUse = config.prioritizeMainHand ? mainHand : offHand;
	if(!mainHand) handToUse = offHand;
	if(!offHand) handToUse = mainHand; 
	if(!handToUse) return;
  const updatedTorchFireEffects = Object.assign({}, DEFAULT_EFFECTS, config.torchFireEffects);
  Object.keys(updatedTorchFireEffects).forEach((key) => {
    if (typeof updatedTorchFireEffects[key] === "number") updatedTorchFireEffects[key] = Math.round(updatedTorchFireEffects[key] / TicksPerSecond);
  });
  if (!isTorchIncluded(handToUse)) {
		handToUse = Compare.types.isEqual(handToUse, mainHand) ? offHand : mainHand;
  }
  if (isTorchIncluded(handToUse)) {
		hurtedEntity.setOnFire(updatedTorchFireEffects[handToUse] ?? 0, true);
  }
});

export {onHurtEvent};