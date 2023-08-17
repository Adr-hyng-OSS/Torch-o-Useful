import { system } from "@minecraft/server";
import { ActionFormData, FormCancelationReason, ModalFormData } from "@minecraft/server-ui";
import { includeCustomTorch, excludeCustomTorch } from "../packages";
import { configDB } from "../main";
import config from "config";
function isTorchIncluded(blockID) {
    const currentPatterns = [
        '^[\\w\\-]+:(?:[\\w_]+_)?torch$'
    ];
    const excludeRegexes = excludeCustomTorch.map((excluded) => new RegExp(excluded));
    const isExcluded = excludeRegexes.some((regex) => regex.test(blockID));
    if (isExcluded) {
        return false;
    }
    let patterns = [...currentPatterns, ...includeCustomTorch];
    const combinedPattern = new RegExp(patterns.join('|'));
    return combinedPattern.test(blockID);
}
function forceSetPermutation(_block, flag, state = "lit") {
    const perm = _block.permutation.withState(state, !flag);
    system.run(() => _block.setPermutation(perm));
}
async function forceShow(player, form, timeout = Infinity) {
    const startTick = system.currentTick;
    while ((system.currentTick - startTick) < timeout) {
        const response = await (form.show(player)).catch(er => console.error(er, er.stack));
        if (response.cancelationReason !== FormCancelationReason.UserBusy) {
            return response;
        }
    }
    ;
    throw new Error(`Timed out after ${timeout} ticks`);
}
;
const fetchScoreObj = () => {
    return (configDB.get("configObject") ?? config.clone());
};
Object.prototype.clone = function () {
    return JSON.parse(JSON.stringify(this));
};
const ConfigUI = {
    main: (id, player) => {
        const isPlainObject = (value) => typeof value === 'object' && !Array.isArray(value) && value !== null && !(value instanceof Function);
        const isMap = (value) => value instanceof Map;
        const keys = {
            "basic": [],
            "customized": [],
            "advanced": []
        };
        let configurationObject = fetchScoreObj();
        configDB.set("configObject", configurationObject);
        for (const [key, value] of Object.entries(configurationObject)) {
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
                ConfigUI.basic(id, player, keys.basic);
            if (result.selection === 1)
                ConfigUI.customize(id, player, keys.customized);
            if (result.selection === 2)
                ConfigUI.advanced(id, player, keys.advanced);
        });
    },
    basic: (id, player, keyValues) => {
        const formKeys = {};
        const basicForm = new ModalFormData()
            .title({ translate: `ConfigurationForm.${id}.basic.name`, with: ["\n"] });
        let i = 0;
        keyValues.forEach(({ key, value }) => {
            formKeys[i] = { "key": key, "value": value };
            i++;
            if (typeof value === "boolean") {
                basicForm.toggle({ translate: `ConfigurationForm.${id}.${key}.name`, with: ["\n"] }, value);
            }
            else {
                basicForm.textField({ translate: `ConfigurationForm.${id}.${key}.name`, with: ["\n"] }, value + "");
            }
        });
        basicForm.toggle({ translate: `ConfigurationForm.${id}.misc.back.text`, with: ["\n"] }, false);
        forceShow(player, basicForm).then((result) => {
            if (result.canceled)
                return player.sendMessage('Ui closed!');
            const configurationObject = fetchScoreObj();
            result.formValues.forEach((value, key) => {
                if (key === result.formValues.length - 1 && value === true)
                    ConfigUI.main(id, player);
                if (key === result.formValues.length - 1)
                    return;
                configurationObject[formKeys[key].key] = value;
                configDB.set("configObject", configurationObject);
            });
        });
    },
    customize: (id, player, keyValues) => {
        let selectedIndex = 0;
        const customizationForm = new ModalFormData();
        keyValues.forEach(({ key, value }) => {
            const dropDownSet = new Set();
            value.forEach((configOption) => {
                const [configKey, configValue] = Object.entries(configOption)[0];
                dropDownSet.add(`${configKey.split(":")[1]}: ${configValue}`);
            });
            const textFieldMap = Array.isArray(config[key]) ? "Update" : "Key";
            customizationForm.dropdown({ translate: `ConfigurationForm.${id}.${key}.name`, with: ["\n"] }, ["Create", ...Array.from(dropDownSet)], selectedIndex);
            customizationForm.textField({ translate: textFieldMap, with: ["\n"] }, "Add / Edit / Delete");
            customizationForm.toggle({ translate: `shouldDelete`, with: ["\n"] }, false);
        });
        customizationForm.toggle({ translate: `ConfigurationForm.${id}.misc.back.text`, with: ["\n"] }, false);
        forceShow(player, customizationForm).then((result) => {
            if (result.canceled)
                return player.sendMessage('Ui closed!');
            result.formValues.forEach((value, key) => {
                if (key === result.formValues.length - 1 && value === true)
                    ConfigUI.main(id, player);
            });
        });
    },
    advanced: (id, player, keyValues) => {
        let selectedIndex = 0;
        const advancedForm = new ModalFormData();
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
        advancedForm.toggle({ translate: `ConfigurationForm.${id}.misc.back.text`, with: ["\n"] }, false);
        forceShow(player, advancedForm).then((result) => {
            if (result.canceled)
                return player.sendMessage('Ui closed!');
            result.formValues.forEach((value, key) => {
                if (key === result.formValues.length - 1 && value === true)
                    ConfigUI.main(id, player);
            });
        });
    }
};
export { isTorchIncluded, forceSetPermutation, forceShow, ConfigUI };
