import { system } from "@minecraft/server";
import { FormCancelationReason } from "@minecraft/server-ui";
async function forceShow(player, form, timeout = Infinity) {
    const startTick = system.currentTick;
    while ((system.currentTick - startTick) < timeout) {
        const response = await (form.show(player)).catch(er => console.error(er, er.stack));
        if (response.cancelationReason !== FormCancelationReason.userBusy) {
            return response;
        }
    }
    ;
    throw new Error(`Timed out after ${timeout} ticks`);
}
;
export { forceShow };
