import { EntityEquipmentInventoryComponent, EntityInventoryComponent, EquipmentSlot, MinecraftBlockTypes, Player, system, world } from "@minecraft/server";
import { Compare, consumeTorchOnLit, forceSetPermutation, igniteTNT, isTorchIncluded } from "../packages";
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
    const equipment = await player.getComponent(EntityEquipmentInventoryComponent.componentId);
    const offHand = equipment.getEquipment(EquipmentSlot.offhand);
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
    const onBlockPlaced = world.afterEvents.blockPlace.subscribe((onPlaced) => {
        system.run(() => world.afterEvents.blockPlace.unsubscribe(onBlockPlaced));
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
        if (_block.type === MinecraftBlockTypes.tnt && !igniteTNT)
            return;
        blockPlaced.setType(MinecraftBlockTypes.air);
        justExecuted = true;
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
                _block.setType(MinecraftBlockTypes.air);
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
    if (consumeTorchOnLit)
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
            _block.setType(MinecraftBlockTypes.air);
            player.dimension.spawnEntity("minecraft:tnt", _block.location);
            justExecuted = true;
            break;
        }
    }
});
