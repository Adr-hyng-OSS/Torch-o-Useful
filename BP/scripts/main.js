import { Compare, isTorchIncluded, torchFireEffects, prioritizeMainHand, consumeTorchOnLit, CContainer, forceSetPermutation, Logger, igniteTNT, forceShow } from "./packages";
import { EntityDamageCause, EntityEquipmentInventoryComponent, EntityInventoryComponent, EquipmentSlot, MessageSourceType, MinecraftBlockTypes, MinecraftItemTypes, Player, TicksPerSecond, system, world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
const logMap = new Map();
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
        inventory.addItem(blockPlacedItemStack.type, 1);
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
import * as configKeys from "./config";
const ui = {
    main: (id, player) => {
        const isPlainObject = (value) => typeof value === 'object' && !Array.isArray(value) && value !== null && !(value instanceof Function);
        const isMap = (value) => value instanceof Map;
        const keys = {
            "basic": [],
            "customized": [],
            "advanced": []
        };
        for (const [key, value] of Object.entries(configKeys.default)) {
            if (typeof value === "boolean") {
                keys.basic.push([key, value]);
            }
            else if (typeof value === "string") {
                keys.basic.push([key, value]);
            }
            else if (typeof value === "number") {
                keys.basic.push([key, value]);
            }
            else if (Array.isArray(value)) {
                keys.customized.push({ key: key, value: value });
            }
            else if (isPlainObject(value) || isMap(value)) {
                keys.advanced.push({ key: key, value: value });
            }
        }
        const main = new ActionFormData()
            .title({ translate: `ConfigurationForm.${id}.addonIdentifier.name`, with: ["\n"] })
            .button({ translate: `ConfigurationForm.${id}.basic.name`, with: ["\n"] })
            .button({ translate: `ConfigurationForm.${id}.listOptions.name`, with: ["\n"] })
            .button({ translate: `ConfigurationForm.${id}.dictionaryOptions.name`, with: ["\n"] });
        forceShow(player, main).then((result) => {
            if (result.canceled)
                return player.sendMessage('Ui closed!');
            if (result.selection === 0)
                ui.basic(id, player, keys.basic);
            if (result.selection === 1)
                ui.customize(id, player, keys.customized);
            if (result.selection === 2)
                ui.advanced(id, player, keys.advanced);
        });
    },
    basic: (id, player, keyValues) => {
        const basicForm = new ModalFormData()
            .title({ translate: `ConfigurationForm.${id}.basic.name`, with: ["\n"] })
            .toggle({ translate: `ConfigurationForm.${id}.misc.back.text`, with: ["\n"] }, false);
        for (let [key, value] of keyValues) {
            if (typeof value === "boolean") {
                basicForm.toggle({ translate: `ConfigurationForm.${id}.${key}.name`, with: ["\n"] }, value);
            }
            else if (typeof value === "string") {
                basicForm.textField({ translate: `ConfigurationForm.${id}.${key}.name`, with: ["\n"] }, value);
            }
            else if (typeof value === "number") {
                basicForm.textField({ translate: `ConfigurationForm.${id}.${key}.name`, with: ["\n"] }, value + "");
            }
        }
        forceShow(player, basicForm).then((result) => {
            if (result.canceled)
                return player.sendMessage('Ui closed!');
            result.formValues.forEach((value, key) => {
                if (key === 0 && value === true)
                    ui.main(id, player);
            });
        }).catch((e) => {
            Logger.warn(e, e.stack);
        });
    },
    customize: (id, player, keyValues) => {
        let selectedIndex = 0;
        const customizationForm = new ModalFormData()
            .toggle({ translate: `ConfigurationForm.${id}.misc.back.text`, with: ["\n"] }, false);
        for (const [key, value] of Object.entries(keyValues)) {
            customizationForm.dropdown({ translate: `ConfigurationForm.${id}.${key}.name`, with: ["\n"] }, ["Create New", ...Array(value)], selectedIndex);
            customizationForm.textField({ translate: `Add `, with: ["\n"] }, "Key -> Create or Update");
        }
        forceShow(player, customizationForm).then((result) => {
            if (result.canceled)
                return player.sendMessage('Ui closed!');
            result.formValues.forEach((value, key) => {
                Logger.warn(`KEY: ${key}, VALUE: ${value}`);
                if (key === 0 && value === true)
                    ui.main(id, player);
            });
        });
    },
    advanced: (id, player, keyValues) => {
        let selectedIndex = 0;
        const advancedForm = new ModalFormData()
            .toggle({ translate: `ConfigurationForm.${id}.misc.back.text`, with: ["\n"] }, false);
        forceShow(player, advancedForm).then((result) => {
            if (result.canceled)
                return player.sendMessage('Ui closed!');
            result.formValues.forEach((value, key) => {
                Logger.warn(`KEY: ${key}, VALUE: ${value}`);
                if (key === 0 && value === true)
                    ui.main(id, player);
            });
        });
    }
};
system.events.scriptEventReceive.subscribe((event) => {
    const { id, initiator, message, sourceBlock, sourceEntity, sourceType } = event;
    if (sourceType !== MessageSourceType.clientScript)
        return;
    if (!sourceEntity)
        return;
    if (!(sourceEntity instanceof Player))
        return;
    if (id.match(/^yn:torchouseful$/)) {
        if (message.match(/^config$/)) {
            Logger.warn(`ID: ${id}, INIT: ${initiator}, MSG: ${message}, SRC: ${sourceType}, PLY: ${sourceEntity?.nameTag}`);
            system.run(() => {
                ui.main(id, sourceEntity);
            });
        }
    }
    if (!sourceBlock)
        return;
    if (!sourceType)
        return;
});
