import { EntityDamageCause, EntityEquippableComponent, EntityInventoryComponent, EquipmentSlot, Player, TicksPerSecond, system, world } from "@minecraft/server";
import { MinecraftBlockTypes, MinecraftItemTypes } from "./modules/vanilla-types/index";
import { Compare, consumeTorchOnLit, forceSetPermutation, igniteTNT, isTorchIncluded, prioritizeMainHand, torchFireEffects } from "./packages";
const DEFAULT_EFFECTS = new Map([
    [MinecraftItemTypes.Torch.id, 40],
    [MinecraftItemTypes.SoulTorch.id, 60],
    [MinecraftItemTypes.RedstoneTorch.id, 40]
]);
const logMap = new Map();
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
    const permutations = JSON.parse(JSON.stringify(_block.permutation.getAllStates()));
    if (permutations["lit"] === undefined && permutations["extinguished"] === undefined && permutations["explode_bit"] === undefined)
        return;
    const equipment = await player.getComponent(EntityEquippableComponent.componentId);
    const offHand = equipment.getEquipment(EquipmentSlot.Offhand);
    const inventory = (player.getComponent(EntityInventoryComponent.componentId).container).setHolder(player);
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
    let justExecuted = false;
    const onBlockPlaced = world.afterEvents.playerPlaceBlock.subscribe((onPlaced) => {
        system.run(() => world.afterEvents.playerPlaceBlock.unsubscribe(onBlockPlaced));
        if (justExecuted)
            return;
        const blockPlaced = onPlaced.block;
        const blockPlacePlayer = onPlaced.player;
        const blockPlacedItemStack = blockPlaced.getItemStack();
        if (!blockPlacedItemStack)
            return;
        if (!blockPlacePlayer)
            return;
        if (!Compare.types.isEqual(blockPlacedItemStack?.type, mainHand?.type))
            return;
        if (!Compare.types.isEqual(blockPlacePlayer?.id, player?.id))
            return;
        if (_block.type === MinecraftBlockTypes.Tnt && !igniteTNT)
            return;
        blockPlaced.setType(MinecraftBlockTypes.Air);
        justExecuted = true;
        if (blockPlacePlayer.isSurvival())
            inventory.giveItem(blockPlacedItemStack.type, 1);
        if (permutations["lit"] === undefined && permutations["extinguished"] === undefined && permutations["explode_bit"] === undefined)
            return;
        if ((permutations["lit"] === true || permutations["extinguished"] === false))
            return;
        for (const [key, value] of Object.entries(permutations)) {
            if (key === "lit" && value === false) {
                const flag = value;
                forceSetPermutation(_block, flag);
                break;
            }
            if (key === "extinguished" && value === true) {
                const flag = value;
                forceSetPermutation(_block, flag, "extinguished");
                break;
            }
            if (key === "explode_bit" && value === false && igniteTNT) {
                _block.setType(MinecraftBlockTypes.Air);
                blockPlacePlayer.dimension.spawnEntity("minecraft:tnt", _block.location);
                break;
            }
        }
        return;
    });
    if (permutations["lit"] === undefined && permutations["extinguished"] === undefined && permutations["explode_bit"] === undefined)
        return;
    if (permutations["lit"] === true || permutations["extinguished"] === false)
        return;
    if (justExecuted)
        return;
    if (consumeTorchOnLit && player.isSurvival())
        inventory.clearItem(torchHand.item.typeId, 1);
    for (const [key, value] of Object.entries(permutations)) {
        if (key === "lit" && value === false) {
            const flag = value;
            forceSetPermutation(_block, flag);
            break;
        }
        if (key === "extinguished" && value === true) {
            const flag = value;
            forceSetPermutation(_block, flag, "extinguished");
            break;
        }
        if (key === "explode_bit" && value === false && igniteTNT) {
            _block.setType(MinecraftBlockTypes.Air);
            player.dimension.spawnEntity("minecraft:tnt", _block.location);
            justExecuted = true;
            break;
        }
    }
});
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
    const equipment = player.getComponent(EntityEquippableComponent.componentId);
    const mainHand = equipment.getEquipment(EquipmentSlot.Mainhand)?.typeId;
    const offHand = equipment.getEquipment(EquipmentSlot.Offhand)?.typeId;
    if (!([isTorchIncluded(mainHand), isTorchIncluded(offHand)].some(hand => hand === true)))
        return;
    let handToUse = prioritizeMainHand ? mainHand : offHand;
    if (!mainHand)
        handToUse = offHand;
    if (!offHand)
        handToUse = mainHand;
    if (!handToUse)
        return;
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
