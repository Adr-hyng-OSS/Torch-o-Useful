import { EntityDamageCause, EntityEquipmentInventoryComponent, EquipmentSlot, MinecraftItemTypes, Player, TicksPerSecond, world } from "@minecraft/server";
import { Compare, configDBSchema, fetchScoreObj, isTorchIncluded } from "../packages";
import { configDB } from "main";
const DEFAULT_EFFECTS = new Map([
    [MinecraftItemTypes.torch.id, 40],
    [MinecraftItemTypes.soulTorch.id, 60],
    [MinecraftItemTypes.redstoneTorch.id, 40]
]);
const onHurtEvent = world.afterEvents.entityHurt.subscribe((event) => {
    const player = event.damageSource.damagingEntity;
    const cause = event.damageSource.cause;
    const hurtedEntity = event.hurtEntity;
    if (!(player instanceof Player))
        return;
    if (!hurtedEntity)
        return;
    if (!Compare.types.isEqual(cause, EntityDamageCause.entityAttack))
        return;
    const equipment = player.getComponent(EntityEquipmentInventoryComponent.componentId);
    const mainHand = equipment.getEquipment(EquipmentSlot.mainhand)?.typeId;
    const offHand = equipment.getEquipment(EquipmentSlot.offhand)?.typeId;
    let config = fetchScoreObj(player.id);
    configDB.set(configDBSchema(player.id), config);
    if (!([isTorchIncluded(config, mainHand), isTorchIncluded(config, offHand)].some(hand => hand === true)))
        return;
    let handToUse = config.prioritizeMainHand ? mainHand : offHand;
    if (!mainHand)
        handToUse = offHand;
    if (!offHand)
        handToUse = mainHand;
    if (!handToUse)
        return;
    const updatedTorchFireEffects = Object.assign({}, DEFAULT_EFFECTS, config.torchFireEffects);
    Object.keys(updatedTorchFireEffects).forEach((key) => {
        if (typeof updatedTorchFireEffects[key] === "number")
            updatedTorchFireEffects[key] = Math.round(updatedTorchFireEffects[key] / TicksPerSecond);
    });
    if (!isTorchIncluded(config, handToUse)) {
        handToUse = Compare.types.isEqual(handToUse, mainHand) ? offHand : mainHand;
    }
    if (isTorchIncluded(config, handToUse)) {
        hurtedEntity.setOnFire(updatedTorchFireEffects[handToUse] ?? 0, true);
    }
});
export { onHurtEvent };
