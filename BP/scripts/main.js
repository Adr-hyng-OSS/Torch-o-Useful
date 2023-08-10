import { Compare, Logger, isTorchIncluded, torchFireEffects, prioritizeMainHand } from "./packages";
import { EntityDamageCause, EntityEquipmentInventoryComponent, EquipmentSlot, MinecraftItemTypes, Player, TicksPerSecond, world } from "@minecraft/server";
const DEFAULT_EFFECTS = new Map([
    [MinecraftItemTypes.torch.id, 40],
    [MinecraftItemTypes.soulTorch.id, 60],
    [MinecraftItemTypes.redstoneTorch.id, 40]
]);
world.afterEvents.entityHurt.subscribe((event) => {
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
    if (!([isTorchIncluded(mainHand), isTorchIncluded(offHand)].some(hand => hand === true)))
        return;
    let handToUse = prioritizeMainHand ? mainHand : offHand;
    const updatedTorchFireEffects = Object.assign({}, DEFAULT_EFFECTS, torchFireEffects);
    Object.keys(updatedTorchFireEffects).forEach((key) => {
        if (typeof updatedTorchFireEffects[key] === "number")
            updatedTorchFireEffects[key] = Math.round(updatedTorchFireEffects[key] / TicksPerSecond);
    });
    if (!isTorchIncluded(handToUse)) {
        handToUse = Compare.types.isEqual(handToUse, mainHand) ? offHand : mainHand;
    }
    if (isTorchIncluded(handToUse)) {
        hurtedEntity.setOnFire(updatedTorchFireEffects[handToUse] ?? 0, true);
    }
});
world.afterEvents.itemUseOn.subscribe((event) => {
    const _block = event.block;
    const player = event.source;
    if (!(player instanceof Player))
        return;
    const equipment = player.getComponent(EntityEquipmentInventoryComponent.componentId);
    const mainHand = equipment.getEquipment(EquipmentSlot.mainhand)?.typeId;
    const offHand = equipment.getEquipment(EquipmentSlot.offhand)?.typeId;
    if (!([isTorchIncluded(mainHand), isTorchIncluded(offHand)].some(hand => hand === true)))
        return;
    const permutations = JSON.parse(JSON.stringify(_block.permutation.getAllStates()));
    Logger.warn(permutations["lit"], permutations["lit"] === undefined);
    if (permutations["lit"] === undefined && permutations["extinguished"] === undefined)
        return;
    for (const [key, value] of Object.entries(permutations)) {
        Logger.warn(`${key}: ${value}`);
        if (key === "lit" && value === false) {
            const flag = value;
            const perm = _block.permutation.withState("lit", !flag);
            _block.setPermutation(perm);
            break;
        }
        else if (key === "extinguished" && value === true) {
            const flag = value;
            const perm = _block.permutation.withState("extinguished", !flag);
            _block.setPermutation(perm);
            break;
        }
    }
});
