import { MessageSourceType, Player, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import * as configKeys from "./config";
import { forceShow, Logger } from "./packages";
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
            if (typeof value === "object" || isMap(value) || isPlainObject(value)) {
                if (!Array.isArray(value)) {
                    const advancedValues = [];
                    for (const [key2, value2] of Object.entries(value)) {
                        advancedValues.push({ [key2]: value2 });
                    }
                    if (advancedValues.some(entry => entry.hasOwnProperty('from') || entry.hasOwnProperty('to'))) {
                        const combinedValues = advancedValues.reduce((result, entry) => Object.assign(result, entry), {});
                        keys.advanced.push({ key: key, value: combinedValues });
                    }
                    else if (advancedValues.some(entry => entry.hasOwnProperty('selection'))) {
                        keys.advanced.push({ key: key, value: advancedValues });
                    }
                    else {
                        keys.customized.push({ key: key, value: advancedValues });
                    }
                }
                else {
                    keys.customized.push({ key: key, value: value });
                }
            }
            else {
                keys.basic.push({ key: key, value: value });
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
        keyValues.forEach(({ key, value }) => {
            if (typeof value === "boolean") {
                basicForm.toggle({ translate: `ConfigurationForm.${id}.${key}.name`, with: ["\n"] }, value);
            }
            else {
                basicForm.textField({ translate: `ConfigurationForm.${id}.${key}.name`, with: ["\n"] }, value + "");
            }
        });
        forceShow(player, basicForm).then((result) => {
            if (result.canceled)
                return player.sendMessage('Ui closed!');
            result.formValues.forEach((value, key) => {
                if (key === 0 && value === true)
                    ui.main(id, player);
            });
        });
    },
    customize: (id, player, keyValues) => {
        let selectedIndex = 0;
        const customizationForm = new ModalFormData()
            .toggle({ translate: `ConfigurationForm.${id}.misc.back.text`, with: ["\n"] }, false);
        keyValues.forEach(({ key, value }) => {
            const dropDownSet = new Set();
            value.forEach((configOption) => {
                const [configKey, configValue] = Object.entries(configOption)[0];
                dropDownSet.add(`${configKey.split(":")[1]}: ${configValue}`);
            });
            const textFieldMap = Array.isArray(configKeys.default[key]) ? "Update" : "Key";
            customizationForm.dropdown({ translate: `ConfigurationForm.${id}.${key}.name`, with: ["\n"] }, ["Create", ...Array.from(dropDownSet)], selectedIndex);
            customizationForm.textField({ translate: textFieldMap, with: ["\n"] }, "Add / Edit / Delete");
            customizationForm.toggle({ translate: `shouldDelete`, with: ["\n"] }, false);
        });
        forceShow(player, customizationForm).then((result) => {
            if (result.canceled)
                return player.sendMessage('Ui closed!');
            result.formValues.forEach((value, key) => {
                if (key === 0 && value === true)
                    ui.main(id, player);
            });
        });
    },
    advanced: (id, player, keyValues) => {
        let selectedIndex = 0;
        const advancedForm = new ModalFormData()
            .toggle({ translate: `ConfigurationForm.${id}.misc.back.text`, with: ["\n"] }, false);
        keyValues.forEach(({ key, value }) => {
            if (Array.isArray(value)) {
                let selection;
                selection = value[0]["selection"];
                if (!selection.length)
                    return;
                selection = ["Choose", ...selection];
                advancedForm.dropdown({ translate: `ConfigurationForm.${id}.${key}.name`, with: ["\n"] }, selection, selectedIndex);
            }
            else {
                advancedForm.slider({ translate: `ConfigurationForm.${id}.${key}.name`, with: ["\n"] }, value.from, value.to, 1, Math.round((value.from + value.to) / 2));
            }
        });
        forceShow(player, advancedForm).then((result) => {
            if (result.canceled)
                return player.sendMessage('Ui closed!');
            result.formValues.forEach((value, key) => {
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
