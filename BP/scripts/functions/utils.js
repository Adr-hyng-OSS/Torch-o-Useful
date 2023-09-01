import { system } from "@minecraft/server";
import { includeCustomTorch, excludeCustomTorch } from "../packages";
import { FormCancelationReason } from "@minecraft/server-ui";
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
export { isTorchIncluded, forceSetPermutation, forceShow };
