import { EntityEquipmentInventoryComponent, EquipmentSlot, ItemStack } from "@minecraft/server";
function stackDistribution(number, groupSize = 64) {
    const fullGroupsCount = Math.floor(number / groupSize);
    const remainder = number % groupSize;
    const groups = new Array(fullGroupsCount).fill(groupSize);
    if (remainder > 0) {
        groups.push(remainder);
    }
    return groups;
}
class CContainer {
    constructor(inventory) {
        this._inventory = inventory;
    }
    setPlayer(newHolder) {
        this._holder = newHolder;
        return this;
    }
    get inventory() {
        return this._inventory;
    }
    set inventory(newInventory) {
        this._inventory = newInventory;
    }
    clearItem(itemId, decrement) {
        const clearSlots = [];
        const equipment = this._holder.getComponent(EntityEquipmentInventoryComponent.componentId);
        const offhand = equipment.getEquipment(EquipmentSlot.offhand);
        for (let i = 0; i < this.inventory.size; i++) {
            let item = this.inventory.getItem(i);
            if (item?.typeId !== itemId)
                continue;
            if (decrement - item.amount > 0) {
                decrement -= item.amount;
                clearSlots.push(i);
                continue;
            }
            ;
            clearSlots.forEach(s => this.inventory.setItem(s));
            if (decrement - item.amount === 0) {
                this.inventory.setItem(i);
                return true;
            }
            ;
            item.amount -= decrement;
            this.inventory.setItem(i, item);
            return true;
        }
        ;
        if (offhand?.typeId === itemId) {
            if (offhand?.amount - decrement === 0) {
                equipment.setEquipment(EquipmentSlot.offhand, undefined);
                return true;
            }
            if (offhand?.amount - decrement > 0) {
                offhand.amount -= decrement;
                equipment.setEquipment(EquipmentSlot.offhand, offhand);
                return true;
            }
        }
        return false;
    }
    ;
    addItem(itemTypeToAdd, amount) {
        if (!amount)
            return;
        const item = new ItemStack(itemTypeToAdd);
        let exceededAmount = 0;
        if (amount > item.maxAmount) {
            const groupStacks = stackDistribution(amount, item.maxAmount);
            groupStacks.forEach(stack => {
                item.amount = stack;
                exceededAmount += this.inventory.addItem(item)?.amount ?? 0;
            });
        }
        else {
            item.amount = amount;
            exceededAmount = this.inventory.addItem(item)?.amount ?? exceededAmount;
        }
        if (!exceededAmount)
            return;
        this._holder.dimension.spawnItem(new ItemStack(itemTypeToAdd, exceededAmount), this._holder.location);
    }
    getItemAmount(itemToCheck) {
        let itemAmount = 0;
        for (let i = 0; i < this.inventory.size; i++) {
            let item = this.inventory.getItem(i);
            if (!item)
                continue;
            if (item.type !== itemToCheck)
                continue;
            itemAmount += item.amount;
        }
        return itemAmount;
    }
    ;
}
export { CContainer };
