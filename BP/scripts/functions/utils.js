import { system } from "@minecraft/server";
import { ActionFormData, FormCancelationReason, ModalFormData } from "@minecraft/server-ui";
import { configDB } from "../main";
import config from "config";
function isTorchIncluded(configObj, blockID) {
    const currentPatterns = [
        '^[\\w\\-]+:(?:[\\w_]+_)?torch$'
    ];
    const excludeRegexes = configObj.excludeCustomTorch.map((excluded) => new RegExp(excluded));
    const isExcluded = excludeRegexes.some((regex) => regex.test(blockID));
    if (isExcluded) {
        return false;
    }
    let patterns = [...currentPatterns, ...configObj.includeCustomTorch];
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
Object.prototype.clone = function () {
    return JSON.parse(JSON.stringify(this));
};
export const fetchScoreObj = (playerID) => {
    const privateConfig = config.clone();
    return configDB.get(configDBSchema(playerID)) ?? privateConfig;
};
export const configDBSchema = (playerID) => {
    return `${playerID}_configObject`;
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
        let configurationObject = fetchScoreObj(player.id);
        configDB.set(configDBSchema(player.id), configurationObject);
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
        let i = 0;
        const basicForm = new ModalFormData()
            .title({ translate: `ConfigurationForm.${id}.basic.name`, with: ["\n"] });
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
            const length = result.formValues.length;
            const shouldBack = result.formValues[length - 1] === true;
            const configurationObject = fetchScoreObj(player.id);
            result.formValues.forEach((value, formIndex) => {
                const isLastElement = formIndex === length - 1;
                if (isLastElement && shouldBack)
                    return ConfigUI.main(id, player);
                if (isLastElement)
                    return;
                configurationObject[formKeys[formIndex].key] = value;
                configDB.set(configDBSchema(player.id), configurationObject);
            });
        });
    },
    customize: (id, player, keyValues) => {
        const formKeys = {};
        let i = 0;
        let selectedIndex = 0;
        const customizationForm = new ModalFormData()
            .title({ translate: `ConfigurationForm.${id}.listOptions.name`, with: ["\n"] });
        const configurationObject = fetchScoreObj(player.id);
        keyValues.forEach(({ key, value }) => {
            formKeys[i] = { "key": key, "value": value, "dropdown": [] };
            i += 3;
            const dropDownSet = new Set();
            const isArray = Array.isArray(config[key]);
            if (isArray) {
                value.forEach((configOption) => {
                    dropDownSet.add(configOption);
                });
            }
            else {
                value.forEach((configOption) => {
                    const [configKey, configValue] = Object.entries(configOption)[0];
                    const entry = `${configKey}: ${configValue}`;
                    dropDownSet.add(entry);
                    formKeys[i - 3] = { "key": key, "value": value, "dropdown": [...formKeys[i - 3].dropdown, entry] };
                });
            }
            const textFieldMap = isArray ? "Update" : "Key";
            customizationForm.dropdown({ translate: `ConfigurationForm.${id}.${key}.name`, with: ["\n"] }, ["Create", ...Array.from(dropDownSet)], selectedIndex);
            customizationForm.textField({ translate: textFieldMap, with: ["\n"] }, "Add / Edit / Delete");
            customizationForm.toggle({ translate: `shouldDelete`, with: ["\n"] }, false);
        });
        customizationForm.toggle({ translate: `ConfigurationForm.${id}.misc.back.text`, with: ["\n"] }, false);
        forceShow(player, customizationForm).then((result) => {
            if (result.canceled)
                return player.sendMessage('Ui closed!');
            const length = result.formValues.length;
            const shouldBack = result.formValues[length - 1] === true;
            result.formValues.forEach((value, formIndex) => {
                const isLastElement = formIndex === length - 1;
                if (isLastElement && shouldBack)
                    return ConfigUI.main(id, player);
                if (isLastElement)
                    return;
                const formValues = configurationObject[formKeys[formIndex]?.key];
                if (formIndex % 3 === 0) {
                    let modifiedEntry;
                    value = value;
                    if (value === 0 && result.formValues[formIndex + 2] === false) {
                        if (result.formValues[formIndex + 1] !== "") {
                            if (Array.isArray(formValues)) {
                                formValues.push(result.formValues[formIndex + 1] + "");
                            }
                            else {
                                const [namespace, ...rest] = (result.formValues[formIndex + 1] + "").split(":");
                                const newKey = `${namespace}:${rest[0].trim()}`;
                                const newValue = rest[1] ? rest[1].trim() : '';
                                let modifiedValue;
                                if (newValue === "true" || newValue === "false") {
                                    modifiedValue = newValue === "true";
                                }
                                else if (!isNaN(Number(newValue))) {
                                    modifiedValue = Number(newValue);
                                }
                                modifiedEntry = { key: newKey, value: modifiedValue };
                                if (!formValues.hasOwnProperty(modifiedEntry.key)) {
                                    formValues[modifiedEntry.key] = modifiedEntry.value;
                                }
                            }
                        }
                    }
                    else if (value !== 0) {
                        if (Array.isArray(formValues)) {
                            value = value !== 0 ? value - 1 : value;
                            if (result.formValues[formIndex + 2] === true) {
                                formValues.splice(value, 1);
                            }
                            if (result.formValues[formIndex + 1] !== "") {
                                if (result.formValues[formIndex + 2] === false) {
                                    formValues[value] = result.formValues[formIndex + 1] + "";
                                }
                            }
                        }
                        else {
                            if (result.formValues[formIndex + 2] === true) {
                                value = value !== 0 ? value - 1 : value;
                                const fetchedKey = Object.keys(formKeys[formIndex]?.value[value])[0];
                                delete formValues[fetchedKey];
                            }
                            if (result.formValues[formIndex + 1] !== "" && result.formValues[formIndex + 2] === false) {
                                value = value !== 0 ? value - 1 : value;
                                const fetchedKey = Object.keys(formKeys[formIndex]?.value[value])[0];
                                if (formValues.hasOwnProperty(fetchedKey)) {
                                    const newValue = result.formValues[formIndex + 1] + "";
                                    let modifiedValue;
                                    if (newValue === "true" || newValue === "false") {
                                        modifiedValue = newValue === "true";
                                    }
                                    else if (!isNaN(Number(newValue))) {
                                        modifiedValue = Number(newValue);
                                    }
                                    formValues[fetchedKey] = modifiedValue;
                                }
                            }
                        }
                    }
                }
                configDB.set(configDBSchema(player.id), configurationObject);
            });
        });
    },
    advanced: (id, player, keyValues) => {
        const formKeys = {};
        let i = 0;
        let UnknownValues;
        (function (UnknownValues) {
            UnknownValues["Selection"] = "selectionIndex";
            UnknownValues["Slide"] = "current";
        })(UnknownValues || (UnknownValues = {}));
        const advancedForm = new ModalFormData()
            .title({ translate: `ConfigurationForm.${id}.dictionaryOptions.name`, with: ["\n"] });
        const configurationObject = fetchScoreObj(player.id);
        keyValues.forEach(({ key, value }) => {
            formKeys[i] = { "key": key, "value": value };
            i++;
            if (Array.isArray(value)) {
                let selection;
                let selectionIndex;
                selection = value[0]["selection"];
                const hasSelectionIndex = value.some(obj => obj.hasOwnProperty(UnknownValues.Selection));
                if (hasSelectionIndex) {
                    const objWithSelectionIndex = value.find(obj => obj.hasOwnProperty(UnknownValues.Selection));
                    selectionIndex = objWithSelectionIndex[UnknownValues.Selection];
                }
                else {
                    configurationObject[key][UnknownValues.Selection] = configurationObject[key][UnknownValues.Selection] ?? 0;
                    selectionIndex = configurationObject[key][UnknownValues.Selection];
                }
                if (!selection.length) {
                    return;
                }
                selection = ["Choose", ...selection];
                advancedForm.dropdown({ translate: `ConfigurationForm.${id}.${key}.name`, with: ["\n"] }, selection, selectionIndex);
            }
            else {
                const hasLoadedSlide = value.hasOwnProperty(UnknownValues.Slide);
                let currentSlide;
                if (hasLoadedSlide) {
                    currentSlide = value[UnknownValues.Slide];
                }
                else {
                    configurationObject[key][UnknownValues.Slide] = configurationObject[key][UnknownValues.Slide] ?? Math.round((value.from + value.to) / 2);
                    currentSlide = configurationObject[key][UnknownValues.Slide];
                }
                advancedForm.slider({ translate: `ConfigurationForm.${id}.${key}.name`, with: ["\n"] }, value.from, value.to, 1, currentSlide);
            }
        });
        advancedForm.toggle({ translate: `ConfigurationForm.${id}.misc.back.text`, with: ["\n"] }, false);
        forceShow(player, advancedForm).then((result) => {
            if (result.canceled)
                return player.sendMessage('Ui closed!');
            const length = result.formValues.length;
            const shouldBack = result.formValues[length - 1] === true;
            result.formValues.forEach((value, formIndex) => {
                const isLastElement = formIndex === length - 1;
                if (isLastElement && shouldBack)
                    return ConfigUI.main(id, player);
                if (isLastElement)
                    return;
                const formValues = configurationObject[formKeys[formIndex].key];
                if (formValues.hasOwnProperty("selection")) {
                    formValues[UnknownValues.Selection] = value;
                }
                else {
                    formValues[UnknownValues.Slide] = value;
                }
                configDB.set(configDBSchema(player.id), configurationObject);
            });
        });
    }
};
export { isTorchIncluded, forceSetPermutation, forceShow, ConfigUI, };
