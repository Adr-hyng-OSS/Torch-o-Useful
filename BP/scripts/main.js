import { Compare, Logger, isTorchIncluded, torchFireEffects, prioritizeMainHand, consumeTorchOnLit, CContainer } from "./packages";
import { EntityDamageCause, EntityEquipmentInventoryComponent, EntityInventoryComponent, EquipmentSlot, MinecraftBlockTypes, MinecraftItemTypes, Player, TicksPerSecond, system, world } from "@minecraft/server";
const logMap = new Map();
const onBlockPlacedLogMap = new Map();
const DEFAULT_EFFECTS = new Map([
    [MinecraftItemTypes.torch.id, 40],
    [MinecraftItemTypes.soulTorch.id, 60],
    [MinecraftItemTypes.redstoneTorch.id, 40]
]);
function forceSetPermutation(_block, flag, state = "lit") {
    const perm = _block.permutation.withState(state, !flag);
    system.run(() => _block.setPermutation(perm));
}
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
world.beforeEvents.itemUseOn.subscribe(async (event) => {
    const _block = event.block;
    const mainHand = event.itemStack;
    const player = event.source;
    if (!(player instanceof Player))
        return;
    const oldLog = logMap.get(player.id);
    logMap.set(player.id, Date.now());
    if ((oldLog + 150) >= Date.now())
        return;
    Logger.warn("TEST EXECUTE");
    const permutations = JSON.parse(JSON.stringify(_block.permutation.getAllStates()));
    if (permutations["lit"] === undefined && permutations["extinguished"] === undefined)
        return;
    const equipment = await player.getComponent(EntityEquipmentInventoryComponent.componentId);
    const offHand = equipment.getEquipment(EquipmentSlot.offhand);
    const inventory = new CContainer(player.getComponent(EntityInventoryComponent.componentId).container).setPlayer(player);
    const hands = [
        { slot: mainHand, item: mainHand },
        { slot: offHand, item: offHand }
    ];
    const torchHand = hands.find(hand => {
        if (!hand.item?.typeId)
            return false;
        return isTorchIncluded(hand.item?.typeId);
    });
    if (!torchHand)
        return;
    const onBlockPlaced = world.afterEvents.blockPlace.subscribe((event2) => {
        system.run(() => world.afterEvents.blockPlace.unsubscribe(onBlockPlaced));
        const onBlockPlacedOldLog = onBlockPlacedLogMap.get(player.id);
        onBlockPlacedLogMap.set(player.id, Date.now());
        if ((onBlockPlacedOldLog + 150) >= Date.now())
            return;
        const blockPlaced = event2.block;
        const blockPlacePlayer = event2.player;
        const blockPlacedItemStack = blockPlaced.getItemStack();
        if (!Compare.types.isEqual(blockPlacedItemStack.type, mainHand.type))
            return;
        if (!Compare.types.isEqual(blockPlacePlayer.id, player.id))
            return;
        blockPlaced.setType(MinecraftBlockTypes.air);
        if (!isTorchIncluded(blockPlacedItemStack.typeId))
            inventory.addItem(blockPlacedItemStack.type, 1);
        if (permutations["lit"] === undefined && permutations["extinguished"] === undefined)
            return;
        if (!consumeTorchOnLit) {
            if (isTorchIncluded(blockPlacedItemStack.typeId))
                inventory.addItem(blockPlacedItemStack.type, 1);
        }
        if (permutations["lit"] === true || permutations["extinguished"] === false)
            return;
        Logger.warn("holding a placeable item");
        for (const [key, value] of Object.entries(permutations)) {
            if (key === "lit" && value === false) {
                const flag = value;
                forceSetPermutation(_block, flag);
                break;
            }
            else if (key === "extinguished" && value === true) {
                const flag = value;
                forceSetPermutation(_block, flag, "extinguished");
                break;
            }
        }
        return;
    });
    if (permutations["lit"] === undefined && permutations["extinguished"] === undefined)
        return;
    if (permutations["lit"] === true || permutations["extinguished"] === false)
        return;
    if (consumeTorchOnLit)
        inventory.clearItem(torchHand.item.typeId, 1);
    Logger.warn("Not holding any placeable item");
    for (const [key, value] of Object.entries(permutations)) {
        if (key === "lit" && value === false) {
            const flag = value;
            forceSetPermutation(_block, flag);
            break;
        }
        else if (key === "extinguished" && value === true) {
            const flag = value;
            forceSetPermutation(_block, flag, "extinguished");
            break;
        }
    }
});
